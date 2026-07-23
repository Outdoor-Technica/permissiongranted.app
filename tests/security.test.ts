import { describe, expect, it } from "vitest";
import {
  createConfirmationProof,
  decryptString,
  encryptString,
  randomToken,
  sha256,
  verifyConfirmationProof,
} from "../src/worker/security";

const encryptionKey = Buffer.alloc(32, 7).toString("base64url");
const confirmationKey = "confirmation-key-that-is-longer-than-thirty-two-characters";

describe("capability security", () => {
  it("generates high-entropy URL-safe tokens", () => {
    const token = randomToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/u);
  });

  it("encrypts and decrypts sensitive strings", async () => {
    const encrypted = await encryptString("alex@example.com", encryptionKey);
    expect(encrypted).not.toContain("alex");
    await expect(decryptString(encrypted, encryptionKey)).resolves.toBe(
      "alex@example.com",
    );
  });

  it("accepts a current confirmation proof for the correct capability", async () => {
    const tokenHash = await sha256("example-token");
    const now = Date.UTC(2026, 6, 23, 10, 0, 0);
    const proof = await createConfirmationProof(
      tokenHash,
      "respond:approved",
      confirmationKey,
      now,
    );

    await expect(
      verifyConfirmationProof(
        proof,
        tokenHash,
        "respond:approved",
        confirmationKey,
        now + 60_000,
      ),
    ).resolves.toBe(true);
  });

  it("rejects expired and wrong-purpose confirmation proofs", async () => {
    const tokenHash = await sha256("example-token");
    const now = Date.UTC(2026, 6, 23, 10, 0, 0);
    const proof = await createConfirmationProof(
      tokenHash,
      "respond:approved",
      confirmationKey,
      now,
    );

    await expect(
      verifyConfirmationProof(
        proof,
        tokenHash,
        "respond:declined",
        confirmationKey,
        now + 60_000,
      ),
    ).resolves.toBe(false);
    await expect(
      verifyConfirmationProof(
        proof,
        tokenHash,
        "respond:approved",
        confirmationKey,
        now + 16 * 60_000,
      ),
    ).resolves.toBe(false);
  });
});
