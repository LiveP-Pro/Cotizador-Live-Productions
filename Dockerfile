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

COPY package.json ./
COPY index.html app.js styles.css equipment-catalog.js equipment-inventory.js equipment.js server.js platform-server.js README.md ./
COPY warehouse-module.html warehouse-inventory.css inventory.js inventory-initial-state.json ./
COPY assets ./assets
COPY luxury/package.json luxury/server.js ./luxury/
COPY luxury/lib ./luxury/lib
COPY luxury/public ./luxury/public

RUN mkdir -p /data/cotizaciones-generadas "/data/Cuadros de Equipo" /data/luxury-travel-backups

EXPOSE 8787

CMD ["node", "--no-warnings", "platform-server.js"]
