FROM node:20-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY scripts ./scripts
COPY src ./src

EXPOSE 3443 3080

# gera o certificado se ausente, aplica as migracoes pendentes e sobe o servico
CMD ["sh", "-c", "sh scripts/gerar-certificado.sh && npx prisma migrate deploy && node src/app.js"]
