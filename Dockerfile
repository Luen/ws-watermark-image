# syntax=docker/dockerfile:1

# Express + sharp image watermarker. Sharp ships glibc prebuilds — no system
# libvips/build toolchain needed on bookworm-slim (unlike Alpine/musl).

FROM node:24.22.1-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205

WORKDIR /app

ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@12.8.1 --activate \
  && pnpm install --frozen-lockfile --prod \
  && (pnpm store prune || true)

COPY index.js Wanderstories-logo.png favicon.ico ./

RUN mkdir -p content/images \
  && chown -R node:node /app

USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||8080)+'/', (r) => process.exit(r.statusCode===200?0:1)).on('error', () => process.exit(1))"

CMD ["node", "index.js"]
