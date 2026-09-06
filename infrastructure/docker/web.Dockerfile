# syntax=docker/dockerfile:1.7
FROM node:24-alpine AS build

RUN corepack enable
WORKDIR /app
ENV NEXT_STANDALONE=true
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web ./apps/web
RUN --mount=type=cache,id=delivereats-pnpm-store,target=/pnpm/store,sharing=locked \
    pnpm config set store-dir /pnpm/store \
    && pnpm install --frozen-lockfile --ignore-scripts \
    && pnpm rebuild sharp esbuild
RUN pnpm --filter @delivereats/web build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
