import { describe, expect, it } from "vitest";
import {
  hasTurnstileRender,
  TURNSTILE_READY_CALLBACK,
  turnstileScriptUrl,
} from "../src/client/turnstile-loader";

describe("Turnstile loader", () => {
  it("waits for Cloudflare's explicit readiness callback", () => {
    const url = new URL(turnstileScriptUrl());

    expect(url.origin).toBe("https://challenges.cloudflare.com");
    expect(url.pathname).toBe("/turnstile/v0/api.js");
    expect(url.searchParams.get("onload")).toBe(TURNSTILE_READY_CALLBACK);
    expect(url.searchParams.get("render")).toBe("explicit");
  });

  it("does not treat Cloudflare's early global stub as ready", () => {
    expect(hasTurnstileRender({})).toBe(false);
    expect(hasTurnstileRender({ render: "pending" })).toBe(false);
    expect(hasTurnstileRender({ render: () => "widget-id" })).toBe(true);
  });
});
