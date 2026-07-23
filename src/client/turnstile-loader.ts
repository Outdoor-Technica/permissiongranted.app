export const TURNSTILE_READY_CALLBACK = "permissionGrantedTurnstileReady";

export function turnstileScriptUrl(): string {
  const url = new URL("https://challenges.cloudflare.com/turnstile/v0/api.js");
  url.searchParams.set("onload", TURNSTILE_READY_CALLBACK);
  url.searchParams.set("render", "explicit");
  return url.toString();
}

export function hasTurnstileRender(
  value: unknown,
): value is { render: (...arguments_: unknown[]) => unknown } {
  return (
    typeof value === "object" &&
    value !== null &&
    "render" in value &&
    typeof value.render === "function"
  );
}
