# syntax=docker/dockerfile:1

# --- Build: Frontend (Vite) und Server (esbuild-Bundle) bauen ---
# Das Ergebnis ist reines JavaScript, daher läuft diese Stufe nativ auf der Build-Maschine statt emuliert.
FROM --platform=$BUILDPLATFORM node:24-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Laufzeit: nur Node und das Bundle, keine node_modules ---
FROM node:24-bookworm-slim
WORKDIR /app

LABEL org.opencontainers.image.source="https://github.com/luka-lta/druckwunsch" \
      org.opencontainers.image.description="Familien-Warteschlange für 3D-Druckwünsche"

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/app/data

COPY --from=build /app/dist ./dist
RUN mkdir -p /app/data && chown node:node /app/data

USER node
EXPOSE 3000
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/server.js"]
