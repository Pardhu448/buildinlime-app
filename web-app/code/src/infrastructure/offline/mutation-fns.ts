import { NonRetriableError } from "@tanstack/offline-transactions"
import { trpc } from "%/infrastructure/trpc/lib/trpc-client"
import { coerceBool } from "%/application/collections/_shared"

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
  // Retriable errors are retried FOREVER and the outbox drains strictly in order,
  // so anything the server will never accept must fail fast or it wedges the queue
  // and stalls every write behind it. CONFLICT (e.g. a duplicate task name) was
  // missing here while mobile already had it.
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
 * name before it replayed, or two clients raced.
 *
 * Suffixing rather than failing is what keeps offline work from being lost. On a
 * CONFLICT the outbox would drop the transaction and roll the optimistic row back
 * — the user's task would silently vanish, with nobody around to be asked about it
 * (there is no global error hook, and on a replay after restart no caller is even
 * awaiting the promise). Retrying is safe precisely because the id is CLIENT-
 * generated and unchanged: only the name collided, so the retry inserts the row the
 * user already sees, and Electric reconciles it back by id with the new name.
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
  // Fail non-retriably rather than hammering the server forever.
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: p.type as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      entity: p.entity as any,
      entity_id: p.entity_id as string,
      // Denormalized channel scope — must reach the server or channel/task
      // properties would persist with a null channel_id and never sync back.
      channel_id: (p.channel_id as string | null) ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status_value: (p.status_value ?? null) as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      priority_value: (p.priority_value ?? null) as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      task_status_value: (p.task_status_value ?? null) as any,
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
 * second row. Only the value columns are sent — `type`, `entity` and `entity_id`
 * identify the property and must not be mutable through this path.
 */
const updateProperty: MutationFn = async ({ transaction }) => {
  const { modified } = transaction.mutations[0]
  const p = modified as Record<string, unknown>
  try {
    await trpc.properties.update.mutate({
      id: p.id as string,
      data: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status_value: (p.status_value ?? null) as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        priority_value: (p.priority_value ?? null) as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        task_status_value: (p.task_status_value ?? null) as any,
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

// -------------------- reads --------------------

/**
 * Unlike every other mutationFn here, this reads ALL of the transaction's
 * mutations rather than mutations[0]: marking a channel read inserts one row per
 * message, and they must go to the server as a single call — not dropped down to
 * whichever row happened to be first.
 */
const markRead: MutationFn = async ({ transaction }) => {
  const rows = transaction.mutations.map(
    (m) => m.modified as Record<string, unknown>,
  )
  if (rows.length === 0) return

  // Grouped by (item_type, channel_id) rather than assuming the whole
  // transaction shares them — one wrong assumption here would silently mark the
  // wrong items read.
  const groups = new Map<string, { item_type: string; channel_id: string; item_ids: string[] }>()
  for (const r of rows) {
    const item_type = r.item_type as string
    const channel_id = r.channel_id as string
    const key = `${item_type}:${channel_id}`
    const group = groups.get(key)
    if (group) group.item_ids.push(r.item_id as string)
    else groups.set(key, { item_type, channel_id, item_ids: [r.item_id as string] })
  }

  try {
    for (const g of groups.values()) {
      await trpc.reads.markRead.mutate({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        item_type: g.item_type as any,
        item_ids: g.item_ids,
        channel_id: g.channel_id,
      })
    }
  } catch (err) {
    wrapTrpcError(err)
  }
}

export const mutationFns = {
  // reads
  markRead,
  // tasks
  createTask,
  updateTask,
  deleteTask,
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
}
