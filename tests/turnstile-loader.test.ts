import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hasTurnstileRender } from "../src/client/turnstile-loader";

describe("Turnstile loader", () => {
  it("loads Cloudflare before the application module", () => {
    const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
    const turnstilePosition = html.indexOf(
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
    );
    const applicationPosition = html.indexOf("/src/client/main.ts");

    expect(turnstilePosition).toBeGreaterThan(-1);
    expect(applicationPosition).toBeGreaterThan(turnstilePosition);
  });

  it("does not treat Cloudflare's early global stub as ready", () => {
    expect(hasTurnstileRender({})).toBe(false);
    expect(hasTurnstileRender({ render: "pending" })).toBe(false);
    expect(hasTurnstileRender({ render: () => "widget-id" })).toBe(true);
  });
});
