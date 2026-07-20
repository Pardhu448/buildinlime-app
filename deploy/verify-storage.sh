#!/usr/bin/env bash
#
# Verify the object-storage path in production — deploymentPlan.md §10 steps 7-10.
# Runs ON the VM (needs .env for DATABASE_URL and the VM's service account for
# gcloud storage), invoked by hand:
#
#   SESSION_COOKIE='__Secure-better-auth.session_token=...' sudo -E bash /opt/buildinlime/verify-storage.sh
#
# The cookie carries the __Secure- prefix in production (better-auth adds it over
# HTTPS). The unprefixed name authenticates as nobody, which surfaces here as a
# confusing "could not resolve a user" in preflight rather than an auth error.
#
# These are the security-critical assertions of the object-storage migration:
# `serveResourceFile` is the SOLE access gate (§12), so the negative tests in
# step 9 are the whole point. The steps run 7 -> 8 -> 10 -> 9 deliberately —
# step 10 needs a live, undeleted resource, and the soft-delete in step 9 is
# one-way for the rest of the run.
#
# The script MUTATES production data: it uploads a test resource, and it
# temporarily flips `member_flag` / sets `deleted_at` on rows it created. An EXIT
# trap restores membership and removes the test resource. Nothing it touches
# predates the run.
#
# Flags:
#   --keep    leave the test resource behind (default: remove it)
#   --large   also round-trip a 50 MB file through the streaming path
#
set -euo pipefail

APP_DIR=${APP_DIR:-/opt/buildinlime}
KEEP=false
LARGE=false
for arg in "$@"; do
  case "$arg" in
    --keep)  KEEP=true ;;
    --large) LARGE=true ;;
    *) echo "unknown flag: $arg" >&2; exit 2 ;;
  esac
done

cd "$APP_DIR"

FAILURES=0
step() { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }
pass() { printf '  \033[1;32m✓\033[0m %s\n' "$*"; }
fail() { printf '  \033[1;31m✗\033[0m %s\n' "$*"; FAILURES=$((FAILURES + 1)); }
note() { printf '    \033[2m%s\033[0m\n' "$*"; }

# expect <description> <actual> <expected>
expect() {
  if [[ "$2" == "$3" ]]; then pass "$1"; else fail "$1 — got '$2', want '$3'"; fi
}

# ---------------------------------------------------------------- preflight

step "preflight"

: "${SESSION_COOKIE:?set SESSION_COOKIE — copy the better-auth session cookie from devtools}"

for bin in curl psql gcloud python3 docker; do
  command -v "$bin" >/dev/null || { echo "missing required binary: $bin" >&2; exit 1; }
done

[[ -f .env ]]                      || { echo "no $APP_DIR/.env" >&2; exit 1; }
[[ -f docker-compose.prod.yaml ]]  || { echo "no $APP_DIR/docker-compose.prod.yaml" >&2; exit 1; }

DB_URL=$(grep -oP '(?<=^DATABASE_URL=).*' .env)
BUCKET=$(grep -oP '(?<=^GCS_BUCKET=).*' compose.env 2>/dev/null || echo buildinlime-resources)
DOMAIN=$(grep -oP '(?<=^PUBLIC_DOMAIN=).*' compose.env 2>/dev/null || echo app.buildinlime.com)
BASE_URL=${BASE_URL:-https://$DOMAIN}

COMPOSE=(docker compose --env-file compose.env --env-file .env -f docker-compose.prod.yaml)

# Hit the public URL, not localhost: this is the path real clients take, through
# Caddy and its certificate.
q() { psql "$DB_URL" -tAqc "$1"; }

# curl helper — emits "<http_code>" and writes the body to $BODY_FILE, or to
# $OUT_FILE when the caller sets it:  OUT_FILE=x req "$url"
#
# OUT_FILE exists because `req -o x` does NOT work: curl pairs -o with URLs
# positionally, so with a single URL the -o baked in below wins and the caller's
# is silently ignored — leaving their file uncreated and any cmp against it
# falsely reporting a mismatch.
BODY_FILE=$(mktemp)
req() {
  curl -sS -b "$SESSION_COOKIE" -o "${OUT_FILE:-$BODY_FILE}" -w '%{http_code}' --max-time 60 "$@" || echo 000
}

SESSION_JSON=$(curl -sS -b "$SESSION_COOKIE" --max-time 15 "$BASE_URL/api/auth/get-session" || echo '')
USER_ID=$(printf '%s' "$SESSION_JSON" | python3 -c \
  'import json,sys; d=sys.stdin.read().strip(); print((json.loads(d).get("user") or {}).get("id","") if d else "")' 2>/dev/null || echo "")

if [[ -z "$USER_ID" ]]; then
  echo "could not resolve a user from SESSION_COOKIE — is it current?" >&2
  exit 1
fi
pass "authenticated as $USER_ID"

# Find a channel this user is actually a member of. The upload requires all four
# ids, and the membership guard reads resource.channel_id.
read -r CHANNEL_ID BUILDUNIT_ID PROJECT_ID MEMBERSHIP_ID <<<"$(q "
  select channel_id, buildunit_id, project_id, id
  from memberships
  where user_id = '$USER_ID' and member_flag = true
  limit 1" | tr '|' ' ')"

if [[ -z "${CHANNEL_ID:-}" ]]; then
  echo "no active membership for $USER_ID — create a project/build unit/channel in the UI first" >&2
  exit 1
fi
pass "channel $CHANNEL_ID"

# --------------------------------------------------------------- teardown

RID=$(python3 -c 'import uuid; print(uuid.uuid4())')
WORK=$(mktemp -d)

cleanup() {
  local rc=$?
  step "cleanup"

  # Always restore membership — a run that dies mid-step-9 must not leave the
  # operator locked out of their own channel.
  if [[ -n "${MEMBERSHIP_ID:-}" ]]; then
    q "update memberships set member_flag = true where id = '$MEMBERSHIP_ID'" >/dev/null
    note "membership restored"
  fi

  if [[ "$KEEP" == true ]]; then
    note "keeping test resource $RID (--keep)"
  else
    q "delete from resources_raw where resource_id = '$RID'" >/dev/null 2>&1 || true
    q "delete from resources     where id          = '$RID'" >/dev/null 2>&1 || true
    gcloud storage rm --recursive "gs://$BUCKET/resources/$RID/" >/dev/null 2>&1 || true
    note "test resource $RID removed"
  fi

  rm -rf "$WORK" "$BODY_FILE"
  exit $rc
}
trap cleanup EXIT

# ------------------------------------------------- §10.7 — object lands as a key

step "7/10  upload — object lands at resources/<id>/<name>, storage_path holds a KEY"

# A filename with spaces and non-ASCII, to exercise the sanitiser at
# fileStorage.ts:54 ([^a-zA-Z0-9._-] -> _) in the same pass.
SRC="$WORK/mañana report.png"
head -c 65536 /dev/urandom >"$SRC"

code=$(req -F "file=@$SRC;type=image/png" \
           -F "resourceId=$RID" -F "name=verify-storage test" \
           -F "channelId=$CHANNEL_ID" -F "buildunitId=$BUILDUNIT_ID" \
           -F "projectId=$PROJECT_ID" \
           "$BASE_URL/api/resources/upload")
expect "upload returns 201" "$code" "201"
[[ "$code" == "201" ]] || { echo "  upload failed, cannot continue:"; cat "$BODY_FILE"; exit 1; }

STORAGE_PATH=$(q "select storage_path from resources_raw where resource_id = '$RID'")
ORIG_NAME=$(q    "select original_filename from resources_raw where resource_id = '$RID'")

# THE assertion of the whole migration: a key, not a path. A leading slash means
# something reintroduced local-disk semantics (and purge-resources.ts:125 would
# refuse to sweep).
expect "storage_path is a key, not an absolute path" \
  "$(case "$STORAGE_PATH" in /*) echo absolute ;; *) echo key ;; esac)" "key"
expect "storage_path is resources/<id>/<sanitised>" \
  "$STORAGE_PATH" "resources/$RID/ma_ana_report.png"
expect "original_filename is preserved unsanitised" "$ORIG_NAME" "mañana report.png"

if gcloud storage ls "gs://$BUCKET/$STORAGE_PATH" >/dev/null 2>&1; then
  pass "object present in gs://$BUCKET/$STORAGE_PATH"
else
  fail "object NOT found at gs://$BUCKET/$STORAGE_PATH"
fi

# --------------------------------------------------- §10.8 — download round-trip

step "8/10  download — byte-identical, correct headers, streaming path"

HDRS="$WORK/headers.txt"
OUT="$WORK/out.png"
code=$(curl -sS -b "$SESSION_COOKIE" -D "$HDRS" -o "$OUT" -w '%{http_code}' \
  --max-time 60 "$BASE_URL/api/resources/$RID/file" || echo 000)
expect "download returns 200" "$code" "200"

if cmp -s "$SRC" "$OUT"; then pass "bytes are identical"; else fail "bytes DIFFER from upload"; fi

hdr() { grep -i "^$1:" "$HDRS" | tail -1 | cut -d' ' -f2- | tr -d '\r'; }
expect "content-type round-trips"   "$(hdr content-type)"   "image/png"
expect "content-length matches"     "$(hdr content-length)" "$(stat -c%s "$SRC")"
expect "cache-control is private"   "$(hdr cache-control)"  "private, max-age=3600"

if [[ "$(hdr content-disposition)" == *attachment* ]]; then
  pass "content-disposition is attachment"
else
  fail "content-disposition not an attachment — got '$(hdr content-disposition)'"
fi

if [[ "$LARGE" == true ]]; then
  # Confirms gcs.ts:55 streams rather than buffering the object into memory.
  # Watch app RSS while this runs; it should stay flat.
  LRG="$WORK/large.bin"; LID=$(python3 -c 'import uuid; print(uuid.uuid4())')
  head -c 52428800 /dev/urandom >"$LRG"
  note "50 MB round-trip (app container RSS should stay flat)"
  code=$(req -F "file=@$LRG;type=application/octet-stream" \
             -F "resourceId=$LID" -F "name=verify-storage large" \
             -F "channelId=$CHANNEL_ID" -F "buildunitId=$BUILDUNIT_ID" \
             -F "projectId=$PROJECT_ID" "$BASE_URL/api/resources/upload")
  expect "50 MB upload returns 201" "$code" "201"
  code=$(OUT_FILE="$WORK/large.out" req "$BASE_URL/api/resources/$LID/file")
  expect "50 MB download returns 200" "$code" "200"
  if cmp -s "$LRG" "$WORK/large.out"; then pass "50 MB bytes identical"; else fail "50 MB bytes DIFFER"; fi
  q "delete from resources_raw where resource_id = '$LID'" >/dev/null
  q "delete from resources     where id          = '$LID'" >/dev/null
  gcloud storage rm --recursive "gs://$BUCKET/resources/$LID/" >/dev/null 2>&1 || true
fi

# ------------------------------------------------------ §10.10 — statelessness

step "10/10 statelessness — destroy the app container, files still serve"

APP_BEFORE=$("${COMPOSE[@]}" ps -q app)
ELEC_BEFORE=$("${COMPOSE[@]}" ps -q electric)

"${COMPOSE[@]}" rm -sf app >/dev/null 2>&1
"${COMPOSE[@]}" up -d app  >/dev/null 2>&1

for _ in $(seq 1 20); do
  [[ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$BASE_URL/api/auth/get-session")" == "200" ]] && break
  sleep 3
done

APP_AFTER=$("${COMPOSE[@]}" ps -q app)
ELEC_AFTER=$("${COMPOSE[@]}" ps -q electric)

# Without this the whole step is vacuous: `up -d` is a no-op when nothing changed,
# and re-downloading from the SAME container proves nothing about statelessness.
if [[ "$APP_BEFORE" != "$APP_AFTER" ]]; then
  pass "app container was genuinely recreated"
else
  fail "app container ID unchanged — nothing was destroyed, this step proved nothing"
fi

# App deploys must leave the replication slot alone (§1.3, §9, §12).
expect "electric container untouched" "$ELEC_AFTER" "$ELEC_BEFORE"

SLOT=$(q "select active::text || ',' || wal_status from pg_replication_slots
          where slot_name = 'electric_slot_default'" || echo "")
expect "replication slot still active/reserved" "$SLOT" "true,reserved"

# curl, not a browser — cache-control is private/max-age=3600, and a cache hit
# would validate the cache instead of the server.
code=$(OUT_FILE="$WORK/after.png" req "$BASE_URL/api/resources/$RID/file")
expect "file still served after container recreation" "$code" "200"
if cmp -s "$SRC" "$WORK/after.png"; then pass "bytes survive container destruction"; else fail "bytes DIFFER after recreation"; fi

# ----------------------------------------------- §10.9 — the negative tests

step "9/10  access gate — non-member 404, soft-deleted 404"

# Case A: membership revoked. fileStorage.ts:199-203 requires member_flag = true,
# so flipping the flag exercises the guard without needing a second account.
q "update memberships set member_flag = false where id = '$MEMBERSHIP_ID'" >/dev/null
code=$(req "$BASE_URL/api/resources/$RID/file")
NONMEMBER_BODY=$(cat "$BODY_FILE")
expect "non-member gets 404" "$code" "404"
q "update memberships set member_flag = true where id = '$MEMBERSHIP_ID'" >/dev/null

code=$(req "$BASE_URL/api/resources/$RID/file")
expect "access restored once membership returns" "$code" "200"

# Case B: soft delete. Must run while the BYTES ARE STILL PRESENT — otherwise the
# 404 comes from getStorage().get() returning null (fileStorage.ts:226), not from
# the deleted_at guard (:186), and the test passes for the wrong reason.
if gcloud storage ls "gs://$BUCKET/$STORAGE_PATH" >/dev/null 2>&1; then
  pass "object still in the bucket (so a 404 can only come from the guard)"
else
  fail "object already gone — the soft-delete test below would be meaningless"
fi

q "update resources set deleted_at = now(), deleted_by_id = '$USER_ID' where id = '$RID'" >/dev/null
code=$(req "$BASE_URL/api/resources/$RID/file")
DELETED_BODY=$(cat "$BODY_FILE")
expect "soft-deleted resource gets 404" "$code" "404"

if gcloud storage ls "gs://$BUCKET/$STORAGE_PATH" >/dev/null 2>&1; then
  pass "bytes outlive the soft delete (purge reclaims them, not the delete)"
else
  fail "bytes vanished on soft delete — unexpected; purge should own reclamation"
fi

# Case C: a resource that never existed.
code=$(req "$BASE_URL/api/resources/$(python3 -c 'import uuid; print(uuid.uuid4())')/file")
MISSING_BODY=$(cat "$BODY_FILE")
expect "nonexistent resource gets 404" "$code" "404"

# All three must be INDISTINGUISHABLE. If they ever diverge the endpoint becomes
# an existence oracle for resource ids — and ids are not secret: they survive in
# messages.resource_ids and in every client's local store from before a delete.
if [[ "$NONMEMBER_BODY" == "$DELETED_BODY" && "$DELETED_BODY" == "$MISSING_BODY" ]]; then
  pass "all three 404 bodies identical — no existence oracle"
else
  fail "404 bodies differ — leaks whether a resource exists"
  note "non-member: $NONMEMBER_BODY"
  note "deleted:    $DELETED_BODY"
  note "missing:    $MISSING_BODY"
fi

# ------------------------------------------------------------------ summary

step "summary"
if [[ $FAILURES -eq 0 ]]; then
  printf '\033[1;32m✓ §10 steps 7-10 all passed\033[0m\n'
else
  printf '\033[1;31m✗ %d check(s) failed\033[0m\n' "$FAILURES"
  exit 1
fi
