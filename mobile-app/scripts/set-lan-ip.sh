#!/usr/bin/env bash
# Auto-fill EXPO_PUBLIC_API_URL in mobile-app/.env with the dev machine's
# current LAN IP, so login/API calls from a physical device keep working
# after DHCP hands out a new address.
#
# Run automatically by the `start:lan` / `start` npm scripts, or by hand:
#   ./scripts/set-lan-ip.sh
#
# Override the port with API_PORT (default 3000), or pin an IP with LAN_IP.
set -euo pipefail

PORT="${API_PORT:-3000}"
ENV_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.env"

detect_ip() {
  # Prefer the source IP of the default route — this is the interface that
  # actually reaches the LAN, and it skips docker/bridge (172.x) addresses.
  if command -v ip >/dev/null 2>&1; then
    ip route get 1.1.1.1 2>/dev/null | grep -oP 'src \K[0-9.]+' | head -1 && return
  fi
  # macOS / fallback: first non-loopback IPv4.
  if command -v ipconfig >/dev/null 2>&1; then
    for i in en0 en1; do ipconfig getifaddr "$i" 2>/dev/null && return; done
  fi
  hostname -I 2>/dev/null | tr ' ' '\n' | grep -E '^192\.168\.|^10\.' | head -1
}

LAN_IP="${LAN_IP:-$(detect_ip)}"

if [[ -z "${LAN_IP}" ]]; then
  echo "set-lan-ip: could not detect a LAN IP. Set it manually in ${ENV_FILE}" >&2
  exit 1
fi

API_URL="http://${LAN_IP}:${PORT}"
LINE="EXPO_PUBLIC_API_URL=${API_URL}"

touch "${ENV_FILE}"
if grep -qE '^EXPO_PUBLIC_API_URL=' "${ENV_FILE}"; then
  # Replace the active (uncommented) value in place.
  sed -i.bak -E "s#^EXPO_PUBLIC_API_URL=.*#${LINE}#" "${ENV_FILE}" && rm -f "${ENV_FILE}.bak"
else
  printf '%s\n' "${LINE}" >> "${ENV_FILE}"
fi

echo "set-lan-ip: EXPO_PUBLIC_API_URL=${API_URL}"
echo "set-lan-ip: ensure the phone is on the same subnet and this origin is in MOBILE_ORIGIN on the server."
