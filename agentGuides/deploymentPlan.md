# Deployment Plan — BuildInLime

Replaces **§9 step 4** of `objectStorageMigration.md` ("Provision the GCE VM +
bucket"). Same goal — close **ARCHITECTURE.md §12.1**, the app server holding no
bytes.

Drafted 2026-07-19 against `feat/object-storage-provider`. Section refs like **§8**
point at `ARCHITECTURE.md`; refs like *(storage §9)* point at
`objectStorageMigration.md`.

**Target: a single GCE VM** running the app and the Electric sync service as two
containers, with **Cloud SQL on private IP**, bytes in **Google Cloud Storage**, and
**Caddy** terminating TLS. Secrets in **Secret Manager**.

**Status (2026-07-20): DEPLOYED and serving at https://app.buildinlime.com, with CI/CD
proven end to end.**

| Phase | State |
|---|---|
| §4 Phase 1 — provisioning | ✅ done, `asia-south1` |
| §5 Phase 2 — packaging | ✅ done, images in Artifact Registry |
| §6 migrations | ✅ applied + ownership sweep |
| §7 first deploy | ✅ live, valid Let's Encrypt cert |
| §8 purge timer | ✅ active and verified applying (§11.3) — was silently never started |
| §9 CI/CD | ✅ **proven** — `5c12dfd` deployed by the pipeline, all 9 steps green (§9.6) |
| §10 verification | ✅ all 10 steps; 7–10 scripted in `deploy/verify-storage.sh` |

**Live configuration** (differs from the defaults written below, which were
pre-decision):

| | |
|---|---|
| Host | `app.buildinlime.com` → `34.93.54.217` |
| VM | `buildinlime-app`, **e2-medium**, `asia-south1-a` |
| Cloud SQL | `buildinlime-db`, PG17, **db-g1-small, ENTERPRISE edition**, private IP `10.101.0.3` |
| Electric disk | **20 GB** pd-ssd at `/var/lib/electric` |
| Cost | ≈ $70/mo (≈ ₹5,930 + GST) |

§3's table and §4.6.2 still show the pre-decision `us-central1` / `e2-standard-2`
/ 50 GB values as the *reasoning*; the table above is what actually runs.

> **This file was previously `cloudRunDeployment.md`.** The plan moved from Cloud Run
> to a single VM after the Electric hosting decision (§1.2, §4.5). Renamed because a
> doc named for the wrong platform is worse than no doc.

---

## 1. How we got here — and why one VM

The decision path matters, because the endpoint resembles where *(storage §9)* started
and it is not for the same reasons.

### 1.1 The storage migration made the app stateless

*(storage §12.1)* pinned the backend to one machine because resource bytes lived on
local disk. Steps 1–3 put every byte behind a `StorageProvider` and shipped a GCS
driver. **That work is not wasted by choosing a single VM** — see §1.4.

### 1.2 Electric is stateful in a way the app is not

Cloud Run was the natural target for a stateless app, and this plan was originally
written for it. Then the Electric hosting question (§4.5) resolved to
**self-managed**, because Electric Cloud has no private-connectivity option and would
have forced Cloud SQL to carry a public IP with an un-narrowable allowlist.

Self-managed Electric needs a persistent filesystem and holds a single logical
replication slot. It **cannot** run on Cloud Run — Electric's own docs say so, and
§4.5.9 records why the Cloud Run multi-container/sidecar variant fails too.

### 1.3 Straddling two platforms costs more than co-locating

That left a choice: app on Cloud Run + Electric on a VM (two platforms, Direct VPC
egress, a VPC hop on the hot sync path), or both containers on one VM.

One VM wins on: a single deployable unit, app→Electric over the container network
instead of a VPC hop, no Direct VPC egress to configure, no long-poll concurrency
billing question, and a topology that mirrors `docker-compose.yaml` — the shape the
team already develops against.

**What it costs, stated plainly:**

- **No autoscaling and no zero-downtime deploys** unless we build them.
- **App deploys touch the box holding the replication slot.** This is the real
  coupling risk (§12) and the main argument against this topology; it is accepted, not
  solved.
- **A single point of failure.** Mitigations in §12, none of which make it redundant.
- **TLS is ours** — Caddy, not a managed certificate.

### 1.4 Why the storage migration still pays off here

On one VM it is tempting to ask why bytes went to GCS at all when there is a disk right
there. The answer:

- **The VM becomes cattle, not a pet.** It can be destroyed and rebuilt with no user
  data loss. Everything durable lives in Cloud SQL and GCS.
- **Horizontal scale stays available.** Running a second app container — on this VM or
  a future one — needs no data migration. §12.1 is closed as a *property*, even though
  we are not currently exercising it (§10 step 9).
- **Backups get simpler.** Cloud SQL has automated backups; GCS has versioning. The
  VM's disks hold only a rebuildable Electric shape-log cache.

---

## 2. Two findings that shaped the plan

### 2.1 The backfill does not run in production

`scripts/migrate-storage-to-gcs.ts` reads bytes from the **old absolute local path**
and re-`put`s them as keys. It presupposes a machine already holding a pre-migration
`uploads/` tree.

A freshly provisioned VM has none, and per *(storage §11)* there is no production
environment — **production starts with zero rows and zero objects.** The backfill is a
**dev-machine tool only**. It stays in the repo, stays tested *(storage §8)*, and is
not part of the cutover.

This removes the riskiest ordering step from the old step-4 plan. The interlock guard
in `purge-resources.ts` stays — it just never fires in a fresh prod.

### 2.2 The container build needs env vars

`ci.yml:41` injects dummy `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and
`RESEND_API_KEY` into the build job, because the `/` prerender pulls in
`connection.ts`, `auth`, and `sendEmailOtp.ts` (`new Resend(...)` at module load) —
all of which throw on missing env. The Dockerfile build stage hits the same wall and
needs the same dummies. Nothing connects at build time.

`STORAGE_DRIVER` stays **unset** during build so the prerender never constructs a GCS
client — `storage/index.ts` is deliberately lazy for exactly this reason.

---

## 3. Phase 0 — decisions to lock first

| Decision | Choice | Why |
|---|---|---|
| Topology | **one GCE VM, two containers + Caddy** | §1.3 |
| Region/zone | one zone, co-located with Cloud SQL and the bucket | cross-region egress costs latency and money |
| VM image | **Ubuntu 24.04 LTS + Docker + Compose** | §4.6.1 — judgment call; COS is the hardening alternative |
| Cloud SQL | **private IP only**, `db-g1-small` | §4.2 — the payoff of self-managing Electric |
| Electric | **self-managed**, same VM | §4.5 |
| Custom domain | map **before** first boot | `BETTER_AUTH_URL` is baked into trusted origins (`auth/server.ts:131-135`); changing it later invalidates sessions, and Caddy needs DNS to issue a cert |
| TLS | Caddy with automatic HTTPS | already the dev front-end; §5.6 |
| Serving strategy | proxy stream, **not** signed URLs | decided in *(storage §5A)*; do not revisit under deploy pressure |

---

## 4. Phase 1 — provision GCP

### 4.1 Bucket

```bash
gcloud storage buckets create gs://buildinlime-resources \
  --location=us-central1 \
  --uniform-bucket-level-access \
  --public-access-prevention
```

`--public-access-prevention` is the *enforcement* of *(storage §10)*'s "keep the bucket
private" — it makes an `allUsers` grant structurally impossible rather than merely
absent. This matters because `serveResourceFile` is the **sole** access gate: the §8
soft-delete and membership guards are defeated the moment bytes are reachable without
passing through it.

No lifecycle rule — an age-based delete would race `ORPHAN_GRACE_MINUTES` in the purge
sweep.

### 4.2 Cloud SQL — private IP only

The payoff of self-managing Electric (§4.5): every consumer of this database lives
inside the VPC, so the instance never needs to be internet-reachable.

Requires private services access on the VPC first:

```bash
gcloud compute addresses create google-managed-services-default \
  --global --purpose=VPC_PEERING --prefix-length=16 --network=default

gcloud services vpc-peerings connect \
  --service=servicenetworking.googleapis.com \
  --ranges=google-managed-services-default --network=default

gcloud sql instances create buildinlime-db \
  --database-version=POSTGRES_17 \
  --tier=db-g1-small \
  --region=us-central1 \
  --network=default \
  --no-assign-ip \
  --database-flags=cloudsql.logical_decoding=on
```

**`cloudsql.logical_decoding=on` is not optional.** `docker-compose.yaml` runs Postgres
with `wal_level=logical` because Electric needs logical replication, and Electric
connects **directly to Postgres**, not through the app. Omitting it fails at sync time
with an error that does not obviously point back here. Confirmed against both
Electric's and Google's docs (§4.5.8).

#### 4.2.1 The Electric role — more than `REPLICATION`

**Corrected 2026-07-19 after testing.** An earlier draft of this section had only:

```sql
CREATE ROLE electric WITH REPLICATION LOGIN PASSWORD '...';
```

That is **not sufficient**. Electric starts, acquires the Postgres lock, then dies with:

```
[emergency] Publication "electric_publication_default" not found in the database
```

Electric creates its own publication and sets `REPLICA IDENTITY FULL`, which needs more
than replication rights. Their docs describe two modes, and the choice is a real
security decision:

**Electric-managed mode** (their recommendation, and what was verified working):

```sql
CREATE ROLE electric WITH LOGIN PASSWORD '...' REPLICATION;
GRANT CONNECT ON DATABASE buildinlime TO electric;
GRANT USAGE  ON SCHEMA public         TO electric;
GRANT CREATE ON DATABASE buildinlime  TO electric;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO electric;
-- plus TABLE OWNERSHIP — Electric must own tables to set REPLICA IDENTITY FULL
-- and add them to its publication:
ALTER TABLE public.<each_table> OWNER TO electric;
```

**⚠️ Weigh the ownership requirement before adopting this.** Handing table ownership to
the sync service's role is a significant grant — it can `DROP`/`ALTER` any table it
owns, and it is a *different* role from the app's. It also interacts with migrations:
`drizzle-kit` runs as the app's role and must still be able to alter tables it no longer
owns.

**Manual mode** is the alternative: the role gets only `CONNECT`/`USAGE`/`SELECT` +
`REPLICATION`, and a DBA creates the publication and sets replica identity by hand.
No ownership transfer.

#### 4.2.2 DECIDED — Electric-managed mode

**Decision (2026-07-19): Electric-managed**, per Electric's own recommendation.
Implemented as `deploy/sql/01-electric-role.sql` and `02-electric-own-tables.sql`, both
verified end-to-end against `postgres:17` + `electricsql/electric:1.4.10` with a
**non-superuser** app role (mirroring Cloud SQL).

Testing turned up three requirements that are **not** in Electric's documented setup.
Each produces a different, non-obvious failure:

| Missing grant | Symptom |
|---|---|
| `CREATE ON SCHEMA public` | `ERROR: permission denied for schema public` on ownership transfer |
| `CREATE ON DATABASE` | Electric starts, takes the lock, dies: `Publication "electric_publication_default" not found` |
| `GRANT electric TO <app_role>` | Next migration fails: `ERROR: must be owner of table <name>` |

The schema-level grant is a genuine gap in Electric's docs: they list
`GRANT CREATE ON DATABASE`, which permits creating *schemas*, not tables within one.
Postgres 15 removed the implicit `PUBLIC` create privilege on schema `public`, so on
PG15+ their documented set is insufficient.

**The ownership sweep must run after EVERY migration**, not once. `drizzle-kit` runs as
the app role, so any table it creates is owned by the app role and silently drops out of
Electric's reach. Wired into the deploy sequence at §6.

**Verified lazy configuration.** Electric adds a table to its publication and sets
`REPLICA IDENTITY FULL` on the **first shape request for that table**, not at startup.
Observed directly: after syncing `users` then `tasks`, `pg_publication_tables` held
exactly those two. This is why the sweep runs eagerly — otherwise a mis-owned table
fails at first sync in production rather than at deploy time.

**Accepted cost.** The `electric` role owns every table in `public` and can therefore
`DROP`/`ALTER` any of them. The app role retains its own identity and reaches ownership
only through membership. If that grant ever looks too broad, manual mode is the fallback
— but it needs the publication and replica identity maintained by hand on every schema
change that touches a synced table.

**Verified working end-to-end:** migrations as the app role → ownership sweep → Electric
starts healthy → publication created and owned by `electric` → authenticated shape
requests return 200 for multiple tables.

`--no-assign-ip` is what makes this posture real. Verify after creation that the
instance has no public IP; it is easy to re-enable one while debugging and forget.

Enable **automated backups** and point-in-time recovery. This is the only durable store
that is not GCS.

### 4.3 Service account

One service account, attached to the VM. Both containers inherit it via the metadata
server:

```bash
gcloud iam service-accounts create buildinlime-vm
```

```bash
# Bucket-scoped, not project-scoped
gcloud storage buckets add-iam-policy-binding gs://buildinlime-resources \
  --member=serviceAccount:buildinlime-vm@PROJECT.iam.gserviceaccount.com \
  --role=roles/storage.objectAdmin

gcloud projects add-iam-policy-binding PROJECT \
  --member=serviceAccount:buildinlime-vm@PROJECT.iam.gserviceaccount.com \
  --role=roles/artifactregistry.reader
```

`objectAdmin` rather than `objectViewer` because `handleFileUpload` writes and
`purge-resources.ts` deletes. Bucket-scoped so a compromised VM cannot reach other
buckets.

**No `roles/cloudsql.client` needed** — with private IP the VM connects straight to the
instance's IP over the VPC, not through the Cloud SQL connector.

### 4.4 Secrets

```bash
for s in db-url electric-db-url better-auth-secret resend-api-key; do
  gcloud secrets create "$s" --replication-policy=automatic
done
```

Grant `roles/secretmanager.secretAccessor` on each to `buildinlime-vm`.

- `db-url` — the app's connection, as the app's role.
- `electric-db-url` — Electric's connection, as the `electric` REPLICATION role (§4.2).
  A separate secret so the two roles stay distinct even though one VM reads both.

**No `electric-secret` / `electric-source-id`.** Those authenticate to *Electric
Cloud*. `electric-proxy.ts:34` only appends `source_id`/`secret` when **both** env vars
are set, so leaving them unset is the correct configuration and needs **no code
change**.

Secrets are materialised into `/opt/buildinlime/.env` at boot (§4.6.5) and read by
Compose. They never enter the image and never enter git.

### 4.5 Electric — hosting decision

**Decision: SELF-MANAGED**, co-located on the app VM. Revised 2026-07-19; an earlier
draft chose Electric Cloud.

#### 4.5.1 The seam makes this reversible

All 15 shape routes funnel through `shapeHandler` (`shape-route.ts:44`): authenticate →
build a session-derived `where` → proxy. **Electric is never exposed to clients.** The
only thing distinguishing the options in the codebase is `electric-proxy.ts:12` and
`:34`:

```ts
return process.env.ELECTRIC_URL || `http://localhost:30000`
...
if (process.env.ELECTRIC_SOURCE_ID && process.env.ELECTRIC_SECRET) {
```

Switching is an **env-var change** — no code, no schema, no client impact. That removes
the usual lock-in argument and means this was decided on operational cost, not
strategic reversibility.

#### 4.5.2 Electric is stateful

Three load-bearing properties:

1. **It holds a Postgres logical replication slot.** If Electric dies and the slot is
   left behind, Postgres retains WAL indefinitely until the disk fills — at which point
   **Postgres stops accepting writes**. On Cloud SQL that is a real outage with a slow
   recovery. This is the most common way self-hosted CDC setups take down production.
2. **It stores shape logs on local disk.** Electric's deployment guide: *"Electric
   caches Shape logs and metadata on the filesystem. Your Electric host must provide a
   persistent filesystem"* — large, fast, locally mounted, ideally NVMe SSD.
3. **It is effectively single-instance per source.** The sync layer does not scale
   horizontally.

Electric's GCP docs, verbatim:

> "We **don't recommend** that you use Cloud Run to deploy the Electric sync service
> because Cloud Run uses an in-memory filesystem and does not provide persistent file
> storage for Shape logs."

Their recommended topologies are Compute Engine (Container-Optimized OS + Persistent
Disk) or GKE.

#### 4.5.3 Comparison

| | Self-managed (this plan) | Electric Cloud |
|---|---|---|
| Replication-slot risk | **ours to monitor** | theirs |
| Ops surface | VM patching, disk, restarts, slot health | none |
| Postgres exposure | **private IP only** — never internet-reachable | **public IP required** — no private option exists (§4.5.4) |
| Cost | folded into the app VM | usage-based, ≈$0 at POC traffic |
| Failure blast radius | **can halt Postgres writes** | sync degrades, DB unaffected |
| Vendor dependency | none | real — young product and company |
| Upgrades | we schedule them | automatic, not on our schedule |

#### 4.5.4 The connectivity constraint that decided it

The case *for* Electric Cloud was real: reversibility is already bought by the proxy
seam; ops time is scarce at POC stage; and the failure modes are asymmetric — Electric
Cloud failing degrades sync, whereas a mismanaged self-hosted slot can stop the
database accepting writes. It was outweighed by the following.

**There is no private-connectivity option.** Sources in §4.5.8.

Across Electric's Cloud product page, `/cloud/usage`, the deployment guide, and the GCP
integration page, the **entire** documented network requirement is one sentence:

> "Your Postgres needs to be reachable from Electric Cloud and configured for logical
> replication."

No VPC peering, no PrivateLink, no Private Service Connect, no SSH tunnel, **no BYOC**.
A targeted search for published **static egress IP ranges** found none.

Google's side closes it:

> "You can't specify a private network (for example, 10.x.x.x) as an authorized
> network."

A private-IP-only Cloud SQL instance **cannot** be reached by an external SaaS. The
documented options are public IP + authorized networks, Private Service Connect (only
for *supported partners* — Electric is not one), or a proxy/tunnel.

**→ Electric Cloud would require Cloud SQL to carry a public IP**, with an
`authorized-networks` rule that cannot be narrowed — effectively `0.0.0.0/0`, a
publicly reachable Postgres defended only by TLS and credentials.

That was survivable at POC stage, and an earlier draft accepted it with "real customer
data arrives" as the flip trigger. **This plan takes the flip now**, because the
migration is free today — no data, no users, no downtime to schedule — and strictly
more expensive at every later date.

#### 4.5.5 Electric recommends this topology

> "If you already run Postgres in GCP, then it's a great idea to also deploy Electric
> within the same network."

Co-locating Electric with Postgres in the VPC is the vendor's own recommended shape.

#### 4.5.6 Operational obligations we are taking on

The cost side of the decision — real work, not a checklist:

- an alert on `pg_replication_slots.active` going false while the slot persists;
- a WAL-retention / disk-space alarm on the Cloud SQL instance, well below full;
- a disk-usage alarm on the Electric data disk (§4.6.3);
- a documented runbook: *"Electric is down and not coming back — drop the slot."*

**Connect Electric directly to Postgres, not through a pooler.** Electric's deployment
guide: *"You usually want to connect directly to Postgres and not via a connection
pool. This is because Electric uses logical replication and most connection poolers
don't support it."* (pgBouncer ≥ 1.23 is the noted exception.) Independent of the app's
own `pg` pool (§5.4), which is a normal query pool and unaffected.

#### 4.5.7 An unexplained warning — verify empirically

Electric's GCP page states:

> "Be careful to connect using the 'Outgoing IP address', not the 'Public IP address'."

**This is counterintuitive and unresolved.** Google's own `configure-ip` docs do not
distinguish the two terms, and with a private-IP-only instance (§4.2) neither may
apply. Treat it as a verbatim warning to **test during the connectivity spike (§12)**
rather than reason about.

#### 4.5.8 Sources

Verified 2026-07-19. **The docs moved from `electric-sql.com` to `electric.ax`**, with
a restructured path scheme (`/docs/sync/…`); use the new domain.

- Electric — GCP integration: https://electric.ax/docs/integrations/gcp
- Electric — Deployment guide: https://electric.ax/docs/sync/guides/deployment
- Electric — Cloud usage: https://electric.ax/cloud/usage
- Cloud SQL — Configure IP: https://docs.cloud.google.com/sql/docs/postgres/configure-ip
- Cloud SQL — Logical replication:
  https://docs.cloud.google.com/sql/docs/postgres/replication/configure-logical-replication
- Cloud Run — Configure containers (sidecars):
  https://docs.cloud.google.com/run/docs/configuring/services/containers
- Cloud Run — NFS volume mounts:
  https://docs.cloud.google.com/run/docs/configuring/services/nfs-volume-mounts
- Cloud Run — Billing settings:
  https://docs.cloud.google.com/run/docs/configuring/billing-settings

#### 4.5.9 Rejected: Electric as a Cloud Run sidecar

Explored 2026-07-19 and **rejected**. Recorded because it looks obviously worth trying
and is not.

Cloud Run multi-container is real and capable: containers share the localhost network
interface, startup order is controllable via `--depends-on` and startup probes, and a
shared in-memory volume exists. Private Cloud SQL from Cloud Run also works, via Direct
VPC egress or a Serverless VPC Access connector. So the *networking* half of the idea
is sound.

It fails on three counts:

1. **Shape logs have nowhere to live.** The shared inter-container volume is
   **in-memory** and dies with the instance. NFS/Filestore: *"Cloud Run does not support
   NFS locking. NFS volumes are automatically mounted in no-lock mode"* — plus writes
   buffer in memory until fsync, a 30-second total volume-mount timeout at startup, and
   added cold-start latency. GCS FUSE: *"does not provide concurrency control for
   multiple writes… the last write wins and all previous writes are lost."* None is a
   viable log store.
2. **Autoscaling multiplies the replication slot.** Every Cloud Run instance runs the
   full container set, so N instances means N Electric containers each opening their own
   slot against the same Postgres. Electric is single-writer per source; this is not a
   degraded mode, it is incoherent.
3. **Pinning to one instance defeats the purpose.** `--min-instances 1 --max-instances
   1` plus instance-based billing would be needed (Electric consumes replication
   continuously, not per-request). But the app then cannot scale at all, and Google is
   explicit that it is still not a guarantee: *"Even if the billing setting is set to
   instance-based billing, Cloud Run autoscaling is still in effect, and may terminate
   instances if they aren't needed."* Cloud Run's revision model also overlaps old and
   new during deploys, so every deploy would briefly run two Electric containers
   contending for the slot. *(This last point is reasoning from the revision model, not
   a doc quote — verify if it ever matters.)*

The result would be a VM with worse guarantees, no persistent disk, and a higher bill.

### 4.6 The VM

#### 4.6.1 Image choice

**Ubuntu 24.04 LTS + Docker Engine + Compose plugin.** A judgment call: Electric and
Google both suggest Container-Optimized OS, which is more hardened and auto-updating,
but its read-only root filesystem and absent package manager make ad-hoc operations
painful — and this team already lives in `docker compose`. COS is the hardening move
once the deploy is boring; it is not the right first step.

#### 4.6.2 Instance

```bash
gcloud compute instances create buildinlime-app \
  --zone=us-central1-a \
  --machine-type=e2-standard-2 \
  --image-family=ubuntu-2404-lts-amd64 --image-project=ubuntu-os-cloud \
  --boot-disk-size=30GB --boot-disk-type=pd-balanced \
  --create-disk=name=buildinlime-electric-data,size=50GB,type=pd-ssd,auto-delete=no \
  --service-account=buildinlime-vm@PROJECT.iam.gserviceaccount.com \
  --scopes=cloud-platform \
  --network=default \
  --address=BUILDINLIME_STATIC_IP \
  --tags=https-server
```

`e2-standard-2` (2 vCPU / 8 GB) is a starting point sized for two containers plus
Caddy. Electric's guide prioritises **disk speed first**, then memory, then CPU — hence
`pd-ssd` for its data disk.

`auto-delete=no` on the Electric disk: deleting the VM should not silently destroy the
shape log. It is a rebuildable cache, but rebuilding it is expensive and should be a
decision, not an accident.

#### 4.6.3 The Electric data disk

Format and mount at `/var/lib/electric`, with an `/etc/fstab` entry so it survives
reboot. Separate from the boot disk so that filling it degrades sync rather than killing
the OS, and so it can be snapshotted and resized independently.

**Add a disk-usage alarm.** Sizing is genuinely unknown — Electric's guide says *"How
much storage you need is highly application dependent. We encourage you to test with
your own workload."* 50 GB is a guess; measure it.

**And alarm the BOOT disk too — that is the one that has actually filled.** Every merge
to main pulls two new images (`app` + `tools`, tagged by SHA) onto the 30 GB boot disk,
which is also the OS disk. Nothing evicted the old ones, so on 2026-07-22 a deploy died
mid-`pull` with:

```
failed to extract layer … to overlayfs:
write /var/lib/containerd/…/snapshots/192/fs/…: no space left on device
```

`deploy.sh` step 6/6 now prunes superseded tags after a successful deploy. It
deliberately does **not** use `docker image prune -a`: that would take `PREV_TAG`'s
images with it, and `PREV_TAG` is precisely what the script's rollback restores. It
keeps the tag being deployed, the one before it, and `latest`.

Note this failure mode is masked if the Electric disk is not mounted — `vm-bootstrap.sh`
uses `nofail` by design, and `docker-compose.prod.yaml` warns that otherwise "shape logs
land on the boot disk". When `/` fills, check `df -h / /var/lib/electric` before assuming
it is images.

#### 4.6.4 Firewall

```bash
gcloud compute firewall-rules create allow-https \
  --allow=tcp:80,tcp:443 --target-tags=https-server --source-ranges=0.0.0.0/0
```

**Only 80/443 from the internet.** Electric's port is never exposed — the app reaches it
over the Compose network. Postgres is private-IP only (§4.2). Use IAP for SSH rather
than opening 22.

#### 4.6.5 Boot-time secret materialisation

A systemd unit (ordered before Compose) writes `/opt/buildinlime/.env`, mode `0600`,
from Secret Manager using the VM's attached service account:

```bash
{
  echo "DATABASE_URL=$(gcloud secrets versions access latest --secret=db-url)"
  echo "ELECTRIC_DATABASE_URL=$(gcloud secrets versions access latest --secret=electric-db-url)"
  echo "BETTER_AUTH_SECRET=$(gcloud secrets versions access latest --secret=better-auth-secret)"
  echo "RESEND_API_KEY=$(gcloud secrets versions access latest --secret=resend-api-key)"
} > /opt/buildinlime/.env
```

Rotating a secret is: update it in Secret Manager, re-run the unit, restart the affected
container.

---

## 5. Phase 2 — package the app

### 5.1 `Dockerfile` — BUILT AND VERIFIED

**Status: implemented.** `/Dockerfile`, `/.dockerignore`, and `/deploy/server-entry.mjs`
exist and are proven — image builds, container boots, routes verified (§5.1.5). This
section records what the implementation had to change from the original sketch, because
four of the assumptions were wrong.

Build context is the **repo root**: `web-app/code` depends on `@buildinlime/contracts`,
`@buildinlime/domain-types`, and `@buildinlime/sync-core` via `workspace:*`.

#### 5.1.1 The server bundle externalises every runtime dependency

The original sketch copied only `dist/` and ran `node dist/server/server.js`. Both halves
were wrong.

`dist/server/server.js` is a 34 KB entry over a 1.3 MB `dist/server/assets/` chunk set,
and **all** runtime deps are bare imports left external — 26 of them, including `pg`,
`@google-cloud/storage`, `better-auth`, `drizzle-orm`, `resend`, `@electric-sql/client`,
`h3-v2`, `seroval`. A `dist`-only image dies with `MODULE_NOT_FOUND`.

So the runtime stage must carry a real `node_modules`, produced by:

```
pnpm deploy --legacy --filter buildinlime --prod /out
```

- **`--legacy` is required on pnpm 10** — without it,
  `ERR_PNPM_DEPLOY_NONINJECTED_WORKSPACE`.
- **`.npmrc` sets `node-linker=hoisted`**, so `/out/node_modules` is a flat npm-style
  tree that copies cleanly between stages. The original warning about pnpm's symlink farm
  not surviving a layer copy **does not apply to this repo**.
- Result is ~516 MB of `node_modules`, ~954 MB image. Larger than ideal: `--prod` still
  admits `drizzle-kit`, `typescript`, `vite`, and `tsx`, and `react-icons` (85 MB) +
  `lucide-react` (44 MB) are real dependencies. `pnpm prune --prod` in `/out` is **not** a
  fix — it deletes the tree entirely, having found no workspace. Size reduction is a
  follow-up, not a blocker: the VM pulls images rarely.

#### 5.1.2 `@dotenvx/dotenvx` was a devDependency imported at runtime — FIXED

`connection.ts:1` and `electric-proxy.ts:1` both `import "@dotenvx/dotenvx/config"`, and
that import survives into 14 server chunks as an external. But the package sat in
**devDependencies**, so `--prod` excluded it and the server could not start.

Fixed by moving it to `dependencies`. It resolved locally only because dev installs
everything — a latent production-only crash that no test would have caught.

`srvx` (§5.1.4) was added explicitly for the same reason: it was reachable only as a
transitive dep of `h3-v2`.

> **Still latent, not fixed:** four externals the bundle imports are undeclared —
> `h3-v2`, `seroval`, `@tanstack/history`, `@tanstack/router-core`. They resolve today
> purely because `node-linker=hoisted` flattens transitives to the root. Switching to the
> default isolated linker would break the server at runtime with no build-time warning.

#### 5.1.3 pnpm version must be pinned — FIXED

`corepack enable` alone fetched **pnpm 11**, which silently ignores the root
`pnpm.overrides` block (pinning react/react-dom to 19.1.0) and then fails
`--frozen-lockfile` with `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`.

Fixed by adding `"packageManager": "pnpm@10.30.3"` to the **root** `package.json`, which
makes corepack resolve the same version locally, in CI, and in Docker. Matches
`ci.yml`'s `PNPM_VERSION`.

#### 5.1.4 The build does not produce a server — `deploy/server-entry.mjs`

The largest surprise. TanStack Start v1.132 emits a **server-agnostic** build:
`dist/server/server.js` default-exports `{ fetch(Request): Response }` and nothing else.
There are no Nitro presets in `@tanstack/start-plugin-core`. Running it directly **exits
0 immediately, silently** — no error, no listener.

`deploy/server-entry.mjs` is the adapter, using `srvx` (already present via `h3-v2`) for
both the Node listener and static serving. Its routing rule, which matters:

| Order | Match | Serves |
|---|---|---|
| 1 | file exists in `dist/client` | the file (hashed assets, icons, `sw.js`) |
| 2 | `/api/*` or `/_server*` | the TanStack handler |
| 3 | anything else | `dist/client/_shell.html` |

**Page routes must NOT reach the handler.** `vite.config.ts` enables SPA mode — the shell
is served for every route and `/` and `/login` are deliberately not server-rendered.
Passing `/` to the handler makes it attempt an SSR render the build is not set up for:

```
TypeError: Cannot read properties of undefined (reading 'state')
  at getStartResponseHeaders (dist/server/server.js:574)
```

All 19 server-route files live under `/api/`, so the prefix rule is exact rather than
heuristic. `/_server` covers TanStack server functions.

The entry also handles SIGTERM (verified: `docker stop` → exit 0, not a spurious crash in
restart policies) and patches `.webmanifest` to `application/manifest+json` — srvx's
static middleware has no MIME entry for it and falls back to `application/octet-stream`,
which browsers reject, making the PWA uninstallable.

#### 5.1.5 Verification performed

Built, run against the live dev Postgres, and checked:

| Path | Result |
|---|---|
| `/`, `/login`, `/deep/route` | `200 text/html` — shell |
| `/manifest.webmanifest` | `200 application/manifest+json` |
| `/sw.js`, `/favicon.svg`, `/assets/*.js`, `*.css` | `200`, correct MIME |
| `/api/auth/get-session` | `200 application/json` — better-auth + DB reachable |
| `/api/users` | `401` — shape-route auth gate intact |
| `docker stop` | exit `0` — graceful shutdown |

**Observation, not fixed:** `/api/nope` returns `500`, not `404`. That is the TanStack
handler's behaviour for an unmatched server route, not the adapter's — pre-existing, worth
a look sometime.

#### 5.1.6 The `tools` stage

Migrations and the purge sweep (§6, §8) need `drizzle-kit`, `tsx`, and the `drizzle/`
directory that the runtime stage strips. `--target tools` is `FROM build`, so it keeps the
full dev tree.

### 5.2 `.dockerignore` — BUILT

`/.dockerignore` exists. Load-bearing entries beyond the obvious `node_modules` / `dist`:

- **`**/.env`** (with `!**/.env.example`) — dotenvx-encrypted secrets must never enter a
  layer.
- **`web-app/code/uploads`** — precisely the local-disk state the object-storage migration
  moved off the app server *(storage §12.1)*. Baking it into an image would reintroduce it.
- `android` / `ios` / `mobile-app` — not part of the web image.

### 5.3 Production Compose file

`deploy/docker-compose.prod.yaml`, deployed to `/opt/buildinlime/` on the VM:

```yaml
name: buildinlime

services:
  caddy:
    image: caddy:2-alpine
    restart: always
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on: [app]

  app:
    image: REGION-docker.pkg.dev/PROJECT/buildinlime/app:TAG
    restart: always
    env_file: .env
    environment:
      NODE_ENV: production
      PORT: 3000
      STORAGE_DRIVER: gcs
      GCS_BUCKET: buildinlime-resources
      BETTER_AUTH_URL: https://app.example.com
      ELECTRIC_URL: http://electric:3000
      PG_POOL_MAX: 10
    depends_on: [electric]

  electric:
    image: electricsql/electric:1.4.10
    restart: always
    environment:
      DATABASE_URL: ${ELECTRIC_DATABASE_URL}
      ELECTRIC_STORAGE_DIR: /var/lib/electric
    volumes:
      - /var/lib/electric:/var/lib/electric

volumes:
  caddy_data:
  caddy_config:
```

Notes on what testing changed:

- **`ELECTRIC_URL: http://electric:3000`** — Compose DNS, not a VPC hop. The §1.3 payoff.
- **`ELECTRIC_SECRET` IS required** — an earlier draft said "no `ELECTRIC_SOURCE_ID` /
  `ELECTRIC_SECRET`", conflating the two. Verified against
  `electricsql/electric:1.4.10`: without a secret, shape requests return
  `401 Unauthorized - Invalid API secret`. It is required unless `ELECTRIC_INSECURE=true`,
  and is passed as a `?secret=` query param. `ELECTRIC_SOURCE_ID` remains Electric Cloud
  only. **This forced a code change — see §5.3.1.**
- **No `GCS_KEY_FILENAME`** — ADC via the VM's attached service account, which
  `storage/index.ts:44` and `gcs.ts:22` already handle. **Zero code change.**
- **Electric's port is not published** — reachable only on the Compose network.
- **`ELECTRIC_INSECURE` deliberately absent.** `docker-compose.yaml` sets it for dev with
  an explicit *"Not suitable for production"* comment.
- **`ELECTRIC_STORAGE_DIR` confirmed** as the correct variable (default `./persistent`).
  Pointed at the mounted pd-ssd (§4.6.3).
- **Healthcheck uses `curl`, not `wget`.** The Electric image ships **curl only** — a
  wget-based probe never passes, and `depends_on: service_healthy` then blocks app startup
  forever. `/v1/health` returns `{"status":"active"}`; the probe accepts 200 or 401 so it
  needs no secret.
- **`app-tools` is behind a `tools` profile** so `up -d` never starts it.
- **Required vars fail loudly.** `${GCS_BUCKET:?...}` style, so a missing value aborts the
  deploy instead of silently starting a misconfigured container.

#### 5.3.1 Code change forced by self-managed Electric

`electric-proxy.ts` previously sent credentials only when **both** env vars were set:

```ts
if (process.env.ELECTRIC_SOURCE_ID && process.env.ELECTRIC_SECRET) { …set both… }
```

Correct for Electric Cloud, silently broken for self-managed — which has a secret but no
source id, so **no credential was sent at all** and every shape request would have 401'd
in production. The two are now independent. Covered by
`tests/unit/electric-proxy.test.ts`, which pins all three deployment shapes
(self-managed / Cloud / local-insecure).

### 5.4 Connection pool — DONE

`connection.ts` now takes `PG_POOL_MAX` (default 10). One app container today, but the
ceiling is instances × max against a `db-g1-small` capped near 100.

### 5.5 dotenvx — the original note was WRONG

This section previously read "no change needed". It was incorrect: `@dotenvx/dotenvx` was
a **devDependency** imported at runtime, which breaks any `--prod` install. Fixed in
§5.1.2. The rest of the original reasoning still holds — dotenvx does not override
already-set env, so Compose's values win, and it logs a harmless `MISSING_ENV_FILE`
notice in-container.

### 5.6 Production Caddyfile — BUILT

`deploy/Caddyfile`. Distinct from the dev `Caddyfile`, which fronts vite at :5173 via
`vite-plugin-caddy.ts` and is unused in production. Validated with
`caddy validate` — config adapts cleanly and automatic HTTP→HTTPS redirects are enabled.

Beyond the basic reverse proxy it sets:

- **Explicit 5m proxy timeouts.** Electric shape requests long-poll (~20s with
  `live=true`) through the app. Defaults are adequate today; being explicit stops a future
  tightening from silently breaking sync.
- **Security headers** — `nosniff`, `DENY` framing, `strict-origin-when-cross-origin`,
  and `-Server`. **HSTS deliberately omitted** until the domain is settled; it is hard to
  walk back.
- `{$PUBLIC_DOMAIN}` from the environment rather than a hardcoded host.

Certificates issue automatically on first HTTPS request, which requires the DNS A record
to already resolve to the VM's static IP (§3). **The `caddy_data` volume must persist** —
losing it re-issues certificates, and Let's Encrypt rate limits apply.

### 5.7 Phase 2 verification performed

Full stack run locally against an **isolated** Postgres (deliberately not the dev
database — a second Electric contends for the `electric_slot_default` lock, which is
§4.5.2's single-writer property demonstrated the hard way):

| Check | Result |
|---|---|
| `docker compose config` | valid |
| `caddy validate` | valid |
| `app-tools pnpm migrate` | migrations applied |
| Electric healthcheck | healthy in ~60s |
| `/`, `/login` | 200, SPA shell |
| `/api/auth/get-session` | 200 |
| `/api/users` unauthenticated | 401 — app-side gate intact |
| Electric direct, no secret | 401 |
| Electric direct, `?secret=` | 200 |
| `tests/unit/electric-proxy.test.ts` | 4 passed |

---

## 6. Phase 3 — migrations

Run explicitly, before starting the new app container — never at container start:

```bash
docker compose --env-file compose.env --env-file .env \
  -f docker-compose.prod.yaml --profile tools run --rm app-tools pnpm migrate

# THEN, every time — not optional, not one-off:
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f deploy/sql/02-electric-own-tables.sql
```

Uses the `tools` image (§5.1). Single-VM deploys are serialised so there is no
concurrent-migration race, but keeping migrations a separate explicit step preserves
that property if a second app container is ever added.

**The ownership sweep is part of "migrate", not a separate concern.** `drizzle-kit` runs
as the app role, so any table a migration creates is owned by the app role — and Electric
cannot add it to its publication or set `REPLICA IDENTITY FULL` on it (§4.2.2). Because
Electric configures tables lazily, on first shape request, skipping the sweep does **not**
fail the deploy. It fails later, at first sync of the new table, in production. Treat the
two commands as one step.

> **Note the `--env-file compose.env --env-file .env` pair.** A single `--env-file`
> *replaces* Compose's default `.env` lookup rather than adding to it, so
> `${ELECTRIC_SECRET}` and `${ELECTRIC_DATABASE_URL}` go unresolved and the command aborts.
> Verified. All systemd units in `vm-bootstrap.sh` pass both.

---

## 7. Phase 4 — first deploy

Order matters:

1. DNS A record → static IP, resolving (§3).
2. VM up, Electric data disk mounted (§4.6.3), `.env` materialised (§4.6.5).
3. `docker compose pull`
4. Migrations (§6).
5. `docker compose up -d` — Electric starts, opens its replication slot, begins
   consuming; Caddy issues the certificate on the first HTTPS request.

Confirm Electric is healthy **before** pointing traffic at the app: it must have
established its slot and caught up, or the first shape requests will hang.

---

## 8. Phase 5 — the purge sweep

`purge-resources.ts` is already provider-portable *(storage §7 item 5)*, which closes
**§12.9** in the same stroke.

A systemd timer on the VM, daily:

```bash
docker compose run --rm app-tools pnpm purge:resources -- --apply
```

**⚠️ Verify `--apply` actually reaches the script** on the first run. `pnpm run x --
--apply` quoting is easy to get subtly wrong, and a purge that silently dry-runs forever
is a failure mode you will not notice. Confirm from the log that it reports applying,
not dry-running.

The *(storage §9)* interlock — the sweep aborts while any row holds an absolute path —
never fires in a fresh prod (§2.1), but **keep the guard**.

---

## 9. Phase 6 — CI/CD

**Status (2026-07-20): PROVEN.** WIF resources created, both repo variables set, and
`5c12dfd` deployed end to end by the pipeline — all nine steps green, smoke test
`200 / 401 / 404` against `https://app.buildinlime.com`.

It took four runs to get there, and §9.6 records what the three failures were. Read it
before changing any of this: every one was in code that looked obviously correct.

**The result that matters most** is in the container ages after a successful deploy:

```
app        Up 4 minutes      <- recreated
caddy      Up 17 hours       <- untouched
electric   Up 17 hours       <- untouched, slot still active/reserved
```

§1.3 accepted "app deploys touch the box holding the replication slot" as the main cost
of co-location, and §12 said to **verify that empirically**. This is that verification,
from a real CI deploy rather than a constructed test: Compose recreated only `app`, and
`electric_slot_default` stayed `active` / `reserved` throughout.

### The pipeline in four files

| File | Runs where | Role |
|---|---|---|
| `.github/workflows/ci.yml` | GitHub runners | the five CI gates + the `deploy` job |
| `.github/scripts/ratchet.sh` | GitHub runner | the `quality` gate's logic |
| `deploy/setup-cicd.sh` | an operator's machine, once | creates the WIF trust so the deploy job can authenticate at all |
| `deploy/deploy.sh` | on the VM | the deploy ordering (§9.3) |

**CI** runs on every PR and on push to `main`, `cancel-in-progress: true`:

| Job | What it proves |
|---|---|
| `build` | the app compiles, with the four dummy env vars §2.2 explains |
| `unit` | web (jsdom) + mobile (node), no database |
| `integration` | tRPC routers against a real `postgres:17-alpine` service. Deliberately **not** `wal_level=logical` — this tier exercises SQL and `generateTxId`, not replication |
| `e2e` | Playwright against the ephemeral `docker-compose.e2e.yaml` stack (Postgres + Electric) |
| `quality` | `ratchet.sh` |

Two non-obvious choices are recorded at their call sites rather than here.
`playwright install` runs **without `--with-deps`** (`ci.yml:122-125`): `--with-deps`
shells out to apt-get and races the runner's own `unattended-upgrades` on the apt lock,
a race that cannot be won from inside the job — and the runner image already ships every
library headless Chromium needs. And the ratchet **fails when an error count goes
*down*** (`ratchet.sh:56`), which reads as perverse until you see that a baseline left
above the real count is tolerated slack: the gap is exactly how many new errors a later
PR could add unnoticed. It has happened twice. Failing until the number is committed is
what keeps the ratchet monotonic.

*(Full CI rationale — the tiering, the baseline-count-vs-changed-files decision, what is
out of scope — lives in `testingAndCiSetup.md` §5 Phase 5. Do not duplicate it here;
this table exists so the deploy path is readable end to end.)*

**CD** is the `deploy` job: authenticate via WIF → build and push `app` + `tools` from
one commit → sync config to the VM over IAP → run `deploy.sh` there → verify from the
public internet. That last step deliberately runs *outside* the VM, so it exercises DNS,
Caddy, and the certificate rather than just the container.

### 9.1 Auth — Workload Identity Federation, never a key file

`deploy/setup-cicd.sh` creates the pool, an OIDC provider, and the
`buildinlime-deploy` service account.

> **The `--attribute-condition` on the provider is load-bearing.** Without it the
> provider trusts *any* token GitHub's OIDC issuer signs, which means any repository
> on GitHub could federate into the pool and impersonate the deployer. It is pinned to
> `Pardhu448/buildinlime-app`, and the `workloadIdentityUser` binding is scoped to the
> same `attribute.repository`.

Roles granted, and why each is needed:

| Role | For |
|---|---|
| `artifactregistry.writer` | push images |
| `iap.tunnelResourceAccessor` | open the IAP SSH tunnel |
| `compute.osAdminLogin` | log in over it with sudo (docker, `/opt/buildinlime`) |
| `compute.viewer` | `gcloud compute ssh` describes the instance first |

The script also sets `enable-oslogin=TRUE` on the VM. Without OS Login, gcloud falls
back to metadata SSH keys, which a CI service account cannot manage.

### 9.2 The job

Gated on `push` to `main` **and** on `build`, `unit`, `integration`, `e2e`, and
`quality` all passing. `e2e` is included deliberately — it is a hard gate in this
workflow, so excluding it would let a red end-to-end suite ship.

`concurrency: deploy-production` with **`cancel-in-progress: false`**. Two concurrent
deploys would race on migrations and on the single Electric replication slot, and
cancelling a half-applied migration is worse than queueing behind it.

### 9.3 The ordering lives in `deploy/deploy.sh`, not in YAML

So it is versioned, reviewable, and runnable by hand during an incident:

1. **pull** — fail before touching anything if the image is missing
2. **migrate** — schema first; the new app never meets an old schema
3. **ownership sweep** — §4.2.2. Missing this does not fail the deploy; it fails at
   first sync of the new table, in production
4. **`up -d`** — Compose recreates only changed services (§12)
5. **smoke** — against `https://${PUBLIC_DOMAIN}`, **not** `http://localhost`:
   `/api/auth/get-session` 200, `/api/users` 401, `/api/.env` 404. Caddy 308-redirects
   HTTP, so a plain-HTTP check never sees 200 (§9.6). The public URL is also the more
   honest test — it exercises DNS, the certificate, Caddy's routing and the app.

On smoke failure it **rolls the image tag back** and restarts, and prints the last
status code plus the app's recent logs. That diagnostic output exists because the first
failure printed *nothing* and had to be re-diagnosed by hand on the VM.

> **Rollback is image-only.** Migrations are not reverted, so if the failed deploy
> applied a schema change, the previous image may not be compatible with the schema it
> lands on. A rollback is a stop-the-bleeding measure, not a return to a known-good
> state.

**Not zero-downtime.** `up -d` recreates the app container, producing a short gap.
Accepted at POC scale.

**Verified (§12 was unsure about this):** Compose recreates only changed services.
Observed twice — a caddy-only config change left `app` and `electric` up, and an
app-only change left `caddy` and `electric` up. App deploys do not churn the
replication slot.

**Still to do:** promote the fake-gcs-server leg from optional to standard
*(storage §8)*. Once GCS is the production driver, that suite exercises the real path.

### 9.6 What the first four deploy runs cost

Three failures before a green run, each in a different layer, none caught by CI. All
three were in code written here and reviewed as correct. Production was never damaged —
every failure stopped before or was reverted — but two of them were avoidable and it is
worth being precise about why they weren't avoided.

**Run 1 — the image build died in the prerender.** TanStack starts a Vite preview server
and fetches `/` from it; the fetch got `ECONNREFUSED 127.0.0.1` in ~10ms. In
`node:22-slim`, `localhost` resolves `::1` first, so the server binds IPv6 while the
client went to IPv4. Fixed with `NODE_OPTIONS=--dns-result-order=ipv4first` in the
Dockerfile build stage.

This one was genuinely hard to see: `docker build --no-cache` succeeds locally, and the
`build` CI job runs the same command on the same runner and passes — it fails *only*
inside Docker on a runner. **It was never reproduced.** A container with IPv6 fully
disabled binds `127.0.0.1` and works, so "the runner has no IPv6" does not explain it
alone; that would need IPv6 present but unroutable. The fix forces both sides onto IPv4
regardless of which was choosing wrong. If the prerender breaks in CI again, this is the
first assumption to re-test, not to trust.

**Run 2 — `PERMISSION_DENIED: iam.serviceAccounts.actAs`.** `gcloud compute ssh/scp`
against an instance that *has* a service account attached requires `actAs` on **that
account**. `setup-cicd.sh` granted four project roles, each necessary, none sufficient.
Avoidable — it is a documented requirement, and nothing surfaces the gap until a real
SSH is attempted. Now bound on the VM's service account **as a resource**, since
project-wide `roles/iam.serviceAccountUser` would let the deployer impersonate every
service account in the project, including ones added later.

**Run 3 — the smoke test rolled back a healthy deploy.** The worst of the three. The
deploy *worked*: image pulled, migrations applied, sweep a no-op, containers up. Then
`curl http://localhost/api/auth/get-session` returned **308** — Caddy's HTTP→HTTPS
redirect — twenty times, and the script reverted a good deploy. The image was later
confirmed fine by running it directly on the VM.

The rollback happened to be safe only because no migration files differed between the
two images; that was checked afterwards, not guaranteed by anything. Had a migration
landed, the reverted image would have met a schema it did not match — precisely the
limitation the box above describes.

**The lesson, stated plainly:** a check that can revert a deploy was never once run
against the real Caddy config before being given that power, and its failure branch
printed nothing. Both are fixed. If a future gate gains authority to undo a deploy, run
it against production *before* wiring it to the rollback.

---

## 10. Phase 7 — verification

### Done

| # | Check | Result |
|---|---|---|
| 1 | Migrations applied | ✅ + ownership sweep, 16 tables |
| 2 | HTTPS serves, cert valid | ✅ Let's Encrypt, clean verify, 308 from HTTP |
| 3 | Auth round-trip | ✅ after verifying the domain in Resend (see below) |
| 4 | Electric sync | ✅ container healthy, shapes served |
| 5 | Exactly one replication slot | ✅ `electric_slot_default`, active, `wal_status=reserved` |
| 6 | Electric writes to the data disk | ✅ `/dev/sdb`, not the boot disk |
| 7 | Upload lands as a **key** at `resources/<id>/<name>` | ✅ key not path, filename sanitised (`ma_ana_report.png`), `original_filename` preserved unsanitised, object present in the bucket |
| 8 | Download round-trip via `serveResourceFile` | ✅ byte-identical, `content-type` round-trips, `cache-control: private`, `content-disposition: attachment` |
| 9 | **Negative tests** — the §8 guard | ✅ non-member 404, soft-deleted 404, nonexistent 404, access restored when membership returns, bytes outlive the soft delete, **all three 404 bodies byte-identical** (no existence oracle) |
| 10 | **Statelessness** | ✅ app container genuinely recreated (ID changed), files still serve byte-identical, `electric` untouched and slot still `active/reserved` |

Steps 7–10 are scripted in `deploy/verify-storage.sh` — run on the VM with a live
session cookie. Re-runnable; an `EXIT` trap restores membership and removes the test
resource on every path including failure. Verified independently after the run: one
active membership, zero leftover rows, no bucket objects.

**Two things the first run caught, both in the test rather than the system:**

- The production cookie carries better-auth's `__Secure-` prefix over HTTPS. The
  unprefixed name authenticates as nobody, which surfaces as a confusing
  "could not resolve a user" in preflight rather than an auth error.
- Step 10 reported *"file still served (200)"* and *"bytes DIFFER"* simultaneously —
  contradictory, and the tell. `req()` bakes in `-o "$BODY_FILE"`, and the caller
  passed a second `-o`; **curl pairs `-o` with URLs positionally**, so with one URL the
  caller's file was never created and `cmp` ran against a missing path. A test that
  fails for a reason unrelated to what it measures. Fixed with an `OUT_FILE` override;
  the same latent bug sat in the `--large` branch.

### Findings from first use

- **OTP mail failed with Resend 403** — `The buildinlime.com domain is not verified`.
  Not a deploy fault; fixed by verifying the domain in Resend. `EMAIL_FROM` was also
  never passed to the container and fell back to `sendEmailOtp.ts:30`'s hardcoded
  default. Now explicit in `compose.env` — prod silently diverging from dev on a value
  that only matters at login is a bad failure mode.
- **Dev users are absent from production, by design.** Production is a fresh database;
  §2.1 — prod starts with zero rows. Not a bug, and the backfill script does not
  change this (it moves *bytes*, not accounts).
- **Unknown `/api/*` paths returned 500, now 404.** TanStack falls through to the SSR
  path when no server route matches, and SPA mode has no SSR, so it threw. Scanners
  probe `/api/.env`, `/api/graphql`, `/api/config` constantly. Fixed by deriving the
  route list from `routeTree.gen.ts` at build time
  (`scripts/generate-api-routes.mjs`) rather than catching the framework's internal
  error.

---

## 11. Follow-ups

**Blocking nothing, but genuinely outstanding:**

1. ~~**Run `deploy/setup-cicd.sh --apply`**~~ — **done.** WIF live, both repo variables
   set, `production` environment gated on a required reviewer. `5c12dfd` deployed by the
   pipeline; §9 is no longer untested code. See §9.6 for what the first four runs cost.
2. ~~**§10 steps 7–10**~~ — **done.** All 22 checks pass against production via
   `deploy/verify-storage.sh`; see §10. Re-run after any change to `fileStorage.ts`,
   `gcs.ts`, or the membership model.
3. **The purge timer has never run, and would not have.** Checked 2026-07-20, ~18h after
   bootstrap: `is-enabled` → `enabled`, `is-active` → **`inactive`**, `list-timers` NEXT
   column empty, journal empty. `vm-bootstrap.sh` ran `systemctl enable` without
   `--now`, which only arms a unit for the *next boot* — and the VM has not rebooted
   since the unit was created. Fixed in the script (`enable --now`).

   **Started and verified 2026-07-20.** Sequence used, and worth repeating on any rebuild:
   dry-run first (`pnpm purge:resources` with no `--apply`) to see the blast radius —
   it reported `0 file(s)`, `0 object(s)`, `0.0 KB`, so starting carried no data risk —
   then `systemctl start buildinlime-purge.timer`, then one manual
   `systemctl start buildinlime-purge.service` to prove the run itself works.

   ```
   active: active      NEXT: Tue 2026-07-21 00:12:07 UTC
   PURGING  retention=30d  driver=gcs        <- "PURGING", not "DRY RUN"
   Deleted longer than 30d ago: 0 file(s)
   Orphaned in the store (...older than 60m): 0 object(s)
   Result=success  ExecMainStatus=0
   ```

   `PURGING` is the line that matters: `--apply` reaches the script through the unit's
   `docker compose ... -- --apply`, so the timer is not silently dry-running. Note
   `Persistent=true` did **not** trigger a catch-up run on start — there was no missed
   schedule to catch up on, since the timer had never been active.

   The general lesson: `enabled` is not `running`. A timer that has never fired looks
   identical to one that is merely waiting, unless you check `is-active` or the NEXT
   column.
4. **`app` is a member of `cloudsqlsuperuser`.** `gcloud sql users create` grants this
   by default, so the app role is more privileged than §4.2.2 assumes and the
   `GRANT electric TO app` membership is not actually load-bearing for it. Revisit once
   migrations are proven stable.
5. **Rotate the Resend API key.** It was pasted in plaintext during setup.
6. **Promote the fake-gcs-server CI leg** from optional to standard *(storage §8)*.
7. **Run the app container as a non-root user.** It is `uid=0` today. Partial mitigation
   for the exposure in §11.1 below — it limits a container escape, not an SSRF. Needs a
   Dockerfile change, rebuild, and redeploy. Cheaper now that the pipeline works: push a
   branch, merge, and the deploy is automatic and reversible.
8. **`two-user-sync.spec.ts` is flaky.** It failed all three Playwright retries in one
   job, then passed on a fresh runner with no code change, then passed again on `main`.
   Random flake usually clears on retry #1; three failures in one job and success in
   another points at something stateful *within* the job — the seed step, or Electric's
   state at that moment — not dice. This is the spec that would catch a real cross-client
   sync regression, so a flaky one is a gate that can be talked into passing. Worth
   diagnosing rather than re-running.

### 11.1 Secret handling — audited 2026-07-20

**What holds up.** No credential has ever been committed: a scan of all history
(`git rev-list --all`) turns up only `re_ci_build_dummy_not_used` and
`postgres:password@localhost` from the dev compose stack. The build-time dummies (§2.2)
keep real values out of the image. On the VM, secrets and config are split by
sensitivity — `.env` is `600 root:root` and holds the five real secrets; `compose.env`
is `644` and holds only image tags, bucket, domain, `PG_POOL_MAX`, `EMAIL_FROM`. That
split is what lets CI sync `compose.env` from git while `.env` never leaves the box.
Secret Manager grants are **per-secret** to `buildinlime-vm`, not project-wide. CI holds
no long-lived credential at all (WIF, §9). The bucket has public access prevention
*enforced* with zero `allUsers` bindings, and Cloud SQL has no public IP.

`compose.env` and `*.env` are now gitignored (`310eeea`) — a tripwire, since
`compose.env` sits beside the real `.env` and is one careless `cp` from a leak.

**`.env` is not hand-maintained.** `buildinlime-secrets.service` re-materialises it from
Secret Manager on every boot — atomic `mv`, `umask 077`, `chmod 0600` — and
`buildinlime.service` declares `Requires=` on it. So Secret Manager is genuinely the
source of truth at runtime, and rotation is one step: update the secret, restart the
unit.

**The accepted exposure.** The app container reaches the metadata server (verified: it
mints a token) and runs as root. That token carries the VM SA's full scope — `secretAccessor`
on all five secrets, plus `objectAdmin` on the resources bucket. An SSRF in the app reads
every credential and can delete every user file.

**Neither obvious fix works, and both were attempted:**

- *Blocking `169.254.169.254` from the container network* breaks storage outright.
  `gcs.ts` runs under ADC — `GCS_KEY_FILENAME` is unset, so the SDK reads the attached
  service account **from the metadata server**. The block would kill every upload and
  download.
- *Revoking `secretAccessor` from the VM SA* breaks boot. The secrets unit needs it, and
  `buildinlime.service` `Requires=` that unit, so the VM would return from any reboot
  unable to serve.

The host needs `secretAccessor` at boot; the container needs metadata at runtime; **GCE
allows one service account per VM**, so the two needs cannot be split across principals.
This is structural to single-VM + ADC, not a misconfiguration, and IAM tuning does not
resolve it — the roles are already scoped to per-secret bindings,
`artifactregistry.reader`, and object admin on exactly one bucket. Item 7 above is the
available partial mitigation; the real fixes are app-layer SSRF defence, or per-workload
identity on a platform that offers it.

**Cosmetic / low priority:**

- §3's decision table and §4.6.2 still show the pre-decision `us-central1` /
  `e2-standard-2` / 50 GB values. Kept as the *reasoning*; the header table records
  what actually runs.
- *(storage §Target header, §9 step 4, §4 table)* say **GCE VM**, which is now correct
  again after the Cloud Run detour. No change needed.

---

## 12. Watch-outs

- **The VM is a single point of failure.** No redundancy, and none of the mitigations
  below change that. Take scheduled snapshots of the boot and Electric disks, keep
  provisioning reproducible, and accept the exposure deliberately at POC scale.
- **App deploys touch the box holding the replication slot.** The accepted cost of
  co-location (§1.3). **Verified 2026-07-20** by a real CI deploy: Compose recreated only
  `app`, while `caddy` and `electric` stayed up 17 hours and `electric_slot_default`
  stayed `active`/`reserved` (§9). Re-check this if the compose file's service
  definitions ever change — if it stops holding, every deploy churns the slot.
- **Deploys are not zero-downtime.** A short gap on every `docker compose up -d`.
- **Electric connectivity is the item to spike first.** Private-IP Cloud SQL, the
  replication role, `cloudsql.logical_decoding`, and the unexplained "Outgoing IP
  address" warning (§4.5.7) all need proving against a real instance before the rest of
  the plan is built.
- **Replication-slot monitoring is not optional** (§4.5.6). A slot left behind by a dead
  Electric fills WAL until Postgres stops accepting writes. **This happened —
  2026-07-24, 30 hours undetected, 24 GB retained, permanent disk growth. See §13.1.**
  Electric does not have to *die* for this: it detached on a half-open socket, stayed
  alive, and kept reporting healthy. The healthcheck cannot see it; only
  `pg_replication_slots.active` can (§13.2).
- **Electric disk sizing is a guess** (§4.6.3), and `ELECTRIC_STORAGE_DIR` is unverified
  (§5.3). Alarm on the disk and confirm the write path on first boot.
- **Pin the Electric image tag** (§5.3). `restart: always` plus a floating tag can
  upgrade a slot-holding service on an unplanned reboot.
- **Do not carry `ELECTRIC_INSECURE` from `docker-compose.yaml`** — dev-only, explicitly
  marked unsuitable for production.
- **`serveResourceFile` remains the only access gate.** Keep the bucket private; do not
  adopt signed URLs *(storage §5B)* without accepting that a URL issued before a
  soft-delete stays valid for its TTL.
- **No local disk for user bytes, ever.** Any future feature reaching for `fs.*` on the
  request path reintroduces §12.1 — and on this topology it would *appear* to work,
  which makes it more dangerous, not less. The provider seam exists to make that a
  review-catchable mistake.
- **The image is ~954 MB** (§5.1.1). Acceptable — the VM pulls rarely — but `--prod`
  admits `drizzle-kit`/`typescript`/`vite`/`tsx` it does not need. Worth trimming once
  the deploy is boring.
- **Four bundle externals are undeclared** (§5.1.2): `h3-v2`, `seroval`,
  `@tanstack/history`, `@tanstack/router-core`. They resolve only because
  `node-linker=hoisted` flattens transitives. Changing the linker breaks production at
  runtime with no build-time signal. Declare them if that setting is ever revisited.
- **`app` and `app-tools` must be built from the same commit.** The tools image runs
  migrations against the schema the app expects; a drift between them is a silent
  mismatch. CI builds both from one context (§9).
- **The ownership sweep must run after every migration** (§4.2.2, §6). Skipping it does
  not fail the deploy — Electric configures tables lazily, so a new table breaks at
  *first sync in production* instead. The slowest possible feedback loop; keep the sweep
  welded to the migrate step.
- **The `electric` role owns every table in `public`** and can drop or alter any of them
  (§4.2.2). Accepted, not ignored. Manual mode is the fallback if that grant ever looks
  too broad.
- **Never run a second Electric against the same database.** It blocks on
  `electric_slot_default` and reports `Timeout waiting for Postgres lock acquisition` —
  observed while testing. Relevant to any staging environment that points at prod's DB.

---

## 13. Incidents

### 13.1 Electric replication detached for 30 hours (2026-07-24 → 2026-07-25)

**Symptom as reported:** writes appeared broken on both clients. Creating build units,
channels, messages and tasks "did not work" on web *and* mobile, while login worked
normally and existing data rendered fine. The report arrived attached to a new Android
APK, so the initial suspicion was the mobile build's API URL.

**Actual cause.** At **2026-07-24 06:10:58 UTC**, `apt-daily-upgrade.service`
(unattended-upgrades) restarted `systemd-networkd`, which bounced `ens4`, `docker0`, the
compose bridge and every container veth:

```
06:10:16  Starting apt-daily-upgrade.service
06:10:53  Stopping systemd-resolved / google-guest-agent / ssh / journald
06:10:58  Stopping systemd-networkd.service
06:10:58  Starting systemd-networkd.service
06:10:58  ens4 / docker0 / br-d0db491808d2 / veth* — Link UP, Gained carrier
```

That severed Electric's logical-replication connection to Cloud SQL. The interfaces were
torn down underneath the socket, so Cloud SQL never sent a FIN or RST: the socket went
**half-open**. Electric received no error, so nothing was logged, no supervisor
restarted anything, and **no reconnect was ever attempted**. The BEAM stayed alive and
kept running its hourly `Optimizing shape db tables` housekeeping against a dead
connection for 30 hours.

**Why nothing caught it.** `docker-compose.prod.yaml`'s healthcheck probes
`/v1/health` and accepts 200 *or* 401 — it proves only that the HTTP API is listening.
Electric reported `Up 5 days (healthy)` throughout. `restart: always` never fired
because nothing exited. The obligations in **§4.5.6** — an alert on
`pg_replication_slots.active` going false, a WAL-retention alarm, a documented
drop-the-slot runbook — would each have caught this independently. None had been built.

**Why it looked like "writes are broken".** Reads and writes take different paths (§3).
Writes landed in Postgres correctly the entire time; only the return trip was dead:

- Web's `projects` / `build_units` / `channels` go through collection
  `onInsert`/`onUpdate`/`onDelete`, which return `{ txid }`
  (`application/collections/organization.ts:94,153,217`). `electric-db-collection`
  awaits that txid and rejects after 5s, **rolling back the optimistic row** — so the
  item appeared, then visibly vanished.
- Messages and tasks go through the outbox with no txid await, so they stayed
  optimistic forever and never reconciled.
- Login was unaffected because Better Auth talks straight to Postgres.

Client-agnostic, which is why web and mobile failed identically. The APK was never
implicated: `mobile-app/scripts/verify-api-url.sh` confirmed
`https://app.buildinlime.com` inlined in `index.android.bundle`, and the release branch
touches no server code.

**Collateral: 24 GB of retained WAL.** The orphaned slot pinned every WAL segment since
`confirmed_flush_lsn`. Cloud SQL auto-resize (`storageAutoResizeLimit: 0`, unlimited)
absorbed it silently, growing the disk from 10 GB to **31 GB. Provisioned disk never
shrinks, so that cost is permanent.**

The retained volume is almost entirely **padding, not data**. `pg_stat_wal.wal_bytes`
showed only ~57 MiB of real WAL records over six days — consistent with ~250 tuple
changes across all tables. But `pg_stat_archiver.archived_count` was 1750 segments over
6.04 days: **290 segments/day against an expected 288**, i.e. one forced switch every
five minutes from `archive_timeout = 300`. At `wal_segment_size = 64MB` that is
**~18.5 GB/day of mostly-empty segments, independent of application load.** A stuck slot
therefore fills disk at ~770 MiB/hour on a completely idle system.

> **Measurement trap, recorded because it cost real time.** A single spot sample of
> `pg_current_wal_lsn()` over ~60s showed a 64 MiB jump, which was extrapolated to
> "90 GiB/day". That was one segment switch caught inside a short window, not a rate —
> and it was miscounted as four 16 MiB segments before `wal_segment_size` was checked
> and found to be 64 MB. It also produced a wrong ~6-hour detach estimate that
> spuriously correlated with a `system_memory_high_watermark` alarm at 07:37 on Jul 25.
> **Use `archived_count` over a long interval, never an LSN delta over a short one.**
> The memory alarms were unrelated: all three postdate the detach by more than a day.

**Recovery (2026-07-25 13:34 UTC).** Draining 22 GB of WAL was pointless — its net
effect was already in the tables, and Electric's entire state was 5.5 MB. A clean reset
was chosen over reconnect-and-drain:

```bash
cd /opt/buildinlime
export DB_URL=$(sudo grep -oP '(?<=^DATABASE_URL=).*' .env)

sudo docker compose --env-file compose.env --env-file .env \
     -f docker-compose.prod.yaml stop electric
sudo psql "$DB_URL" -c "select slot_name, active, wal_status from pg_replication_slots;"

sudo psql "$DB_URL" -c "select pg_drop_replication_slot('electric_slot_default');"
sudo rm -rf /var/lib/electric/*

sudo docker compose --env-file compose.env --env-file .env \
     -f docker-compose.prod.yaml up -d electric
```

**Both `--env-file` flags are required.** Plain `docker compose -f docker-compose.prod.yaml`
fails with `required variable APP_IMAGE is missing a value` — the tag lives in
`compose.env` (§9.3).

Verification — `active` flipped `f → t`, `wal_status` `extended → reserved`, lag
`24 GB → 295 bytes`, and the log showed `Received relation` from the replication stream
handler for `seen_state`, `messages`, `resources`, `tasks`, `build_units`.

**Client aftermath — wiping `/var/lib/electric` invalidates every shape handle.** Every
connected client holds persisted offsets against handles that no longer exist. Electric
answers those with a 409 must-refetch. Web recovered on reload. On mobile, `messages`
recovered but `build_units` did not, and **a full app restart did not fix it — only
sign-out/sign-in did**, because that is what wipes the local store via
`ensureCleanPersistenceForUser` (ARCHITECTURE §7). Persisted offsets survive a restart
by design, so bootstrap hands the collections back the same stale offsets, Electric
reports "up-to-date", and the collection sits silently empty with no error and no
prompt. **If Electric storage is ever wiped again, tell users to sign out and back in;
a restart is not sufficient.**

**Open items this incident created** — see §13.2.

### 13.2 Fixes this incident requires

Ordered by value. (1) prevents recurrence, (2) bounds how long a recurrence goes
unnoticed, (3) bounds what it costs. Do them in that order.

#### 1. Stop unattended-upgrades restarting the network

The trigger, and it *will* recur — unpredictably, because `apt-daily-upgrade` only
bounces `systemd-networkd` when it actually upgrades a networking package. On a single
VM hosting a stateful replication consumer, an unattended network restart is a bad
trade.

**Preferred — GCP-native: VM Manager / OS Config patch management.** Disable the
distro's own timer and let GCP own patching on a schedule you control:

```bash
sudo systemctl disable --now apt-daily-upgrade.timer apt-daily.timer

gcloud compute instances os-inventory ... # requires the OS Config agent enabled
gcloud compute os-config patch-deployments create buildinlime-monthly \
  --instance-filter-names="zones/asia-south1-a/instances/buildinlime-app" \
  --recurring-schedule-time-of-day="18:00" \
  --recurring-schedule-frequency=MONTHLY ...
```

The reason to prefer this over just disabling the timer: patch deployments support
**pre- and post-patch scripts**, so Electric can be stopped cleanly before the patch and
started after — turning the exact failure above into a controlled restart. It also gives
patch-compliance reporting, which a disabled timer does not.

**Interim — IMPLEMENTED** in `vm-bootstrap.sh` as
`/etc/needrestart/conf.d/90-buildinlime.conf`, and installed on the live VM.

**First, what the mechanism is NOT.** The obvious guess — a `systemd` package upgrade
whose postinst restarts its own units — is wrong. `/var/log/apt/history.log` for the
06:10 run shows `krb5-*`, `rsyslog`, `gawk`, `libpam*` and `tar`; **systemd was never
upgraded.** The restart cascade begins at 06:10:53, two seconds after the libpam upgrade
completes at 06:10:51. This is `needrestart` (3.6, installed, with no explicit restart
mode, which on Ubuntu Server means fully automatic) restarting every daemon linked
against the upgraded library. Consequently:

- `Unattended-Upgrade::Package-Blacklist { "systemd"; }` would have prevented **nothing**.
- Blacklisting `libpam` instead is not on the table; it is security-critical.

So keep needrestart in automatic mode — ssh, cron and the rest *should* still restart
after a library fix — and carve out only the network plane:

```perl
# /etc/needrestart/conf.d/90-buildinlime.conf
$nrconf{override_rc}{qr(^systemd-networkd\.service$)} = 0;
$nrconf{override_rc}{qr(^systemd-resolved\.service$)} = 0;
$nrconf{override_rc}{qr(^containerd\.service$)}       = 0;
1;
```

`docker` is already covered by stock `qr(^docker)`; `containerd` is not.

> **Two traps, both found by measuring rather than reasoning.**
>
> **1. Use per-key assignment, never `$nrconf{override_rc} = {...}`.** conf.d is parsed
> *after* the defaults and the README says files "override or modify any previously set
> config option" — a whole-hash assignment **replaces** it. Measured on this VM: the
> assigning form cut `override_rc` from **43 keys to 4**, silently dropping `^dbus`,
> `^systemd-logind`, `^getty@`, `^docker`, `^network` and the rest. That is *worse than
> stock* — it would cause more restarts, not fewer. The per-key form yields 46.
>
> **2. `override_rc => 0` means "do not restart", not "do not list".** The service is
> still detected and still appears in `needrestart -r l -b` output, so **that listing
> cannot be used to verify the override**. Stock config ships `qr(^dbus) => 0` and dbus
> is still listed — yet dbus was demonstrably *not* restarted on 2026-07-24, while
> `systemd-networkd`, which had no override, was. Verify by dumping the parsed hash:
>
> ```bash
> sudo perl -e 'our %nrconf; do "/etc/needrestart/needrestart.conf";
>   print scalar(keys %{$nrconf{override_rc}}), "\n";'   # expect 46, not 4
> ```

**The trade-off, stated explicitly:** those three services keep running against the old
library until something restarts them, and this VM does not reboot on its own — uptime
was 6 days at the time of the incident. That deferral is only acceptable if patching is
actually completed on a schedule, which is the argument for the VM Manager form above.

Do **not** simply `systemctl mask apt-daily-upgrade.timer` and stop there — that trades
a sync outage for an unpatched internet-facing host. The journal already shows constant
SSH brute-force attempts against this VM.

#### 2. Detect it — and self-heal

**The 30-hour detection gap did more damage than the fault.** §4.5.6 called for this
alert before the system was built; it was never implemented.

The current healthcheck cannot see this by construction — it probes `/v1/health` and
accepts 200 *or* 401, which proves only that the HTTP API is listening. **The invariant
that matters is `pg_replication_slots.active`, and it lives in Postgres, not in
Electric.**

**IMPLEMENTED** in `deploy/vm-bootstrap.sh` as `buildinlime-slot-watch.timer` +
`.service` + `/usr/local/bin/buildinlime-slot-watch.sh`, mirroring the existing
`buildinlime-purge.timer` pattern (§8) — same conventions, same place. Runs every 5
minutes (`OnUnitActiveSec=5m`, `OnBootSec=10m`, deliberately **not** `Persistent=true`:
replaying missed checks on boot would fire several restarts in a row).

This is **self-healing, not just alerting**: a restart re-establishes replication, which
is all that was needed here. Behaviour by state:

| slot state | action |
|---|---|
| `active \| reserved` | none |
| `active \| extended` | none — catching up |
| `inactive \| extended` | **restart Electric** (the §13.1 case) |
| `inactive \| lost` | log `MANUAL ACTION REQUIRED`, do **not** restart |
| row missing | restart Electric to recreate the slot |
| Postgres unreachable | log, no action |
| container not `running` | log, no action |
| container up < 5 min | no action |

Four guards matter, and each exists for a reason:

- **`wal_status = lost` is not restartable.** Postgres has already discarded WAL the slot
  needed; only the drop + wipe in §13.1 recovers it. Restarting on a loop would churn a
  slot that can never catch up.
- **A failed query is not a failed slot.** If Postgres is unreachable, restarting
  Electric fixes nothing and would loop every cycle.
- **Skip while the container is not `running`.** Electric is legitimately down mid-deploy;
  acting there races `deploy.sh`.
- **The 5-minute start grace doubles as rate limiting.** After a restart we cannot
  restart again for 5 minutes, so a genuinely broken Electric yields one restart per
  cycle rather than a tight loop.

> **Trap, found by testing against the real database.** Do **not** write
> `select active || '|' || wal_status`. psql prints a bare boolean column as `t`/`f`, but
> through `||` Postgres casts it to the SQL literal `true`/`false`. A check written
> against `'t'` therefore never matches, and the watchdog restarts Electric on *every*
> cycle — including healthy ones. The script uses an explicit
> `case when active then 'active' else 'inactive' end`. Mock values agreed with the wrong
> assumption and the bug survived a unit-style test; only running the query against
> production exposed it.

**`postgresql-client` is now installed by `vm-bootstrap.sh` too.** It never was, despite
`deploy.sh`'s ownership sweep (§4.2.2) already depending on `psql`. It happened to be
present on the first VM, so the gap would only have surfaced on a rebuild.

**Then alert as a backstop**, for when the restart itself fails. The VM currently sends
**nothing** to Cloud Logging — `gcloud logging read 'resource.type="gce_instance"'`
returns empty, so the Ops Agent is not installed. Install it, log the check result, and
build a log-based metric + alerting policy on it. Without the agent there is no path
from a VM-side condition to an alert at all.

#### 3. Bound the blast radius — and note the flag does *not* work here

**Verified against `gcloud sql flags list --database-version=POSTGRES_17`:**

```
max_slot_wal_keep_size   INTEGER   min 102400   max 10485760
```

The flag exists — but the values are megabytes, so **the minimum Cloud SQL permits is
102400 MB = 100 GB**, more than three times this instance's entire 31 GB disk. It can
therefore never trigger before the disk does, and setting it buys nothing at this
instance size. *Confirm the unit before relying on this reading; the conclusion holds
only if it is MB.*

**Use the disk autoresize limit instead.** It is currently `storageAutoResizeLimit: 0`
— unlimited — which is exactly why 24 GB of padding was absorbed silently and the disk
is now permanently 31 GB:

```bash
gcloud sql instances patch buildinlime-db --storage-auto-increase-limit=50
```

**This is a real trade-off, not a free win:** hitting the ceiling makes the instance
reject writes. Set it high enough to absorb a normal spike (~18.5 GB/day of padding
means 50 GB gives ~1 day of headroom above current usage) and *only* alongside fix 2, so
something reacts before the cap is reached. A cap without detection converts a silent
cost leak into an outage.

Two related flags are worth knowing about, though neither would have prevented this:
`wal_sender_timeout` (Postgres-side; it is what correctly marked the slot `active = f`)
and `tcp_keepalives_idle`. Both act on the *server* side. The failure was that
**Electric's client never noticed**, so no Postgres flag addresses it — which is why
fix 2 is the one that matters.

#### 4. Make stale-offset recovery survivable

Lower priority, but user-facing. After a shape-handle invalidation, mobile's
`build_units` collection stayed silently empty across a full app restart; only
sign-out/sign-in cleared it (§13.1). Persisted offsets survive restart by design, so
bootstrap re-hands the collections the same stale offsets and Electric reports
"up-to-date" forever. Either make the 409 must-refetch path reliably reset the persisted
offset, or surface the condition in the UI. Today the cure is undocumented tribal
knowledge, and the symptom is indistinguishable from "the app is broken".
