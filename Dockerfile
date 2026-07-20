# syntax=docker/dockerfile:1
#
# BuildInLime web app — production image.
#
# Build context is the REPO ROOT, not web-app/code: the app depends on
# @buildinlime/{contracts,domain-types,sync-core} via workspace:*.
#
#   docker build -t buildinlime-app .
#
# Two targets:
#   --target runtime  (default) the server. `node dist/server/server.js`.
#   --target tools    same tree + devDeps, for `pnpm migrate` / `pnpm purge:resources`.
#
# See web-app/code/agentGuides/deploymentPlan.md §5.1.

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# corepack resolves the version from the root package.json "packageManager" field.
# That pin matters: pnpm 11 silently ignores the "pnpm.overrides" block (which pins
# react/react-dom to 19.1.0), and --frozen-lockfile then fails on a config mismatch.
RUN corepack enable
WORKDIR /repo

# ---------------------------------------------------------------------------
# deps — full install (dev included; the build needs vite/tanstack-start).
# Manifests are copied alone first so this layer caches across source edits.
# ---------------------------------------------------------------------------
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY packages/contracts/package.json      packages/contracts/
COPY packages/domain-types/package.json   packages/domain-types/
COPY packages/sync-core/package.json      packages/sync-core/
COPY web-app/code/package.json            web-app/code/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# build — compile the app, then produce a prod-only tree for the runtime stage.
# ---------------------------------------------------------------------------
FROM deps AS build
COPY packages/ packages/
COPY web-app/code/ web-app/code/

# Build-time dummies mirror ci.yml:41. Nothing connects at build time — the `/`
# prerender pulls in connection.ts, auth, and sendEmailOtp.ts (`new Resend(...)`
# at module load), all of which throw on missing env.
#   DISABLE_CADDY   — the vite plugin hard-exits when the caddy binary is absent
#                     (vite.config.ts:64).
#   STORAGE_DRIVER  — deliberately UNSET so the prerender builds no GCS client;
#                     storage/index.ts is lazy for exactly this reason.
#   NODE_OPTIONS    — pin DNS to IPv4, to stop an address-family mismatch during
#                     prerender. TanStack's prerender starts a Vite preview server
#                     and fetches `/` from it. Node resolves `localhost` verbatim,
#                     and in this image that binds the server to ::1 — while the
#                     failure in CI showed the client hitting 127.0.0.1 and finding
#                     nothing ("Prerendered 0 pages", then TypeError: fetch failed,
#                     ECONNREFUSED 127.0.0.1). Server and client on different
#                     families.
#
#                     Caveat: this was NOT reproduced locally. A container with
#                     IPv6 fully disabled binds 127.0.0.1 and works, so "the runner
#                     has no IPv6" does not explain it on its own — it would need
#                     IPv6 present but unroutable. ipv4first forces both sides onto
#                     IPv4 either way. If the prerender fails in CI again, this is
#                     the first assumption to re-test, not to trust.
RUN DISABLE_CADDY=1 \
    NODE_OPTIONS=--dns-result-order=ipv4first \
    DATABASE_URL=postgresql://postgres:password@localhost:5432/electric \
    BETTER_AUTH_SECRET=build-only-secret-000000000000000000000000 \
    BETTER_AUTH_URL=http://localhost:3000 \
    RESEND_API_KEY=re_build_dummy \
    pnpm --filter buildinlime build

# The server bundle leaves ALL runtime deps external — pg, @google-cloud/storage,
# better-auth, drizzle-orm, resend, @dotenvx/dotenvx and ~20 more are bare imports
# in dist/server/**. The image therefore needs a real node_modules; copying dist/
# alone yields MODULE_NOT_FOUND at startup.
#
# --legacy is required on pnpm 10 (ERR_PNPM_DEPLOY_NONINJECTED_WORKSPACE otherwise).
# .npmrc sets node-linker=hoisted, so /out/node_modules is a flat npm-style tree
# that copies cleanly between stages — no pnpm symlink farm to preserve.
RUN pnpm deploy --legacy --filter buildinlime --prod /out

# ---------------------------------------------------------------------------
# runtime — the service.
# ---------------------------------------------------------------------------
FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Cloud-agnostic: the app reads PORT (Nitro honours it). vite.config.ts's
# server.port is dev-only and does not affect this bundle.
ENV PORT=3000
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /repo/web-app/code/dist ./dist
# dist/server/server.js only EXPORTS a fetch handler — it does not listen. This entry
# is the adapter that serves it (and dist/client) over HTTP. See its header comment.
COPY deploy/server-entry.mjs ./server-entry.mjs
EXPOSE 3000
CMD ["node", "server-entry.mjs"]

# ---------------------------------------------------------------------------
# tools — migrations and the purge sweep. Needs devDeps (drizzle-kit, tsx) and
# the drizzle/ directory, which the runtime stage does not carry.
#   docker compose run --rm app-tools pnpm migrate
#   docker compose run --rm app-tools pnpm purge:resources -- --apply
# ---------------------------------------------------------------------------
FROM build AS tools
WORKDIR /repo/web-app/code
ENV NODE_ENV=production
CMD ["pnpm", "migrate"]
