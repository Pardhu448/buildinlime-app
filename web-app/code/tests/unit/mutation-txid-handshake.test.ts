import { describe, it, expect, vi } from "vitest"
import { makeCoreMutationFns } from "@buildinlime/sync-core"

// The txid handshake in packages/sync-core/src/mutation-fns.ts. Its header lists
// three rules, each of which has already caused a real failure; these tests exist
// to make breaking one of them loud rather than subtle.
//
// The nastiest is rule 1 — awaiting INSIDE the retriable try/catch. That bug does
// not throw or hang visibly: it makes the offline executor re-run the mutation-fn
// and RE-ISSUE the write, forever. "mutate called exactly once" is the assertion
// that catches it, so do not relax it.

const TXID = 4242

function makeTrpc(result: unknown = { item: {}, txid: TXID }) {
  const mutate = vi.fn().mockResolvedValue(result)
  // Only messages.create is exercised here; the rest of the surface is stubbed
  // because makeCoreMutationFns destructures nothing at construction time.
  return {
    trpc: { messages: { create: { mutate } } } as never,
    mutate,
  }
}

const transaction = {
  mutations: [
    {
      modified: {
        id: "m1",
        text: "hello",
        created_at: "2026-07-22T00:00:00.000Z",
        channel_id: "c1",
        buildunit_id: "b1",
        project_id: "p1",
        createdby_id: "u1",
      },
      original: {},
    },
  ],
}

const run = (fns: ReturnType<typeof makeCoreMutationFns>) =>
  fns.createMessage({ transaction, idempotencyKey: "k1" })

describe("createMessage txid handshake", () => {
  it("waits for the synced row before resolving", async () => {
    const { trpc, mutate } = makeTrpc()
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const awaitTxId = vi.fn().mockReturnValue(gate)

    const fns = makeCoreMutationFns(trpc, { awaitTxId: { messages: awaitTxId } })
    let settled = false
    const pending = run(fns).then(() => {
      settled = true
    })

    // The tRPC write has returned, but the handshake has not — this is precisely
    // the window in which the optimistic row used to be dropped.
    await Promise.resolve()
    expect(mutate).toHaveBeenCalledTimes(1)
    expect(awaitTxId).toHaveBeenCalledWith(TXID)
    expect(settled).toBe(false)

    release()
    await pending
    expect(settled).toBe(true)
  })

  it("swallows a handshake timeout instead of throwing (rule 2)", async () => {
    // Throwing here would roll back a write the server has already committed.
    const { trpc, mutate } = makeTrpc()
    const awaitTxId = vi.fn().mockRejectedValue(new Error("timeout waiting for txid"))

    const fns = makeCoreMutationFns(trpc, { awaitTxId: { messages: awaitTxId } })

    await expect(run(fns)).resolves.toBeUndefined()
    expect(mutate).toHaveBeenCalledTimes(1)
  })

  it("does not re-issue the write when the handshake times out (rule 1)", async () => {
    // The regression guard. If the await is ever moved inside the try/catch,
    // wrapTrpcError marks the timeout retriable and the executor re-runs this fn,
    // re-POSTing the message. A duplicate mutate call is that bug's signature.
    const { trpc, mutate } = makeTrpc()
    const awaitTxId = vi.fn().mockRejectedValue(new Error("timeout waiting for txid"))

    const fns = makeCoreMutationFns(trpc, { awaitTxId: { messages: awaitTxId } })
    await run(fns)

    expect(mutate).toHaveBeenCalledTimes(1)
    expect(awaitTxId).toHaveBeenCalledTimes(1)
  })

  it("skips the handshake when the app supplies no hook", async () => {
    // Pre-handshake behaviour, still the default for every unwired entity.
    const { trpc, mutate } = makeTrpc()
    const fns = makeCoreMutationFns(trpc)

    await expect(run(fns)).resolves.toBeUndefined()
    expect(mutate).toHaveBeenCalledTimes(1)
  })

  it("skips the handshake when the server returns no txid", async () => {
    const { trpc } = makeTrpc({ item: {} })
    const awaitTxId = vi.fn()

    const fns = makeCoreMutationFns(trpc, { awaitTxId: { messages: awaitTxId } })
    await run(fns)

    expect(awaitTxId).not.toHaveBeenCalled()
  })

  it("still surfaces a failed write, and never reaches the handshake", async () => {
    const mutate = vi.fn().mockRejectedValue(new Error("boom"))
    const trpc = { messages: { create: { mutate } } } as never
    const awaitTxId = vi.fn()

    const fns = makeCoreMutationFns(trpc, { awaitTxId: { messages: awaitTxId } })

    await expect(run(fns)).rejects.toThrow("boom")
    expect(awaitTxId).not.toHaveBeenCalled()
  })
})
