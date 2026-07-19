#!/usr/bin/env bash
#
# Deploy a new image tag. Runs ON the VM, invoked by CI over IAP-tunnelled SSH
# (or by hand). Implements the §6/§7 ordering from deploymentPlan.md.
#
#   sudo IMAGE_TAG=<sha> bash /opt/buildinlime/deploy.sh
#
# The ordering is the point of this script:
#   1. pull      — fail before touching anything if the image is missing
#   2. migrate   — schema first, so the new app never meets an old schema
#   3. sweep     — ownership transfer; Electric configures tables lazily, so a
#                  missed sweep fails at first sync in PRODUCTION, not here (§4.2.2)
#   4. up -d     — Compose recreates only changed services, leaving Electric's
#                  replication slot alone (verified §12)
#   5. smoke     — and roll back the tag if it fails
#
set -euo pipefail

APP_DIR=/opt/buildinlime
IMAGE_TAG="${IMAGE_TAG:?set IMAGE_TAG}"
REGION="${REGION:-asia-south1}"
PROJECT="${PROJECT:-buildinlime}"
AR_REPO="${AR_REPO:-buildinlime}"
REGISTRY="${REGION}-docker.pkg.dev/${PROJECT}/${AR_REPO}"

cd "$APP_DIR"

COMPOSE=(docker compose --env-file compose.env --env-file .env -f docker-compose.prod.yaml)

step() { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }

# Remember the current tag so a failed smoke test can roll back.
PREV_TAG=$(grep -oP '(?<=/app:).*' compose.env || echo "")
step "deploying ${IMAGE_TAG} (previous: ${PREV_TAG:-none})"

step "1/5 point compose at the new tag"
sed -i "s|/app:.*|/app:${IMAGE_TAG}|" compose.env
sed -i "s|/tools:.*|/tools:${IMAGE_TAG}|" compose.env
grep -E '^(APP|TOOLS)_IMAGE=' compose.env

step "2/5 pull"
"${COMPOSE[@]}" pull -q app 2>&1 | tail -2
"${COMPOSE[@]}" --profile tools pull -q app-tools 2>&1 | tail -2

step "3/5 migrate"
"${COMPOSE[@]}" --profile tools run --rm app-tools pnpm migrate 2>&1 | tail -5

step "4/5 electric ownership sweep"
# MUST run after every migration. drizzle-kit runs as the app role, so any table
# a migration creates is owned by `app` and Electric cannot add it to its
# publication or set REPLICA IDENTITY FULL on it. Electric configures tables
# lazily on first shape request, so a missed sweep surfaces as a broken sync in
# production rather than a failed deploy. See deploymentPlan.md §4.2.2.
DB_URL=$(grep -oP '(?<=^DATABASE_URL=).*' .env)
psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "${APP_DIR}/sql/02-electric-own-tables.sql"

step "5/5 restart"
"${COMPOSE[@]}" up -d 2>&1 | tail -5
"${COMPOSE[@]}" ps --format 'table {{.Service}}\t{{.Status}}'

step "smoke test"
ok=true
for i in $(seq 1 20); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://localhost/api/auth/get-session || echo 000)
  [[ "$code" == "200" ]] && break
  [[ $i -eq 20 ]] && ok=false
  sleep 3
done

if $ok; then
  # /api/users must be 401, not 500 — proves the auth gate is intact and the
  # route manifest (scripts/generate-api-routes.mjs) loaded.
  users=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://localhost/api/users || echo 000)
  probe=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://localhost/api/.env || echo 000)
  echo "  /api/auth/get-session : 200"
  echo "  /api/users            : ${users} (expect 401)"
  echo "  /api/.env             : ${probe} (expect 404)"
  [[ "$users" == "401" && "$probe" == "404" ]] || ok=false
fi

if ! $ok; then
  printf '\n\033[1;31m✗ smoke test FAILED\033[0m\n'
  if [[ -n "$PREV_TAG" ]]; then
    echo "  rolling back to ${PREV_TAG}"
    sed -i "s|/app:.*|/app:${PREV_TAG}|" compose.env
    sed -i "s|/tools:.*|/tools:${PREV_TAG}|" compose.env
    "${COMPOSE[@]}" up -d 2>&1 | tail -3
    echo "  rolled back. NOTE: migrations are NOT reverted — if this deploy applied"
    echo "  a schema change, the previous image may not be compatible with it."
  fi
  exit 1
fi

printf '\n\033[1;32m✓ deployed %s\033[0m\n' "$IMAGE_TAG"
