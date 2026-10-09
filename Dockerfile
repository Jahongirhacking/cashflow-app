# syntax=docker/dockerfile:1.7
# My Cashify API — production image for the NestJS backend (apps/api).
#
# Stages: deps (workspace dev deps) → build (shared + api compiled, then `pnpm deploy` prunes a
#         production-only tree for the API) → runtime (alpine, non-root, compiled output + pruned deps).
# The web app (apps/mobile) is a static export served elsewhere; it is not part of this image.

ARG NODE_VERSION=24-alpine
ARG PNPM_VERSION=10.27.0

# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS base
ARG PNPM_VERSION
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app

# Workspace manifests only: keeps the dependency layer cacheable across source changes.
# apps/mobile's manifest is copied so the workspace matches pnpm-lock.yaml; its deps are never installed.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/mobile/package.json apps/mobile/
COPY packages/shared/package.json packages/shared/
COPY packages/config/package.json packages/config/

# ---------------------------------------------------------------------------
FROM base AS deps
# --ignore-scripts: the root postinstall builds @finance/shared, which happens explicitly in the build stage.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts --filter "@finance/api..." --filter "@finance/shared..."

# ---------------------------------------------------------------------------
FROM deps AS build
COPY packages/config packages/config
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @finance/shared build \
 && pnpm --filter @finance/api build \
 # Pruned production tree for the API alone (~100 MB): its runtime deps plus a copy of @finance/shared.
 # The hoisted workspace install would otherwise drag the mobile app's React Native deps along.
 && pnpm --filter @finance/api --prod deploy --legacy /out

# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS runtime
ENV NODE_ENV=production
ENV PORT=3000
# Users file store (only used when GOOGLE_SPREADSHEET_ID is empty). Mount a volume here in production.
ENV DATA_DIR=/data
WORKDIR /app

COPY --from=build --chown=node:node /out/package.json ./package.json
COPY --from=build --chown=node:node /out/node_modules ./node_modules
COPY --from=build --chown=node:node /out/dist ./dist
RUN mkdir -p /data && chown node:node /data

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" >/dev/null || exit 1
CMD ["node", "dist/main.js"]
