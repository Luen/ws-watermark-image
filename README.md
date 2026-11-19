# Wanderstories Image Watermark Proxy

[![Node 26 build](https://github.com/Luen/ws-watermark-image/actions/workflows/node26-build.yml/badge.svg)](https://github.com/Luen/ws-watermark-image/actions/workflows/node26-build.yml)
[![Docker Image](https://img.shields.io/badge/ghcr.io-ws--watermark--image-blue?logo=docker)](https://github.com/Luen/ws-watermark-image/pkgs/container/ws-watermark-image)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D26-brightgreen?logo=node.js)](https://nodejs.org/)
[![pnpm Version](https://img.shields.io/badge/pnpm-12-orange?logo=pnpm)](https://pnpm.io/)

A high-performance caching reverse proxy and image watermarking microservice built with **Express 5** and **sharp**.

It dynamically proxies Ghost CMS media from Wanderstories, overlays the brand watermark, optimizes the image, and caches the result locally on disk with an in-memory fallback.

---

## Features

- **On-the-Fly Image Watermarking**: Dynamically composites the Wanderstories brand logo onto requested images using `sharp`.
- **Ghost CMS Compatibility**:
  - Handles `/content/images/{*imagePath}` routes, supporting both original images and Ghost responsive derivative sizes (`/content/images/size/w<width>/...` and `/content/images/size/w<w>h<h>/...`).
  - Native 302 redirects: When an unconfigured or arbitrary width is requested, the proxy responds with `302 Found` to the original unresized image, matching Ghost CMS behavior and preventing storage exhaustion attacks.
- **Resilient Caching**:
  - Persists processed images on disk under `content/images/` for fast repeated static serving.
  - **Memory Fallback**: If disk write fails (e.g. read-only volume or permission mismatch), processed images are served directly from memory so requests never fail with a 500 error.
- **Security & Hardening**:
  - Path traversal protection (`path.resolve` boundary verification).
  - Configurable rate limiting via `express-rate-limit` with Draft-6 `RateLimit-*` headers.
  - Helmet security headers (CSP, Cross-Origin-Resource-Policy, Cross-Origin-Opener-Policy).
  - CORS allowlist for `wanderstories.space` origins without rejecting unknown browser origins.
- **Production Ready**:
  - Multi-architecture Docker images (`linux/amd64`, `linux/arm64`) published to GitHub Container Registry (GHCR).
  - Built-in HTTP health check endpoint (`GET /`).
  - Nightly automated dependency maintenance and release pipeline.

---

## How It Works

```
 Client Request
       │
       ▼
 ┌───────────────┐
 │ Express Proxy │ ──► Validate path & allowed Ghost image sizes
 └───────┬───────┘
         │
         ├───► Cached on disk? ─────────► [Serve static file] (200 OK)
         │
         └───► Cache miss:
                 │
                 ├──► Fetch upstream from Ghost origin (redirect: manual)
                 ├──► Check dimensions (max 2400w x 4000h)
                 ├──► Composite watermark logo with Sharp
                 ├──► Save to content/images/ (or memory fallback)
                 └──► [Serve watermarked image] (200 OK)
```

---

## Configuration

The service is configured via environment variables:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | Port for the HTTP server to listen on. |
| `TRUST_PROXY` | `1` | Express `trust proxy` setting (`1`, `true`, `false`, hop count, or subnet CIDR). |
| `ALLOWED_IMAGE_SIZES` | *(Ghost defaults)* | Comma-separated list of allowed responsive sizes (e.g. `w300,w600,w1000,w1200,w2000,w2400,w256h256`). |
| `ALLOWED_IMAGE_WIDTHS`| *(Ghost defaults)* | Alternative shorthand for numeric widths (e.g. `300,600,1000,1200,2000`). |
| `RATE_LIMIT_WINDOW_MS`| `900000` (15 min) | Rate limiting time window in milliseconds. |
| `RATE_LIMIT_MAX` | `800` | Maximum allowed requests per IP per window. |
| `MAX_CONCURRENT_IMAGE_JOBS` | `8` | Maximum simultaneous Sharp image compositing operations to prevent CPU/memory spikes. |
| `IMAGE_CACHE_CONTROL` | `public, max-age=31536000, immutable` | `Cache-Control` header sent with image responses. |

---

## Getting Started

### Prerequisites

- **Node.js**: `26.x` LTS or later (`.nvmrc` provided)
- **pnpm**: `v12.x`

### Installation

```bash
git clone https://github.com/Luen/ws-watermark-image.git
cd ws-watermark-image
pnpm install
```

### Running Locally

```bash
# Start production server
pnpm start

# Start development server with hot-reload (nodemon)
pnpm run dev
```

The server will start at `http://localhost:8080`.

### Running Tests

```bash
# Run the built-in node:test test suite
pnpm test

# Run ESLint
pnpm run lint
```

---

## Docker Deployment

### Docker Compose (Recommended)

A `docker-compose.yml` is included for easy deployment:

```yaml
services:
  watermark-service:
    image: ghcr.io/luen/ws-watermark-image:latest
    container_name: ws-watermark-image
    ports:
      - '8080:8080'
    environment:
      - PORT=8080
    volumes:
      - ./content:/app/content
    restart: unless-stopped
    healthcheck:
      test: ['CMD', 'node', '-e', "require('http').get('http://localhost:8080/', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

Run with:

```bash
docker compose up -d
```

### File Permissions Note

The Docker container runs as the non-root user `node` (`uid: 1000`, `gid: 1000`). When mounting a host directory to `./content`, ensure the host directory is writable by UID 1000:

```bash
mkdir -p content
sudo chown -R 1000:1000 content
```

If the volume is read-only or owned by another user, the proxy automatically falls back to in-memory serving without failing requests.

---

## Branching & Release Model

This repository follows **Trunk-Based Development**:

- All feature branches and bug fixes open Pull Requests directly against **`main`**.
- Releases, tags, and Docker images on GHCR are cut from **`main`**.
- An automated nightly GitHub Action keeps dependencies updated and publishes new versions when production dependencies change.

---

## License

[ISC](LICENSE) © [Luen Warneke](https://wanderstories.space/)
