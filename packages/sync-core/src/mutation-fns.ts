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

// NOTE: we intentionally do NOT call `collection.utils.awaitTxId(result.txid)`
// after the tRPC mutation. Electric's normal stream reconciles the optimistic row
// by id, and the brief pre-reconciliation window has never produced an observable
// flicker.
//
// This was once explained as an upstream limitation — that awaiting a txid through
// a `persistedCollectionOptions`-wrapped collection "never resolves". That is NOT
// true, so do not repeat it: `awaitTxId` takes a 5s timeout and REJECTS, the
// persistence wrapper spreads `utils` through untouched, and web's projects /
// build-units / channels collections have always run this exact handshake through
// persisted collections (they return `{ txid }`, which electric-db-collection
// awaits for them).
//
// What actually jammed the executor: the original pilot awaited INSIDE the
// try/catch below. A timeout carries no `.data.code`, so wrapTrpcError rethrew it
// as retriable, the executor re-ran the whole mutation-fn — re-issuing the tRPC
// call — and timed out again, forever.
//
// So if you re-add it: keep it OUT of the retriable path and swallow a timeout
// (the server has already committed; retrying re-issues the write and throwing
// rolls back a mutation that succeeded), and skip it when the collection is
// idle-GC'd, since GC aborts the shape stream that would carry the txid.
// See ARCHITECTURE.md §12.6.

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
export function makeCoreMutationFns(trpc: CoreTrpc): CoreMutationFns {
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
    try {
      await trpc.messages.create.mutate({
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
    } catch (err) {
      wrapTrpcError(err)
    }
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
