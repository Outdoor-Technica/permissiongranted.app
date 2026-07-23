import type { CreateRequestInput } from "../shared/contracts";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

function normaliseText(value: unknown, maximumLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalised = value.replace(/\s+/gu, " ").trim();
  if (normalised.length === 0 || normalised.length > maximumLength) {
    return null;
  }
  return normalised;
}

function normaliseEmail(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalised = value.trim().toLowerCase();
  if (normalised.length > 254 || !EMAIL_PATTERN.test(normalised)) {
    return null;
  }
  return normalised;
}

export function parseCreateRequestInput(
  value: unknown,
): { ok: true; value: CreateRequestInput } | { ok: false; error: string } {
  if (typeof value !== "object" || value === null) {
    return { ok: false, error: "Request details are required." };
  }

  const input = value as Record<string, unknown>;
  const requesterName = normaliseText(input.requesterName, 60);
  const recipientName = normaliseText(input.recipientName, 60);
  const senderEmail = normaliseEmail(input.senderEmail);
  const recipientEmail = normaliseEmail(input.recipientEmail);
  const requestTitle = normaliseText(input.requestTitle, 100);
  const justification = normaliseText(input.justification, 400);
  const turnstileToken =
    typeof input.turnstileToken === "string" && input.turnstileToken.length <= 2048
      ? input.turnstileToken
      : null;

  if (requesterName === null) {
    return { ok: false, error: "Enter your name using 60 characters or fewer." };
  }
  if (recipientName === null) {
    return { ok: false, error: "Enter the recipient’s name using 60 characters or fewer." };
  }
  if (senderEmail === null) {
    return { ok: false, error: "Enter a valid email address for yourself." };
  }
  if (recipientEmail === null) {
    return { ok: false, error: "Enter a valid recipient email address." };
  }
  if (senderEmail === recipientEmail) {
    return { ok: false, error: "Use a different recipient email address." };
  }
  if (requestTitle === null || requestTitle.length < 3) {
    return { ok: false, error: "Describe the request in at least 3 characters." };
  }
  if (justification === null || justification.length < 3) {
    return { ok: false, error: "Make the case in at least 3 characters." };
  }
  if (turnstileToken === null || turnstileToken.length === 0) {
    return { ok: false, error: "Complete the anti-bot check." };
  }
  if (input.acceptableUseAccepted !== true) {
    return { ok: false, error: "Confirm the expected-recipient rule." };
  }

  return {
    ok: true,
    value: {
      requesterName,
      recipientName,
      senderEmail,
      recipientEmail,
      requestTitle,
      justification,
      turnstileToken,
      acceptableUseAccepted: true,
    },
  };
}

export function parseProof(value: unknown): string | null {
  if (
    typeof value !== "object" ||
    value === null ||
    !("confirmationProof" in value)
  ) {
    return null;
  }
  const proof = (value as Record<string, unknown>).confirmationProof;
  return typeof proof === "string" && proof.length <= 256 ? proof : null;
}

export function parseReportReason(value: unknown): string | null {
  if (typeof value !== "object" || value === null || !("reason" in value)) {
    return null;
  }
  return normaliseText((value as Record<string, unknown>).reason, 300);
}
