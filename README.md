# Permission Granted

A playful, email-first permission-request service for `permissiongranted.app`.

The sender drafts a request and verifies their address. The recipient receives a branded HTML email with equal **Approve** and **Decline** actions. Either action opens a web confirmation page; only the explicit confirmation POST records the decision. Approval returns to the sender as an HTML certificate.

## Architecture

- Cloudflare Worker for the API and scheduled retention cleanup
- Workers Static Assets for the Vite-built SPA
- D1 for requests, one-time decisions, delivery state, reports, and local email previews
- Cloudflare Email Sending Worker binding for transactional HTML and text email
- Turnstile on request creation
- No Queue: email is sent directly by the verification or decision request

## Local development

Requirements:

- Node.js 20.19 or newer
- npm

Set up:

```powershell
npm install
.\scripts\setup-local.ps1
npm run db:local
npm run dev
```

Open the URL Wrangler prints, normally `http://localhost:8787`.

Local setup uses Cloudflare’s published Turnstile test pair and `EMAIL_MODE=preview`. Transactional messages are written to the local `email_previews` D1 table instead of leaving the machine. After creating a request, the UI exposes the local verification preview link.

Run the full local verification suite:

```powershell
npm run check
```

## Production configuration

The checked-in Wrangler configuration targets `permissiongranted.app` and uses automatic D1 provisioning. Before the first public deployment:

1. Ensure `permissiongranted.app` is active in the same Cloudflare account and uses Cloudflare DNS.
2. Upgrade the account to Workers Paid; arbitrary Email Sending recipients require it.
3. Onboard `notify.permissiongranted.app` under **Compute > Email Service > Email Sending**.
4. Create a Turnstile widget restricted to `permissiongranted.app`.
5. Replace the test `TURNSTILE_SITE_KEY` in `wrangler.jsonc` with the production site key.
6. Set all four secrets interactively—never put production values in the repository.

```powershell
npx wrangler login
npx wrangler email sending enable notify.permissiongranted.app
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put DATA_ENCRYPTION_KEY
npx wrangler secret put EMAIL_HMAC_KEY
npx wrangler secret put CONFIRMATION_HMAC_KEY
```

`DATA_ENCRYPTION_KEY` must be a base64-encoded 32-byte value. The HMAC secrets should be separate random values containing at least 32 characters.

One PowerShell method for generating values locally without printing them into command history:

```powershell
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToBase64String($bytes)
```

Then deploy and apply the automatically provisioned D1 migration:

```powershell
npm run deploy
npm run db:remote
```

Wrangler writes the provisioned D1 database ID back to `wrangler.jsonc`. Commit that configuration change after checking it.

## Email identities

- Request and verification mail: `requests@notify.permissiongranted.app`
- Certificate and verdict mail: `certificates@notify.permissiongranted.app`

Both are restricted in the Worker binding. Every message has matching HTML and plain-text bodies, honest subject lines, no remote decorative images, no tracking pixel, and full `permissiongranted.app` links.

## Security model

- Sender verification happens before recipient delivery.
- Email actions use separate 256-bit random capability tokens.
- D1 stores token hashes for lookup and AES-GCM-encrypted token copies solely so a failed transactional email can be retried.
- Sender and recipient addresses are encrypted with AES-GCM.
- Keyed HMAC values support rate limiting without storing searchable plaintext addresses.
- Initial email-link GET requests never change state.
- Confirmation proofs expire after 15 minutes.
- The decision update is conditional on `status = 'pending'`; only the winning request sends a result email.
- Private pages and API responses are `no-store`, `no-referrer`, and `noindex`.
- Request text is escaped in both the SPA and email templates.
- Capability tokens, names, request text, and email addresses are excluded from logs.

## Operational notes

- The normal completed flow sends three emails.
- API-level email failures do not roll back a recorded decision.
- The sender management page exposes explicit retries for failed recipient or result email.
- Accepted-message retries, bounce handling, and suppression lists are handled by Cloudflare Email Service.
- The bundled privacy and terms pages are product placeholders and require legal review before launch.

## Useful commands

```powershell
npm run typecheck
npm test
npm run build
npx wrangler deploy --dry-run
npx wrangler tail --status error
```
