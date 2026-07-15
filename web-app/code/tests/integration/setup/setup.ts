import { beforeEach, afterAll } from "vitest"
import { resetDb, closeDb } from "./db"

// Per-file setup for every integration spec: a clean database before each test,
// and a closed pool when the file finishes. Registered via `setupFiles` on the
// integration project (vitest.config.ts).
beforeEach(async () => {
  await resetDb()
})

afterAll(async () => {
  await closeDb()
})
