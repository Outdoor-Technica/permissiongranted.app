# Contributing

Thanks for helping improve Permission Granted.

## Before you start

- Search existing issues and pull requests before starting substantial work.
- Open an issue first for major features, schema changes, new third-party services, or changes to the safety model.
- Never use real recipient data or send unsolicited test email.
- Report vulnerabilities privately using the process in [SECURITY.md](./SECURITY.md).

## Local workflow

```sh
npm install
npm run setup
npm run db:local
npm run dev
```

The generated `.dev.vars` file is ignored by Git. Local email uses preview mode, so transactional messages are stored in the local D1 database rather than delivered.

Before submitting a change:

```sh
npm run check
```

This runs Cloudflare type generation, TypeScript checks, unit tests, the production build, and a Wrangler dry-run deployment.

## Pull requests

- Keep each pull request focused on one coherent change.
- Add or update tests for changed behavior.
- Update documentation when configuration, data handling, or user-facing behavior changes.
- Preserve equal treatment of Approve and Decline.
- Keep state-changing actions behind an explicit confirmation request.
- Do not add email-open tracking, public request pages, or real-service impersonation.
- Explain the user impact and validation performed in the pull-request description.

By contributing, you agree that your contribution is licensed under the project’s [MIT License](./LICENSE).
