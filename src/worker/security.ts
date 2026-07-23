import { timingSafeEqual } from "node:crypto";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(value: string): Uint8Array | null {
  if (!/^[a-f0-9]+$/i.test(value) || value.length % 2 !== 0) {
    return null;
  }

  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }
  return bytes;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function randomToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return bytesToHex(new Uint8Array(digest));
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  if (secret.length < 32) {
    throw new Error("HMAC secrets must be at least 32 characters.");
  }
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

export async function hmacHex(value: string, secret: string): Promise<string> {
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return bytesToHex(new Uint8Array(signature));
}

function importEncryptionKey(secret: string): Promise<CryptoKey> {
  const bytes = base64UrlToBytes(secret);
  if (bytes.length !== 32) {
    throw new Error("DATA_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  }
  return crypto.subtle.importKey(
    "raw",
    toArrayBuffer(bytes),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptString(value: string, secret: string): Promise<string> {
  const key = await importEncryptionKey(secret);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(value),
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return bytesToBase64Url(combined);
}

export async function decryptString(value: string, secret: string): Promise<string> {
  const combined = base64UrlToBytes(value);
  if (combined.length <= 12) {
    throw new Error("Encrypted value is malformed.");
  }
  const key = await importEncryptionKey(secret);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: combined.slice(0, 12) },
    key,
    combined.slice(12),
  );
  return decoder.decode(plaintext);
}

export async function createConfirmationProof(
  tokenHash: string,
  purpose: string,
  secret: string,
  now = Date.now(),
): Promise<string> {
  const issuedAt = Math.floor(now / 1000);
  const signature = await hmacHex(`${purpose}:${tokenHash}:${issuedAt}`, secret);
  return `${issuedAt}.${signature}`;
}

export async function verifyConfirmationProof(
  proof: string,
  tokenHash: string,
  purpose: string,
  secret: string,
  now = Date.now(),
): Promise<boolean> {
  const [issuedAtText, providedSignature, ...remainder] = proof.split(".");
  if (
    remainder.length > 0 ||
    issuedAtText === undefined ||
    providedSignature === undefined ||
    !/^\d+$/u.test(issuedAtText)
  ) {
    return false;
  }

  const issuedAt = Number.parseInt(issuedAtText, 10);
  const currentTime = Math.floor(now / 1000);
  if (issuedAt > currentTime + 30 || currentTime - issuedAt > 15 * 60) {
    return false;
  }

  const expectedSignature = await hmacHex(
    `${purpose}:${tokenHash}:${issuedAt}`,
    secret,
  );
  const providedBytes = hexToBytes(providedSignature);
  const expectedBytes = hexToBytes(expectedSignature);
  if (providedBytes === null || expectedBytes === null) {
    return false;
  }

  const providedDigest = await crypto.subtle.digest(
    "SHA-256",
    toArrayBuffer(providedBytes),
  );
  const expectedDigest = await crypto.subtle.digest(
    "SHA-256",
    toArrayBuffer(expectedBytes),
  );
  return timingSafeEqual(
    new Uint8Array(providedDigest),
    new Uint8Array(expectedDigest),
  );
}

export function maskEmail(email: string): string {
  const [localPart, domain] = email.split("@");
  if (localPart === undefined || domain === undefined) {
    return "••••";
  }
  const firstCharacter = localPart.at(0) ?? "•";
  return `${firstCharacter}${"•".repeat(Math.min(Math.max(localPart.length - 1, 3), 8))}@${domain}`;
}
