FROM node:22-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web-client/package.json apps/web-client/package.json
COPY apps/web-admin/package.json apps/web-admin/package.json
COPY apps/web-pro/package.json apps/web-pro/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/database/package.json packages/database/package.json
RUN pnpm install --frozen-lockfile

FROM dependencies AS builder
ARG NEXT_PUBLIC_API_URL=/backend
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY . .
RUN pnpm --filter @fixmy/database generate \
  && pnpm --filter @fixmy/api build \
  && pnpm --filter @fixmy/web-client build \
  && pnpm --filter @fixmy/web-admin build \
  && pnpm --filter @fixmy/web-pro build

FROM builder AS runtime
ENV NODE_ENV=production
EXPOSE 3000 3001 3002 4000
CMD ["node", "apps/api/dist/main.js"]
