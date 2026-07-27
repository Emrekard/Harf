FROM node:22-slim

WORKDIR /app

# better-sqlite3 için derleme araçları yalnızca kurulum sırasında gerekir.
COPY package*.json ./
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && npm ci --omit=dev \
    && apt-get purge -y python3 make g++ \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

COPY . .

# Veritabanı ve yüklenen faturalar kalıcı birimde tutulur.
VOLUME /app/data

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
