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

## Production deployment

The production application is deployed at `https://permissiongranted.app`.

- Worker: `permission-granted`
- D1 database: `permission-granted`
- Email Sending domain: `permissiongranted.app`
- Email Routing contacts: `privacy@permissiongranted.app` and `support@permissiongranted.app`
- Turnstile widget: restricted to `permissiongranted.app`
- Scheduled cleanup: `17 3 * * *`

The public Turnstile site key is checked into `wrangler.jsonc`. The Turnstile secret, encryption key, and two independent HMAC keys exist only as encrypted Cloudflare Worker secrets. A Windows DPAPI-protected recovery copy is stored outside the repository at `%USERPROFILE%\.permissiongranted-secrets.dpapi`.

To deploy a subsequent version and apply any new D1 migrations:

```powershell
npm run deploy
npm run db:remote
```

The initial deployment used Wrangler automatic D1 provisioning. Remote migration commands resolve the configured `permission-granted` database by name.

## Email identities

- All transactional mail: `Permission Granted <notify@permissiongranted.app>`

The address is restricted in the Worker binding. Every message has matching HTML and plain-text bodies, honest subject lines, no remote decorative images, no tracking pixel, and full `permissiongranted.app` links.
Replies are directed to the routed `support@permissiongranted.app` mailbox.

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
- Terms and Privacy Notice version `2026-07-23` is recorded when a sender submits a request.

## Operational notes

- The normal completed flow sends three emails.
- API-level email failures do not roll back a recorded decision.
- The sender management page exposes explicit retries for failed recipient or result email.
- Accepted-message retries, bounce handling, and suppression lists are handled by Cloudflare Email Service.
- The site publishes a UK GDPR privacy notice, Terms of Service, and strictly necessary Cookie Notice.
- Senders receive a just-in-time privacy summary and explicitly accept the current Terms.
- The first recipient email links to the Privacy Notice.

## Useful commands

```powershell
npm run typecheck
npm test
npm run build
npx wrangler deploy --dry-run
npx wrangler tail --status error
```
