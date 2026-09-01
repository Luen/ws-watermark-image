# AGENTS.md

Agent-focused guidance for this repository ([AGENTS.md format](https://agents.md/)). Human-facing docs live in `README.md`.

Treat this file as living documentation: update it when the stack, scripts, or project facts change.

## Project overview

Wanderstories image watermark proxy: Express 5 + sharp. Image routes use a named Express 5 wildcard (`/content/images/{*imagePath}`); `req.params.imagePath` is an array of path segments.

## Setup

```bash
npm install
npm start
npm run dev
```

ESLint is a devDependency; run `npx eslint .` after JS changes if there is no `lint` script, and fix issues before finishing.

## Conventions

- Sanitize input; keep Helmet / CSRF / rate-limit behavior intact.
- Never commit secrets or uploaded images.


## Pull requests

Before merging any pull request:

1. **Read all comments** on the PR — conversation comments, review comments (including those on specific lines), and bot comments. Address or acknowledge them. Do not merge while review feedback is unresolved.
2. **Wait for CI to complete successfully.** GitHub Actions (and other required checks) on the PR must finish and pass. Do not merge while checks are pending, failed, cancelled, or skipped when they are required. If CI fails, fix the cause and wait for a green run before merging.
