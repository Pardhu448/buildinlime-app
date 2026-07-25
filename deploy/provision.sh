#!/usr/bin/env bash
#
# GCP provisioning for the BuildInLime single-VM deployment.
# Implements deploymentPlan.md §4 (Phase 1).
#
#   ./provision.sh              # DRY RUN — prints what it would do, changes nothing
#   ./provision.sh --apply      # execute
#
# Dry-run-by-default mirrors scripts/purge-resources.ts and
# scripts/migrate-storage-to-gcs.ts.
#
# Idempotent: every step checks for the resource first, so a re-run after a partial
# failure is safe. It does NOT delete or reconfigure anything that already exists —
# if a resource is present but wrong, it says so and leaves it alone.
#
# NOT covered here (deliberately):
#   - the Electric database role      → §4.2.1, an unresolved security decision
#   - VM bootstrap (disk, docker)     → deploy/vm-bootstrap.sh
#   - secret VALUES                   → you set those; this only creates the slots
#
set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration — override via environment.
# ---------------------------------------------------------------------------
# Defaults are the "Lean, asia-south1" bundle decided 2026-07-19 (§3):
# ≈ $70/month (≈ ₹5,930 + GST). Mumbai runs ~20% above us-central1 across every
# line item; the premium buys ~200ms off every sync round trip, which matters
# because Electric long-polls continuously.
PROJECT="${PROJECT:-}"
REGION="${REGION:-asia-south1}"
ZONE="${ZONE:-asia-south1-a}"
NETWORK="${NETWORK:-default}"

BUCKET="${BUCKET:-buildinlime-resources}"
SQL_INSTANCE="${SQL_INSTANCE:-buildinlime-db}"
SQL_TIER="${SQL_TIER:-db-g1-small}"
SQL_DATABASE="${SQL_DATABASE:-buildinlime}"
VM_NAME="${VM_NAME:-buildinlime-app}"
# e2-medium (1 vCPU billed + 4 GiB) fits Node + BEAM + Caddy at POC scale.
# Resizable later with a stop/start — no rebuild.
VM_TYPE="${VM_TYPE:-e2-medium}"
SA_NAME="${SA_NAME:-buildinlime-vm}"
ELECTRIC_DISK="${ELECTRIC_DISK:-buildinlime-electric-data}"
# 20GB start: §4.6.3's 50GB was a guess, and pd-ssd grows live without downtime.
ELECTRIC_DISK_SIZE="${ELECTRIC_DISK_SIZE:-20GB}"
STATIC_IP_NAME="${STATIC_IP_NAME:-buildinlime-ip}"
PEERING_RANGE="${PEERING_RANGE:-google-managed-services-buildinlime}"
AR_REPO="${AR_REPO:-buildinlime}"

APPLY=false
[[ "${1:-}" == "--apply" ]] && APPLY=true

SA_EMAIL="${SA_NAME}@${PROJECT}.iam.gserviceaccount.com"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
c_step() { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }
c_skip() { printf '  \033[0;32m✓ exists\033[0m  %s\n' "$*"; }
c_do() { printf '  \033[1;33m→ create\033[0m  %s\n' "$*"; }
c_warn() { printf '  \033[1;31m! \033[0m %s\n' "$*"; }

# Run a command, or just print it in dry-run mode.
run() {
  if $APPLY; then
    "$@"
  else
    printf '      \033[0;90m%s\033[0m\n' "$*"
  fi
}

# exists <description> <command...> — true if the probe command succeeds.
exists() { "$@" >/dev/null 2>&1; }

require_project() {
  if [[ -z "$PROJECT" ]]; then
    c_warn "PROJECT is not set."
    echo "    PROJECT=my-project ./provision.sh [--apply]"
    exit 1
  fi
  if ! exists gcloud projects describe "$PROJECT"; then
    c_warn "Cannot read project '$PROJECT' — wrong id, or auth expired."
    echo "    Try: gcloud auth login"
    exit 1
  fi
}

# ---------------------------------------------------------------------------
require_project

if $APPLY; then
  printf '\033[1;31m APPLY MODE — this creates billable resources in %s\033[0m\n' "$PROJECT"
else
  printf '\033[1;34m DRY RUN — nothing will be created. Re-run with --apply.\033[0m\n'
fi
printf ' project=%s region=%s zone=%s\n' "$PROJECT" "$REGION" "$ZONE"

# ---------------------------------------------------------------------------
c_step "APIs"
# Enabling an already-enabled API is a no-op, so this is unconditional.
for api in compute.googleapis.com sqladmin.googleapis.com storage.googleapis.com \
  secretmanager.googleapis.com servicenetworking.googleapis.com \
  artifactregistry.googleapis.com iap.googleapis.com; do
  c_do "$api"
  run gcloud services enable "$api" --project "$PROJECT"
done

# ---------------------------------------------------------------------------
c_step "Bucket — §4.1"
if exists gcloud storage buckets describe "gs://${BUCKET}" --project "$PROJECT"; then
  c_skip "gs://${BUCKET}"
  c_warn "Verify it has uniform access + public-access-prevention; not changed here."
else
  c_do "gs://${BUCKET}"
  # public-access-prevention makes an allUsers grant structurally impossible —
  # serveResourceFile is the ONLY access gate (§4.1, storage §10).
  run gcloud storage buckets create "gs://${BUCKET}" \
    --project "$PROJECT" --location "$REGION" \
    --uniform-bucket-level-access --public-access-prevention
fi

# ---------------------------------------------------------------------------
c_step "Service account — §4.3"
if exists gcloud iam service-accounts describe "$SA_EMAIL" --project "$PROJECT"; then
  c_skip "$SA_EMAIL"
else
  c_do "$SA_EMAIL"
  run gcloud iam service-accounts create "$SA_NAME" --project "$PROJECT" \
    --display-name "BuildInLime app VM"
fi

c_do "roles/storage.objectAdmin on gs://${BUCKET} (bucket-scoped, not project)"
run gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" \
  --project "$PROJECT" --member "serviceAccount:${SA_EMAIL}" \
  --role roles/storage.objectAdmin

c_do "roles/artifactregistry.reader"
run gcloud projects add-iam-policy-binding "$PROJECT" \
  --member "serviceAccount:${SA_EMAIL}" \
  --role roles/artifactregistry.reader --condition=None

# Ops Agent telemetry — §13.2. Both are write-only and project-scoped; there is no
# resource-scoped equivalent for logging/monitoring the way there is for the bucket
# and the secrets above.
#
# WITHOUT THESE THE AGENT STILL INSTALLS, STILL REPORTS HEALTHY, AND SHIPS NOTHING.
# That is the same failure shape as the Electric healthcheck in §13.1 — a component
# that answers "I am fine" to a question nobody wanted the answer to — so grant them
# BEFORE installing the agent, not after.
#
# They must also be granted by a principal with setIamPolicy on the project. Running
# them ON the VM fails with PERMISSION_DENIED: gcloud there authenticates as this very
# service account, and a service account cannot grant itself roles.
for role in roles/logging.logWriter roles/monitoring.metricWriter; do
  c_do "$role"
  run gcloud projects add-iam-policy-binding "$PROJECT" \
    --member "serviceAccount:${SA_EMAIL}" \
    --role "$role" --condition=None
done

# ---------------------------------------------------------------------------
c_step "Private services access — §4.2"
if exists gcloud compute addresses describe "$PEERING_RANGE" --global --project "$PROJECT"; then
  c_skip "$PEERING_RANGE"
else
  c_do "$PEERING_RANGE (/16 for VPC peering)"
  run gcloud compute addresses create "$PEERING_RANGE" \
    --project "$PROJECT" --global --purpose VPC_PEERING \
    --prefix-length 16 --network "$NETWORK"
fi

c_do "servicenetworking peering on ${NETWORK}"
# `connect` fails if a peering already exists; `update` is the idempotent form.
if $APPLY; then
  gcloud services vpc-peerings connect \
    --project "$PROJECT" --service servicenetworking.googleapis.com \
    --ranges "$PEERING_RANGE" --network "$NETWORK" 2>/dev/null ||
    gcloud services vpc-peerings update \
      --project "$PROJECT" --service servicenetworking.googleapis.com \
      --ranges "$PEERING_RANGE" --network "$NETWORK" --force
else
  printf '      \033[0;90mgcloud services vpc-peerings connect --ranges %s --network %s\033[0m\n' \
    "$PEERING_RANGE" "$NETWORK"
fi

# ---------------------------------------------------------------------------
c_step "Cloud SQL — §4.2 (private IP only)"
if exists gcloud sql instances describe "$SQL_INSTANCE" --project "$PROJECT"; then
  c_skip "$SQL_INSTANCE"
  if $APPLY; then
    ip=$(gcloud sql instances describe "$SQL_INSTANCE" --project "$PROJECT" \
      --format='value(settings.ipConfiguration.ipv4Enabled)')
    [[ "$ip" == "True" ]] && c_warn "Instance has a PUBLIC IP — §4.2 requires private only."
  fi
else
  c_do "$SQL_INSTANCE (POSTGRES_17, $SQL_TIER, no public IP)"
  # cloudsql.logical_decoding=on is NOT optional — Electric needs logical
  # replication and fails at sync time without it (§4.2).
  # --edition=ENTERPRISE is REQUIRED for shared-core tiers. POSTGRES_17 defaults to
  # ENTERPRISE_PLUS, which rejects db-g1-small with:
  #   Invalid Tier (db-g1-small) for (ENTERPRISE_PLUS) Edition
  # Enterprise Plus starts at db-perf-optimized-N-2 (2 vCPU / 16 GiB) — $221/mo vs
  # $30.66/mo, i.e. 7x — and buys HA, data cache and near-zero-downtime maintenance
  # that nothing in this plan needs at POC scale.
  run gcloud sql instances create "$SQL_INSTANCE" \
    --project "$PROJECT" --database-version POSTGRES_17 \
    --edition ENTERPRISE \
    --tier "$SQL_TIER" --region "$REGION" \
    --network "$NETWORK" --no-assign-ip \
    --database-flags cloudsql.logical_decoding=on \
    --backup --enable-point-in-time-recovery
fi

if exists gcloud sql databases describe "$SQL_DATABASE" --instance "$SQL_INSTANCE" --project "$PROJECT"; then
  c_skip "database ${SQL_DATABASE}"
else
  c_do "database ${SQL_DATABASE}"
  run gcloud sql databases create "$SQL_DATABASE" \
    --instance "$SQL_INSTANCE" --project "$PROJECT"
fi

# The Electric role needs a psql session, which needs private-network access to the
# instance — i.e. from the VM, not from here. Decision and grants are settled
# (§4.2.2); this just points at the scripts rather than pretending to run them.
c_warn "Electric's DB role is created from the VM, not here (private IP)."
echo "      Once the VM is up:  psql \"\$ADMIN_URL\" -v db=${SQL_DATABASE} \\"
echo "                            -v app_role=app -v electric_pw=... \\"
echo "                            -f deploy/sql/01-electric-role.sql"
echo "      Then after EVERY migration: deploy/sql/02-electric-own-tables.sql (§6)"

# ---------------------------------------------------------------------------
c_step "Secrets — §4.4 (slots only; values are set separately)"
for s in db-url electric-db-url electric-secret better-auth-secret resend-api-key; do
  if exists gcloud secrets describe "$s" --project "$PROJECT"; then
    c_skip "$s"
  else
    c_do "$s"
    run gcloud secrets create "$s" --project "$PROJECT" --replication-policy automatic
  fi
  run gcloud secrets add-iam-policy-binding "$s" --project "$PROJECT" \
    --member "serviceAccount:${SA_EMAIL}" --role roles/secretmanager.secretAccessor
done
c_warn "Set values with: printf '%s' 'VALUE' | gcloud secrets versions add NAME --data-file=-"

# ---------------------------------------------------------------------------
c_step "Artifact Registry — §9"
if exists gcloud artifacts repositories describe "$AR_REPO" --location "$REGION" --project "$PROJECT"; then
  c_skip "$AR_REPO"
else
  c_do "$AR_REPO (docker, $REGION)"
  run gcloud artifacts repositories create "$AR_REPO" \
    --project "$PROJECT" --repository-format docker --location "$REGION"
fi

# ---------------------------------------------------------------------------
c_step "Static IP — §3 (needed before Caddy can issue a certificate)"
if exists gcloud compute addresses describe "$STATIC_IP_NAME" --region "$REGION" --project "$PROJECT"; then
  c_skip "$STATIC_IP_NAME"
  $APPLY && printf '      address: %s\n' \
    "$(gcloud compute addresses describe "$STATIC_IP_NAME" --region "$REGION" --project "$PROJECT" --format='value(address)')"
else
  c_do "$STATIC_IP_NAME"
  run gcloud compute addresses create "$STATIC_IP_NAME" --project "$PROJECT" --region "$REGION"
fi

# ---------------------------------------------------------------------------
c_step "Firewall — §4.6.4 (80/443 only; SSH via IAP, not port 22)"
if exists gcloud compute firewall-rules describe allow-https --project "$PROJECT"; then
  c_skip "allow-https"
else
  c_do "allow-https (tcp:80,443 → tag https-server)"
  run gcloud compute firewall-rules create allow-https --project "$PROJECT" \
    --network "$NETWORK" --allow tcp:80,tcp:443 \
    --target-tags https-server --source-ranges 0.0.0.0/0
fi

if exists gcloud compute firewall-rules describe allow-iap-ssh --project "$PROJECT"; then
  c_skip "allow-iap-ssh"
else
  c_do "allow-iap-ssh (35.235.240.0/20 is IAP's fixed range)"
  run gcloud compute firewall-rules create allow-iap-ssh --project "$PROJECT" \
    --network "$NETWORK" --allow tcp:22 \
    --target-tags https-server --source-ranges 35.235.240.0/20
fi

# ---------------------------------------------------------------------------
c_step "Electric data disk — §4.6.3"
if exists gcloud compute disks describe "$ELECTRIC_DISK" --zone "$ZONE" --project "$PROJECT"; then
  c_skip "$ELECTRIC_DISK"
else
  c_do "$ELECTRIC_DISK ($ELECTRIC_DISK_SIZE pd-ssd)"
  # Separate from the boot disk so filling it degrades sync rather than killing
  # the OS, and so it survives VM deletion.
  run gcloud compute disks create "$ELECTRIC_DISK" \
    --project "$PROJECT" --zone "$ZONE" \
    --size "$ELECTRIC_DISK_SIZE" --type pd-ssd
fi

# ---------------------------------------------------------------------------
c_step "VM — §4.6.2"
if exists gcloud compute instances describe "$VM_NAME" --zone "$ZONE" --project "$PROJECT"; then
  c_skip "$VM_NAME"
else
  c_do "$VM_NAME ($VM_TYPE, Ubuntu 24.04 LTS)"
  run gcloud compute instances create "$VM_NAME" \
    --project "$PROJECT" --zone "$ZONE" --machine-type "$VM_TYPE" \
    --image-family ubuntu-2404-lts-amd64 --image-project ubuntu-os-cloud \
    --boot-disk-size 30GB --boot-disk-type pd-balanced \
    --disk "name=${ELECTRIC_DISK},device-name=${ELECTRIC_DISK},mode=rw,auto-delete=no" \
    --service-account "$SA_EMAIL" --scopes cloud-platform \
    --network "$NETWORK" --address "$STATIC_IP_NAME" \
    --tags https-server
fi

# ---------------------------------------------------------------------------
printf '\n\033[1;36m▸ Next\033[0m\n'
cat <<'NEXT'
  1. Create the Electric DB role from the VM: deploy/sql/01-electric-role.sql (§4.2.2).
  2. Set secret VALUES (see the note above).
  3. Point the DNS A record at the static IP — BEFORE first boot, so Caddy can
     issue a certificate and BETTER_AUTH_URL is final (§3).
  4. Bootstrap the VM: deploy/vm-bootstrap.sh
  5. Spike Electric ↔ private Cloud SQL before anything else (§12).
NEXT
$APPLY || printf '\n\033[1;34m DRY RUN complete — nothing was created.\033[0m\n'
