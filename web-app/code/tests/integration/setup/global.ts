import path from "node:path"
import { Client } from "pg"
import { Pool } from "pg"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import {
  MAINTENANCE_DATABASE_URL,
  TEST_DATABASE_URL,
  TEST_DB_NAME,
} from "./config"

// Vitest globalSetup — runs ONCE in the main process before any integration
// test file. Ensures the test database exists and is migrated to head. Per-test
// truncation is handled separately in setup.ts.
export default async function setup(): Promise<void> {
  // 1. Create the test database if it does not exist. CREATE DATABASE cannot run
  //    inside a transaction, so use a plain Client (pg runs simple queries in
  //    autocommit) against the maintenance database.
  const admin = new Client({ connectionString: MAINTENANCE_DATABASE_URL })
  await admin.connect()
  try {
    const { rows } = await admin.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [TEST_DB_NAME],
    )
    if (rows.length === 0) {
      // Identifier can't be parameterised; TEST_DB_NAME comes from our own
      // config, not user input.
      await admin.query(`CREATE DATABASE "${TEST_DB_NAME}"`)
    }
  } finally {
    await admin.end()
  }

  // 2. Migrate to head. Vitest runs from web-app/code, so the drizzle folder is
  //    at <cwd>/drizzle.
  const pool = new Pool({ connectionString: TEST_DATABASE_URL })
  const db = drizzle({ client: pool, casing: "snake_case" })
  try {
    await migrate(db, {
      migrationsFolder: path.resolve(process.cwd(), "drizzle"),
    })
  } finally {
    await pool.end()
  }
}
