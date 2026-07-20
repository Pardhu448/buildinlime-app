import "@dotenvx/dotenvx/config"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error(`DATABASE_URL is not set`)
}
// Pool size is per-process. One app container today, but the ceiling is
// instances x max, and a db-g1-small Cloud SQL instance caps around 100 — so make
// it configurable now rather than discovering the limit under load.
// See agentGuides/deploymentPlan.md §5.4.
const pool = new Pool({
  connectionString: databaseUrl,
  max: Number(process.env.PG_POOL_MAX ?? 10),
})
export const db = drizzle({ client: pool, casing: `snake_case` })
