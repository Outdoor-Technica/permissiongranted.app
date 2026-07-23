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
    console.warn(
      JSON.stringify({
        event: "turnstile_siteverify_http_error",
        status: response.status,
      }),
    );
    return false;
  }

  const result: unknown = await response.json();
  if (!isTurnstileResult(result)) {
    console.warn(JSON.stringify({ event: "turnstile_siteverify_invalid_response" }));
    return false;
  }
  if (!result.success) {
    console.warn(
      JSON.stringify({
        event: "turnstile_validation_failed",
        errorCodes: result["error-codes"] ?? [],
      }),
    );
    return false;
  }

  if (result.action !== undefined && result.action !== "create_request") {
    console.warn(
      JSON.stringify({
        event: "turnstile_action_mismatch",
        received: result.action,
      }),
    );
    return false;
  }

  if (
    String(env.ENVIRONMENT) === "production" &&
    result.hostname !== undefined &&
    result.hostname !== env.ALLOWED_HOSTNAME
  ) {
    console.warn(
      JSON.stringify({
        event: "turnstile_hostname_mismatch",
        received: result.hostname,
      }),
    );
    return false;
  }

  return true;
}
