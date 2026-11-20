# AGENTS.md

Agent-focused guidance for this repository ([AGENTS.md format](https://agents.md/)). Human-facing docs live in `README.md`.

## Living document

Treat this file as **living documentation**. Update it in the same PR when the stack, scripts, branch model, deploy path, or other project facts change. Future agents should keep it accurate rather than leaving stale instructions.

## Branch model

This repository uses **trunk-based development**:

| Branch | Role |
| --- | --- |
| `main` | Default branch for features, fixes, and production releases |

- Open feature and fix PRs directly against **`main`**.
- Releases, tags, and Docker images are published from `main`.
- Do not use `dev` or `master`.

## Package manager

This repo uses **pnpm** (`packageManager` in `package.json`).

- Install: `pnpm install` (do not use npm/yarn for installs in this repo).
- Scripts: `pnpm run <script>` / `pnpm exec <bin>`.
- Lockfile: `pnpm-lock.yaml` only — do not commit `package-lock.json` or `yarn.lock`.
- Dependency overrides (for audit fixes) live in `pnpm-workspace.yaml`; the Dockerfile copies that file before the frozen-lockfile install.
- Local disk: pnpm's content-addressable store shares package contents across checkouts on the same machine.

## Dependency and deploy notes

### Tier B - Docker services (nightly on main)

- Nightly GitHub Action (`.github/workflows/nightly-minor-deps-release.yml`) runs on **`main`**:
  1. npm-check-updates `--target semver` with `--cooldown 3` (raises package.json in-major ranges; lockfile re-resolved after)
  2. lint/test when scripts exist
  3. if package.json ranges changed: lint/test; **release only when a production dependency moved** (`dependencies` / `optionalDependencies` / `peerDependencies`) — patch bump, commit, GitHub Release. `devDependencies`-only updates commit without releasing
- `main` is the default branch, so a published GitHub Release fires `.github/workflows/release-publish.yml`, which builds and pushes the image. The nightly workflow does not build images itself; do not add a second build there or the same tags get pushed twice.
- Image tags: `ghcr.io/<owner>/<repo>:latest`, `:v<version>`, `:<sha>` (repository name lowercased).
- Servers should pull/recreate from GHCR (e.g. Watchtower or cron).
- Publishing uses the workflow's `GITHUB_TOKEN` (`packages: write`); no extra registry secrets are required.
- Dependabot auto-merge for routine minor/patch is **disabled** here to avoid duplicate bumps; leave majors/security as human-reviewed PRs.

## Project overview

Wanderstories image watermark proxy: Express 5 + sharp. Image routes use a named Express 5 wildcard (`/content/images/{*imagePath}`); `req.params.imagePath` is an array of path segments.

`index.js` exports the Express `app` and only calls `app.listen()` when run directly, so tests can boot the real app in-process.

## Setup

```bash
pnpm install
pnpm test
pnpm start
pnpm run dev
pnpm run lint
```

## Testing

- `pnpm test` runs the built-in `node:test` suite in `test/` — no extra test framework or test dependencies.
- Tests start the exported app on an ephemeral port and make real HTTP requests, so the full middleware stack (Helmet, CSRF, CORS, rate limiting) and route handlers are exercised.
- Tests create their fixtures under `content/images/` (for example `__test__/`, `__cache_test__/`, and `size/w2000/__test__/`) and delete them afterwards. `content/` is gitignored — never commit fixtures or uploaded images.
- **Every bug fix needs a regression test** that fails without the fix.
- Do not throw from middleware for request metadata you dislike (for example an unknown CORS `Origin`). Omit headers or return a 4xx, and cover the behaviour with a test. Throwing turns the response into an opaque 500.
- CI (`.github/workflows/node26-build.yml`) runs `pnpm test` on every PR to `main`; the nightly workflow also runs `pnpm test` and `pnpm run lint`.

`pnpm run lint` uses the flat config in `eslint.config.js` (ESLint 10). Fix lint errors rather than disabling rules.

## Conventions

- Sanitize input; keep Helmet / CSRF / rate-limit behavior intact.
- CORS is enforced by the browser, not the server. Never reject a request because of its `Origin`; omit `Access-Control-Allow-*` headers instead.
- The app caches processed images on disk under `content/`. If a write fails (e.g. a bind-mounted volume owned by another user), the app still serves the processed image from memory, so a cache problem never becomes a 500.
- Deployment: the bind-mounted `content/` directory must be writable by uid 1000 (the container's `node` user). On a fresh host run `mkdir -p content && sudo chown 1000:1000 content`; if Docker created it as root, fix with `sudo chown -R 1000:1000 content`.
- Never commit secrets or uploaded images.


## Pull requests

Before merging any pull request:

1. **Read all comments** on the PR — conversation comments, review comments (including those on specific lines), and bot comments. Address or acknowledge them. Do not merge while review feedback is unresolved.
2. **Run `pnpm test` locally** and add/update regression tests for the change.
3. **Wait for CI to complete successfully.** GitHub Actions (and other required checks) on the PR must finish and pass. Do not merge while checks are pending, failed, cancelled, or skipped when they are required. If CI fails, fix the cause and wait for a green run before merging.

## Node runtime

Use Node.js 26 LTS (`.nvmrc`). Docker pins Node 26.13.0 with its multi-platform image digest. Install pnpm via `npm install -g pnpm@<pinned-version>` in Node 26 images; Corepack is no longer bundled. PR checks run `pnpm test` and build the production Docker image without publishing it.
