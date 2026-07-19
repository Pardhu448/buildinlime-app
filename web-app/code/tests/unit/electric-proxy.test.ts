import { describe, it, expect, beforeEach, afterEach } from "vitest"

// Electric authentication is passed as query params on the proxied origin request
// (electric-proxy.ts). The two params are independent and were previously coupled:
//
//   if (ELECTRIC_SOURCE_ID && ELECTRIC_SECRET) { set both }
//
// which is correct for Electric Cloud (which needs both) but silently sent NO
// credential for a self-managed Electric, where only ELECTRIC_SECRET exists. Every
// shape request then came back `401 Unauthorized - Invalid API secret`. Verified
// against electricsql/electric:1.4.10, which requires the secret unless started with
// ELECTRIC_INSECURE=true.
//
// These cases pin the three deployment shapes:
//   self-managed  → secret only        (agentGuides/deploymentPlan.md §5.3)
//   Electric Cloud→ source_id + secret
//   local dev     → neither, against an ELECTRIC_INSECURE container

const REQUEST_URL = "https://app.example.com/api/users?offset=-1&live=true"

async function prepare() {
  // Re-import per case: the module reads process.env at call time, but importing
  // fresh keeps it honest if that ever changes.
  const mod = await import("%/infrastructure/database/electric-proxy")
  return mod.prepareElectricUrl(REQUEST_URL)
}

let saved: Record<string, string | undefined>

beforeEach(() => {
  saved = {
    ELECTRIC_URL: process.env.ELECTRIC_URL,
    ELECTRIC_SOURCE_ID: process.env.ELECTRIC_SOURCE_ID,
    ELECTRIC_SECRET: process.env.ELECTRIC_SECRET,
  }
  process.env.ELECTRIC_URL = "http://electric:3000"
  delete process.env.ELECTRIC_SOURCE_ID
  delete process.env.ELECTRIC_SECRET
})

afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
})

describe("prepareElectricUrl — Electric authentication", () => {
  it("sends `secret` alone when only ELECTRIC_SECRET is set (self-managed)", async () => {
    process.env.ELECTRIC_SECRET = "s3cr3t"

    const url = await prepare()

    expect(url.searchParams.get("secret")).toBe("s3cr3t")
    expect(url.searchParams.has("source_id")).toBe(false)
  })

  it("sends both when source id and secret are set (Electric Cloud)", async () => {
    process.env.ELECTRIC_SOURCE_ID = "src-123"
    process.env.ELECTRIC_SECRET = "s3cr3t"

    const url = await prepare()

    expect(url.searchParams.get("source_id")).toBe("src-123")
    expect(url.searchParams.get("secret")).toBe("s3cr3t")
  })

  it("sends neither when unset (local dev, ELECTRIC_INSECURE container)", async () => {
    const url = await prepare()

    expect(url.searchParams.has("secret")).toBe(false)
    expect(url.searchParams.has("source_id")).toBe(false)
  })

  it("targets /v1/shape on ELECTRIC_URL and forwards protocol params only", async () => {
    const url = await prepare()

    expect(url.origin + url.pathname).toBe("http://electric:3000/v1/shape")
    // Electric protocol params are copied through...
    expect(url.searchParams.get("offset")).toBe("-1")
    expect(url.searchParams.get("live")).toBe("true")
    // ...but `table` is set by shapeHandler from the descriptor, never the client.
    expect(url.searchParams.has("table")).toBe(false)
  })
})
