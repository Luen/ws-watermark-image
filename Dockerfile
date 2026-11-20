# syntax=docker/dockerfile:1

# Express + sharp image watermarker. Sharp ships glibc prebuilds — no system
# libvips/build toolchain needed on bookworm-slim (unlike Alpine/musl).

FROM node:26.13.1-bookworm-slim@sha256:5df79989ed685e09f0a98019db4cebfb22fb9df1a53c0161664a011f7ff6b0f1

WORKDIR /app

ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
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
