import { createCollection } from "@tanstack/react-db"
import { electricCollectionOptions } from "@tanstack/electric-db-collection"
import { persistedCollectionOptions } from "@tanstack/browser-db-sqlite-persistence"
import { z } from "zod"
import {
  selectProjectSchema,
  selectBuildUnitSchema,
  selectChannelSchema,
  selectMembershipSchema,
  MEMBERSHIP_ROLES,
} from "%/infrastructure/database/schema/admin-schema"
import { getPersistence } from "../../infrastructure/persistence/browser-persistence"
import { retryOnError, coerceBool, origin } from "./_shared"

const electricMembershipSchema = selectMembershipSchema.extend({
  member_flag: z.preprocess(coerceBool, z.boolean()),
  role: z.enum(MEMBERSHIP_ROLES).default(`viewer`),
})

const MEMBERSHIPS_SCHEMA_VERSION = 1

function _makeMembershipsCollection(
  persistence: Awaited<ReturnType<typeof getPersistence>>["persistence"],
) {
  return createCollection(
    persistedCollectionOptions({
      ...electricCollectionOptions({
        id: `memberships`,
        shapeOptions: {
          url: new URL(`/api/memberships`, origin).toString(),
          onError: retryOnError,
          parser: {
            timestamptz: (date: string) => new Date(date),
          },
        },
        schema: electricMembershipSchema,
        getKey: (item) => item.id,
      }),
      persistence,
      schemaVersion: MEMBERSHIPS_SCHEMA_VERSION,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  )
}

// Deferred export — initialized by initializeMembershipsCollection()
export let membershipsCollection: ReturnType<typeof _makeMembershipsCollection> = null!

export async function initializeMembershipsCollection() {
  if (import.meta.env.DEV) console.log(`[OPFS:memberships] Initializing persisted collection…`)
  const t0 = performance.now()
  const { persistence } = await getPersistence()
  membershipsCollection = _makeMembershipsCollection(persistence)
  if (import.meta.env.DEV) console.log(`[OPFS:memberships] Collection created in ${(performance.now() - t0).toFixed(0)}ms`)
}

// ---------------------------------------------------------------------------
// Factory functions — collections are created AFTER memberships load so that
// membership-derived IDs can be baked into the shape URLs.  This eliminates
// the per-poll membership table scan on the server side.
// ---------------------------------------------------------------------------

const PROJECTS_SCHEMA_VERSION = 1

function _makeProjectsCollection(
  persistence: Awaited<ReturnType<typeof getPersistence>>["persistence"],
  memberProjectIds: string[],
) {
  const url = new URL(`/api/projects`, origin)
  if (memberProjectIds.length > 0) url.searchParams.set(`member_ids`, memberProjectIds.join(`,`))
  return createCollection(
    persistedCollectionOptions({
      ...electricCollectionOptions({
        id: `projects`,
        shapeOptions: {
          url: url.toString(),
          onError: retryOnError,
          parser: {
            timestamptz: (date: string) => {
              return new Date(date)
            },
          },
        },
        schema: selectProjectSchema,
        getKey: (item) => item.id,
        // Project writes go through @tanstack/offline-transactions —
        // see application/actions/projects.ts. update/delete are not
        // currently used by UI; when added, register them in mutation-fns
        // and add an action wrapper.
      }),
      persistence,
      schemaVersion: PROJECTS_SCHEMA_VERSION,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  )
}

const BUILD_UNITS_SCHEMA_VERSION = 1

function _makeBuildUnitsCollection(
  persistence: Awaited<ReturnType<typeof getPersistence>>["persistence"],
  memberBuildunitIds: string[],
) {
  const url = new URL(`/api/buildunits`, origin)
  if (memberBuildunitIds.length > 0) url.searchParams.set(`member_ids`, memberBuildunitIds.join(`,`))
  return createCollection(
    persistedCollectionOptions({
      ...electricCollectionOptions({
        id: `build-units`,
        shapeOptions: {
          url: url.toString(),
          onError: retryOnError,
          parser: {
            timestamptz: (date: string) => {
              return new Date(date)
            },
          },
        },
        schema: selectBuildUnitSchema,
        getKey: (item) => item.id,
        // Build-unit writes go through @tanstack/offline-transactions —
        // see application/actions/buildunits.ts.
      }),
      persistence,
      schemaVersion: BUILD_UNITS_SCHEMA_VERSION,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  )
}

const CHANNELS_SCHEMA_VERSION = 1

function _makeChannelsCollection(
  persistence: Awaited<ReturnType<typeof getPersistence>>["persistence"],
  memberChannelIds: string[],
) {
  const url = new URL(`/api/channels`, origin)
  if (memberChannelIds.length > 0) url.searchParams.set(`member_ids`, memberChannelIds.join(`,`))
  return createCollection(
    persistedCollectionOptions({
      ...electricCollectionOptions({
        id: `channels`,
        shapeOptions: {
          url: url.toString(),
          onError: retryOnError,
          parser: {
            timestamptz: (date: string) => {
              return new Date(date)
            },
          },
        },
        schema: selectChannelSchema,
        getKey: (item) => item.id,
        // Channel writes go through @tanstack/offline-transactions —
        // see application/actions/channels.ts.
      }),
      persistence,
      schemaVersion: CHANNELS_SCHEMA_VERSION,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  )
}

// ---------------------------------------------------------------------------
// Deferred exports — initialized by initializeOrganizationCollections()
// called from the _authenticated loader after memberships preload.
// ES-module live bindings ensure importers always read the current value.
// ---------------------------------------------------------------------------
export let projectsCollection: ReturnType<typeof _makeProjectsCollection> = null!
export let buildUnitsCollection: ReturnType<typeof _makeBuildUnitsCollection> = null!
export let channelsCollection: ReturnType<typeof _makeChannelsCollection> = null!

export async function initializeOrganizationCollections(params: {
  memberProjectIds: string[]
  memberBuildunitIds: string[]
  memberChannelIds: string[]
}) {
  if (import.meta.env.DEV) console.log(`[OPFS:org] Initializing persisted collections (projects, buildUnits, channels)…`)
  const t0 = performance.now()
  const { persistence } = await getPersistence()
  projectsCollection = _makeProjectsCollection(persistence, params.memberProjectIds)
  buildUnitsCollection = _makeBuildUnitsCollection(persistence, params.memberBuildunitIds)
  channelsCollection = _makeChannelsCollection(persistence, params.memberChannelIds)
  if (import.meta.env.DEV) console.log(`[OPFS:org] Collections created in ${(performance.now() - t0).toFixed(0)}ms`)
}
