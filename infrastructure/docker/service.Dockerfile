# syntax=docker/dockerfile:1.7
FROM node:24-alpine AS build

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages
COPY services ./services

RUN --mount=type=cache,id=delivereats-pnpm-store,target=/pnpm/store,sharing=locked \
    pnpm config set store-dir /pnpm/store \
    && pnpm install --frozen-lockfile

ARG SERVICE_NAME
RUN pnpm --filter @delivereats/shared-types build \
    && pnpm --filter @delivereats/shared-config build \
    && pnpm --filter @delivereats/shared-utils build \
    && pnpm --filter @delivereats/backend-kit build \
    && pnpm --filter "$SERVICE_NAME" db:generate \
    && pnpm --filter "$SERVICE_NAME" build

RUN --mount=type=cache,id=delivereats-pnpm-store,target=/pnpm/store,sharing=locked \
    pnpm config set store-dir /pnpm/store \
    && pnpm --filter "$SERVICE_NAME" deploy /runtime

FROM node:24-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build --chown=node:node /runtime ./
COPY --from=build /app/packages ./packages
COPY infrastructure/docker/service-entrypoint.sh /usr/local/bin/service-entrypoint
COPY --chown=node:node scripts/admin-create.mjs /app/scripts/admin-create.mjs
RUN chmod +x /usr/local/bin/service-entrypoint
RUN mkdir -p /app/private-files && chown node:node /app/private-files
USER node

ENTRYPOINT ["service-entrypoint"]
