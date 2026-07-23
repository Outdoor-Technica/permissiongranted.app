import { describe, expect, it } from "vitest";
import { parseCreateRequestInput } from "../src/worker/validation";

const validInput = {
  requesterName: " Alex ",
  recipientName: " Sam ",
  senderEmail: "Alex@Example.com",
  recipientEmail: "sam@example.com",
  requestTitle: "Buy another motorbike",
  justification: "The garage has room if we measure creatively.",
  turnstileToken: "test-token",
  acceptableUseAccepted: true,
};

describe("request validation", () => {
  it("normalises a valid request", () => {
    const result = parseCreateRequestInput(validInput);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.requesterName).toBe("Alex");
      expect(result.value.senderEmail).toBe("alex@example.com");
    }
  });

  it("rejects a request sent to the sender", () => {
    const result = parseCreateRequestInput({
      ...validInput,
      recipientEmail: "alex@example.com",
    });
    expect(result.ok).toBe(false);
  });

  it("requires the expected-recipient confirmation", () => {
    const result = parseCreateRequestInput({
      ...validInput,
      acceptableUseAccepted: false,
    });
    expect(result.ok).toBe(false);
  });
});
