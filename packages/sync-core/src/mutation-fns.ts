import { NonRetriableError } from "@tanstack/offline-transactions"
import type { inferRouterInputs } from "@trpc/server"
import {
  NON_RETRIABLE_TRPC_CODES as NON_RETRIABLE_CODE_LIST,
  type PropertyType,
  type EntityType,
  type StatusValue,
  type PriorityValue,
  type TaskStatusValue,
  type SeenScope,
} from "@buildinlime/domain-types"
import type { AppRouter } from "@buildinlime/contracts"
import { coerceBool } from "./collections"

// THE TXID HANDSHAKE (`settleTxId` below).
//
// Without it, a mutation-fn resolves the moment tRPC returns 200. TanStack DB then
// drops the optimistic row, and the bubble's existence depends entirely on the
// Electric shape delivering the synced row milliseconds later. That window is
// normally invisible — until sync stalls, at which point the row is dropped with
// nothing to replace it and the message SILENTLY VANISHES, text and all. An earlier
// revision of this comment asserted "the brief pre-reconciliation window has never
// produced an observable flicker"; DISAPPEARING_MESSAGES_INVESTIGATION.md is the
// counterexample that killed that assumption (§9.3 for this, §11 for the stall that
// exposed it).
//
// Every mutation router already returns `{ item, txid }` from `generateTxId(tx)`,
// and Electric stamps the same txid on the rows it streams back. So awaiting it
// holds the optimistic row until the real row is there to replace it: no window.
//
// It is NOT a cure for a stalled shape — after the timeout the row still drops. It
// converts an unbounded, silent, indistinguishable-from-data-loss failure into a
// bounded one, which is the honest behaviour and makes every future repro readable.
//
// THREE RULES, each of which has already drawn blood:
//
// 1. The await MUST sit OUTSIDE the retriable try/catch. The original pilot awaited
//    inside it: a timeout carries no `.data.code`, so wrapTrpcError rethrew it as
//    retriable, the executor re-ran the whole mutation-fn — RE-ISSUING the tRPC
//    write — and timed out again, forever.
// 2. A timeout MUST be swallowed, never thrown. Past the tRPC call the server has
//    committed; throwing rolls back a write that succeeded.
// 3. It needs a live shape to carry the txid. `messages` is IDLE_GC_MS and GC
//    aborts the stream — but GC only fires with no mounted live query, sending only
//    happens from the channel screen where one is mounted, and the 60s tier dwarfs
//    the 5s timeout. Re-check this if either constant moves.
//
// Do NOT reintroduce the old claim that awaiting a txid through a
// `persistedCollectionOptions`-wrapped collection "never resolves". It is false:
// `awaitTxId` takes a 5s timeout and REJECTS, the persistence wrapper spreads
// `utils` through untouched, and web's projects / build-units / channels have always
// run this handshake through persisted collections.

type Inputs = inferRouterInputs<AppRouter>

export type MutationFn = (params: {
  transaction: { mutations: Array<{ modified: unknown; original: unknown }> }
  idempotencyKey: string
}) => Promise<unknown>

// Derived from the canonical list so it can never drift from the routers or the
// other client (ARCHITECTURE.md §5).
export const NON_RETRIABLE_TRPC_CODES = new Set<string>(NON_RETRIABLE_CODE_LIST)

export function wrapTrpcError(err: unknown): never {
  const code = (err as { data?: { code?: string } } | null)?.data?.code
  if (code && NON_RETRIABLE_TRPC_CODES.has(code)) {
    throw new NonRetriableError(err instanceof Error ? err.message : String(err))
  }
  throw err instanceof Error ? err : new Error(String(err))
}

// The subset of the tRPC client the shared mutation-fns call. Typed with the
// contract input types — both apps' routers `.input()` from the same contracts, so
// each app's real tRPC client is assignable to this. Keeps sync-core off tRPC's
// full proxy-client type.
export interface CoreTrpc {
  tasks: {
    create: { mutate(input: Inputs[`tasks`][`create`]): Promise<unknown> }
    update: { mutate(input: Inputs[`tasks`][`update`]): Promise<unknown> }
    delete: { mutate(input: Inputs[`tasks`][`delete`]): Promise<unknown> }
  }
  messages: {
    create: { mutate(input: Inputs[`messages`][`create`]): Promise<unknown> }
    delete: { mutate(input: Inputs[`messages`][`delete`]): Promise<unknown> }
  }
  resources: {
    delete: { mutate(input: Inputs[`resources`][`delete`]): Promise<unknown> }
  }
  properties: {
    create: { mutate(input: Inputs[`properties`][`create`]): Promise<unknown> }
    update: { mutate(input: Inputs[`properties`][`update`]): Promise<unknown> }
    delete: { mutate(input: Inputs[`properties`][`delete`]): Promise<unknown> }
  }
  teams: {
    create: { mutate(input: Inputs[`teams`][`create`]): Promise<unknown> }
    update: { mutate(input: Inputs[`teams`][`update`]): Promise<unknown> }
  }
  seen: {
    markSeen: { mutate(input: Inputs[`seen`][`markSeen`]): Promise<unknown> }
  }
}

// A `type` (not an interface) so it carries an implicit string index signature and
// stays assignable to the executor's `Record<string, MutationFn>` when passed
// directly (web), as well as when spread into a wider object (mobile).
export type CoreMutationFns = {
  markSeen: MutationFn
  createTask: MutationFn
  updateTask: MutationFn
  deleteTask: MutationFn
  createMessage: MutationFn
  deleteMessage: MutationFn
  deleteResource: MutationFn
  createProperty: MutationFn
  updateProperty: MutationFn
  deleteProperty: MutationFn
  createTeam: MutationFn
  updateTeam: MutationFn
}

const isConflict = (err: unknown) =>
  (err as { data?: { code?: string } } | null)?.data?.code === `CONFLICT`

/** How many suffixed names to try before giving up and failing the transaction. */
const MAX_NAME_ATTEMPTS = 50

// The mutation-fns replay each optimistic transaction against the server. They read
// the untyped outbox row (`Record<string, unknown>`) and cast fields to build the
// typed tRPC payload. One copy bound to whichever app's tRPC client is injected.
/**
 * Entities whose tRPC mutations return a Postgres txid that Electric echoes back
 * on the synced row. Every one of these routers already calls `generateTxId(tx)`
 * and returns `{ item, txid }`, so any of them CAN be wired — only the ones an app
 * supplies a hook for actually are.
 */
export type TxIdEntity = `messages` | `tasks` | `resources` | `properties` | `teams`

export interface CoreMutationHooks {
  /**
   * Per-entity "resolve once the synced row carrying this txid has landed".
   * Each app supplies `(txid) => xCollection.utils.awaitTxId(txid)`.
   *
   * MUST be a function, not a captured collection: both apps export their
   * collections as `export let` and REASSIGN them on project switch / resync, so a
   * captured value pins a stale, cleaned-up instance whose shape is gone. Mirrors
   * the `getCollection: () => xCollection` idiom already used in actions/*.
   *
   * An entity with no hook keeps the pre-handshake behaviour: settle as soon as
   * tRPC returns 200. Adding one is two lines in the mutation-fn — capture
   * `result.txid`, then `await settleTxId("<entity>", txid)` after the try/catch.
   */
  awaitTxId?: Partial<Record<TxIdEntity, (txid: number) => Promise<void>>>
}

export function makeCoreMutationFns(
  trpc: CoreTrpc,
  hooks: CoreMutationHooks = {},
): CoreMutationFns {
  /**
   * Wait for `txid` to come back through the entity's shape, then return. Silent
   * no-op when the app supplied no hook for this entity or the server returned no
   * txid.
   *
   * CALL THIS OUTSIDE THE RETRIABLE try/catch — see rules 1 and 2 in the header.
   * It never throws, so it cannot roll back or re-drive a write that has already
   * committed on the server.
   */
  const settleTxId = async (entity: TxIdEntity, txid: number | undefined) => {
    const await_ = hooks.awaitTxId?.[entity]
    if (!await_ || txid === undefined) return
    try {
      await await_(txid)
    } catch {
      // Timed out (awaitTxId's own 5s default) waiting for the shape to deliver
      // this txid, or the collection was torn down mid-flight. Either way the
      // write SUCCEEDED; swallow and let the optimistic row drop exactly as it
      // did before the handshake existed — bounded now instead of immediate.
    }
  }

  // -------------------- tasks --------------------

  /**
   * Create the task, auto-suffixing its name if that name is already taken in the
   * channel: "Site Survey" → "Site Survey (2)" → "Site Survey (3)"…
   *
   * The add form already blocks duplicate names, so this only fires when the check
   * could not be trusted: the task was created OFFLINE and someone else took the
   * name before it replayed, or two clients raced. Suffixing rather than failing is
   * what keeps offline work from being lost — a CONFLICT would drop the transaction
   * and roll the optimistic row back, silently vanishing the user's task. Retrying
   * is safe because the id is CLIENT-generated and unchanged: only the name collided.
   */
  const createTask: MutationFn = async ({ transaction }) => {
    const { modified } = transaction.mutations[0]
    const task = modified as Record<string, unknown>
    const baseName = task.name as string

    for (let attempt = 1; attempt <= MAX_NAME_ATTEMPTS; attempt++) {
      const name = attempt === 1 ? baseName : `${baseName} (${attempt})`
      try {
        await trpc.tasks.create.mutate({
          id: task.id as string,
          name,
          description: task.description as string,
          completed: coerceBool(task.completed),
          channel_id: task.channel_id as string,
          buildunit_id: task.buildunit_id as string,
          createdby_id: task.createdby_id as string,
          assignee_id: (task.assignee_id as string | null) ?? null,
        })
        return
      } catch (err) {
        // Any other failure is the outbox's business — retriable or not, it is not
        // ours to paper over.
        if (!isConflict(err)) wrapTrpcError(err)
      }
    }
    // 50 taken names in one channel is not a collision, it is a bug or an abuse.
    throw new NonRetriableError(
      `Could not find a free name for task "${baseName}" after ${MAX_NAME_ATTEMPTS} attempts`,
    )
  }

  const updateTask: MutationFn = async ({ transaction }) => {
    const { modified } = transaction.mutations[0]
    const task = modified as Record<string, unknown>
    try {
      await trpc.tasks.update.mutate({
        id: task.id as string,
        data: {
          name: task.name as string,
          description: task.description as string,
          completed: coerceBool(task.completed),
          assignee_id: (task.assignee_id as string | null) ?? null,
        },
      })
    } catch (err) {
      wrapTrpcError(err)
    }
  }

  const deleteTask: MutationFn = async ({ transaction }) => {
    const { original } = transaction.mutations[0]
    const task = original as Record<string, unknown>
    try {
      await trpc.tasks.delete.mutate({ id: task.id as string })
    } catch (err) {
      wrapTrpcError(err)
    }
  }

  // -------------------- messages --------------------

  const createMessage: MutationFn = async ({ transaction }) => {
    const { modified } = transaction.mutations[0]
    const m = modified as Record<string, unknown>
    let txid: number | undefined
    try {
      const result = await trpc.messages.create.mutate({
        id: m.id as string,
        text: m.text as string,
        // Forward the client's optimistic send time so the synced row keeps the
        // created_at the UI sorted on. Serialised through the outbox as an ISO
        // string; the server coerces it back.
        created_at: m.created_at as string,
        channel_id: m.channel_id as string,
        buildunit_id: m.buildunit_id as string,
        project_id: m.project_id as string,
        createdby_id: m.createdby_id as string,
        mention_ids: (m.mention_ids as string[] | undefined) ?? [],
        resource_ids: (m.resource_ids as string[] | undefined) ?? [],
        parent_id: (m.parent_id as string | null) ?? null,
        task_id: (m.task_id as string | null) ?? null,
      })
      txid = (result as { txid?: number } | undefined)?.txid
    } catch (err) {
      wrapTrpcError(err)
    }
    // Outside the catch on purpose — rule 1 in the header. This is what keeps the
    // bubble on screen until the synced row exists to replace it.
    await settleTxId(`messages`, txid)
  }

  /**
   * Soft delete. Reads `modified`, not `original`, because deleteMessageAction is an
   * UPDATE (the redaction) rather than a removal — the row has to survive. The server
   * does the real redaction and stamps deleted_at; all we send is the id.
   */
  const deleteMessage: MutationFn = async ({ transaction }) => {
    const { modified } = transaction.mutations[0]
    const m = modified as Record<string, unknown>
    try {
      await trpc.messages.delete.mutate({ id: m.id as string })
    } catch (err) {
      wrapTrpcError(err)
    }
  }

  // -------------------- resources --------------------

  const deleteResource: MutationFn = async ({ transaction }) => {
    const { original } = transaction.mutations[0]
    const r = original as Record<string, unknown>
    try {
      await trpc.resources.delete.mutate({ id: r.id as string })
    } catch (err) {
      wrapTrpcError(err)
    }
  }

  // -------------------- properties --------------------

  const createProperty: MutationFn = async ({ transaction }) => {
    const { modified } = transaction.mutations[0]
    const p = modified as Record<string, unknown>
    try {
      await trpc.properties.create.mutate({
        id: p.id as string,
        type: p.type as PropertyType,
        entity: p.entity as EntityType,
        entity_id: p.entity_id as string,
        // Denormalized channel scope — must reach the server or channel/task
        // properties persist with a null channel_id and never sync back.
        channel_id: (p.channel_id as string | null) ?? null,
        status_value: (p.status_value as StatusValue | null) ?? null,
        priority_value: (p.priority_value as PriorityValue | null) ?? null,
        task_status_value: (p.task_status_value as TaskStatusValue | null) ?? null,
        target_date: (p.target_date as string | null) ?? null,
        start_date: (p.start_date as string | null) ?? null,
        pending_task: (p.pending_task as string | null) ?? null,
        percent_complete: (p.percent_complete as string | null) ?? null,
        label_value: (p.label_value as string | null) ?? null,
      })
    } catch (err) {
      wrapTrpcError(err)
    }
  }

  /**
   * Re-setting an existing property type edits it in place. Only the value columns
   * are sent — `type`, `entity` and `entity_id` identify the property and must not
   * be mutable through this path.
   */
  const updateProperty: MutationFn = async ({ transaction }) => {
    const { modified } = transaction.mutations[0]
    const p = modified as Record<string, unknown>
    try {
      await trpc.properties.update.mutate({
        id: p.id as string,
        data: {
          status_value: (p.status_value as StatusValue | null) ?? null,
          priority_value: (p.priority_value as PriorityValue | null) ?? null,
          task_status_value: (p.task_status_value as TaskStatusValue | null) ?? null,
          target_date: (p.target_date as string | null) ?? null,
          start_date: (p.start_date as string | null) ?? null,
          pending_task: (p.pending_task as string | null) ?? null,
          percent_complete: (p.percent_complete as string | null) ?? null,
          label_value: (p.label_value as string | null) ?? null,
        },
      })
    } catch (err) {
      wrapTrpcError(err)
    }
  }

  const deleteProperty: MutationFn = async ({ transaction }) => {
    const { original } = transaction.mutations[0]
    const p = original as Record<string, unknown>
    try {
      await trpc.properties.delete.mutate({ id: p.id as string })
    } catch (err) {
      wrapTrpcError(err)
    }
  }

  // -------------------- teams --------------------

  const createTeam: MutationFn = async ({ transaction }) => {
    const { modified } = transaction.mutations[0]
    const t = modified as Record<string, unknown>
    try {
      await trpc.teams.create.mutate({
        id: t.id as string,
        name: t.name as string,
        description: (t.description as string | null) ?? null,
        owner_id: t.owner_id as string,
        project_id: t.project_id as string,
        member_ids: (t.member_ids as string[] | undefined) ?? [],
      })
    } catch (err) {
      wrapTrpcError(err)
    }
  }

  const updateTeam: MutationFn = async ({ transaction }) => {
    const { modified } = transaction.mutations[0]
    const t = modified as Record<string, unknown>
    try {
      await trpc.teams.update.mutate({
        id: t.id as string,
        data: {
          name: t.name as string,
          description: (t.description as string | null) ?? null,
          member_ids: (t.member_ids as string[] | undefined) ?? [],
        },
      })
    } catch (err) {
      wrapTrpcError(err)
    }
  }

  // -------------------- seen --------------------

  /**
   * Advance a "last seen" marker. One marker per transaction (mutations[0]); the
   * server upserts and keeps the LATEST seen_at (GREATEST), so an out-of-order
   * replay can't move the line backward.
   */
  const markSeen: MutationFn = async ({ transaction }) => {
    const { modified } = transaction.mutations[0]
    const s = modified as Record<string, unknown>
    try {
      await trpc.seen.markSeen.mutate({
        scope: s.scope as SeenScope,
        scope_id: (s.scope_id as string) ?? ``,
        // Serialised through the outbox as an ISO string; the server coerces it back.
        seen_at: (s.seen_at instanceof Date ? s.seen_at.toISOString() : s.seen_at) as string,
      })
    } catch (err) {
      wrapTrpcError(err)
    }
  }

  return {
    markSeen,
    createTask,
    updateTask,
    deleteTask,
    createMessage,
    deleteMessage,
    deleteResource,
    createProperty,
    updateProperty,
    deleteProperty,
    createTeam,
    updateTeam,
  }
}
