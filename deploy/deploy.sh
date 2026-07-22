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
#   6. prune     — evict superseded images; the boot disk is finite (see below)
#
# Failure handling is a single EXIT trap, NOT per-step cleanup. Step 1 rewrites
# compose.env before anything else runs, so ANY later failure used to leave the
# file pointing at a tag that may not even be on the box — while the rollback
# lived only inside the smoke-test branch and so never ran for an earlier
# failure. That is exactly what happened when a full disk killed the pull: the
# containers kept serving the old image (correct), but compose.env named the new
# one, so the next `compose up` or a reboot would have tried to start a tag that
# was never fully pulled.
set -euo pipefail

# Overridable only so deploy.test.sh can point it at a scratch directory. In
# production CI always leaves it unset, and the default is what runs.
APP_DIR="${APP_DIR:-/opt/buildinlime}"
IMAGE_TAG="${IMAGE_TAG:?set IMAGE_TAG}"
REGION="${REGION:-asia-south1}"
PROJECT="${PROJECT:-buildinlime}"
AR_REPO="${AR_REPO:-buildinlime}"
REGISTRY="${REGION}-docker.pkg.dev/${PROJECT}/${AR_REPO}"

cd "$APP_DIR"

COMPOSE=(docker compose --env-file compose.env --env-file .env -f docker-compose.prod.yaml)

step() { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }

# Remember the current tag so any failure can roll back to it.
PREV_TAG=$(grep -oP '(?<=/app:).*' compose.env || echo "")
step "deploying ${IMAGE_TAG} (previous: ${PREV_TAG:-none})"

# Set once the smoke test has passed; tells the trap there is nothing to undo.
DEPLOY_OK=false
# Set the moment `up -d` has run. Before that point the containers are still on
# PREV_TAG and rolling back means editing compose.env and NOTHING ELSE — calling
# `up -d` there would recreate containers this deploy never touched.
CONTAINERS_RECREATED=false

point_compose_at() {
  sed -i "s|/app:.*|/app:${1}|" compose.env
  sed -i "s|/tools:.*|/tools:${1}|" compose.env
}

on_exit() {
  local rc=$?
  trap - EXIT
  # Explicit `if`, not `$DEPLOY_OK && exit 0`: the && form leans on set -e's
  # exemption for non-final commands in a list, which is exactly the kind of
  # subtlety that should not decide whether production rolls back.
  if $DEPLOY_OK; then
    exit 0
  fi

  printf '\n\033[1;31m✗ deploy FAILED (exit %s)\033[0m\n' "$rc"

  if [[ -z "$PREV_TAG" ]]; then
    # First-ever deploy, or compose.env had no tag to read. Nothing to go back
    # to, so say so loudly rather than pretending we recovered.
    echo "  no previous tag recorded — compose.env still names ${IMAGE_TAG}."
    echo "  Fix the cause, then re-run; do not 'compose up' until you do."
    exit "$rc"
  fi

  echo "  restoring compose.env to ${PREV_TAG}"
  point_compose_at "$PREV_TAG"

  if $CONTAINERS_RECREATED; then
    echo "  containers were already recreated — bringing ${PREV_TAG} back up"
    "${COMPOSE[@]}" up -d 2>&1 | tail -3 || true
    echo "  rolled back. NOTE: migrations are NOT reverted — if this deploy applied"
    echo "  a schema change, the previous image may not be compatible with it."
  else
    echo "  containers were never recreated; they are still serving ${PREV_TAG}."
  fi
  exit "$rc"
}
trap on_exit EXIT

step "1/6 point compose at the new tag"
point_compose_at "$IMAGE_TAG"
grep -E '^(APP|TOOLS)_IMAGE=' compose.env

step "2/6 pull"
"${COMPOSE[@]}" pull -q app 2>&1 | tail -2
"${COMPOSE[@]}" --profile tools pull -q app-tools 2>&1 | tail -2

step "3/6 migrate"
"${COMPOSE[@]}" --profile tools run --rm app-tools pnpm migrate 2>&1 | tail -5

step "4/6 electric ownership sweep"
# MUST run after every migration. drizzle-kit runs as the app role, so any table
# a migration creates is owned by `app` and Electric cannot add it to its
# publication or set REPLICA IDENTITY FULL on it. Electric configures tables
# lazily on first shape request, so a missed sweep surfaces as a broken sync in
# production rather than a failed deploy. See deploymentPlan.md §4.2.2.
DB_URL=$(grep -oP '(?<=^DATABASE_URL=).*' .env)
psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "${APP_DIR}/sql/02-electric-own-tables.sql"

step "5/6 restart"
"${COMPOSE[@]}" up -d 2>&1 | tail -5
# From here on a rollback means more than editing compose.env.
CONTAINERS_RECREATED=true
"${COMPOSE[@]}" ps --format 'table {{.Service}}\t{{.Status}}'

step "smoke test"
# Hit the PUBLIC HTTPS URL, not http://localhost.
#
# Caddy 308-redirects HTTP to HTTPS, so `curl http://localhost/...` returns 308
# forever and never 200. The first real run of this script rolled back a
# perfectly healthy deploy because of exactly that: the image was fine,
# migrations applied, containers came up — and the check was wrong.
#
# The public URL is also the more honest test: it exercises DNS, the certificate,
# Caddy's routing and the app, which is what "deployed" actually means. It
# hairpins back to this VM, which is verified to work from here.
BASE="https://$(grep -oP '(?<=^PUBLIC_DOMAIN=).*' compose.env)"
ok=true
last=000
for i in $(seq 1 20); do
  last=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$BASE/api/auth/get-session" || echo 000)
  [[ "$last" == "200" ]] && break
  [[ $i -eq 20 ]] && ok=false
  sleep 3
done

if $ok; then
  # /api/users must be 401, not 500 — proves the auth gate is intact and the
  # route manifest (scripts/generate-api-routes.mjs) loaded.
  users=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$BASE/api/users" || echo 000)
  probe=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$BASE/api/.env" || echo 000)
  echo "  ${BASE}"
  echo "  /api/auth/get-session : 200"
  echo "  /api/users            : ${users} (expect 401)"
  echo "  /api/.env             : ${probe} (expect 404)"
  [[ "$users" == "401" && "$probe" == "404" ]] || ok=false
else
  # Print the evidence. Previously this branch printed NOTHING, so the first
  # failure gave no clue why — the diagnosis had to be redone by hand on the VM.
  echo "  ${BASE}/api/auth/get-session never returned 200 in 60s"
  echo "  last status: ${last}"
  echo "  --- app logs ---"
  "${COMPOSE[@]}" logs app --tail 20 2>&1 | sed 's/^/  /'
fi

if ! $ok; then
  printf '\n\033[1;31m✗ smoke test FAILED\033[0m\n'
  # The rollback itself lives in the EXIT trap, so this path and an earlier
  # failure recover identically. Keeping a second copy here is how the pull
  # failure ended up with no rollback at all.
  exit 1
fi

# ---------------------------------------------------------------------------
step "6/6 prune superseded images"
# The boot disk is 30 GB and shared with the OS (deploymentPlan.md §4.6.2), while
# every merge to main pulls TWO new images (app + tools). Nothing used to evict
# the old ones, so the disk filled and a deploy died mid-`pull` with
# "no space left on device" — after compose.env had already been rewritten.
#
# Deliberately NOT `docker image prune -a`: that would take PREV_TAG's images
# with it, and PREV_TAG is exactly what the trap above rolls back to. Keep the
# tag being deployed, the one before it, and `latest`; drop the rest of this
# repo's tags. Anything still referenced by a running container is refused by
# `docker rmi` anyway, so this cannot pull the floor out from under the app.
#
# Never fatal: a deploy that worked must not be reported as failed because a
# cleanup did not.
KEEP="${IMAGE_TAG}|latest"
if [[ -n "$PREV_TAG" ]]; then
  KEEP="${KEEP}|${PREV_TAG}"
fi
STALE=$(docker images --format '{{.Repository}}:{{.Tag}}' \
  | grep -E "^${REGISTRY}/(app|tools):" \
  | grep -vE ":(${KEEP})$" || true)
if [[ -n "$STALE" ]]; then
  echo "  keeping: ${IMAGE_TAG}, ${PREV_TAG:-none}, latest"
  echo "$STALE" | sed 's/^/  removing /'
  echo "$STALE" | xargs -r docker rmi >/dev/null 2>&1 || true
else
  echo "  nothing to remove"
fi
# Dangling layers left behind by `docker build`/failed pulls. Safe by definition:
# untagged and unreferenced.
docker image prune -f >/dev/null 2>&1 || true
df -h / | awk 'NR==2 {printf "  boot disk: %s used of %s (%s)\n", $3, $2, $5}'

DEPLOY_OK=true
printf '\n\033[1;32m✓ deployed %s\033[0m\n' "$IMAGE_TAG"
