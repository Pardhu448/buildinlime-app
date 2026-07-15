// Test-database coordinates, kept import-light (strings only) so both the
// Vitest config and the runtime harness can import it without pulling in `pg`.
//
// Targets a SEPARATE database (`buildinlime_test`) on the same compose Postgres
// the app uses in dev (port 54321) — never the dev `electric` database, so a
// test run can TRUNCATE freely without touching dev data. CI overrides via
// TEST_DATABASE_URL against its own Postgres service.
const DEFAULT_TEST_DATABASE_URL =
  "postgresql://postgres:password@localhost:54321/buildinlime_test"

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL

// The name of the database to create/migrate/truncate.
export const TEST_DB_NAME = new URL(TEST_DATABASE_URL).pathname.slice(1)

// A connection to an EXISTING database on the same server, used only to run
// `CREATE DATABASE buildinlime_test` (you cannot create a DB while connected to
// it). `electric` is guaranteed to exist — it is the compose POSTGRES_DB.
export const MAINTENANCE_DATABASE_URL = (() => {
  const u = new URL(TEST_DATABASE_URL)
  u.pathname = "/electric"
  return u.toString()
})()
