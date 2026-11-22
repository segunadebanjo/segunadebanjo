# InsurePress Studio — production image (API + built React client + headless Chromium)

# ---- 1. Build the React client --------------------------------------------------------------
FROM node:22-bookworm-slim AS client
WORKDIR /app
COPY shared ./shared
COPY client/package.json client/package-lock.json ./client/
RUN cd client && npm ci --no-audit --no-fund
COPY client ./client
RUN cd client && npm run build

# ---- 2. Runtime --------------------------------------------------------------------------------
FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    PORT=5050 \
    EXPORT_DIR=/app/exports \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Chromium renders the print PDFs, cover PNGs and EPUB covers. DejaVu covers the Naira sign (₦).
RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium fonts-dejavu-core fonts-liberation ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev --no-audit --no-fund
COPY server ./server
COPY shared ./shared
COPY database ./database
COPY --from=client /app/client/dist ./client/dist
RUN mkdir -p /app/exports && chown -R node:node /app/exports

USER node
EXPOSE 5050
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:5050/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/index.js"]
