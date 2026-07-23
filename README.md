<p align="center">
  <img src="./public/favicon.svg" width="88" height="88" alt="Permission Granted seal">
</p>

<h1 align="center">Permission Granted</h1>

<p align="center">
  <a href="https://github.com/Outdoor-Technica/permissiongranted.app/actions/workflows/ci.yml"><img src="https://github.com/Outdoor-Technica/permissiongranted.app/actions/workflows/ci.yml/badge.svg" alt="CI status"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-285c52" alt="MIT License"></a>
  <br>
  A playful, email-first way to put a request in writing and await the verdict.
  <br>
  <a href="https://permissiongranted.app"><strong>Visit the live website</strong></a>
  ·
  <a href="./CONTRIBUTING.md">Contribute</a>
  ·
  <a href="./SECURITY.md">Security</a>
  ·
  <a href="./LICENSE">MIT License</a>
</p>

## What it does

A sender drafts a light-hearted permission request and verifies their own email address. The recipient receives a branded HTML email with equally prominent **Approve** and **Decline** actions. Either action opens a confirmation page, and only an explicit confirmation records the decision.

If the request is approved, the sender receives a certificate-style HTML email. A decline returns a straightforward verdict notice. Requests are private, have no legal force, and never use email-open tracking.

## Highlights

- Sender verification before the recipient is contacted
- Separate, random capabilities for approval, decline, reporting, and management
- Email links that never change state on `GET`
- One-time, conditional decisions
- HTML and plain-text transactional email
- Encrypted email addresses and retry capabilities in D1
- Turnstile abuse protection and privacy-preserving rate limits
- Scheduled request retention cleanup
- Local email previews that do not send real messages
- Accessible, responsive “Domestic Dossier” interface

## Built with

- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Cloudflare Email Service](https://developers.cloudflare.com/email-service/)
- [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/)
- [Hono](https://hono.dev/)
- [Vite](https://vite.dev/)
- TypeScript and Vitest

## Run it locally

Requirements:

- Node.js 20.19 or newer
- npm

```sh
git clone <your-fork-url>
cd permissiongranted.app
npm install
npm run setup
npm run db:local
npm run dev
```

Open the URL Wrangler prints, normally `http://localhost:8787`.

`npm run setup` creates an ignored `.dev.vars` file with random local-only keys, Cloudflare’s published Turnstile test secret, and `EMAIL_MODE=preview`. In preview mode, messages are stored in the local `email_previews` D1 table and never leave your machine.

Run the complete verification suite with:

```sh
npm run check
```

## How it works

```text
Sender drafts request
        │
        ▼
Sender verifies email ──► Recipient receives request
                                  │
                     ┌────────────┴────────────┐
                     ▼                         ▼
                Approve page              Decline page
                     │                         │
                     └────────────┬────────────┘
                                  ▼
                       Explicit confirmation
                                  │
                                  ▼
                        Sender receives result
```

The email action pages deliberately separate navigation from mutation: automated link scanners can open an email URL, but they cannot record a decision.

## Documentation

- [Architecture](./docs/architecture.md)
- [Deployment guide](./docs/deployment.md)
- [Security model](./docs/security.md)
- [Project wiki](../../wiki)

## Production service

The public service at [permissiongranted.app](https://permissiongranted.app) is operated by Outdoor Technica Ltd. Its production infrastructure, email domains, legal notices, and data-controller obligations belong to that deployment and do not automatically apply to forks.

If you deploy a fork, use your own Cloudflare account, domain, D1 database, Turnstile widget, email identities, secrets, policies, and legal notices. Do not send unsolicited messages or present a fork as an official or legally binding permission service.

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request. For security vulnerabilities, follow [SECURITY.md](./SECURITY.md) instead of filing a public issue.

## License

The source code is available under the [MIT License](./LICENSE).

The MIT License does not grant permission to use the Permission Granted name, logo, or other branding in a way that suggests endorsement by or affiliation with Outdoor Technica Ltd.
