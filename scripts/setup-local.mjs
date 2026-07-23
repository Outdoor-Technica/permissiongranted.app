import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(projectRoot, ".dev.vars");

if (existsSync(target)) {
  throw new Error(
    ".dev.vars already exists. Remove it manually if you intend to regenerate local secrets.",
  );
}

const randomBase64Url = (byteCount) => randomBytes(byteCount).toString("base64url");

const content = [
  "TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA",
  `DATA_ENCRYPTION_KEY=${randomBase64Url(32)}`,
  `EMAIL_HMAC_KEY=${randomBase64Url(48)}`,
  `CONFIRMATION_HMAC_KEY=${randomBase64Url(48)}`,
  "EMAIL_MODE=preview",
  "",
].join("\n");

writeFileSync(target, content, {
  encoding: "utf8",
  flag: "wx",
  mode: 0o600,
});

console.log("Created .dev.vars with local-only random secrets and email preview mode.");
