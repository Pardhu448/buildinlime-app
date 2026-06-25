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

const createTask: MutationFn = async ({ transaction }) => {
  const { modified } = transaction.mutations[0]
  const task = modified as Record<string, unknown>
  try {
    await trpc.tasks.create.mutate({
      id: task.id as string,
      name: task.name as string,
      description: task.description as string,
      completed: coerceBool(task.completed),
      channel_id: task.channel_id as string,
      buildunit_id: task.buildunit_id as string,
      createdby_id: task.createdby_id as string,
      assignee_id: (task.assignee_id as string | null) ?? null,
    })
  } catch (err) {
    wrapTrpcError(err)
  }
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
    })
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status_value: (p.status_value ?? null) as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      priority_value: (p.priority_value ?? null) as any,
      target_date: (p.target_date as string | null) ?? null,
      start_date: (p.start_date as string | null) ?? null,
      pending_task: (p.pending_task as string | null) ?? null,
      label_value: (p.label_value as string | null) ?? null,
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

export const mutationFns = {
  // tasks
  createTask,
  updateTask,
  deleteTask,
  // projects
  createProject,
  // messages
  createMessage,
  // resources
  deleteResource,
  // properties
  createProperty,
  deleteProperty,
  // teams
  createTeam,
  updateTeam,
}
