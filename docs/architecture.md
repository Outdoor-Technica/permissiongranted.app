# Architecture

Permission Granted is a TypeScript application built as one Cloudflare Worker with a Vite single-page frontend.

## Components

- **Static frontend:** Vite assets served through Workers Static Assets.
- **API:** Hono routes running in a Cloudflare Worker.
- **Database:** D1 stores encrypted request data, state, delivery metadata, reports, and local email previews.
- **Email:** Cloudflare Email Service sends matching HTML and plain-text transactional messages.
- **Abuse protection:** Turnstile protects request creation; keyed HMAC identifiers enforce sender and recipient caps without storing searchable email addresses.
- **Maintenance:** A scheduled Worker handler deletes expired records.

## Request lifecycle

1. A sender submits a request and a Turnstile token.
2. The Worker validates and encrypts the request, then emails a verification capability to the sender.
3. Verifying the sender triggers the recipient request email.
4. Approve and Decline links open action-specific confirmation pages.
5. The recipient explicitly confirms one action.
6. A conditional database update records only the first decision and triggers the sender result email.
7. The sender’s management capability exposes status and permitted retries.

## Capability design

Each sensitive action uses a separate 256-bit random capability. D1 stores hashes for lookup. Encrypted token copies exist only where a failed transactional email may need to be reconstructed for an explicit retry.

Email-link `GET` requests are read-only. Short-lived, action-scoped confirmation proofs protect the decision `POST`, which prevents automated email link scanners from approving or declining a request.

## Data boundaries

Sender and recipient email addresses are encrypted with AES-GCM. HMAC values support rate limiting without making addresses searchable. User content is escaped independently for the web interface and email templates.

Private routes use `no-store`, `no-referrer`, and `noindex`. Application logs exclude names, request content, email addresses, and capability URLs.

For more detail, see the [security model](./security.md).
