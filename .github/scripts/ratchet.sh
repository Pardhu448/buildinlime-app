#!/usr/bin/env bash
# Quality ratchet — baseline-count style.
#
# typecheck and lint are RED at the baseline (see agentGuides/testingAndCiSetup.md),
# so CI cannot gate on green. Instead each workspace has a committed MAX error
# count in .github/quality-baseline.json. This fails only when a count EXCEEDS its
# baseline (a net regression); when a count drops, it says so and asks you to lower
# the baseline, which is how the debt ratchets down.
#
# Chosen over a changed-files ratchet on purpose: whole-file dirty conditions
# (historically mobile's `AppRouter = any`, since fixed by the contracts package)
# mean simply *touching* a dirty file would fail a changed-files gate for errors
# you did not introduce. A count baseline only punishes actually adding errors.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BASELINE="$ROOT/.github/quality-baseline.json"
SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"
fail=0

{
  echo "## Quality ratchet"
  echo ""
  echo "| workspace | check | baseline | current | status |"
  echo "|---|---|---:|---:|---|"
} >> "$SUMMARY"

# count_errors <check-name> <output>
count_errors() {
  if [ "$1" = "typecheck" ]; then
    printf '%s\n' "$2" | grep -cE 'error TS' || true
  else
    # eslint summary line: "✖ N problems (E errors, W warnings)"
    printf '%s\n' "$2" | grep -oE '[0-9]+ error' | head -1 | grep -oE '^[0-9]+' || echo 0
  fi
}

# NOTE ON FILTERS: pass a PATH (./web-app/code), never a package name.
# The root workspace package is itself named `buildinlime`, the same as
# web-app/code, and the root's own `typecheck` script is
# `pnpm --filter buildinlime typecheck && ...`. So `--filter buildinlime` matches
# BOTH packages, the root re-runs the web check nested inside its own output, and
# every error gets counted twice — the count came out at exactly 2x the real one.
# A path filter names exactly one package and cannot collide.
check() { # $1 pnpm filter (a path), $2 check-name (== npm script name), $3 baseline key
  local filter="$1" name="$2" key="${3:-$1}" out count base status
  out="$(pnpm --filter "$filter" "$name" 2>&1 || true)"
  count="$(count_errors "$name" "$out")"
  count="${count:-0}"
  base="$(jq -r --arg f "$key" --arg n "$name" '.[$f][$n]' "$BASELINE")"

  if [ "$count" -gt "$base" ]; then
    status="❌ regression (+$((count - base)))"
    fail=1
    echo "::error::${key} ${name}: ${count} errors exceeds baseline ${base}"
    printf '%s\n' "$out" | grep -E 'error( TS)?' | head -30
  elif [ "$count" -lt "$base" ]; then
    # FAILS, deliberately. A baseline left above the real count is tolerated
    # slack: the gap is exactly how many new errors a later PR could add without
    # this gate noticing. It has happened twice — once stale by 87, once when a
    # merge restored an older copy of this file and quietly gave mobile 30 back.
    # Making an improvement fail until the number is committed is what keeps the
    # ratchet monotonic.
    status="⬇️ improved (−$((base - count))) — LOWER THE BASELINE"
    fail=1
    echo "::error::${key} ${name}: ${count} is below baseline ${base} — update .github/quality-baseline.json to ${count} to lock the gain in"
  else
    status="✅ at baseline"
  fi
  echo "| ${key} | ${name} | ${base} | ${count} | ${status} |" >> "$SUMMARY"
  echo "${key} ${name}: current=${count} baseline=${base} → ${status}"
}

check ./web-app/code typecheck buildinlime
check ./web-app/code lint      buildinlime
check ./mobile-app  typecheck buildinlimemobile
check ./mobile-app  lint      buildinlimemobile
# Shared packages were born clean → baseline 0, i.e. a hard typecheck gate.
# (No lint entries: the packages have no eslint config yet.)
check "@buildinlime/contracts" typecheck
check "@buildinlime/sync-core" typecheck
check "@buildinlime/domain-types" typecheck

if [ "$fail" -ne 0 ]; then
  echo "" >> "$SUMMARY"
  echo "**A count is off its baseline. If it went UP, fix the new errors. If it went DOWN, lower the number in .github/quality-baseline.json so the gain cannot be given back.**" >> "$SUMMARY"
fi
exit "$fail"
