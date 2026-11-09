# AGENTS.md

Agent-focused guidance for this repository ([AGENTS.md format](https://agents.md/)). Human-facing docs live in `README.md`.

## Living document

Treat this file as **living documentation**. Update it in the same PR when the stack, scripts, branch model, deploy path, or other project facts change. Future agents should keep it accurate rather than leaving stale instructions.

## Branch model

| Branch | Role |
| --- | --- |
| `dev` | Default branch for features, fixes, and integration |
| `main` | Production/release branch |

- Open feature/fix PRs against **`dev`**.
- **Release from [`main`](https://github.com/Luen/ws-watermark-image/tree/main):** sync `main` with `dev`, then do the version bump, tag, and GitHub Release from `main` (see `.github/workflows/release-publish.yml`).
- **Publish the image manually:** GitHub only fires release events for the default branch (`dev`), so a release created on `main` does not auto-build. After creating the release, run `gh workflow run release-publish.yml --ref dev -f tag=vX.Y.Z` (or use Actions → "Run workflow") to publish the image, then wait for it to finish.
- **Backmerge after every release:** merge `main` back into `dev` so both branches stay up to date.
- At the time of writing, `main` was **11 commits behind `dev`** (GitHub shows "This branch is 11 commits behind dev"). Check before releasing with `git rev-list --count origin/main..origin/dev` and sync `main` first.
- Do not use `master` (rename to `main` if any remnant remains).

## Package manager

This repo uses **pnpm** (`packageManager` in `package.json`).

- Install: `pnpm install` (do not use npm/yarn for installs in this repo).
- Scripts: `pnpm run <script>` / `pnpm exec <bin>`.
- Lockfile: `pnpm-lock.yaml` only — do not commit `package-lock.json` or `yarn.lock`.
- Local disk: pnpm's content-addressable store shares package contents across checkouts on the same machine.

## Dependency and deploy notes

### Tier B - Docker services (nightly on dev)

- Nightly GitHub Action (`.github/workflows/nightly-minor-deps-release.yml`) runs on **`dev`**:
  1. npm-check-updates `--target semver` with `--cooldown 3` (raises package.json in-major ranges; lockfile re-resolved after)
  2. lint/test when scripts exist
  3. if package.json ranges changed: lint/test; **release only when a production dependency moved** (`dependencies` / `optionalDependencies` / `peerDependencies`) — patch bump, commit, GitHub Release, image. `devDependencies`-only updates commit without releasing
- The nightly action still commits and releases on **`dev`**. Afterwards, sync `main` from `dev` (and backmerge) so `main` remains the release branch and does not fall behind.
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
npm start
pnpm run dev
```

## Testing

- `pnpm test` runs the built-in `node:test` suite in `test/` — no extra test framework or test dependencies.
- Tests start the exported app on an ephemeral port and make real HTTP requests, so the full middleware stack (Helmet, CSRF, CORS, rate limiting) and route handlers are exercised.
- The suite creates its image fixture under `content/images/__test__` and deletes it afterwards. `content/` is gitignored — never commit fixtures or uploaded images.
- **Every bug fix needs a regression test** that fails without the fix.
- Do not throw from middleware for request metadata you dislike (for example an unknown CORS `Origin`). Omit headers or return a 4xx, and cover the behaviour with a test. Throwing turns the response into an opaque 500.
- CI (`.github/workflows/node26-build.yml`) runs `pnpm test` on every PR to `dev`/`main`; the nightly workflow also runs `pnpm test` when the script exists.

ESLint is a devDependency but the repo has no `eslint.config.*`, so `pnpm exec eslint .` currently fails. Use `node --check <file>` for syntax checks until a config is added.

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
