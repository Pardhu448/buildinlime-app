import { NonRetriableError } from "@tanstack/offline-transactions"
import { trpc } from "%/infrastructure/trpc/lib/trpc-client"
import { tasksCollection } from "%/application/collections/communication"
import { coerceBool } from "%/application/collections/_shared"

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

const createTask: MutationFn = async ({ transaction }) => {
  const { modified } = transaction.mutations[0]
  const task = modified as Record<string, unknown>
  try {
    const result = await trpc.tasks.create.mutate({
      id: task.id as string,
      name: task.name as string,
      description: task.description as string,
      completed: coerceBool(task.completed),
      channel_id: task.channel_id as string,
      buildunit_id: task.buildunit_id as string,
      createdby_id: task.createdby_id as string,
      assignee_id: (task.assignee_id as string | null) ?? null,
    })
    await tasksCollection.utils.awaitTxId(result.txid)
  } catch (err) {
    wrapTrpcError(err)
  }
}

const updateTask: MutationFn = async ({ transaction }) => {
  const { modified } = transaction.mutations[0]
  const task = modified as Record<string, unknown>
  try {
    const result = await trpc.tasks.update.mutate({
      id: task.id as string,
      data: {
        name: task.name as string,
        description: task.description as string,
        completed: coerceBool(task.completed),
        assignee_id: (task.assignee_id as string | null) ?? null,
      },
    })
    await tasksCollection.utils.awaitTxId(result.txid)
  } catch (err) {
    wrapTrpcError(err)
  }
}

const deleteTask: MutationFn = async ({ transaction }) => {
  const { original } = transaction.mutations[0]
  const task = original as Record<string, unknown>
  try {
    const result = await trpc.tasks.delete.mutate({ id: task.id as string })
    await tasksCollection.utils.awaitTxId(result.txid)
  } catch (err) {
    wrapTrpcError(err)
  }
}

export const mutationFns = {
  createTask,
  updateTask,
  deleteTask,
}
