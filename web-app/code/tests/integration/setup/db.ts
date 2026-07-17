import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { TEST_DATABASE_URL } from "./config"

// The test database handle. Structurally identical to the app's
// infrastructure/database/connection.ts (same `casing`, no schema binding), so
// it is assignable to the tRPC `Context.db` — which is how makeCtx (ctx.ts)
// hands routers a real, transaction-capable db.
//
// `max: 1` — a single connection. Tests run serially (fileParallelism: false),
// and one connection means a router transaction and the between-test TRUNCATE
// can never sit on two connections with locks acquired in different orders,
// which otherwise deadlocks TRUNCATE ... CASCADE.
export const pool = new Pool({ connectionString: TEST_DATABASE_URL, max: 1 })
export const db = drizzle({ client: pool, casing: "snake_case" })

/**
 * Empty every application table. Called from `beforeEach` (see setup.ts) so each
 * test starts from a clean slate. Discovers tables from the catalog rather than
 * hard-coding a list, so a new table never silently escapes truncation. Drizzle
 * keeps its migration ledger in the separate `drizzle` schema, so restricting to
 * `public` leaves it untouched and migrations are not re-run between tests.
 */
export async function resetDb(): Promise<void> {
  const { rows } = await pool.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  )
  if (rows.length === 0) return
  const list = rows.map((r) => `"${r.tablename}"`).join(", ")
  // RESTART IDENTITY + CASCADE: one statement, FK order irrelevant.
  await pool.query(`TRUNCATE ${list} RESTART IDENTITY CASCADE`)
}

/** Close the pool. Called from `afterAll` so the worker can exit cleanly. */
export async function closeDb(): Promise<void> {
  await pool.end()
}
