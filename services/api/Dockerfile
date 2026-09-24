# Der Datenbank-Dienst als Container — fuer einen Server im Netz, damit die
# Apps auf dem Handy ihn erreichen. Node ohne Fremdbibliotheken, darum kein
# npm install. Die Daten (Konten, Bilder, Mail-Tresor) liegen unter /data:
# das Verzeichnis als Volume einhaengen, sonst sind sie nach einem Neustart weg.
#
#   docker build -t better-api services/api
#   docker run -d --name better-api -p 8090:8090 -v better-data:/data \
#     -e BETTER_API_TOKEN=<langes Geheimnis> -e BETTER_DATA_KEY=<64 Hex> \
#     -e BETTER_TRUST_PROXY=1 better-api
#
# Davor gehoert ein Reverse-Proxy mit HTTPS (Caddy, nginx, oder der Anbieter
# selbst) — iOS und Android lassen die App sonst nicht verbinden.
FROM node:22-alpine

WORKDIR /app
COPY . .

ENV NODE_ENV=production \
    PORT=8090 \
    BETTER_DATA_DIR=/data \
    BETTER_ADMIN_PORT=0

RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8090

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:8090/v1/health || exit 1

CMD ["node", "server.js"]
