#!/usr/bin/env bash
#
# Tests for deploy/deploy.sh's failure handling and image pruning.
#
#   bash deploy/deploy.test.sh
#
# WHY THIS EXISTS. deploy.sh rewrites compose.env in step 1, before anything
# else runs. For a long time the rollback lived only inside the smoke-test
# branch, so any EARLIER failure left compose.env naming a tag that might not be
# on the box. That is not theoretical: a full boot disk killed the `pull` in
# step 2, and production was left one `compose up` away from trying to start a
# half-pulled image. These tests pin the three recovery paths so that cannot
# regress:
#
#   1. fail BEFORE `up -d`  -> restore compose.env, do NOT touch containers
#   2. fail AFTER  `up -d`  -> restore compose.env AND bring the old tag back up
#   3. no previous tag      -> restore nothing, say so loudly, still fail
#
# Everything the script shells out to (docker, psql, curl) is stubbed on PATH.
# Nothing here touches a real registry, database or VM.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_SH="${SCRIPT_DIR}/deploy.sh"

PASS=0
FAIL=0

pass() { printf '  \033[1;32m✓\033[0m %s\n' "$1"; PASS=$((PASS + 1)); }
fail() { printf '  \033[1;31m✗\033[0m %s\n     %s\n' "$1" "$2"; FAIL=$((FAIL + 1)); }

check() { # check <label> <expected> <actual>
  if [[ "$2" == "$3" ]]; then pass "$1"; else fail "$1" "expected [$2], got [$3]"; fi
}
check_contains() { # check_contains <label> <needle> <haystack>
  if [[ "$3" == *"$2"* ]]; then pass "$1"; else fail "$1" "expected to contain [$2]"; fi
}
check_absent() {
  if [[ "$3" != *"$2"* ]]; then pass "$1"; else fail "$1" "expected NOT to contain [$2]"; fi
}

# ---------------------------------------------------------------------------
# Harness
# ---------------------------------------------------------------------------

# Builds a scratch APP_DIR plus stub docker/psql/curl, runs deploy.sh, and
# leaves the results in RUN_OUT / RUN_RC / the stub call log.
#
#   FAIL_PULL=1   docker compose pull exits 1   (the disk-full case)
#   FAIL_SMOKE=1  curl never returns 200        (bad image case)
#   PREV=<tag>    starting tag in compose.env; empty for a first-ever deploy
setup_and_run() {
  local prev="$1" fail_pull="${2:-0}" fail_smoke="${3:-0}"

  WORK="$(mktemp -d)"
  BIN="${WORK}/bin"
  mkdir -p "$BIN" "${WORK}/app/sql"
  CALLS="${WORK}/calls.log"
  : >"$CALLS"

  local app_dir="${WORK}/app"
  if [[ -n "$prev" ]]; then
    cat >"${app_dir}/compose.env" <<EOF
APP_IMAGE=asia-south1-docker.pkg.dev/buildinlime/buildinlime/app:${prev}
TOOLS_IMAGE=asia-south1-docker.pkg.dev/buildinlime/buildinlime/tools:${prev}
PUBLIC_DOMAIN=example.test
EOF
  else
    # No tag at all — grep -oP finds nothing, PREV_TAG ends up empty.
    cat >"${app_dir}/compose.env" <<EOF
PUBLIC_DOMAIN=example.test
EOF
  fi
  echo "DATABASE_URL=postgres://stub" >"${app_dir}/.env"
  : >"${app_dir}/docker-compose.prod.yaml"
  : >"${app_dir}/sql/02-electric-own-tables.sql"

  # --- stubs -------------------------------------------------------------
  cat >"${BIN}/docker" <<EOF
#!/usr/bin/env bash
echo "docker \$*" >>"${CALLS}"
case "\$1" in
  compose)
    for a in "\$@"; do
      if [[ "\$a" == pull ]]; then [[ "${fail_pull}" == 1 ]] && exit 1; fi
    done
    exit 0
    ;;
  images)
    # Two live tags plus three superseded ones, across app and tools.
    R=asia-south1-docker.pkg.dev/buildinlime/buildinlime
    echo "\$R/app:newtag"
    echo "\$R/app:${prev:-none}"
    echo "\$R/app:latest"
    echo "\$R/app:oldaaa"
    echo "\$R/tools:oldaaa"
    echo "\$R/app:oldbbb"
    echo "postgres:16"
    exit 0
    ;;
  *) exit 0 ;;
esac
EOF

  cat >"${BIN}/psql" <<EOF
#!/usr/bin/env bash
echo "psql \$*" >>"${CALLS}"
exit 0
EOF

  cat >"${BIN}/curl" <<EOF
#!/usr/bin/env bash
echo "curl \$*" >>"${CALLS}"
if [[ "${fail_smoke}" == 1 ]]; then echo 000; exit 0; fi
for a in "\$@"; do
  case "\$a" in
    *"/api/users")   echo 401; exit 0 ;;
    *"/api/.env")    echo 404; exit 0 ;;
  esac
done
echo 200
EOF

  # `sleep` is stubbed out so the 20x3s smoke retry loop does not make the
  # failure tests take a minute each.
  cat >"${BIN}/sleep" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF

  chmod +x "${BIN}"/*

  RUN_OUT="$(PATH="${BIN}:${PATH}" APP_DIR="${app_dir}" IMAGE_TAG=newtag \
    bash "$DEPLOY_SH" 2>&1)"
  RUN_RC=$?
  COMPOSE_ENV="$(cat "${app_dir}/compose.env")"
  CALL_LOG="$(cat "$CALLS")"
  rm -rf "$WORK"
}

# ---------------------------------------------------------------------------

echo
echo "1. failure BEFORE up -d (the disk-full pull)"
setup_and_run "oldtag" 1 0
check "exits non-zero" "1" "$RUN_RC"
check_contains "compose.env restored to the previous tag" "/app:oldtag" "$COMPOSE_ENV"
check_absent "compose.env no longer names the new tag" "/app:newtag" "$COMPOSE_ENV"
check_absent "containers were NOT recreated" "compose up -d" "${CALL_LOG//compose --env-file/compose}"
check_contains "says the containers are untouched" "still serving oldtag" "$RUN_OUT"

echo
echo "2. failure AFTER up -d (smoke test fails)"
setup_and_run "oldtag" 0 1
check "exits non-zero" "1" "$RUN_RC"
check_contains "compose.env restored to the previous tag" "/app:oldtag" "$COMPOSE_ENV"
check_contains "rolls the containers back too" "bringing oldtag back up" "$RUN_OUT"
check_contains "warns migrations are not reverted" "migrations are NOT reverted" "$RUN_OUT"

echo
echo "3. no previous tag recorded"
setup_and_run "" 1 0
check "exits non-zero" "1" "$RUN_RC"
check_contains "says there is nothing to roll back to" "no previous tag recorded" "$RUN_OUT"
check_contains "warns against compose up" "do not 'compose up'" "$RUN_OUT"

echo
echo "4. success prunes superseded images only"
setup_and_run "oldtag" 0 0
check "exits zero" "0" "$RUN_RC"
check_contains "compose.env left on the new tag" "/app:newtag" "$COMPOSE_ENV"
check_contains "reports success" "deployed newtag" "$RUN_OUT"
check_contains "removes a superseded app image" "removing asia-south1-docker.pkg.dev/buildinlime/buildinlime/app:oldaaa" "$RUN_OUT"
check_contains "removes a superseded tools image" "removing asia-south1-docker.pkg.dev/buildinlime/buildinlime/tools:oldaaa" "$RUN_OUT"
# The three that must survive: the tag just deployed, the rollback target, and
# latest. Losing PREV_TAG here would silently disarm the rollback in test 2.
check_absent "keeps the tag just deployed" "removing asia-south1-docker.pkg.dev/buildinlime/buildinlime/app:newtag" "$RUN_OUT"
check_absent "keeps the rollback target" "removing asia-south1-docker.pkg.dev/buildinlime/buildinlime/app:oldtag" "$RUN_OUT"
check_absent "keeps latest" "removing asia-south1-docker.pkg.dev/buildinlime/buildinlime/app:latest" "$RUN_OUT"
# Unrelated images (postgres, electric, caddy) are not ours to delete.
check_absent "leaves third-party images alone" "removing postgres:16" "$RUN_OUT"

echo
printf '\n%s passed, %s failed\n\n' "$PASS" "$FAIL"
[[ "$FAIL" -eq 0 ]]
