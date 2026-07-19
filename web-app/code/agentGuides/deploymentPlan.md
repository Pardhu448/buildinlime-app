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

**Status (2026-07-19): NOT STARTED.** Storage steps 1–3 are built and CI-green
*(storage §9)*; everything below is provisioning + packaging work.

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

Add a `deploy` job to `ci.yml`, gated on `push: branches: [main]` **and** on the existing
`build` / `unit` / `integration` jobs passing.

Use **Workload Identity Federation**, never a downloaded JSON key:

```yaml
permissions:
  contents: read
  id-token: write
```

Steps:

1. authenticate (WIF → a deploy service account)
2. build + push the `app` and `app-tools` images to Artifact Registry
3. deploy over an IAP-tunnelled SSH command:

```bash
gcloud compute ssh buildinlime-app --zone us-central1-a --tunnel-through-iap \
  --command 'cd /opt/buildinlime && \
             docker compose pull && \
             docker compose run --rm app-tools pnpm migrate && \
             docker compose up -d'
```

**This is not a zero-downtime deploy.** `docker compose up -d` recreates the app
container, producing a short gap. Acceptable at POC scale; recorded in §12.

It should **not** restart `electric` — Compose only recreates services whose image or
config changed, which is what keeps the replication slot stable across app deploys.
**Verify this empirically** rather than assuming it; if it is wrong, every deploy churns
the slot (§12).

**Promote the fake-gcs-server leg from optional to standard.** *(storage §8)* lists it as
optional CI; once GCS is the production driver, that suite exercises the real path.

---

## 10. Phase 7 — verification, in order

1. Migrations applied.
2. `https://app.example.com` serves; certificate valid; `/login` renders.
3. Auth round-trip — validates `BETTER_AUTH_URL` and trusted origins
   (`auth/server.ts:131-135`).
4. Electric sync works — validates logical decoding (§4.2), the private-IP path, and the
   replication role.
5. `SELECT * FROM pg_replication_slots` — exactly **one** active slot.
6. Confirm Electric is writing to `/var/lib/electric` on the data disk, not the boot disk
   (§5.3).
7. **Upload a file.** Confirm the object lands at
   `resources/<resourceId>/<safeFilename>` in the bucket, and that
   `resources_raw.storage_path` holds a **key**, not a path.
8. **Download it back** — exercises `serveResourceFile`'s stream path.
9. **Negative tests:** soft-delete a resource → 404; non-member → 404. This is the §8
   guard and the security-critical assertion of the whole migration.
10. **Statelessness check.** §12.1's original proof was "upload via instance A, read via
    instance B" — not directly available on a single VM. Substitute: **destroy the app
    container entirely, recreate it, and confirm previously-uploaded files still serve.**
    That demonstrates the same property — no user bytes on the app's filesystem — which
    is what §12.1 actually asserts (§1.4).

---

## 11. Docs and code still to update

- *(storage §Target header)*, *(storage §9 step 4)*, *(storage §4 table)* currently say
  **Cloud Run**, having been updated from **GCE VM** earlier the same day. They now need
  to say **GCE VM** again. The churn is real; update once this plan is executed rather
  than tracking each revision.
- **`src/infrastructure/storage/drivers/gcs.ts:15-18`** and
  **`src/infrastructure/storage/index.ts:35`** — same story. The original comments said
  "the GCE VM's attached service account", were changed to Cloud Run, and are now correct
  again in their **original** wording. Revert them.
- *(storage §10)* — already updated with `--public-access-prevention`. No further change.

---

## 12. Watch-outs

- **The VM is a single point of failure.** No redundancy, and none of the mitigations
  below change that. Take scheduled snapshots of the boot and Electric disks, keep
  provisioning reproducible, and accept the exposure deliberately at POC scale.
- **App deploys touch the box holding the replication slot.** The accepted cost of
  co-location (§1.3). Compose should leave `electric` alone during app deploys —
  **verify that empirically** (§9), because if it is wrong every deploy churns the slot.
- **Deploys are not zero-downtime.** A short gap on every `docker compose up -d`.
- **Electric connectivity is the item to spike first.** Private-IP Cloud SQL, the
  replication role, `cloudsql.logical_decoding`, and the unexplained "Outgoing IP
  address" warning (§4.5.7) all need proving against a real instance before the rest of
  the plan is built.
- **Replication-slot monitoring is not optional** (§4.5.6). A slot left behind by a dead
  Electric fills WAL until Postgres stops accepting writes.
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
