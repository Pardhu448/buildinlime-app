# GCP Cost Reduction — Paused Deployment

**Status (2026-09-02): the `buildinlime` GCP project is PAUSED and trimmed.
Paused cost ≈ $11/month, down from ≈ $70/month running and ≈ $24/month at the
initial pause.**

This is the companion to `deploymentPlan.md`. That file describes how the
deployment was *built*; this one records what was *switched off or released* to
stop it costing money while the POC is idle, and what has to be put back to
bring it up again.

> The live-configuration table in `deploymentPlan.md` §Status describes the
> running deployment. Two of its rows no longer exist — see §4.

---

## 1. Why

The deployment was budgeted at ≈ $70/month (≈ ₹5,930 + GST). Measured against
list price in `asia-south1`, the running cost was closer to $87–95/month, with
Cloud SQL `db-g1-small` — not the VM — as the single largest line item.

On **2026-09-01** compute was stopped. That alone did not get the bill to zero,
because stored bytes and a reserved address keep accruing whether or not
anything is running. On **2026-09-02** a further round released the resources
that were both idle *and* rebuildable.

The rule applied throughout: **stop paying for what can be recreated from a
script or from Postgres; keep paying for what only exists once.**

---

## 2. What is switched off (recoverable, nothing deleted)

| Resource | State | Cost while paused |
|---|---|---|
| `buildinlime-app` — e2-medium VM, `asia-south1-a` | `TERMINATED` | $0 compute |
| `buildinlime-db` — Cloud SQL PG17, `db-g1-small` | `activationPolicy=NEVER` | storage only |

Both restart in place. No data was moved or dropped.

---

## 3. What is still billing

| Item | Size | ≈ $/month |
|---|---|---|
| Cloud SQL storage (PD_SSD) | 31 GB | 6.30 |
| VM boot disk `buildinlime-app` (pd-balanced) | 30 GB | 3.50 |
| Artifact Registry, after cleanup policy | ~6 GB | 0.60 |
| GCS `buildinlime-resources` | 25 MB | ~0.00 |
| Cloud SQL automated backups | <1 GB | ~0.10 |
| **Total** | | **≈ 11** |

Both large items were kept **deliberately**, so that resuming stays a two-command
operation rather than a rebuild. See §6 for what it would take to go lower.

---

## 4. What was released on 2026-09-02

### 4.1 Static IP `34.93.54.217` — released

The address was the largest single line in the paused bill (≈ $7.30/month; an
unattached reserved IP is charged at a *higher* rate than an attached one).

Nothing in code pinned it. The mobile app (`mobile-app/eas.json`), the CI health
check (`.github/workflows/ci.yml`), the privacy policy and the Play Store listing
all reference the **hostname** `app.buildinlime.com`, never the address. The only
references to the digits were documentation.

```
gcloud compute instances delete-access-config buildinlime-app \
  --zone=asia-south1-a --project=buildinlime --access-config-name=external-nat
gcloud compute addresses delete buildinlime-ip \
  --region=asia-south1 --project=buildinlime --quiet
```

**Consequence at resume:** the VM now has no external IP and will receive an
ephemeral one on start. **DNS must be repointed before the app is reachable**,
and before Caddy can complete its Let's Encrypt HTTP-01 challenge. Until DNS
lands, the site is down *and* the certificate will not issue — this is expected,
not a code failure.

> The release command is not idempotent in an obvious way. Running it twice
> returns `INVALID_USAGE` ("access config not present") on the second call, which
> reads like a failure but means the first call worked. **Verify with
> `gcloud compute operations list`, not with console output.**

### 4.2 Electric data disk — deleted

`buildinlime-electric-data`, 20 GB pd-ssd mounted at `/var/lib/electric`
(≈ $4.10/month). Deleted without a snapshot.

This is safe because the disk held **only a rebuildable shape-log cache** —
`deploymentPlan.md:100` and `:546` say so explicitly. The caution in `:546`
("rebuilding it is expensive") was written against production-scale data; the
database is 40 KB gzipped, so the rebuild is trivial.

```
gcloud compute instances detach-disk buildinlime-app \
  --zone=asia-south1-a --project=buildinlime --disk=buildinlime-electric-data
gcloud compute disks delete buildinlime-electric-data \
  --zone=asia-south1-a --project=buildinlime --quiet
```

**Consequence at resume — this one is a silent trap.** `vm-bootstrap.sh` mounts
`/var/lib/electric` with `nofail` by design. With the disk gone, the VM boots
clean and *looks* healthy, but shape logs land on the 30 GB boot disk instead.
`deploymentPlan.md:574` already flags this as a masked failure mode. **Recreate
the disk, or remove the fstab entry, before deploying.**

### 4.3 Artifact Registry cleanup policy — enabled

The repo had no cleanup policy and had grown to **22.7 GB across 71 images**
(37 `app`, 34 `tools`, 12 untagged), all from July 2026.

Policy now live on `asia-south1-docker.pkg.dev/buildinlime/buildinlime`:

| Rule | Action |
|---|---|
| `keep-latest-tag` | Keep anything tagged `latest` |
| `keep-recent-10` | Keep the 10 newest versions per package |
| `delete-untagged` | Delete untagged images older than 7 days |
| `delete-old-tagged` | Delete tagged images older than 30 days |

Keep rules take precedence over delete rules, so the 10 newest survive
regardless of age. This is compatible with `deploy/deploy.sh`, which deploys by
commit SHA and rolls back to `PREV_TAG` (`deploy.sh:44`, `:80`) — ten retained
SHAs is far more rollback depth than the script uses.

Expected steady state: ~21 images, ~6 GB. Deletion runs on Google's schedule,
so the reported repo size does not drop immediately.

> Set with `--dry-run` first, confirmed, then re-applied with `--no-dry-run`.
> Do the same for any future change: dry-run results go to Cloud Logging and can
> take up to a day to appear.

### 4.4 Do not touch

`google-managed-services-buildinlime` (`10.101.0.0`, `RESERVED`) still appears in
`gcloud compute addresses list`. It is **not** a stray reservation — it is the VPC
peering range backing Cloud SQL's private IP. Deleting it breaks the database's
networking.

---

## 5. Backups

The pre-pause dump is `buildinlime-20260901-202928.sql.gz` — 17 tables,
**40 KB gzipped**. It now exists in two places:

| Location | Notes |
|---|---|
| `~/BuildInLime-gcs-backup/backups/` | local, alongside a full mirror of the resources bucket |
| `gs://buildinlime-resources/backups/` | pushed 2026-09-02, MD5 verified identical |

The bucket has `public_access_prevention: enforced` and uniform bucket-level
access with no `allUsers` binding, so the dump is not web-reachable. Two
remaining gaps, both accepted rather than fixed:

- **No object versioning** on the bucket — a same-path re-upload replaces it with
  no recovery. Closable with
  `gcloud storage buckets update gs://buildinlime-resources --versioning`, which
  would also start retaining noncurrent versions of user resources.
- **`buildinlime-vm@` holds `objectAdmin`** on that bucket, so the app's own
  service account could delete the backup. Same blast radius that already covers
  user resources, so not new exposure — but the copy is not independent of the
  thing it protects.

---

## 6. If the bill needs to go lower

Not done, and each trades resume simplicity for money:

| Option | Saves ≈ $/mo | Cost |
|---|---|---|
| Delete Cloud SQL, restore the 40 KB dump into a fresh 10 GB instance later | 6.30 | Automated backups die with the instance; the dump becomes the only copy |
| Snapshot and delete the VM boot disk | 2.70 net | Resume becomes re-running `provision.sh` + `vm-bootstrap.sh` |

Cloud SQL storage **cannot be shrunk in place** — 31 GB is permanent for that
instance. It grew there by automatic storage increase and will not come back
down. Deleting and recreating is the only path.

Doing both takes the paused bill to ≈ $4/month and turns resume into an
afternoon rather than a minute.

---

## 7. Resume checklist

Supersedes the two-command resume in earlier notes.

1. **Start Cloud SQL first** — the VM's services expect the database:
   ```
   gcloud sql instances patch buildinlime-db --activation-policy ALWAYS --project buildinlime
   ```
2. **Recreate the Electric disk** (or remove the `/var/lib/electric` fstab entry):
   ```
   gcloud compute disks create buildinlime-electric-data \
     --size=20GB --type=pd-ssd --zone=asia-south1-a --project=buildinlime
   gcloud compute instances attach-disk buildinlime-app \
     --disk=buildinlime-electric-data --device-name=buildinlime-electric-data \
     --zone=asia-south1-a --project=buildinlime
   ```
   Format and mount per `deploymentPlan.md` §4.6.2 if newly created.
3. **Start the VM:**
   ```
   gcloud compute instances start buildinlime-app --zone asia-south1-a --project buildinlime
   ```
4. **Repoint DNS.** Read the new ephemeral IP and update the `app.buildinlime.com`
   A record. Nothing works until this propagates.
   ```
   gcloud compute instances describe buildinlime-app --zone asia-south1-a \
     --project buildinlime --format='value(networkInterfaces[0].accessConfigs[0].natIP)'
   ```
   Re-reserve a static IP first if a stable address is wanted again.
5. **Wait for Caddy's certificate**, then verify with `deploy/verify-storage.sh`.
6. **Check `df -h / /var/lib/electric`** before assuming the deploy is healthy —
   per §4.2, a missing Electric mount fails silently.
