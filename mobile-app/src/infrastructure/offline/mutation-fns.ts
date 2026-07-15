import { NonRetriableError } from "@tanstack/offline-transactions"
import { trpc } from "../trpc/client"
import { coerceBool } from "../../application/collections/_shared"

// NOTE: we intentionally do NOT call `collection.utils.awaitTxId(result.txid)`
// after the tRPC mutation. Doing so jams the offline-transactions executor
// because awaiting the txid through a `persistedCollectionOptions`-wrapped
// Electric collection never resolves, so the outbox entry stays "pending"
// forever, the FIFO queue grows, and the page event loop ends up starved.
// Electric's normal stream reconciles the optimistic row by id; the brief
// pre-reconciliation window is harmless.

type MutationFn = (params: {
  transaction: { mutations: Array<{ modified: unknown; original: unknown }> }
  idempotencyKey: string
}) => Promise<unknown>

const NON_RETRIABLE_TRPC_CODES = new Set([
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "PRECONDITION_FAILED",
  "PAYLOAD_TOO_LARGE",
  "UNPROCESSABLE_CONTENT",
])

function wrapTrpcError(err: unknown): never {
  const code = (err as { data?: { code?: string } } | null)?.data?.code
  if (code && NON_RETRIABLE_TRPC_CODES.has(code)) {
    throw new NonRetriableError(
      err instanceof Error ? err.message : String(err),
    )
  }
  throw err instanceof Error ? err : new Error(String(err))
}

// -------------------- tasks --------------------

const isConflict = (err: unknown) =>
  (err as { data?: { code?: string } } | null)?.data?.code === `CONFLICT`

/** How many suffixed names to try before giving up and failing the transaction. */
const MAX_NAME_ATTEMPTS = 50

/**
 * Create the task, auto-suffixing its name if that name is already taken in the
 * channel: "Site Survey" → "Site Survey (2)" → "Site Survey (3)"…
 *
 * The add form already blocks duplicate names, so this only fires when the check
 * could not be trusted: the task was created OFFLINE and someone else took the
 * name before it replayed, or two clients raced. On mobile that is the common
 * path, not a corner case.
 *
 * Suffixing rather than failing is what keeps offline work from being lost. On a
 * CONFLICT the outbox would drop the transaction and roll the optimistic row back
 * — the task would silently vanish from the user's screen, with nobody around to
 * be asked about it (there is no global error hook, and on a replay after restart
 * no caller is even awaiting the promise). Retrying is safe precisely because the
 * id is CLIENT-generated and unchanged: only the name collided, so the retry
 * inserts the row the user already sees, and Electric reconciles it back by id
 * with the new name.
 */
const createTask: MutationFn = async ({ transaction }) => {
  const { modified } = transaction.mutations[0]
  const t = modified as Record<string, unknown>
  const baseName = t.name as string

  for (let attempt = 1; attempt <= MAX_NAME_ATTEMPTS; attempt++) {
    const name = attempt === 1 ? baseName : `${baseName} (${attempt})`
    try {
      await trpc.tasks.create.mutate({
        id: t.id as string,
        name,
        description: t.description as string,
        completed: coerceBool(t.completed),
        channel_id: t.channel_id as string,
        buildunit_id: t.buildunit_id as string,
        createdby_id: t.createdby_id as string,
        assignee_id: (t.assignee_id as string | null) ?? null,
      })
      return
    } catch (err) {
      // Any other failure is the outbox's business — retriable or not, it is not
      // ours to paper over.
      if (!isConflict(err)) wrapTrpcError(err)
    }
  }
  // 50 taken names in one channel is not a collision, it is a bug or an abuse.
  // Fail non-retriably rather than hammering the server forever.
  throw new NonRetriableError(
    `Could not find a free name for task "${baseName}" after ${MAX_NAME_ATTEMPTS} attempts`,
  )
}

const updateTask: MutationFn = async ({ transaction }) => {
  const { modified } = transaction.mutations[0]
  const t = modified as Record<string, unknown>
  try {
    await trpc.tasks.update.mutate({
      id: t.id as string,
      data: {
        name: t.name as string,
        description: t.description as string,
        completed: coerceBool(t.completed),
        assignee_id: (t.assignee_id as string | null) ?? null,
      },
    })
  } catch (err) {
    wrapTrpcError(err)
  }
}

const deleteTask: MutationFn = async ({ transaction }) => {
  const { original } = transaction.mutations[0]
  const t = original as Record<string, unknown>
  try {
    await trpc.tasks.delete.mutate({ id: t.id as string })
  } catch (err) {
    wrapTrpcError(err)
  }
}

// -------------------- projects --------------------

const createProject: MutationFn = async ({ transaction }) => {
  const { modified } = transaction.mutations[0]
  const p = modified as Record<string, unknown>
  try {
    await trpc.projects.create.mutate({
      id: p.id as string,
      name: p.name as string,
      description: p.description as string,
      owner_id: p.owner_id as string,
    })
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
      // same created_at the UI sorted on — see createMessageSchema. Serialised
      // through the outbox as an ISO string; the server coerces it back.
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
 * UPDATE (the redaction) rather than a removal — see the action for why the row has
 * to survive. The server does the real redaction and stamps deleted_at; all we send
 * is the id.
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
      type: p.type,
      entity: p.entity,
      entity_id: p.entity_id as string,
      // Denormalized channel scope — must reach the server, or a channel/task
      // property persists with a null channel_id and syncs back to nobody but
      // its creator (the properties shape matches them BY channel_id).
      channel_id: (p.channel_id as string | null) ?? null,
      status_value: p.status_value ?? null,
      priority_value: p.priority_value ?? null,
      task_status_value: p.task_status_value ?? null,
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
 * Re-setting an existing property type edits it in place rather than adding a
 * second row. Only value columns are sent — type/entity/entity_id identify the
 * property and must not be mutable through this path.
 */
const updateProperty: MutationFn = async ({ transaction }) => {
  const { modified } = transaction.mutations[0]
  const p = modified as Record<string, unknown>
  try {
    await trpc.properties.update.mutate({
      id: p.id as string,
      data: {
        status_value: p.status_value ?? null,
        priority_value: p.priority_value ?? null,
        task_status_value: p.task_status_value ?? null,
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

// -------------------- build units --------------------

const createBuildUnit: MutationFn = async ({ transaction }) => {
  const { modified } = transaction.mutations[0]
  const b = modified as Record<string, unknown>
  try {
    await trpc.buildUnits.create.mutate({
      id: b.id as string,
      name: b.name as string,
      description: (b.description as string | null) ?? null,
      project_id: b.project_id as string,
      owner_id: b.owner_id as string,
    })
  } catch (err) {
    wrapTrpcError(err)
  }
}

const updateBuildUnit: MutationFn = async ({ transaction }) => {
  const { modified } = transaction.mutations[0]
  const b = modified as Record<string, unknown>
  try {
    await trpc.buildUnits.update.mutate({
      id: b.id as string,
      data: {
        name: b.name as string,
        description: (b.description as string | null) ?? null,
      },
    })
  } catch (err) {
    wrapTrpcError(err)
  }
}

const deleteBuildUnit: MutationFn = async ({ transaction }) => {
  const { original } = transaction.mutations[0]
  const b = original as Record<string, unknown>
  try {
    await trpc.buildUnits.delete.mutate({ id: b.id as string })
  } catch (err) {
    wrapTrpcError(err)
  }
}

// -------------------- channels --------------------

const createChannel: MutationFn = async ({ transaction }) => {
  const { modified } = transaction.mutations[0]
  const c = modified as Record<string, unknown>
  try {
    await trpc.channels.create.mutate({
      id: c.id as string,
      name: c.name,
      description: (c.description as string | null) ?? null,
      buildunit_id: c.buildunit_id as string,
      owner_id: c.owner_id as string,
    })
  } catch (err) {
    wrapTrpcError(err)
  }
}

const updateChannel: MutationFn = async ({ transaction }) => {
  const { modified } = transaction.mutations[0]
  const c = modified as Record<string, unknown>
  try {
    await trpc.channels.update.mutate({
      id: c.id as string,
      data: {
        name: c.name,
        description: (c.description as string | null) ?? null,
      },
    })
  } catch (err) {
    wrapTrpcError(err)
  }
}

const deleteChannel: MutationFn = async ({ transaction }) => {
  const { original } = transaction.mutations[0]
  const c = original as Record<string, unknown>
  try {
    await trpc.channels.delete.mutate({ id: c.id as string })
  } catch (err) {
    wrapTrpcError(err)
  }
}

// -------------------- seen --------------------

/**
 * Advance a "last seen" marker (the timestamp successor to markRead). One marker
 * per transaction (mutations[0]); the server upserts and keeps the LATEST seen_at
 * (GREATEST), so an out-of-order outbox replay can never move the line backward.
 * scope_id is '' for the singleton inbox / mytasks scopes and the channel id for
 * a channel. seen_at rides the outbox as an ISO string.
 */
const markSeen: MutationFn = async ({ transaction }) => {
  const s = transaction.mutations[0].modified as Record<string, unknown>
  try {
    await trpc.seen.markSeen.mutate({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      scope: s.scope as any,
      scope_id: (s.scope_id as string) ?? ``,
      seen_at: (s.seen_at instanceof Date
        ? s.seen_at.toISOString()
        : s.seen_at) as string,
    })
  } catch (err) {
    wrapTrpcError(err)
  }
}

export const mutationFns = {
  // seen
  markSeen,
  // tasks
  createTask,
  updateTask,
  deleteTask,
  // projects
  createProject,
  // messages
  createMessage,
  deleteMessage,
  // resources
  deleteResource,
  // properties
  createProperty,
  updateProperty,
  deleteProperty,
  // teams
  createTeam,
  updateTeam,
  // build units
  createBuildUnit,
  updateBuildUnit,
  deleteBuildUnit,
  // channels
  createChannel,
  updateChannel,
  deleteChannel,
}
