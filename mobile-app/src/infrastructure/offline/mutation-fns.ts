import {
  makeCoreMutationFns,
  wrapTrpcError,
  type MutationFn,
} from "@buildinlime/sync-core"
import type { ChannelName } from "@buildinlime/domain-types"
import { trpc } from "../trpc/client"

// The shared core spine (tasks / messages / resources / properties / teams / seen)
// lives in packages/sync-core. Mobile adds the entity mutations it alone drives
// through the outbox: projects, build units and channels are created from the
// mobile client, where web manages them elsewhere.

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
      name: c.name as ChannelName,
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
        name: c.name as ChannelName,
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

export const mutationFns = {
  ...makeCoreMutationFns(trpc),
  createProject,
  createBuildUnit,
  updateBuildUnit,
  deleteBuildUnit,
  createChannel,
  updateChannel,
  deleteChannel,
}
