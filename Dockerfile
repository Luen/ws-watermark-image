# syntax=docker/dockerfile:1

# Express + sharp image watermarker. Sharp ships glibc prebuilds — no system
# libvips/build toolchain needed on bookworm-slim (unlike Alpine/musl).

FROM node:26.13.0-bookworm-slim@sha256:bc0a2afd3b74ce12222fc8bab99271e66257f021078f5f4a5d687a77d280c1d9

WORKDIR /app

ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm@12.8.1 \
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
