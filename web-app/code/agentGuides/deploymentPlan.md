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

Then the replication role Electric connects as — **not** a superuser, and not the app's
role:

```sql
CREATE ROLE electric WITH REPLICATION LOGIN PASSWORD '...';
```

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

### 5.1 `Dockerfile` (repo root, not `web-app/code`)

Build context must be the **repo root**: `web-app/code` depends on
`@buildinlime/contracts`, `@buildinlime/domain-types`, and `@buildinlime/sync-core` via
`workspace:*`.

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm PATH=$PNPM_HOME:$PATH
RUN corepack enable

FROM base AS build
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY packages/ packages/
COPY web-app/code/package.json web-app/code/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile
COPY web-app/code/ web-app/code/

# Build-time dummies mirror ci.yml:41 — see §2.2. Nothing connects at build time.
# DISABLE_CADDY because the vite plugin hard-exits when the caddy binary is absent
# (vite.config.ts:64). STORAGE_DRIVER stays unset so the prerender builds no GCS client.
RUN DISABLE_CADDY=1 \
    DATABASE_URL=postgresql://postgres:password@localhost:5432/electric \
    BETTER_AUTH_SECRET=build-only-secret-000000000000000000000000 \
    BETTER_AUTH_URL=http://localhost:3000 \
    RESEND_API_KEY=re_build_dummy \
    pnpm --filter buildinlime build

FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/web-app/code/dist ./dist
CMD ["node", "dist/server/server.js"]
```

**⚠️ Verify before trusting the runtime stage.** It is *unconfirmed* whether Nitro
bundles server deps into `dist/server/server.js` or leaves `pg` /
`@google-cloud/storage` / `better-auth` external:

```bash
node -e "const s=require('fs').readFileSync('web-app/code/dist/server/server.js','utf8'); \
  console.log(['pg','@google-cloud/storage','better-auth'] \
    .map(m=>m+': '+((s.includes('require(\"'+m+'\")')||s.includes('from\"'+m+'\"'))?'EXTERNAL':'bundled')).join('\n'))"
```

If anything reports EXTERNAL, add a `pnpm deploy --filter buildinlime --prod /out` stage
and copy `/out/node_modules`. Do **not** copy the raw workspace `node_modules` — pnpm's
symlink farm does not survive a layer copy intact.

**A second `tools` stage retaining devDeps is required** for migrations and the purge
sweep (§6, §8), which need `drizzle-kit`, `tsx`, and the `drizzle/` directory that the
minimal runtime stage strips.

### 5.2 `.dockerignore` (repo root)

```
node_modules
**/node_modules
**/dist
web-app/code/uploads
web-app/code/.env
web-app/code/.tanstack
android
ios
mobile-app
.git
```

`uploads/` and `.env` are the load-bearing entries: the first is precisely the local-disk
state being migrated away from, the second holds dotenvx-encrypted secrets.

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

Notes:

- **`ELECTRIC_URL: http://electric:3000`** — Compose DNS, not a VPC hop. This is the
  §1.3 payoff. No `ELECTRIC_SOURCE_ID` / `ELECTRIC_SECRET` (§4.4).
- **No `GCS_KEY_FILENAME`** — ADC via the VM's attached service account, which
  `storage/index.ts:44` and `gcs.ts:22` already handle. **Zero code change.**
- **Electric's port is not published** — reachable only on the Compose network.
- **`ELECTRIC_INSECURE` is deliberately absent.** `docker-compose.yaml` sets it for dev
  with an explicit *"Not suitable for production"* comment. Do not carry it over;
  configure Electric's own auth per their security guide.
- **Pin the Electric image tag.** `restart: always` plus a floating tag would upgrade a
  replication-slot-holding service on an unplanned restart.
- **Verify `ELECTRIC_STORAGE_DIR` is the correct variable name** for the pinned Electric
  version before relying on it — if it is wrong, Electric silently writes shape logs to
  its default path on the boot disk and the whole point of the data disk is lost.

### 5.4 Connection pool

`connection.ts:9` uses pg's default `max: 10`. On a single app container that is fine as
is, but make it configurable now so adding a second container later is a Compose change
rather than a code change:

```ts
const pool = new Pool({
  connectionString: databaseUrl,
  max: Number(process.env.PG_POOL_MAX ?? 10),
})
```

### 5.5 dotenvx — no change needed

`connection.ts:1` imports `@dotenvx/dotenvx/config`. It does not override already-set
process env, so Compose's `env_file` and `environment` values win, and with no `.env` in
the image it is an inert no-op. The only requirement is that `.dockerignore` excludes
`.env` (§5.2).

### 5.6 Production Caddyfile

Distinct from the dev `Caddyfile`, which fronts vite at :5173 via `vite-plugin-caddy.ts`
and is not used in production. `deploy/Caddyfile`:

```
app.example.com {
  reverse_proxy app:3000
  encode gzip
}
```

Caddy obtains and renews the certificate automatically. This requires the DNS A record
to resolve to the VM's static IP **before** first start (§3).

---

## 6. Phase 3 — migrations

Run explicitly, before starting the new app container — never at container start:

```bash
docker compose run --rm app-tools pnpm migrate
```

Uses the `tools` image (§5.1). Single-VM deploys are serialised so there is no
concurrent-migration race, but keeping migrations a separate explicit step preserves
that property if a second app container is ever added.

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
- **The runtime image contents are unverified** until the §5.1 bundling check is run.
