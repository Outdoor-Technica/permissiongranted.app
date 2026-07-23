import "@fontsource/fraunces/latin-600.css";
import "@fontsource/fraunces/latin-700.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import type {
  ApiError,
  ConfirmationResponse,
  PublicRequest,
} from "../shared/contracts";
import {
  cookieNotice,
  LEGAL_VERSION,
  type LegalDocument,
  privacyNotice,
  termsOfService,
} from "./legal-content";
import { hasTurnstileRender } from "./turnstile-loader";
import "./styles.css";

interface TurnstileApi {
  render(
    container: string | HTMLElement,
    options: {
      sitekey: string;
      action: string;
      theme: "light";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ): string;
  reset(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

function getAppRoot(): HTMLDivElement {
  const element = document.querySelector<HTMLDivElement>("#app");
  if (element === null) {
    throw new Error("App root is missing.");
  }
  return element;
}
const app = getAppRoot();

const logo = `
  <span class="brand-seal" aria-hidden="true"><span>✓</span></span>
  <span class="brand-name">Permission<br>Granted</span>
`;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(timestamp));
}

function header(privatePage = false): string {
  return `
    <header class="site-header ${privatePage ? "site-header--private" : ""}">
      <a class="brand" href="/" data-link aria-label="Permission Granted home">${logo}</a>
      ${
        privatePage
          ? `<span class="private-label">PRIVATE REQUEST</span>`
          : `<nav aria-label="Primary">
              <a href="/how-it-works" data-link>How it works</a>
              <a href="/templates" data-link>Templates</a>
              <a href="/safety" data-link>Safety</a>
              <a class="button button--small button--outline" href="/create" data-link>Draft a request</a>
            </nav>`
      }
    </header>`;
}

function footer(): string {
  return `
    <footer class="site-footer">
      <div class="footer-brand">${logo}</div>
      <p>Official-ish documentation for entirely unofficial decisions.</p>
      <div class="footer-links">
        <a href="/safety" data-link>Safety</a>
        <a href="/privacy" data-link>Privacy</a>
        <a href="/terms" data-link>Terms</a>
        <a href="/cookies" data-link>Cookies</a>
      </div>
    </footer>`;
}

function requestSheet(
  request: Pick<
    PublicRequest,
    "publicId" | "requesterName" | "recipientName" | "requestTitle" | "justification"
  >,
  options: { status?: string; stamp?: string } = {},
): string {
  return `
    <article class="request-sheet">
      <span class="paperclip" aria-hidden="true"></span>
      <div class="request-sheet__meta">
        <span>REQUEST ID&nbsp; ${escapeHtml(request.publicId)}</span>
        <span>${escapeHtml(options.status ?? "AWAITING REVIEW")}</span>
      </div>
      <dl class="request-fields">
        <div><dt>FROM</dt><dd>${escapeHtml(request.requesterName)}</dd></div>
        <div><dt>TO</dt><dd>${escapeHtml(request.recipientName)}</dd></div>
        <div><dt>REQUEST</dt><dd>${escapeHtml(request.requestTitle)}</dd></div>
        <div><dt>REASON</dt><dd>${escapeHtml(request.justification)}</dd></div>
      </dl>
      ${
        options.stamp
          ? `<div class="result-stamp result-stamp--${options.stamp === "DECLINED" ? "declined" : "approved"}">${escapeHtml(options.stamp)}</div>`
          : ""
      }
    </article>`;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const result: unknown = await response.json();
  if (!response.ok) {
    const error =
      typeof result === "object" &&
      result !== null &&
      "error" in result &&
      typeof (result as ApiError).error === "string"
        ? (result as ApiError).error
        : "Something went wrong.";
    throw new Error(error);
  }
  return result as T;
}

function navigate(path: string): void {
  history.pushState({}, "", path);
  renderRoute();
  window.scrollTo({ top: 0, behavior: "instant" });
}

function bindNavigation(): void {
  document.querySelectorAll<HTMLAnchorElement>("a[data-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      event.preventDefault();
      navigate(link.pathname);
    });
  });
}

function setPage(html: string, title: string): void {
  app.innerHTML = html;
  document.title = `${title} — Permission Granted`;
  bindNavigation();
}

function renderHome(): void {
  setPage(
    `
    <div class="page-shell">
      ${header()}
      <main id="main">
        <section class="hero">
          <div class="hero__copy">
            <p class="eyebrow">OFFICIAL-ISH REQUESTS</p>
            <h1>Put that request<br>in writing.</h1>
            <p class="hero__lede">Create a playful permission request. We’ll email it privately. Await the verdict.</p>
            <div class="button-row">
              <a class="button button--primary" href="/create" data-link>Draft a request</a>
              <a class="text-link" href="/how-it-works" data-link><span class="text-link__label">See how it works</span><span class="text-link__arrow" aria-hidden="true">→</span></a>
            </div>
          </div>
          <div class="hero__specimen" aria-label="Example request">
            ${requestSheet({
              publicId: "PG-00482",
              requesterName: "Alex",
              recipientName: "Sam",
              requestTitle: "Permission to buy another motorbike",
              justification: "The garage has room if we measure creatively.",
            })}
            <span class="specimen-note">A persuasive filing.</span>
          </div>
        </section>
        <section class="steps" aria-labelledby="steps-title">
          <h2 id="steps-title" class="visually-hidden">How it works</h2>
          <article><span>01</span><div><h3>Draft the case</h3><p>Names, request, reason, and two email addresses.</p></div></article>
          <article><span>02</span><div><h3>Confirm and send</h3><p>Verify your address before anything reaches the recipient.</p></div></article>
          <article><span>03</span><div><h3>Receive the verdict</h3><p>Approval arrives as a highly unofficial certificate.</p></div></article>
        </section>
        <section class="trust-strip">
          <p class="eyebrow">A SMALL BUT IMPORTANT FILE NOTE</p>
          <h2>The joke is the paperwork.<br>The decision is always theirs.</h2>
          <p>Approve and Decline are equally prominent. Email clicks never record a decision. No open tracking, no public requests, no pretending to be Google.</p>
          <a class="text-link" href="/safety" data-link><span class="text-link__label">Read the safety policy</span><span class="text-link__arrow" aria-hidden="true">→</span></a>
        </section>
      </main>
      ${footer()}
    </div>`,
    "Put that request in writing",
  );
}

function createPreviewMarkup(values: {
  requesterName: string;
  recipientName: string;
  requestTitle: string;
  justification: string;
}): string {
  return requestSheet({
    publicId: "DRAFT",
    requesterName: values.requesterName || "Your name",
    recipientName: values.recipientName || "Their name",
    requestTitle: values.requestTitle || "Your carefully considered request",
    justification: values.justification || "Your compelling supporting argument.",
  });
}

async function loadTurnstile(
  siteKey: string,
  onToken: (token: string) => void,
): Promise<string> {
  if (!hasTurnstileRender(window.turnstile)) {
    throw new Error("Anti-bot check is unavailable.");
  }
  return window.turnstile.render("#turnstile", {
    sitekey: siteKey,
    action: "create_request",
    theme: "light",
    callback: onToken,
    "expired-callback": () => onToken(""),
    "error-callback": () => onToken(""),
  });
}

async function renderCreate(): Promise<void> {
  setPage(
    `
    <div class="page-shell">
      ${header()}
      <main id="main" class="create-layout">
        <section class="create-form-wrap">
          <p class="eyebrow">DRAFT A REQUEST</p>
          <h1>Make your case.</h1>
          <p class="section-lede">A little context can go a long way.</p>
          <form id="request-form" class="request-form" novalidate>
            <fieldset>
              <legend><span>01</span> The people</legend>
              <div class="field-grid">
                <label>Your name<input name="requesterName" autocomplete="name" maxlength="60" required value="Alex"></label>
                <label>Their name<input name="recipientName" autocomplete="off" maxlength="60" required value="Sam"></label>
              </div>
              <label>Their email<input name="recipientEmail" type="email" autocomplete="off" maxlength="254" required placeholder="sam@example.com"></label>
            </fieldset>
            <fieldset>
              <legend><span>02</span> The request</legend>
              <label>What are you asking permission for?<input name="requestTitle" maxlength="100" required value="Buy another motorbike"></label>
            </fieldset>
            <fieldset>
              <legend><span>03</span> The case</legend>
              <label>Why should this be approved?<textarea name="justification" maxlength="400" required>The garage has room if we measure creatively.</textarea></label>
            </fieldset>
            <fieldset>
              <legend><span>04</span> Delivery and verification</legend>
              <label>Your email<input name="senderEmail" type="email" autocomplete="email" maxlength="254" required placeholder="alex@example.com"><span class="field-note">We verify you before emailing Sam.</span></label>
              <label class="check-label"><input name="acceptableUseAccepted" type="checkbox" required><span>I’m 18 or over, agree to the <a href="/terms" target="_blank">Terms</a>, acknowledge the <a href="/privacy" target="_blank">Privacy Notice</a>, and will send this only to someone who can reasonably expect it from me.</span></label>
              <div id="turnstile" class="turnstile-wrap" aria-label="Anti-bot check"></div>
            </fieldset>
            <div id="form-status" class="form-status" role="status" aria-live="polite"></div>
            <button class="button button--primary button--wide" type="submit">Email my verification link</button>
            <p class="privacy-note">⌑ We use these details to verify you, deliver the request, record the outcome, and prevent abuse. Requests expire after 30 days; decided records are kept for up to 90 days. No email open tracking. <a href="/privacy" target="_blank">Full privacy notice</a>.</p>
          </form>
        </section>
        <aside class="live-preview" aria-label="Live request preview">
          <p class="eyebrow">LIVE PREVIEW</p>
          <div id="request-preview">
            ${createPreviewMarkup({
              requesterName: "Alex",
              recipientName: "Sam",
              requestTitle: "Buy another motorbike",
              justification: "The garage has room if we measure creatively.",
            })}
          </div>
          <span class="preview-arrow">Updates as you type ↘</span>
        </aside>
      </main>
      ${footer()}
    </div>`,
    "Draft a request",
  );

  const form = document.querySelector<HTMLFormElement>("#request-form");
  const preview = document.querySelector<HTMLDivElement>("#request-preview");
  const status = document.querySelector<HTMLDivElement>("#form-status");
  if (form === null || preview === null || status === null) {
    return;
  }

  let turnstileToken = "";
  let turnstileWidgetId: string | null = null;
  try {
    const config = await api<{ turnstileSiteKey: string }>("/api/config");
    turnstileWidgetId = await loadTurnstile(
      config.turnstileSiteKey,
      (token) => {
        turnstileToken = token;
      },
    );
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Anti-bot check failed.";
    status.className = "form-status form-status--error";
  }

  const updatePreview = (): void => {
    const data = new FormData(form);
    preview.innerHTML = createPreviewMarkup({
      requesterName: String(data.get("requesterName") ?? ""),
      recipientName: String(data.get("recipientName") ?? ""),
      requestTitle: String(data.get("requestTitle") ?? ""),
      justification: String(data.get("justification") ?? ""),
    });
  };
  form.addEventListener("input", updatePreview);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    status.textContent = "";
    status.className = "form-status";
    if (!form.reportValidity()) {
      return;
    }
    if (turnstileToken.length === 0) {
      status.textContent = "Complete the anti-bot check.";
      status.className = "form-status form-status--error";
      return;
    }

    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    submit?.setAttribute("disabled", "");
    if (submit !== null) {
      submit.textContent = "Preparing the file…";
    }
    const data = new FormData(form);
    try {
      const response = await api<{
        ok: boolean;
        senderEmailMasked: string;
        previewUrl?: string;
      }>("/api/requests", {
        method: "POST",
        body: JSON.stringify({
          requesterName: data.get("requesterName"),
          recipientName: data.get("recipientName"),
          recipientEmail: data.get("recipientEmail"),
          requestTitle: data.get("requestTitle"),
          justification: data.get("justification"),
          senderEmail: data.get("senderEmail"),
          acceptableUseAccepted: data.get("acceptableUseAccepted") === "on",
          turnstileToken,
        }),
      });
      renderCheckEmail(response.senderEmailMasked, response.previewUrl);
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "The request could not be created.";
      status.className = "form-status form-status--error";
      submit?.removeAttribute("disabled");
      if (submit !== null) {
        submit.textContent = "Email my verification link";
      }
      if (turnstileWidgetId !== null && window.turnstile !== undefined) {
        window.turnstile.reset(turnstileWidgetId);
        turnstileToken = "";
      }
    }
  });
}

function renderCheckEmail(maskedEmail: string, previewUrl?: string): void {
  setPage(
    `
    <div class="page-shell">
      ${header(true)}
      <main id="main" class="private-main">
        <section class="receipt-panel">
          <span class="receipt-icon" aria-hidden="true">✉</span>
          <p class="eyebrow">DRAFT RECEIVED</p>
          <h1>Check your email.</h1>
          <p>We sent a verification link to <strong>${escapeHtml(maskedEmail)}</strong>.</p>
          <p>No request has been sent to the recipient yet.</p>
          ${
            previewUrl
              ? `<a class="button button--primary" href="${escapeHtml(previewUrl)}">Open local preview</a>`
              : ""
          }
          <a class="text-link" href="/create" data-link><span class="text-link__label">Draft a different request</span><span class="text-link__arrow" aria-hidden="true">→</span></a>
        </section>
      </main>
    </div>`,
    "Check your email",
  );
}

function loadingPage(label: string): void {
  setPage(
    `<div class="page-shell">${header(true)}<main id="main" class="private-main"><div class="loading-seal" aria-label="${escapeHtml(label)}">✓</div><p class="loading-copy">${escapeHtml(label)}</p></main></div>`,
    label,
  );
}

function privateError(title: string, message: string): void {
  setPage(
    `<div class="page-shell">${header(true)}<main id="main" class="private-main"><section class="receipt-panel"><p class="eyebrow">FILE NOTE</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><a class="text-link" href="/" data-link><span class="text-link__label">Return home</span><span class="text-link__arrow" aria-hidden="true">→</span></a></section></main></div>`,
    title,
  );
}

function statusLabel(status: PublicRequest["status"]): string {
  const labels: Record<PublicRequest["status"], string> = {
    awaiting_sender_verification: "AWAITING VERIFICATION",
    sending_recipient_email: "SENDING REQUEST",
    recipient_email_failed: "DELIVERY NEEDS ATTENTION",
    pending: "AWAITING DECISION",
    approved: "PERMISSION GRANTED",
    declined: "DECLINED",
    disabled: "DISABLED",
  };
  return labels[status];
}

async function renderVerify(token: string): Promise<void> {
  loadingPage("Opening request file");
  try {
    const response = await api<ConfirmationResponse>(`/api/verify/${token}`);
    const request = response.request;
    const alreadySent =
      request.status !== "awaiting_sender_verification" &&
      request.status !== "recipient_email_failed";
    setPage(
      `
      <div class="page-shell">
        ${header(true)}
        <main id="main" class="private-main">
          <section class="private-intro">
            <p class="eyebrow">${alreadySent ? "REQUEST STATUS" : "SENDER VERIFICATION"}</p>
            <h1>${alreadySent ? "This file is already active." : "Confirm and send."}</h1>
            <p>${alreadySent ? "The latest status is shown below." : `Your address is verified only after you press the button below.`}</p>
          </section>
          <div class="private-document">
            ${requestSheet(request, { status: statusLabel(request.status) })}
            <div class="confirmation-bar">
              <div>
                <span>FROM</span><strong>${escapeHtml(response.senderEmailMasked ?? "")}</strong>
              </div>
              <div>
                <span>DELIVER TO</span><strong>${escapeHtml(response.recipientEmailMasked ?? "")}</strong>
              </div>
            </div>
            <div id="private-status" class="form-status" role="status" aria-live="polite"></div>
            ${
              alreadySent
                ? `<a class="button button--primary button--wide" href="/manage/${encodeURIComponent(token)}" data-link>View request status</a>`
                : `<button id="confirm-send" class="button button--primary button--wide">Confirm and send request</button>
                   <p class="privacy-note">This is the step that emails the recipient.</p>`
            }
          </div>
        </main>
      </div>`,
      "Confirm and send",
    );

    const button = document.querySelector<HTMLButtonElement>("#confirm-send");
    button?.addEventListener("click", async () => {
      const status = document.querySelector<HTMLDivElement>("#private-status");
      button.disabled = true;
      button.textContent = "Sending request…";
      try {
        await api(`/api/verify/${token}`, {
          method: "POST",
          body: JSON.stringify({ confirmationProof: response.confirmationProof }),
        });
        navigate(`/manage/${token}`);
      } catch (error) {
        if (status !== null) {
          status.textContent = error instanceof Error ? error.message : "The email could not be sent.";
          status.className = "form-status form-status--error";
        }
        button.disabled = false;
        button.textContent = "Try sending again";
      }
    });
  } catch (error) {
    privateError(
      "This file is unavailable.",
      error instanceof Error ? error.message : "The request could not be opened.",
    );
  }
}

function renderDecisionResult(
  request: PublicRequest,
  emailStatus: string | null | undefined,
): void {
  const approved = request.status === "approved";
  setPage(
    `
    <div class="page-shell">
      ${header(true)}
      <main id="main" class="private-main">
        <section class="private-intro">
          <p class="eyebrow">DECISION RECORDED</p>
          <h1>${approved ? "Permission granted." : "Request declined."}</h1>
          <p>${approved ? "The highly unofficial certificate is on its way." : "No explanation was required."}</p>
        </section>
        <div class="private-document">
          ${requestSheet(request, {
            status: statusLabel(request.status),
            stamp: approved ? "PERMISSION GRANTED" : "DECLINED",
          })}
          <div class="notification-line ${emailStatus === "failed" ? "notification-line--error" : ""}">
            <span aria-hidden="true">${emailStatus === "failed" ? "!" : "✓"}</span>
            ${emailStatus === "failed" ? "The decision was recorded, but the sender email could not be sent." : "Decision recorded. The sender has been notified."}
          </div>
          <a class="text-link" href="/create" data-link><span class="text-link__label">Create your own request</span><span class="text-link__arrow" aria-hidden="true">→</span></a>
        </div>
      </main>
    </div>`,
    approved ? "Permission granted" : "Request declined",
  );
}

async function renderRespond(token: string): Promise<void> {
  loadingPage("Opening decision file");
  try {
    const response = await api<ConfirmationResponse>(`/api/respond/${token}`);
    const request = response.request;
    if (request.status === "approved" || request.status === "declined") {
      renderDecisionResult(request, response.senderResultEmailStatus);
      return;
    }
    const decision = response.proposedDecision;
    if (decision === undefined) {
      throw new Error("The proposed decision is missing.");
    }
    const isApprove = decision === "approved";
    setPage(
      `
      <div class="page-shell">
        ${header(true)}
        <main id="main" class="private-main">
          <section class="private-intro">
            <p class="eyebrow">ACTION REQUIRED</p>
            <h1>Confirm your decision.</h1>
            <p>No decision has been recorded from the email click.</p>
          </section>
          <div class="private-document">
            ${requestSheet(request, { status: "PROPOSED DECISION" })}
            <div class="decision-selection decision-selection--${isApprove ? "approved" : "declined"}">
              <span>YOU SELECTED</span>
              <strong>${isApprove ? "✓ APPROVE" : "× DECLINE"}</strong>
            </div>
            <p class="irreversible-note">Once recorded, this decision cannot be changed.</p>
            <div id="private-status" class="form-status" role="status" aria-live="polite"></div>
            <button id="record-decision" class="button ${isApprove ? "button--approve" : "button--decline"} button--wide">
              ${isApprove ? "Record approval" : "Record decline"}
            </button>
            <a class="text-link" href="/" data-link><span class="text-link__label">Leave without deciding</span><span class="text-link__arrow" aria-hidden="true">→</span></a>
          </div>
        </main>
      </div>`,
      `Confirm ${isApprove ? "approval" : "decline"}`,
    );

    const button = document.querySelector<HTMLButtonElement>("#record-decision");
    button?.addEventListener("click", async () => {
      const status = document.querySelector<HTMLDivElement>("#private-status");
      button.disabled = true;
      button.textContent = "Recording decision…";
      try {
        const result = await api<ConfirmationResponse>(`/api/respond/${token}`, {
          method: "POST",
          body: JSON.stringify({ confirmationProof: response.confirmationProof }),
        });
        renderDecisionResult(result.request, result.senderResultEmailStatus);
      } catch (error) {
        if (status !== null) {
          status.textContent = error instanceof Error ? error.message : "The decision could not be recorded.";
          status.className = "form-status form-status--error";
        }
        button.disabled = false;
        button.textContent = isApprove ? "Record approval" : "Record decline";
      }
    });
  } catch (error) {
    privateError(
      "This decision link is unavailable.",
      error instanceof Error ? error.message : "The request could not be opened.",
    );
  }
}

async function renderManage(token: string): Promise<void> {
  loadingPage("Retrieving request status");
  try {
    const response = await api<ConfirmationResponse>(`/api/manage/${token}`);
    const request = response.request;
    const final = request.status === "approved" || request.status === "declined";
    setPage(
      `
      <div class="page-shell">
        ${header(true)}
        <main id="main" class="manage-main">
          <section class="manage-heading">
            <div><p class="eyebrow">YOUR REQUEST</p><h1>${final ? "A verdict has been filed." : "The file is open."}</h1></div>
            <span class="status-badge status-badge--${request.status}">${escapeHtml(statusLabel(request.status))}</span>
          </section>
          <div class="manage-grid">
            <div>
              ${requestSheet(request, {
                status: statusLabel(request.status),
                stamp: request.status === "approved" ? "PERMISSION GRANTED" : request.status === "declined" ? "DECLINED" : undefined,
              })}
            </div>
            <aside class="management-panel">
              <section>
                <p class="eyebrow">DELIVERY</p>
                <dl class="management-list">
                  <div><dt>Recipient</dt><dd>${escapeHtml(response.recipientEmailMasked ?? "")}</dd></div>
                  <div><dt>Request email</dt><dd>${escapeHtml(response.recipientEmailStatus ?? "Not sent")}</dd></div>
                  <div><dt>Result email</dt><dd>${escapeHtml(response.senderResultEmailStatus ?? "Awaiting decision")}</dd></div>
                  <div><dt>Expires</dt><dd>${escapeHtml(formatDate(request.expiresAt))}</dd></div>
                </dl>
              </section>
              <div id="manage-status" class="form-status" role="status" aria-live="polite"></div>
              ${
                request.status === "recipient_email_failed"
                  ? `<button class="button button--primary button--wide" id="resend-recipient">Retry recipient email</button>`
                  : ""
              }
              ${
                final && response.senderResultEmailStatus === "failed"
                  ? `<button class="button button--primary button--wide" id="resend-result">Retry result email</button>`
                  : ""
              }
              ${
                !final && request.status !== "disabled"
                  ? `<button class="text-button text-button--danger" id="disable-request">Disable this request</button>`
                  : ""
              }
              <a class="text-link" href="/create" data-link><span class="text-link__label">Create another request</span><span class="text-link__arrow" aria-hidden="true">→</span></a>
            </aside>
          </div>
        </main>
      </div>`,
      "Request status",
    );

    const action = async (endpoint: string, button: HTMLButtonElement): Promise<void> => {
      const status = document.querySelector<HTMLDivElement>("#manage-status");
      button.disabled = true;
      try {
        await api(`/api/manage/${token}/${endpoint}`, {
          method: "POST",
          body: JSON.stringify({ confirmationProof: response.confirmationProof }),
        });
        await renderManage(token);
      } catch (error) {
        if (status !== null) {
          status.textContent = error instanceof Error ? error.message : "The action failed.";
          status.className = "form-status form-status--error";
        }
        button.disabled = false;
      }
    };
    document.querySelector<HTMLButtonElement>("#resend-recipient")?.addEventListener("click", (event) => {
      void action("resend-recipient", event.currentTarget as HTMLButtonElement);
    });
    document.querySelector<HTMLButtonElement>("#resend-result")?.addEventListener("click", (event) => {
      void action("resend-result", event.currentTarget as HTMLButtonElement);
    });
    document.querySelector<HTMLButtonElement>("#disable-request")?.addEventListener("click", (event) => {
      void action("disable", event.currentTarget as HTMLButtonElement);
    });
  } catch (error) {
    privateError(
      "This management link is unavailable.",
      error instanceof Error ? error.message : "The request could not be opened.",
    );
  }
}

async function renderReport(token: string): Promise<void> {
  loadingPage("Opening report form");
  try {
    const response = await api<ConfirmationResponse>(`/api/report/${token}`);
    setPage(
      `
      <div class="page-shell">
        ${header(true)}
        <main id="main" class="private-main">
          <section class="receipt-panel receipt-panel--wide">
            <p class="eyebrow">REPORT OR BLOCK</p>
            <h1>Something wrong with this request?</h1>
            <p>Submitting this form disables an undecided request and sends it for review.</p>
            <div class="report-summary"><span>${escapeHtml(response.request.publicId)}</span><strong>${escapeHtml(response.request.requestTitle)}</strong></div>
            <form id="report-form">
              <label>What’s wrong?<textarea name="reason" maxlength="300" required placeholder="Spam, harassment, impersonation, or something else"></textarea></label>
              <div id="report-status" class="form-status" role="status" aria-live="polite"></div>
              <button class="button button--decline button--wide" type="submit">Report and block request</button>
            </form>
          </section>
        </main>
      </div>`,
      "Report request",
    );
    const form = document.querySelector<HTMLFormElement>("#report-form");
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) {
        return;
      }
      const button = form.querySelector<HTMLButtonElement>("button");
      button?.setAttribute("disabled", "");
      const data = new FormData(form);
      try {
        await api(`/api/report/${token}`, {
          method: "POST",
          body: JSON.stringify({
            confirmationProof: response.confirmationProof,
            reason: data.get("reason"),
          }),
        });
        privateError("Report received.", "The request has been blocked where possible. Thank you.");
      } catch (error) {
        const status = document.querySelector<HTMLDivElement>("#report-status");
        if (status !== null) {
          status.textContent = error instanceof Error ? error.message : "The report could not be sent.";
          status.className = "form-status form-status--error";
        }
        button?.removeAttribute("disabled");
      }
    });
  } catch (error) {
    privateError(
      "This report link is unavailable.",
      error instanceof Error ? error.message : "The request could not be opened.",
    );
  }
}

function renderEditorialPage(
  title: string,
  eyebrow: string,
  body: string,
): void {
  setPage(
    `<div class="page-shell">${header()}<main id="main" class="editorial-page"><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1>${escapeHtml(title)}</h1><div class="editorial-copy">${body}</div><a class="button button--primary" href="/create" data-link>Draft a request</a></main>${footer()}</div>`,
    title,
  );
}

function renderLegalPage(document: LegalDocument): void {
  const navigation = document.sections
    .map(
      (section) =>
        `<li><a href="#${escapeHtml(section.id)}">${escapeHtml(section.title)}</a></li>`,
    )
    .join("");
  const sections = document.sections
    .map(
      (section) =>
        `<section id="${escapeHtml(section.id)}" class="legal-section"><h2>${escapeHtml(section.title)}</h2>${section.body}</section>`,
    )
    .join("");

  setPage(
    `<div class="page-shell">
      ${header()}
      <main id="main" class="legal-page">
        <header class="legal-hero">
          <p class="eyebrow">${escapeHtml(document.eyebrow)}</p>
          <h1>${escapeHtml(document.title)}</h1>
          <p>${escapeHtml(document.summary)}</p>
          <dl class="legal-meta">
            <div><dt>Effective</dt><dd>${escapeHtml(LEGAL_VERSION)}</dd></div>
            <div><dt>Operator</dt><dd>Aryan Alipour trading as Permission Granted</dd></div>
            <div><dt>Contact</dt><dd><a href="mailto:privacy@permissiongranted.app">privacy@permissiongranted.app</a></dd></div>
          </dl>
        </header>
        <div class="legal-layout">
          <aside class="legal-index" aria-label="On this page">
            <span>ON THIS PAGE</span>
            <ol>${navigation}</ol>
          </aside>
          <article class="legal-copy">${sections}</article>
        </div>
      </main>
      ${footer()}
    </div>`,
    document.pageTitle,
  );
}

function renderRoute(): void {
  const path = window.location.pathname.replace(/\/+$/u, "") || "/";
  const segments = path.split("/").filter(Boolean);

  if (path === "/") {
    renderHome();
  } else if (path === "/create") {
    void renderCreate();
  } else if (segments[0] === "verify" && segments[1] !== undefined) {
    void renderVerify(segments[1]);
  } else if (segments[0] === "respond" && segments[1] !== undefined) {
    void renderRespond(segments[1]);
  } else if (segments[0] === "manage" && segments[1] !== undefined) {
    void renderManage(segments[1]);
  } else if (segments[0] === "report" && segments[1] !== undefined) {
    void renderReport(segments[1]);
  } else if (path === "/how-it-works") {
    renderEditorialPage(
      "Three emails. One verdict.",
      "HOW IT WORKS",
      `<h2>1. Draft and verify</h2><p>You write the request and verify your own address. Nothing reaches the recipient before that confirmation.</p><h2>2. They decide</h2><p>The recipient gets an HTML email with equally prominent Approve and Decline actions. Either action opens a web confirmation page; email scanners cannot decide for them.</p><h2>3. The record arrives</h2><p>An approval returns as a certificate-style HTML email. A decline returns as a simple verdict notice. Neither outcome has legal force.</p>`,
    );
  } else if (path === "/templates") {
    renderEditorialPage(
      "Opening arguments.",
      "CURATED TEMPLATES",
      `<div class="template-list"><article><span>THE GARAGE</span><h2>Buy another motorbike</h2><p>“The garage has room if we measure creatively.”</p></article><article><span>THE WEEKEND</span><h2>Disappear for a fishing trip</h2><p>“I will return with either dinner or an excellent explanation.”</p></article><article><span>THE SOFA</span><h2>Order takeaway tonight</h2><p>“The kitchen has submitted a formal request for leave.”</p></article></div>`,
    );
  } else if (path === "/safety") {
    renderEditorialPage(
      "Keep the joke kind.",
      "SAFETY",
      `<h2>Expected recipients only</h2><p>Send requests only to someone who knows you and can reasonably expect a playful message from you.</p><h2>Never authority</h2><p>Permission Granted is not affiliated with Google, a government, an employer, or a legal service. Decisions recorded here are not legal consent.</p><h2>Recipient control</h2><p>No email click records a decision. Decline is never hidden. Recipients can report and block a request from the original email.</p><h2>Private by design</h2><p>Requests are not public, and the service does not use email-open tracking.</p>`,
    );
  } else if (path === "/privacy") {
    renderLegalPage(privacyNotice);
  } else if (path === "/terms") {
    renderLegalPage(termsOfService);
  } else if (path === "/cookies") {
    renderLegalPage(cookieNotice);
  } else {
    privateError("Page not found.", "The file you requested does not exist.");
  }
}

window.addEventListener("popstate", renderRoute);
renderRoute();
