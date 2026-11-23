FROM node:22-bookworm-slim

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8787
ENV COTIZADOR_DATA_DIR=/data
ENV CHROME_PATH=/usr/bin/chromium

RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium ca-certificates fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY index.html app.js styles.css equipment-catalog.js equipment-inventory.js equipment.js server.js warehouse-ledger.cjs platform-server.js README.md ./
COPY warehouse-module.html warehouse-inventory.css inventory.js inventory-initial-state.json warehouse-import.cjs warehouse-import-review.js ./
COPY warehouse-xlsx-normalize.cjs ./
COPY warehouse-import-corrections.js ./
COPY equipment-service-import.cjs equipment-service-import.js equipment-service-import.css ./
COPY live-access.js live-users.cjs live-warehouse-access.cjs ./
COPY scripts/live-users-admin.cjs ./scripts/
COPY equipment-event-store.cjs equipment-event-personalizer.js equipment-event-personalizer.css equipment-extras-library.js equipment-extras-library.css equipment-workspace.js equipment-workspace.css ./
COPY equipment-name-picker.js equipment-name-picker.css ./
COPY equipment-identity.js equipment-document-audit.js equipment-planner.js equipment-planner.css equipment-batch-events.js equipment-batch-events.css equipment-event-import.cjs equipment-reporting.cjs ./
COPY equipment-report-viewer.js equipment-report-viewer.css ./
COPY assets ./assets
COPY luxury/package.json luxury/server.js ./luxury/
COPY luxury/lib ./luxury/lib
COPY luxury/public ./luxury/public

RUN mkdir -p /data/cotizaciones-generadas "/data/Cuadros de Equipo" /data/luxury-travel-backups

EXPOSE 8787

CMD ["node", "--no-warnings", "platform-server.js"]
