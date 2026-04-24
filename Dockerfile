# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS deps
WORKDIR /app
# Prisma generate (postinstall) membutuhkan DATABASE_URL; .env tidak ikut image.
ENV DATABASE_URL="postgresql://prisma:prisma@127.0.0.1:5432/prisma?schema=public"
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV DATABASE_URL="postgresql://prisma:prisma@127.0.0.1:5432/prisma?schema=public"
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
