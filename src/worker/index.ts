import { Hono } from "hono";
import { LEGAL_VERSION } from "../shared/legal";
import type { Context } from "hono";
import type { Decision } from "../shared/contracts";
import {
  approvalCertificateEmail,
  declineNoticeEmail,
  recipientRequestEmail,
  senderVerificationEmail,
} from "./email-templates";
import { emailErrorCode, sendMessage } from "./email";
import {
  beginRecipientDelivery,
  completeRecipientDelivery,
  completeResultDelivery,
  failRecipientDelivery,
  failResultDelivery,
  getByActionHash,
  getByManagementHash,
  getByReportHash,
  insertRequest,
  recordDecision,
  requestCountForEmail,
  toPublicRequest,
  type RequestRow,
} from "./repository";
import {
  createConfirmationProof,
  decryptString,
  encryptString,
  hmacHex,
  maskEmail,
  randomToken,
  sha256,
  verifyConfirmationProof,
} from "./security";
import { verifyTurnstile } from "./turnstile";
import {
  parseCreateRequestInput,
  parseProof,
  parseReportReason,
} from "./validation";

type AppBindings = { Bindings: Env };
type AppContext = Context<AppBindings>;

const MAX_JSON_BYTES = 20_000;
const app = new Hono<AppBindings>();

function apiError(
  context: AppContext,
  status: 400 | 403 | 404 | 409 | 410 | 413 | 429 | 500 | 502,
  code: string,
  error: string,
): Response {
  return context.json({ code, error }, status);
}

function redactedRoute(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== "api") {
    return "/other";
  }
  if (
    ["verify", "manage", "respond", "report"].includes(segments[1] ?? "")
  ) {
    return `/${["api", segments[1], ":token", segments[3]].filter(Boolean).join("/")}`;
  }
  return `/${segments.slice(0, 2).join("/")}`;
}

async function readBoundedJson(request: Request): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null && Number(contentLength) > MAX_JSON_BYTES) {
    throw new RangeError("payload_too_large");
  }
  if (request.body === null) {
    return null;
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  while (true) {
    const result = await reader.read();
    if (result.done) {
      break;
    }
    byteLength += result.value.byteLength;
    if (byteLength > MAX_JSON_BYTES) {
      await reader.cancel();
      throw new RangeError("payload_too_large");
    }
    chunks.push(result.value);
  }

  const body = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(body)) as unknown;
  } catch {
    throw new SyntaxError("invalid_json");
  }
}

function isExpired(row: RequestRow, now = Date.now()): boolean {
  return row.expires_at <= now;
}

function requestEmailData(row: RequestRow) {
  return {
    publicId: row.public_id,
    requesterName: row.requester_name,
    recipientName: row.recipient_name,
    requestTitle: row.request_title,
    justification: row.justification,
    expiresAt: row.expires_at,
  };
}

async function deliverRecipientRequest(
  env: Env,
  row: RequestRow,
): Promise<{ ok: true } | { ok: false; code: string }> {
  try {
    const [recipientEmail, approveToken, declineToken, reportToken] =
      await Promise.all([
        decryptString(row.recipient_email_ciphertext, env.DATA_ENCRYPTION_KEY),
        decryptString(row.approve_token_ciphertext, env.DATA_ENCRYPTION_KEY),
        decryptString(row.decline_token_ciphertext, env.DATA_ENCRYPTION_KEY),
        decryptString(row.report_token_ciphertext, env.DATA_ENCRYPTION_KEY),
      ]);
    const content = recipientRequestEmail(requestEmailData(row), {
      approveUrl: `${env.APP_BASE_URL}/respond/${approveToken}`,
      declineUrl: `${env.APP_BASE_URL}/respond/${declineToken}`,
      reportUrl: `${env.APP_BASE_URL}/report/${reportToken}`,
    });
    const messageId = await sendMessage(env, {
      requestId: row.id,
      kind: "recipient_request",
      to: recipientEmail,
      from: env.EMAIL_FROM,
      content,
    });
    await completeRecipientDelivery(env.DB, row.id, messageId, Date.now());
    return { ok: true };
  } catch (error) {
    const code = emailErrorCode(error);
    await failRecipientDelivery(env.DB, row.id, code);
    console.error(
      JSON.stringify({
        event: "recipient_email_failed",
        requestId: row.public_id,
        code,
      }),
    );
    return { ok: false, code };
  }
}

async function deliverSenderResult(
  env: Env,
  row: RequestRow,
  decision: Decision,
  decidedAt: number,
): Promise<{ ok: true } | { ok: false; code: string }> {
  try {
    const [senderEmail, managementToken] = await Promise.all([
      decryptString(row.sender_email_ciphertext, env.DATA_ENCRYPTION_KEY),
      decryptString(row.management_token_ciphertext, env.DATA_ENCRYPTION_KEY),
    ]);
    const manageUrl = `${env.APP_BASE_URL}/manage/${managementToken}`;
    const content =
      decision === "approved"
        ? approvalCertificateEmail(requestEmailData(row), decidedAt, manageUrl)
        : declineNoticeEmail(requestEmailData(row), decidedAt, manageUrl);
    const messageId = await sendMessage(env, {
      requestId: row.id,
      kind: decision === "approved" ? "approval_certificate" : "decline_notice",
      to: senderEmail,
      from: env.EMAIL_FROM,
      content,
    });
    await completeResultDelivery(env.DB, row.id, messageId, Date.now());
    return { ok: true };
  } catch (error) {
    const code = emailErrorCode(error);
    await failResultDelivery(env.DB, row.id, code);
    console.error(
      JSON.stringify({
        event: "sender_result_email_failed",
        requestId: row.public_id,
        code,
      }),
    );
    return { ok: false, code };
  }
}

app.use("/api/*", async (context, next) => {
  await next();
  context.header("Cache-Control", "no-store");
  context.header("X-Content-Type-Options", "nosniff");
  context.header("X-Robots-Tag", "noindex, nofollow, noarchive");
  context.header("Referrer-Policy", "no-referrer");
});

app.get("/api/config", (context) =>
  context.json({ turnstileSiteKey: context.env.TURNSTILE_SITE_KEY }),
);

app.post("/api/requests", async (context) => {
  let body: unknown;
  try {
    body = await readBoundedJson(context.req.raw);
  } catch (error) {
    return error instanceof RangeError
      ? apiError(context, 413, "payload_too_large", "The request is too large.")
      : apiError(context, 400, "invalid_json", "The request body is invalid.");
  }

  const parsed = parseCreateRequestInput(body);
  if (!parsed.ok) {
    return apiError(context, 400, "invalid_request", parsed.error);
  }

  const turnstileValid = await verifyTurnstile(
    parsed.value.turnstileToken,
    context.req.header("CF-Connecting-IP"),
    context.env,
  );
  if (!turnstileValid) {
    return apiError(
      context,
      403,
      "turnstile_failed",
      "The anti-bot check expired or could not be verified. Please try again.",
    );
  }

  const [senderEmailHmac, recipientEmailHmac] = await Promise.all([
    hmacHex(parsed.value.senderEmail, context.env.EMAIL_HMAC_KEY),
    hmacHex(parsed.value.recipientEmail, context.env.EMAIL_HMAC_KEY),
  ]);
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const [senderCount, recipientCount] = await Promise.all([
    requestCountForEmail(context.env.DB, "sender_email_hmac", senderEmailHmac, since),
    requestCountForEmail(
      context.env.DB,
      "recipient_email_hmac",
      recipientEmailHmac,
      since,
    ),
  ]);
  if (senderCount >= 8 || recipientCount >= 3) {
    return apiError(
      context,
      429,
      "rate_limited",
      "That address has reached today’s request limit. Please try again tomorrow.",
    );
  }

  const id = crypto.randomUUID();
  const publicId = `PG-${id.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
  const managementToken = randomToken();
  const approveToken = randomToken();
  const declineToken = randomToken();
  const reportToken = randomToken();
  const now = Date.now();
  const ttlDays = Math.min(Math.max(Number(context.env.REQUEST_TTL_DAYS), 1), 90);
  const expiresAt = now + ttlDays * 24 * 60 * 60 * 1000;

  const [
    managementTokenHash,
    managementTokenCiphertext,
    approveTokenHash,
    approveTokenCiphertext,
    declineTokenHash,
    declineTokenCiphertext,
    reportTokenHash,
    reportTokenCiphertext,
    senderEmailCiphertext,
    recipientEmailCiphertext,
  ] = await Promise.all([
    sha256(managementToken),
    encryptString(managementToken, context.env.DATA_ENCRYPTION_KEY),
    sha256(approveToken),
    encryptString(approveToken, context.env.DATA_ENCRYPTION_KEY),
    sha256(declineToken),
    encryptString(declineToken, context.env.DATA_ENCRYPTION_KEY),
    sha256(reportToken),
    encryptString(reportToken, context.env.DATA_ENCRYPTION_KEY),
    encryptString(parsed.value.senderEmail, context.env.DATA_ENCRYPTION_KEY),
    encryptString(parsed.value.recipientEmail, context.env.DATA_ENCRYPTION_KEY),
  ]);

  await insertRequest(context.env.DB, {
    id,
    publicId,
    managementTokenHash,
    managementTokenCiphertext,
    approveTokenHash,
    approveTokenCiphertext,
    declineTokenHash,
    declineTokenCiphertext,
    reportTokenHash,
    reportTokenCiphertext,
    senderEmailCiphertext,
    senderEmailHmac,
    recipientEmailCiphertext,
    recipientEmailHmac,
    requesterName: parsed.value.requesterName,
    recipientName: parsed.value.recipientName,
    requestTitle: parsed.value.requestTitle,
    justification: parsed.value.justification,
    termsVersion: LEGAL_VERSION,
    privacyVersion: LEGAL_VERSION,
    termsAcceptedAt: now,
    createdAt: now,
    expiresAt,
  });

  const verifyUrl = `${context.env.APP_BASE_URL}/verify/${managementToken}`;
  const verification = senderVerificationEmail(
    {
      publicId,
      requesterName: parsed.value.requesterName,
      recipientName: parsed.value.recipientName,
      requestTitle: parsed.value.requestTitle,
      justification: parsed.value.justification,
      expiresAt,
    },
    verifyUrl,
  );

  try {
    await sendMessage(context.env, {
      requestId: id,
      kind: "sender_verification",
      to: parsed.value.senderEmail,
      from: context.env.EMAIL_FROM,
      content: verification,
    });
  } catch (error) {
    await context.env.DB.prepare("DELETE FROM requests WHERE id = ?").bind(id).run();
    const code = emailErrorCode(error);
    console.error(JSON.stringify({ event: "verification_email_failed", requestId: publicId, code }));
    return apiError(
      context,
      502,
      "verification_email_failed",
      "We could not send the verification email. Check the address and try again.",
    );
  }

  return context.json({
    ok: true,
    senderEmailMasked: maskEmail(parsed.value.senderEmail),
    previewUrl: String(context.env.EMAIL_MODE) === "preview" ? verifyUrl : undefined,
  });
});

app.get("/api/verify/:token", async (context) => {
  const tokenHash = await sha256(context.req.param("token"));
  const row = await getByManagementHash(context.env.DB, tokenHash);
  if (row === null) {
    return apiError(context, 404, "not_found", "This request link is not available.");
  }
  if (row.status === "disabled") {
    return apiError(context, 410, "disabled", "This request has been disabled.");
  }
  if (isExpired(row)) {
    return apiError(context, 410, "expired", "This request has expired.");
  }

  const [senderEmail, recipientEmail, confirmationProof] = await Promise.all([
    decryptString(row.sender_email_ciphertext, context.env.DATA_ENCRYPTION_KEY),
    decryptString(row.recipient_email_ciphertext, context.env.DATA_ENCRYPTION_KEY),
    createConfirmationProof(
      tokenHash,
      "verify",
      context.env.CONFIRMATION_HMAC_KEY,
    ),
  ]);

  return context.json({
    request: toPublicRequest(row),
    confirmationProof,
    senderEmailMasked: maskEmail(senderEmail),
    recipientEmailMasked: maskEmail(recipientEmail),
    recipientEmailStatus: row.recipient_email_status,
  });
});

app.post("/api/verify/:token", async (context) => {
  const tokenHash = await sha256(context.req.param("token"));
  const row = await getByManagementHash(context.env.DB, tokenHash);
  if (row === null) {
    return apiError(context, 404, "not_found", "This request link is not available.");
  }
  if (row.status === "disabled" || isExpired(row)) {
    return apiError(context, 410, "unavailable", "This request is no longer available.");
  }

  let body: unknown;
  try {
    body = await readBoundedJson(context.req.raw);
  } catch {
    return apiError(context, 400, "invalid_json", "The confirmation is invalid.");
  }
  const proof = parseProof(body);
  const proofValid =
    proof !== null &&
    (await verifyConfirmationProof(
      proof,
      tokenHash,
      "verify",
      context.env.CONFIRMATION_HMAC_KEY,
    ));
  if (!proofValid) {
    return apiError(context, 403, "confirmation_expired", "Reload the page and confirm again.");
  }

  if (
    row.status !== "awaiting_sender_verification" &&
    row.status !== "recipient_email_failed"
  ) {
    return context.json({
      request: toPublicRequest(row),
      recipientEmailStatus: row.recipient_email_status,
      alreadyProcessed: true,
    });
  }

  const started = await beginRecipientDelivery(context.env.DB, row.id, Date.now());
  if (!started) {
    const current = await getByManagementHash(context.env.DB, tokenHash);
    return context.json({
      request: toPublicRequest(current ?? row),
      recipientEmailStatus: current?.recipient_email_status ?? row.recipient_email_status,
      alreadyProcessed: true,
    });
  }

  const delivery = await deliverRecipientRequest(context.env, row);
  if (!delivery.ok) {
    return apiError(
      context,
      502,
      "recipient_email_failed",
      "The request was verified, but the recipient email could not be sent. You can retry from this page.",
    );
  }

  const current = await getByManagementHash(context.env.DB, tokenHash);
  return context.json({
    request: toPublicRequest(current ?? { ...row, status: "pending" }),
    recipientEmailStatus: "sent",
    manageUrl: `${context.env.APP_BASE_URL}/manage/${context.req.param("token")}`,
  });
});

app.get("/api/manage/:token", async (context) => {
  const tokenHash = await sha256(context.req.param("token"));
  const row = await getByManagementHash(context.env.DB, tokenHash);
  if (row === null) {
    return apiError(context, 404, "not_found", "This management link is not available.");
  }
  const [senderEmail, recipientEmail, confirmationProof] = await Promise.all([
    decryptString(row.sender_email_ciphertext, context.env.DATA_ENCRYPTION_KEY),
    decryptString(row.recipient_email_ciphertext, context.env.DATA_ENCRYPTION_KEY),
    createConfirmationProof(
      tokenHash,
      "manage",
      context.env.CONFIRMATION_HMAC_KEY,
    ),
  ]);
  return context.json({
    request: toPublicRequest(row),
    confirmationProof,
    senderEmailMasked: maskEmail(senderEmail),
    recipientEmailMasked: maskEmail(recipientEmail),
    recipientEmailStatus: row.recipient_email_status,
    senderResultEmailStatus: row.sender_result_email_status,
  });
});

app.post("/api/manage/:token/resend-recipient", async (context) => {
  const tokenHash = await sha256(context.req.param("token"));
  const row = await getByManagementHash(context.env.DB, tokenHash);
  if (row === null) {
    return apiError(context, 404, "not_found", "This management link is not available.");
  }
  const body = await readBoundedJson(context.req.raw);
  const proof = parseProof(body);
  if (
    proof === null ||
    !(await verifyConfirmationProof(
      proof,
      tokenHash,
      "manage",
      context.env.CONFIRMATION_HMAC_KEY,
    ))
  ) {
    return apiError(context, 403, "confirmation_expired", "Reload the page and try again.");
  }
  if (row.status !== "recipient_email_failed") {
    return apiError(context, 409, "invalid_state", "The recipient email cannot be resent.");
  }
  const started = await beginRecipientDelivery(context.env.DB, row.id, Date.now());
  if (!started) {
    return apiError(context, 409, "already_processing", "The email is already being processed.");
  }
  const delivery = await deliverRecipientRequest(context.env, row);
  return delivery.ok
    ? context.json({ ok: true })
    : apiError(context, 502, "recipient_email_failed", "The email could not be sent.");
});

app.post("/api/manage/:token/resend-result", async (context) => {
  const tokenHash = await sha256(context.req.param("token"));
  const row = await getByManagementHash(context.env.DB, tokenHash);
  if (row === null) {
    return apiError(context, 404, "not_found", "This management link is not available.");
  }
  const body = await readBoundedJson(context.req.raw);
  const proof = parseProof(body);
  if (
    proof === null ||
    !(await verifyConfirmationProof(
      proof,
      tokenHash,
      "manage",
      context.env.CONFIRMATION_HMAC_KEY,
    ))
  ) {
    return apiError(context, 403, "confirmation_expired", "Reload the page and try again.");
  }
  if (
    (row.status !== "approved" && row.status !== "declined") ||
    row.sender_result_email_status !== "failed" ||
    row.decided_at === null
  ) {
    return apiError(context, 409, "invalid_state", "The result email cannot be resent.");
  }
  await context.env.DB.prepare(
    "UPDATE requests SET sender_result_email_status = 'sending' WHERE id = ?",
  )
    .bind(row.id)
    .run();
  const delivery = await deliverSenderResult(
    context.env,
    row,
    row.status,
    row.decided_at,
  );
  return delivery.ok
    ? context.json({ ok: true })
    : apiError(context, 502, "result_email_failed", "The result email could not be sent.");
});

app.post("/api/manage/:token/disable", async (context) => {
  const tokenHash = await sha256(context.req.param("token"));
  const row = await getByManagementHash(context.env.DB, tokenHash);
  if (row === null) {
    return apiError(context, 404, "not_found", "This management link is not available.");
  }
  const body = await readBoundedJson(context.req.raw);
  const proof = parseProof(body);
  if (
    proof === null ||
    !(await verifyConfirmationProof(
      proof,
      tokenHash,
      "manage",
      context.env.CONFIRMATION_HMAC_KEY,
    ))
  ) {
    return apiError(context, 403, "confirmation_expired", "Reload the page and try again.");
  }
  if (row.status === "approved" || row.status === "declined") {
    return apiError(context, 409, "already_decided", "A decided request cannot be disabled.");
  }
  await context.env.DB.prepare(
    "UPDATE requests SET status = 'disabled', disabled_at = ? WHERE id = ?",
  )
    .bind(Date.now(), row.id)
    .run();
  return context.json({ ok: true });
});

app.get("/api/respond/:token", async (context) => {
  const tokenHash = await sha256(context.req.param("token"));
  const action = await getByActionHash(context.env.DB, tokenHash);
  if (action === null) {
    return apiError(context, 404, "not_found", "This decision link is not available.");
  }
  if (action.row.status === "disabled") {
    return apiError(context, 410, "disabled", "This request has been disabled.");
  }
  if (isExpired(action.row) && action.row.status === "pending") {
    return apiError(context, 410, "expired", "This request has expired.");
  }
  const confirmationProof = await createConfirmationProof(
    tokenHash,
    `respond:${action.decision}`,
    context.env.CONFIRMATION_HMAC_KEY,
  );
  return context.json({
    request: toPublicRequest(action.row),
    proposedDecision: action.decision,
    confirmationProof,
  });
});

app.post("/api/respond/:token", async (context) => {
  const tokenHash = await sha256(context.req.param("token"));
  const action = await getByActionHash(context.env.DB, tokenHash);
  if (action === null) {
    return apiError(context, 404, "not_found", "This decision link is not available.");
  }
  if (action.row.status === "disabled" || isExpired(action.row)) {
    return apiError(context, 410, "unavailable", "This request is no longer available.");
  }

  const body = await readBoundedJson(context.req.raw);
  const proof = parseProof(body);
  if (
    proof === null ||
    !(await verifyConfirmationProof(
      proof,
      tokenHash,
      `respond:${action.decision}`,
      context.env.CONFIRMATION_HMAC_KEY,
    ))
  ) {
    return apiError(context, 403, "confirmation_expired", "Reload the page and confirm again.");
  }

  if (action.row.status === "approved" || action.row.status === "declined") {
    return context.json({
      request: toPublicRequest(action.row),
      senderResultEmailStatus: action.row.sender_result_email_status,
      alreadyProcessed: true,
    });
  }

  const decidedAt = Date.now();
  const recorded = await recordDecision(
    context.env.DB,
    action.row.id,
    action.decision,
    decidedAt,
  );
  if (!recorded) {
    const current = await getByActionHash(context.env.DB, tokenHash);
    return current === null
      ? apiError(context, 409, "decision_conflict", "This request already has a decision.")
      : context.json({
          request: toPublicRequest(current.row),
          senderResultEmailStatus: current.row.sender_result_email_status,
          alreadyProcessed: true,
        });
  }

  const delivery = await deliverSenderResult(
    context.env,
    action.row,
    action.decision,
    decidedAt,
  );
  return context.json({
    request: {
      ...toPublicRequest(action.row),
      status: action.decision,
      decidedAt,
    },
    senderResultEmailStatus: delivery.ok ? "sent" : "failed",
  });
});

app.get("/api/report/:token", async (context) => {
  const tokenHash = await sha256(context.req.param("token"));
  const row = await getByReportHash(context.env.DB, tokenHash);
  if (row === null) {
    return apiError(context, 404, "not_found", "This report link is not available.");
  }
  const confirmationProof = await createConfirmationProof(
    tokenHash,
    "report",
    context.env.CONFIRMATION_HMAC_KEY,
  );
  return context.json({
    request: toPublicRequest(row),
    confirmationProof,
  });
});

app.post("/api/report/:token", async (context) => {
  const tokenHash = await sha256(context.req.param("token"));
  const row = await getByReportHash(context.env.DB, tokenHash);
  if (row === null) {
    return apiError(context, 404, "not_found", "This report link is not available.");
  }
  const body = await readBoundedJson(context.req.raw);
  const proof = parseProof(body);
  const reason = parseReportReason(body);
  if (
    proof === null ||
    !(await verifyConfirmationProof(
      proof,
      tokenHash,
      "report",
      context.env.CONFIRMATION_HMAC_KEY,
    ))
  ) {
    return apiError(context, 403, "confirmation_expired", "Reload the page and try again.");
  }
  if (reason === null) {
    return apiError(context, 400, "invalid_reason", "Tell us briefly what is wrong.");
  }

  await context.env.DB.batch([
    context.env.DB
      .prepare(
        "INSERT INTO reports (id, request_id, reason, created_at) VALUES (?, ?, ?, ?)",
      )
      .bind(crypto.randomUUID(), row.id, reason, Date.now()),
    context.env.DB
      .prepare(
        `UPDATE requests
         SET status = CASE
           WHEN status IN ('approved', 'declined') THEN status
           ELSE 'disabled'
         END,
         disabled_at = CASE
           WHEN status IN ('approved', 'declined') THEN disabled_at
           ELSE ?
         END
         WHERE id = ?`,
      )
      .bind(Date.now(), row.id),
  ]);
  return context.json({ ok: true });
});

app.get("/api/manage/:token/previews", async (context) => {
  if (String(context.env.EMAIL_MODE) !== "preview") {
    return apiError(context, 404, "not_found", "Email previews are unavailable.");
  }
  const tokenHash = await sha256(context.req.param("token"));
  const row = await getByManagementHash(context.env.DB, tokenHash);
  if (row === null) {
    return apiError(context, 404, "not_found", "This management link is not available.");
  }
  const previews = await context.env.DB.prepare(
    `SELECT id, kind, recipient_masked, subject, html, text, created_at
     FROM email_previews WHERE request_id = ? ORDER BY created_at DESC`,
  )
    .bind(row.id)
    .all();
  return context.json({ previews: previews.results });
});

app.notFound((context) =>
  apiError(context, 404, "not_found", "The requested API route does not exist."),
);

app.onError((error, context) => {
  console.error(
    JSON.stringify({
      event: "unhandled_request_error",
      route: redactedRoute(new URL(context.req.url).pathname),
      error: error instanceof Error ? error.message : "Unknown error",
    }),
  );
  return apiError(context, 500, "internal_error", "Something went wrong.");
});

export default {
  fetch: app.fetch,
  async scheduled(_controller, env): Promise<void> {
    const now = Date.now();
    const finalRetentionCutoff = now - 90 * 24 * 60 * 60 * 1000;
    await env.DB.batch([
      env.DB
        .prepare(
          `DELETE FROM email_previews
           WHERE request_id IN (
             SELECT id FROM requests
             WHERE expires_at < ? OR (decided_at IS NOT NULL AND decided_at < ?)
           )`,
        )
        .bind(now, finalRetentionCutoff),
      env.DB
        .prepare(
          `DELETE FROM reports
           WHERE request_id IN (
             SELECT id FROM requests
             WHERE expires_at < ? OR (decided_at IS NOT NULL AND decided_at < ?)
           )`,
        )
        .bind(now, finalRetentionCutoff),
      env.DB
        .prepare(
          `DELETE FROM requests
           WHERE expires_at < ? OR (decided_at IS NOT NULL AND decided_at < ?)`,
        )
        .bind(now, finalRetentionCutoff),
    ]);
  },
} satisfies ExportedHandler<Env>;
