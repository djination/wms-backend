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
RUN npx prisma generate --schema prisma/schema.prisma \
  && npx prisma generate --schema prisma/schema-platform.prisma \
  && npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

ARG FLYWAY_VERSION=11.3.4
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates curl \
  && curl -fsSL "https://repo1.maven.org/maven2/org/flywaydb/flyway-commandline/${FLYWAY_VERSION}/flyway-commandline-${FLYWAY_VERSION}-linux-x86_64.tar.gz" \
    | tar xz -C /opt \
  && ln -sf "/opt/flyway-${FLYWAY_VERSION}/flyway" /usr/local/bin/flyway \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./
COPY --from=build /app/db ./db
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/src/generated ./src/generated

RUN chmod +x scripts/docker-entrypoint.sh

EXPOSE 4000
ENTRYPOINT ["sh", "scripts/docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
