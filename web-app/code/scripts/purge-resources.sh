#!/usr/bin/env bash
#
# Nightly reclamation of the bytes behind deleted files. Thin wrapper around
# `pnpm purge:resources` so cron has something with an absolute path, a working
# directory, and a log to write to.
#
# Install (idempotent — replaces any previous entry for this script):
#
#   ( crontab -l 2>/dev/null | grep -v purge-resources.sh
#     echo "17 3 * * * bash -lc '$PWD/scripts/purge-resources.sh'" ) | crontab -
#
# Remove:
#
#   crontab -l | grep -v purge-resources.sh | crontab -
#
# The `bash -lc` matters: cron runs with a near-empty PATH and would not find
# pnpm. A login shell picks up the same PATH you get in a terminal.
#
# NOTE this runs with --apply, so it really does delete. The 30-day retention
# window inside the script is the safety net: a file whose resource was deleted
# more recently than that is left alone. To see what it would do without doing
# it, run `pnpm purge:resources` by hand — that is dry-run by default.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${PURGE_LOG_DIR:-$APP_DIR/logs}"
mkdir -p "$LOG_DIR"
cd "$APP_DIR"

exec >>"$LOG_DIR/purge-resources.log" 2>&1
echo "=== $(date -Is) purge-resources ==="
pnpm --silent purge:resources -- --apply
echo
