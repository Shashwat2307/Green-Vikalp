FROM oven/bun:1.3 AS base
WORKDIR /app

# Cache bust: 2026-07-07

COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/zod/package.json packages/zod/package.json

RUN bun install

COPY apps/api apps/api
COPY packages/db packages/db
COPY packages/zod packages/zod

RUN cd packages/db && bunx prisma generate

EXPOSE 3001
CMD ["bun", "run", "apps/api/index.ts"]
