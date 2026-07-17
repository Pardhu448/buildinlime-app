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

check() { # $1 pnpm filter, $2 check-name (== npm script name)
  local filter="$1" name="$2" out count base status
  out="$(pnpm --filter "$filter" "$name" 2>&1 || true)"
  count="$(count_errors "$name" "$out")"
  count="${count:-0}"
  base="$(jq -r --arg f "$filter" --arg n "$name" '.[$f][$n]' "$BASELINE")"

  if [ "$count" -gt "$base" ]; then
    status="❌ regression (+$((count - base)))"
    fail=1
    echo "::error::${filter} ${name}: ${count} errors exceeds baseline ${base}"
    printf '%s\n' "$out" | grep -E 'error( TS)?' | head -30
  elif [ "$count" -lt "$base" ]; then
    status="⬇️ improved (−$((base - count))) — lower the baseline"
  else
    status="✅ at baseline"
  fi
  echo "| ${filter} | ${name} | ${base} | ${count} | ${status} |" >> "$SUMMARY"
  echo "${filter} ${name}: current=${count} baseline=${base} → ${status}"
}

check buildinlime typecheck
check buildinlime lint
check buildinlimemobile typecheck
check buildinlimemobile lint
# Shared packages were born clean → baseline 0, i.e. a hard typecheck gate.
# (No lint entries: the packages have no eslint config yet.)
check "@buildinlime/contracts" typecheck
check "@buildinlime/sync-core" typecheck
check "@buildinlime/domain-types" typecheck

if [ "$fail" -ne 0 ]; then
  echo "" >> "$SUMMARY"
  echo "**A count exceeded its baseline. Fix the new errors, or if intentional, update .github/quality-baseline.json.**" >> "$SUMMARY"
fi
exit "$fail"
