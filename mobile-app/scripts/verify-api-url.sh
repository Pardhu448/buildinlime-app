#!/usr/bin/env bash
# Verify the production API URL was actually inlined into a built bundle.
#
# Why this exists (see ANDROID_RELEASE_PLAN.md, Phase 2 step 3 + Blocker 2):
# EXPO_PUBLIC_API_URL is inlined by Metro at build time. All 7 API modules fall
# back to the emulator alias `http://10.0.2.2:3000` when the env var is missing.
# If the EAS build profile's `env` block fails to reach Metro, the app still
# builds, installs and opens fine — and then cannot reach anything, because
# every request silently targets 10.0.2.2. Launching the app does NOT catch this;
# inspecting the shipped bundle does.
#
# How it decides:
#   Metro rewrites `process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:3000"` to
#   `"https://app.buildinlime.com" ?? "http://10.0.2.2:3000"` when inlining works,
#   and to `undefined ?? "http://10.0.2.2:3000"` when it does not. So:
#     - the production URL string PRESENT  => inlined correctly  => PASS
#     - the production URL string ABSENT   => fell back to 10.0.2.2 => FAIL
#   The 10.0.2.2 literal is ALWAYS present (it is the source-level fallback), so
#   its presence is not a failure signal — only the absence of the prod URL is.
#   (Hermes compiles the JS to bytecode, but string literals survive in the
#   bytecode string table, so a plain byte-grep finds them.)
#
# Usage:
#   ./scripts/verify-api-url.sh <artifact>
# where <artifact> is one of:
#   - an .apk / .aab / .zip  (Android build output from `eas build`)
#   - an .ipa                (iOS build output)
#   - a raw *.bundle / *.js  (an already-extracted Metro bundle)
#   - a directory            (searched recursively for the bundle)
#
# Override the expected URL (default: the production API) via arg 2 or env:
#   EXPECTED_API_URL=https://staging.example.com ./scripts/verify-api-url.sh app.apk
set -euo pipefail

ARTIFACT="${1:-}"
EXPECTED_API_URL="${2:-${EXPECTED_API_URL:-https://app.buildinlime.com}}"
FALLBACK_URL="http://10.0.2.2:3000"

if [[ -z "${ARTIFACT}" || ! -e "${ARTIFACT}" ]]; then
  echo "verify-api-url: pass a path to an .apk/.aab/.ipa, a *.bundle, or a directory." >&2
  echo "  usage: $0 <artifact> [expected-url]" >&2
  exit 2
fi

command -v unzip >/dev/null 2>&1 || { echo "verify-api-url: 'unzip' is required." >&2; exit 2; }

WORKDIR=""
# Must end with status 0 — as an EXIT trap its final status would otherwise
# leak into the script's exit code (e.g. when WORKDIR was never set).
cleanup() { if [[ -n "${WORKDIR}" && -d "${WORKDIR}" ]]; then rm -rf "${WORKDIR}"; fi; }
trap cleanup EXIT

# Resolve a directory tree we can search, extracting archives as needed.
case "${ARTIFACT}" in
  *.apk|*.aab|*.ipa|*.zip)
    WORKDIR="$(mktemp -d)"
    echo "verify-api-url: extracting $(basename "${ARTIFACT}") ..."
    unzip -qq "${ARTIFACT}" -d "${WORKDIR}"
    SEARCH_ROOT="${WORKDIR}"
    ;;
  *)
    SEARCH_ROOT="${ARTIFACT}"
    ;;
esac

# Locate the JS bundle(s). Android: index.android.bundle; iOS: main.jsbundle.
# Fall back to any *.bundle, then to scanning the whole tree if nothing matches.
mapfile -t BUNDLES < <(
  if [[ -d "${SEARCH_ROOT}" ]]; then
    find "${SEARCH_ROOT}" \
      \( -name 'index.android.bundle' -o -name 'main.jsbundle' -o -name '*.bundle' \) \
      -type f 2>/dev/null
  else
    printf '%s\n' "${SEARCH_ROOT}"
  fi
)

if [[ "${#BUNDLES[@]}" -eq 0 ]]; then
  echo "verify-api-url: no JS bundle found under '${SEARCH_ROOT}'." >&2
  echo "  Scanning the whole tree for the URL strings instead." >&2
  BUNDLES=("${SEARCH_ROOT}")
fi

echo "verify-api-url: expecting  ${EXPECTED_API_URL}"
echo "verify-api-url: fallback   ${FALLBACK_URL} (presence is normal — it is the source default)"
echo

FOUND_EXPECTED=0
for b in "${BUNDLES[@]}"; do
  # -a: treat binary (Hermes bytecode) as text. -r: recurse if a dir was passed.
  # `|| true`: grep exits 1 on no-match, which must not abort under `set -e` —
  # a zero count is the whole point of the FAIL path.
  hits_expected="$(grep -rac -- "${EXPECTED_API_URL}" "${b}" 2>/dev/null | awk -F: '{s+=$NF} END {print s+0}' || true)"
  hits_fallback="$(grep -rac -- "${FALLBACK_URL}" "${b}" 2>/dev/null | awk -F: '{s+=$NF} END {print s+0}' || true)"
  label="$(basename "${b}")"
  printf '  %-28s expected=%s  fallback=%s\n' "${label}" "${hits_expected}" "${hits_fallback}"
  if [[ "${hits_expected}" -gt 0 ]]; then FOUND_EXPECTED=1; fi
done

echo
if [[ "${FOUND_EXPECTED}" -eq 1 ]]; then
  echo "verify-api-url: PASS — '${EXPECTED_API_URL}' is inlined in the bundle."
  exit 0
else
  echo "verify-api-url: FAIL — '${EXPECTED_API_URL}' is NOT in the bundle." >&2
  echo "  The build fell back to ${FALLBACK_URL}: the EAS build profile's" >&2
  echo "  EXPO_PUBLIC_API_URL never reached Metro. Do NOT ship this artifact." >&2
  exit 1
fi
