import type { EmailContent } from "./email-templates";
import { maskEmail } from "./security";

export type EmailKind =
  | "sender_verification"
  | "recipient_request"
  | "approval_certificate"
  | "decline_notice";

interface SendMessageOptions {
  requestId: string;
  kind: EmailKind;
  to: string;
  from: string;
  content: EmailContent;
}

export async function sendMessage(
  env: Env,
  options: SendMessageOptions,
): Promise<string> {
  if (String(env.EMAIL_MODE) === "preview") {
    const previewId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO email_previews (
        id, request_id, kind, recipient_masked, subject, html, text, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        previewId,
        options.requestId,
        options.kind,
        maskEmail(options.to),
        options.content.subject,
        options.content.html,
        options.content.text,
        Date.now(),
      )
      .run();
    return `preview-${previewId}`;
  }

  const response = await env.EMAIL.send({
    to: options.to,
    from: { email: options.from, name: "Permission Granted" },
    replyTo: {
      email: env.SUPPORT_EMAIL,
      name: "Permission Granted Support",
    },
    subject: options.content.subject,
    html: options.content.html,
    text: options.content.text,
    headers: {
      "Auto-Submitted": "auto-generated",
      "X-Entity-Ref-ID": options.requestId,
    },
  });
  return response.messageId;
}

export function emailErrorCode(error: unknown): string {
  if (
    error instanceof Error &&
    "code" in error &&
    typeof (error as Error & { code?: unknown }).code === "string"
  ) {
    return (error as Error & { code: string }).code.slice(0, 80);
  }
  return "E_UNKNOWN";
}
