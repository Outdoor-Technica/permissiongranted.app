# Deployment guide

This guide describes a new deployment of the source code. It does not grant access to the production Permission Granted service or its Cloudflare resources.

## Prerequisites

- A Cloudflare account
- A domain managed by Cloudflare
- Node.js 22 or newer
- npm
- Wrangler authentication through `npx wrangler login`

## Configure the project

1. Fork or clone the repository and run `npm install`.
2. Update `wrangler.jsonc` with your Worker name, custom domain, application URL, allowed hostname, sender address, support address, and Turnstile site key.
3. Create or select a D1 database and ensure the `DB` binding points to it.
4. Onboard your domain to Cloudflare Email Sending and restrict the `EMAIL` binding to your transactional sender.
5. Create a Turnstile widget restricted to your production hostname.
6. Configure Email Routing if your published support or privacy addresses should forward elsewhere.
7. Replace the bundled legal notices with terms appropriate to your operator, jurisdiction, deployment, and data practices.

## Add Worker secrets

Set four independent production secrets:

```sh
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put DATA_ENCRYPTION_KEY
npx wrangler secret put EMAIL_HMAC_KEY
npx wrangler secret put CONFIRMATION_HMAC_KEY
```

`DATA_ENCRYPTION_KEY` must be a base64 or base64url-encoded 32-byte random value. Each HMAC key must be a different high-entropy value of at least 32 characters. Never commit these values.

## Apply the schema and deploy

```sh
npm run check
npm run db:remote
npm run deploy
```

Apply new migrations before deploying code that depends on them.

## Production checks

- Create a request between two addresses you control.
- Confirm sender verification is required before recipient delivery.
- Confirm Approve and Decline open confirmation pages without recording a decision.
- Confirm only one decision can win.
- Verify result email, reply-to behavior, SPF, DKIM, and DMARC alignment.
- Verify private pages send `no-store`, `no-referrer`, and `noindex`.
- Test expiration, reporting, retry, and scheduled cleanup behavior.
- Review local laws, privacy obligations, retention, and abuse-response procedures.
