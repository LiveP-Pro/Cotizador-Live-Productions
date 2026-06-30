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
COPY index.html app.js styles.css equipment.js server.js README.md ./
COPY assets ./assets

RUN mkdir -p /data/cotizaciones-generadas "/data/Cuadros de Equipo"

EXPOSE 8787
VOLUME ["/data"]

CMD ["node", "--no-warnings", "server.js"]
