interface TurnstileResult {
  success: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
}

function isTurnstileResult(value: unknown): value is TurnstileResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "success" in value &&
    typeof (value as Record<string, unknown>).success === "boolean"
  );
}

export async function verifyTurnstile(
  token: string,
  remoteIp: string | undefined,
  env: Env,
): Promise<boolean> {
  const formData = new FormData();
  formData.set("secret", env.TURNSTILE_SECRET_KEY);
  formData.set("response", token);
  formData.set("idempotency_key", crypto.randomUUID());
  if (remoteIp !== undefined) {
    formData.set("remoteip", remoteIp);
  }

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body: formData },
  );
  if (!response.ok) {
    return false;
  }

  const result: unknown = await response.json();
  if (!isTurnstileResult(result) || !result.success) {
    return false;
  }

  if (result.action !== undefined && result.action !== "create_request") {
    return false;
  }

  if (
    String(env.ENVIRONMENT) === "production" &&
    result.hostname !== undefined &&
    result.hostname !== env.ALLOWED_HOSTNAME
  ) {
    return false;
  }

  return true;
}
