# Security model

Permission Granted treats emailed action URLs as bearer capabilities and assumes that mail infrastructure may automatically open links.

## Trust boundaries

- A sender controls the content and supplies both email addresses.
- A recipient may be unexpected and never has to respond.
- Email clients and security scanners may visit every link.
- Anyone holding a private capability URL can exercise the access it grants.
- Cloudflare provides the network, compute, storage, bot protection, and transactional email platform.

## Principal controls

- Sender verification before recipient contact
- Turnstile and per-address creation caps
- Separate 256-bit random capabilities for each action
- Hashed capability lookup and encrypted retry copies
- AES-GCM encryption for email addresses
- Independent HMAC keys for rate limits and confirmation proofs
- Read-only email-link `GET` requests
- Explicit, short-lived confirmation `POST` requests
- Conditional one-time decisions
- Escaping in both HTML surfaces
- Private-page cache, referrer, and indexing controls
- Minimal application logging and scheduled retention cleanup

## Deliberate limitations

- Email delivery and mailbox security are outside the application’s control.
- A forwarded or exposed capability URL remains usable until it expires, is disabled, or reaches a terminal state.
- The service does not establish identity beyond control of the sender’s verification mailbox and possession of the recipient capability.
- Decisions are playful records and have no legal force.

## Reporting

Follow [SECURITY.md](../SECURITY.md) for private vulnerability reporting. Do not include live capability URLs, personal information, or production secrets in public issues.
