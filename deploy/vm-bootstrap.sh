#!/usr/bin/env bash
#
# One-time VM bootstrap. Runs ON the VM, as root, after deploy/provision.sh.
# Implements deploymentPlan.md §4.6.3 (data disk), §4.6.5 (secrets), §8 (purge timer).
#
#   gcloud compute ssh buildinlime-app --zone us-central1-a --tunnel-through-iap
#   sudo PROJECT=my-project PUBLIC_DOMAIN=app.example.com \
#        GCS_BUCKET=buildinlime-resources bash vm-bootstrap.sh
#
# Idempotent — safe to re-run. It will not reformat a disk that already has a
# filesystem, and it overwrites unit files rather than appending.
#
set -euo pipefail

PROJECT="${PROJECT:?set PROJECT}"
PUBLIC_DOMAIN="${PUBLIC_DOMAIN:?set PUBLIC_DOMAIN, e.g. app.example.com}"
GCS_BUCKET="${GCS_BUCKET:-buildinlime-resources}"
REGION="${REGION:-asia-south1}"
AR_REPO="${AR_REPO:-buildinlime}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
# Sender for auth OTP mail. Its domain must be verified in Resend, or sends fail
# with 403 "The <domain> domain is not verified" — the app starts fine and only
# login breaks, so this is worth getting right before first use.
EMAIL_FROM="${EMAIL_FROM:-BuildInLime <contact@buildinlime.com>}"

ELECTRIC_DEV="/dev/disk/by-id/google-buildinlime-electric-data"
ELECTRIC_MNT="/var/lib/electric"
APP_DIR="/opt/buildinlime"

step() { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }

# ---------------------------------------------------------------------------
step "Docker"
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg |
    gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    >/etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
else
  echo "  already installed: $(docker --version)"
fi

# ---------------------------------------------------------------------------
step "Electric data disk → ${ELECTRIC_MNT}"
if [[ ! -e "$ELECTRIC_DEV" ]]; then
  echo "  !! ${ELECTRIC_DEV} not found — was the disk attached with"
  echo "     device-name=buildinlime-electric-data? See provision.sh."
  exit 1
fi

# blkid exits non-zero when there is no filesystem. Only format in that case —
# never reformat, that would destroy the shape log.
if ! blkid "$ELECTRIC_DEV" >/dev/null 2>&1; then
  echo "  formatting (no existing filesystem)"
  mkfs.ext4 -m 0 -E lazy_itable_init=0,lazy_journal_init=0,discard "$ELECTRIC_DEV"
else
  echo "  filesystem present — not touching it"
fi

mkdir -p "$ELECTRIC_MNT"
UUID=$(blkid -s UUID -o value "$ELECTRIC_DEV")
if ! grep -q "$UUID" /etc/fstab; then
  # nofail so a missing disk degrades sync instead of blocking boot.
  echo "UUID=${UUID} ${ELECTRIC_MNT} ext4 discard,defaults,nofail 0 2" >>/etc/fstab
  echo "  added to /etc/fstab"
fi
mountpoint -q "$ELECTRIC_MNT" || mount "$ELECTRIC_MNT"
# The Electric container runs unprivileged; it must be able to write here.
chown -R 65532:65532 "$ELECTRIC_MNT" 2>/dev/null || chmod 0777 "$ELECTRIC_MNT"
df -h "$ELECTRIC_MNT" | tail -1

# ---------------------------------------------------------------------------
step "Application directory"
mkdir -p "$APP_DIR"
echo "  place docker-compose.prod.yaml and Caddyfile in ${APP_DIR}/"
echo "  (CI copies them; see deploymentPlan.md §9)"

# Non-secret config, read by Compose alongside the generated .env.
cat >"${APP_DIR}/compose.env" <<EOF
APP_IMAGE=${REGION}-docker.pkg.dev/${PROJECT}/${AR_REPO}/app:${IMAGE_TAG}
TOOLS_IMAGE=${REGION}-docker.pkg.dev/${PROJECT}/${AR_REPO}/tools:${IMAGE_TAG}
GCS_BUCKET=${GCS_BUCKET}
PUBLIC_URL=https://${PUBLIC_DOMAIN}
PUBLIC_DOMAIN=${PUBLIC_DOMAIN}
EMAIL_FROM=${EMAIL_FROM}
PG_POOL_MAX=10
EOF
chmod 0644 "${APP_DIR}/compose.env"

# ---------------------------------------------------------------------------
step "Secret materialisation — §4.6.5"
# Pulls from Secret Manager using the VM's attached service account. Values never
# enter the image and never enter git.
cat >/usr/local/bin/buildinlime-secrets <<'EOS'
#!/usr/bin/env bash
set -euo pipefail
umask 077
OUT=/opt/buildinlime/.env
TMP=$(mktemp)
get() { gcloud secrets versions access latest --secret="$1"; }
{
  echo "DATABASE_URL=$(get db-url)"
  echo "ELECTRIC_DATABASE_URL=$(get electric-db-url)"
  echo "ELECTRIC_SECRET=$(get electric-secret)"
  echo "BETTER_AUTH_SECRET=$(get better-auth-secret)"
  echo "RESEND_API_KEY=$(get resend-api-key)"
} >"$TMP"
# Atomic replace so a failed fetch never leaves a half-written .env behind.
mv "$TMP" "$OUT"
chmod 0600 "$OUT"
EOS
chmod 0755 /usr/local/bin/buildinlime-secrets

cat >/etc/systemd/system/buildinlime-secrets.service <<'EOF'
[Unit]
Description=Materialise BuildInLime secrets from Secret Manager
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/local/bin/buildinlime-secrets

[Install]
WantedBy=multi-user.target
EOF

# ---------------------------------------------------------------------------
step "Application service"
cat >/etc/systemd/system/buildinlime.service <<EOF
[Unit]
Description=BuildInLime application stack
Requires=docker.service buildinlime-secrets.service
After=docker.service buildinlime-secrets.service ${ELECTRIC_MNT//\//-}.mount

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${APP_DIR}
ExecStart=/usr/bin/docker compose --env-file compose.env --env-file .env -f docker-compose.prod.yaml up -d
ExecStop=/usr/bin/docker compose --env-file compose.env --env-file .env -f docker-compose.prod.yaml down

[Install]
WantedBy=multi-user.target
EOF

# ---------------------------------------------------------------------------
step "Purge timer — §8"
cat >/etc/systemd/system/buildinlime-purge.service <<EOF
[Unit]
Description=BuildInLime resource purge + orphan sweep
Requires=docker.service
After=buildinlime.service

[Service]
Type=oneshot
WorkingDirectory=${APP_DIR}
# --apply is REQUIRED — the script dry-runs by default. Verify from the first
# run's log that it reports applying, not dry-running (§8).
ExecStart=/usr/bin/docker compose --env-file compose.env --env-file .env -f docker-compose.prod.yaml \\
          --profile tools run --rm app-tools pnpm purge:resources -- --apply
EOF

cat >/etc/systemd/system/buildinlime-purge.timer <<'EOF'
[Unit]
Description=Daily BuildInLime purge

[Timer]
OnCalendar=daily
RandomizedDelaySec=30m
Persistent=true

[Install]
WantedBy=timers.target
EOF

# ---------------------------------------------------------------------------
step "Enable units"
systemctl daemon-reload
systemctl enable buildinlime-secrets.service
systemctl enable buildinlime.service
systemctl enable buildinlime-purge.timer

cat <<NEXT

▸ Bootstrap complete. Not started — deliberately.

  Before first start:
    1. Copy docker-compose.prod.yaml and Caddyfile into ${APP_DIR}/
    2. Confirm DNS: ${PUBLIC_DOMAIN} → this VM's static IP.
       Caddy issues its certificate on first HTTPS request; without DNS it fails
       and Let's Encrypt rate limits apply to retries.
    3. Ensure secret VALUES exist in Secret Manager, then:
         systemctl start buildinlime-secrets
    4. Run migrations BEFORE starting the app (§6):
         cd ${APP_DIR} && docker compose --env-file compose.env --env-file .env \\
           -f docker-compose.prod.yaml --profile tools run --rm app-tools pnpm migrate
    5. systemctl start buildinlime
    6. Verify exactly one replication slot (§10 step 5):
         SELECT slot_name, active FROM pg_replication_slots;
NEXT
