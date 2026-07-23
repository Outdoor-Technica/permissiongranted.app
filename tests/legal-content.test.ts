import { describe, expect, it } from "vitest";
import {
  cookieNotice,
  LEGAL_VERSION,
  privacyNotice,
  termsOfService,
} from "../src/client/legal-content";
import { LEGAL_VERSION as STORED_LEGAL_VERSION } from "../src/shared/legal";

function documentText(document: typeof privacyNotice): string {
  return [
    document.eyebrow,
    document.title,
    document.summary,
    ...document.sections.flatMap((section) => [
      section.id,
      section.title,
      section.body,
    ]),
  ].join(" ");
}

describe("production legal content", () => {
  it("publishes a versioned privacy notice with required transparency topics", () => {
    const text = documentText(privacyNotice);

    expect(LEGAL_VERSION).toBe("23 July 2026");
    expect(STORED_LEGAL_VERSION).toBe("2026-07-23");
    expect(text).toContain("Aryan Alipour");
    expect(text).toContain("privacy@permissiongranted.app");
    expect(text).toContain("lawful basis");
    expect(text).toContain("legitimate interests");
    expect(text).toContain("International transfers");
    expect(text).toContain("How long information is kept");
    expect(text).toContain("Your right to object");
    expect(text).toContain("Information Commissioner");
    expect(text).toContain("Automated checks");
  });

  it("publishes enforceable service rules and balanced liability wording", () => {
    const text = documentText(termsOfService);

    expect(text).toContain("at least 18");
    expect(text).toContain("reasonably expect");
    expect(text).toContain("no legal force");
    expect(text).toContain("Nothing in these Terms excludes liability");
    expect(text).toContain("statutory consumer rights");
    expect(text).toContain("law of England and Wales");
  });

  it("explains the strictly necessary cookie position without placeholders", () => {
    const allText = [
      documentText(privacyNotice),
      documentText(termsOfService),
      documentText(cookieNotice),
    ].join(" ");

    expect(allText).toContain("strictly necessary");
    expect(allText).toContain("Cloudflare Turnstile");
    expect(allText).not.toMatch(/\bplaceholder\b/iu);
    expect(allText).not.toMatch(/\bMVP\b/u);
  });
});
