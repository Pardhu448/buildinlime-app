#!/usr/bin/env bash
#
# One-time CI/CD setup: Workload Identity Federation so GitHub Actions can deploy
# without a downloaded service-account key. Implements deploymentPlan.md §9.
#
#   ./setup-cicd.sh              # DRY RUN
#   ./setup-cicd.sh --apply
#
# Prints the values to put in the workflow when it finishes.
#
set -euo pipefail

PROJECT="${PROJECT:-buildinlime}"
REGION="${REGION:-asia-south1}"
ZONE="${ZONE:-asia-south1-a}"
VM_NAME="${VM_NAME:-buildinlime-app}"
GITHUB_REPO="${GITHUB_REPO:-Pardhu448/buildinlime-app}"
POOL="${POOL:-github-actions}"
PROVIDER="${PROVIDER:-github}"
SA_NAME="${SA_NAME:-buildinlime-deploy}"

APPLY=false
[[ "${1:-}" == "--apply" ]] && APPLY=true
SA_EMAIL="${SA_NAME}@${PROJECT}.iam.gserviceaccount.com"

step() { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }
skip() { printf '  \033[0;32m✓ exists\033[0m  %s\n' "$*"; }
mk() { printf '  \033[1;33m→ create\033[0m  %s\n' "$*"; }
run() { if $APPLY; then "$@"; else printf '      \033[0;90m%s\033[0m\n' "$*"; fi; }
have() { "$@" >/dev/null 2>&1; }

PROJECT_NUM=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')
$APPLY || printf '\033[1;34m DRY RUN — nothing will be created.\033[0m\n'
printf ' project=%s (%s) repo=%s\n' "$PROJECT" "$PROJECT_NUM" "$GITHUB_REPO"

step "APIs"
for api in iamcredentials.googleapis.com sts.googleapis.com; do
  mk "$api"; run gcloud services enable "$api" --project "$PROJECT"
done

step "Deploy service account"
if have gcloud iam service-accounts describe "$SA_EMAIL" --project "$PROJECT"; then
  skip "$SA_EMAIL"
else
  mk "$SA_EMAIL"
  run gcloud iam service-accounts create "$SA_NAME" --project "$PROJECT" \
    --display-name "GitHub Actions deployer"
fi

step "Roles for the deployer"
# artifactregistry.writer — push images.
# iap.tunnelResourceAccessor — open the IAP SSH tunnel.
# compute.osAdminLogin — log in over that tunnel (sudo on the VM, needed to run
#   docker and write /opt/buildinlime).
# compute.viewer — `gcloud compute ssh` describes the instance first.
for role in roles/artifactregistry.writer roles/iap.tunnelResourceAccessor \
  roles/compute.osAdminLogin roles/compute.viewer; do
  mk "$role"
  run gcloud projects add-iam-policy-binding "$PROJECT" \
    --member "serviceAccount:${SA_EMAIL}" --role "$role" --condition=None
done

step "Let the deployer act as the VM's service account"
# ---------------------------------------------------------------------------
# `gcloud compute ssh/scp` against an instance that HAS a service account
# attached requires iam.serviceAccounts.actAs on THAT account — the four project
# roles above are not enough. Without this the deploy job fails at the config
# sync step with:
#
#   PERMISSION_DENIED: User does not have iam.serviceAccounts.actAs permission
#   on the instance's service account
#
# Bound on the VM's service account as a RESOURCE, not project-wide: granting
# roles/iam.serviceAccountUser at project level would let the deployer
# impersonate every service account in the project, including any added later.
# ---------------------------------------------------------------------------
VM_SA="${VM_SA:-buildinlime-vm@${PROJECT}.iam.gserviceaccount.com}"
mk "serviceAccountUser on ${VM_SA}"
run gcloud iam service-accounts add-iam-policy-binding "$VM_SA" \
  --project "$PROJECT" --role roles/iam.serviceAccountUser \
  --member "serviceAccount:${SA_EMAIL}"

step "Workload Identity Pool"
if have gcloud iam workload-identity-pools describe "$POOL" --project "$PROJECT" --location global; then
  skip "$POOL"
else
  mk "$POOL"
  run gcloud iam workload-identity-pools create "$POOL" --project "$PROJECT" \
    --location global --display-name "GitHub Actions"
fi

step "OIDC provider"
# ---------------------------------------------------------------------------
# SECURITY: --attribute-condition is NOT optional.
#
# Without it, the provider trusts ANY token GitHub's OIDC issuer signs — that
# means any GitHub repository on the internet could federate into this pool and
# impersonate the deploy service account. The condition pins it to this one
# repository. Google rejects provider creation without a condition for exactly
# this reason, but it is worth understanding rather than pasting.
# ---------------------------------------------------------------------------
if have gcloud iam workload-identity-pools providers describe "$PROVIDER" \
  --project "$PROJECT" --location global --workload-identity-pool "$POOL"; then
  skip "$PROVIDER"
else
  mk "$PROVIDER (restricted to ${GITHUB_REPO})"
  run gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" \
    --project "$PROJECT" --location global --workload-identity-pool "$POOL" \
    --display-name "GitHub" \
    --issuer-uri "https://token.actions.githubusercontent.com" \
    --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
    --attribute-condition "assertion.repository == '${GITHUB_REPO}'"
fi

step "Let the repo impersonate the deployer"
POOL_RES="projects/${PROJECT_NUM}/locations/global/workloadIdentityPools/${POOL}"
# Scoped to attribute.repository, so only this repo's tokens map to this SA.
mk "workloadIdentityUser for ${GITHUB_REPO}"
run gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --project "$PROJECT" --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/${POOL_RES}/attribute.repository/${GITHUB_REPO}"

step "Enable OS Login on the VM"
# Required for service-account SSH. Without it gcloud falls back to metadata SSH
# keys, which a CI service account cannot manage.
mk "enable-oslogin=TRUE on ${VM_NAME}"
run gcloud compute instances add-metadata "$VM_NAME" --project "$PROJECT" \
  --zone "$ZONE" --metadata enable-oslogin=TRUE

step "Values for .github/workflows"
cat <<OUT
  WIF_PROVIDER: ${POOL_RES}/providers/${PROVIDER}
  WIF_SERVICE_ACCOUNT: ${SA_EMAIL}

  Both are non-secret — they identify, they do not authorise. The attribute
  condition above is what authorises. Set them as repo variables or inline.
OUT
$APPLY || printf '\n\033[1;34m DRY RUN complete.\033[0m\n'
