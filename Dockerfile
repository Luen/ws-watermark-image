# syntax=docker/dockerfile:1

# Express + sharp image watermarker. Sharp ships glibc prebuilds — no system
# libvips/build toolchain needed on bookworm-slim (unlike Alpine/musl).

FROM node:24-bookworm-slim@sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e

WORKDIR /app

ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate && ppnpm install --frozen-lockfile --prod && npm cache clean --force

COPY index.js Wanderstories-logo.png favicon.ico ./

RUN mkdir -p content/images \
  && chown -R node:node /app

USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||8080)+'/', (r) => process.exit(r.statusCode===200?0:1)).on('error', () => process.exit(1))"

CMD ["node", "index.js"]
