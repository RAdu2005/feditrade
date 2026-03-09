FROM node:24-bookworm-slim AS base
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run prisma:generate

FROM base AS web
EXPOSE 3000
CMD ["sh", "-c", "npm run prisma:push && npm run dev -- -H 0.0.0.0 -p 3000"]

FROM base AS worker
CMD ["sh", "-c", "npm run prisma:push && npm run worker"]
