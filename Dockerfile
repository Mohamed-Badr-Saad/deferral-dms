FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
COPY package.json pnpm-lock.yaml ./
# Prefer a reproducible install from the committed lockfile; fall back to a
# regular install (which updates the lockfile inside the image) if
# package.json and pnpm-lock.yaml have drifted apart. Run `pnpm install`
# locally and commit the refreshed pnpm-lock.yaml when you see the fallback
# fire, so builds go back to being fully reproducible.
RUN pnpm install --frozen-lockfile || pnpm install --no-frozen-lockfile

FROM dependencies AS builder
COPY . .
# Build-time placeholders only; real credentials are provided at runtime.
ENV DOCKER_BUILD=1 NEXT_TELEMETRY_DISABLED=1
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build BETTER_AUTH_SECRET=build-only-placeholder-not-a-runtime-secret pnpm build

FROM dependencies AS migrate
COPY src/db/migrations ./src/db/migrations
COPY deploy/migrate.mjs ./deploy/migrate.mjs
USER node
CMD ["node", "deploy/migrate.mjs"]

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
RUN mkdir -p public/uploads .next/cache && chown -R node:node public/uploads .next/cache
USER node
EXPOSE 3000
CMD ["node", "server.js"]
