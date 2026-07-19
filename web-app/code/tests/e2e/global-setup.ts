import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { makeSignature } from "better-auth/crypto"
import { sessions } from "%/infrastructure/database/schema/auth-schema"

// -----------------------------------------------------------------------------
// Playwright globalSetup — migrates + seeds the E2E database and writes an
// authenticated storageState per user, BYPASSING the email-OTP login entirely.
//
// Auth without OTP: we insert a real `sessions` row and hand the browser a
// signed session cookie built with Better Auth's own public signing primitive
// (`makeSignature` from better-auth/crypto — exactly what the server uses to
// verify it). With only the session_token cookie present, getSession falls back
// to a DB lookup by token, which finds our row. No Resend, no verifications
// table, no prod-code changes.
//
// It reuses the integration harness (migrate/reset/factories) so seeding stays
// single-sourced. The e2e DB is pointed at via env set in playwright.config.ts.
// -----------------------------------------------------------------------------

const AUTH_DIR = path.resolve(process.cwd(), "tests/e2e/.auth")
// cookiePrefix is "better-auth" and useSecureCookies is false in dev, so the
// session cookie is the un-prefixed name.
const COOKIE_NAME = "better-auth.session_token"

// Fixed, URL-friendly names so specs can build the channel deep-link.
export const BUILD_UNIT_NAME = "AlphaUnit"
export const CHANNEL_NAME = "Finance" // must be one of CHANNEL_NAMES
export const RESOURCE_NAME = "e2e-doc.pdf"

export default async function globalSetup(): Promise<void> {
  // Ensure the integration harness modules (which read TEST_DATABASE_URL) point
  // at the e2e DB even if the config default did not set it.
  process.env.TEST_DATABASE_URL ??= process.env.DATABASE_URL

  // Dynamic imports: these modules read env at load, so import them only after
  // the env above is in place.
  const { default: migrate } = await import("../integration/setup/global")
  const { db, resetDb, closeDb } = await import("../integration/setup/db")
  const {
    createUser,
    createProject,
    createBuildUnit,
    createChannel,
    createMembership,
    createResource,
  } = await import("../integration/factories")

  await migrate()
  await resetDb()

  const userA = await createUser({ name: "E2E Alice" })
  const userB = await createUser({ name: "E2E Bob" })
  const project = await createProject({ ownerId: userA.id, name: "E2E Project" })
  const buildUnit = await createBuildUnit({
    projectId: project.id,
    ownerId: userA.id,
    name: BUILD_UNIT_NAME,
  })
  const channel = await createChannel({
    buildUnitId: buildUnit.id,
    ownerId: userA.id,
    name: CHANNEL_NAME,
  })
  // Both users need a membership row: the client derives its channel-scoped shape
  // set from `memberships` (deriveMembershipSets), regardless of role.
  await createMembership({
    userId: userA.id,
    channelId: channel.id,
    buildUnitId: buildUnit.id,
    projectId: project.id,
    role: "owner",
  })
  await createMembership({
    userId: userB.id,
    channelId: channel.id,
    buildUnitId: buildUnit.id,
    projectId: project.id,
    role: "co-owner",
  })
  // A channel-level resource for the offline delete test (uploader = A → A may
  // delete it).
  await createResource({
    channelId: channel.id,
    buildUnitId: buildUnit.id,
    projectId: project.id,
    createdById: userA.id,
    name: RESOURCE_NAME,
  })

  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) throw new Error("BETTER_AUTH_SECRET must be set for e2e")

  mkdirSync(AUTH_DIR, { recursive: true })

  async function writeAuthState(userId: string, file: string): Promise<void> {
    const token = `${randomUUID()}${randomUUID()}`.replace(/-/g, "")
    const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
    await db.insert(sessions).values({
      id: randomUUID(),
      token,
      userId,
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: null,
      userAgent: null,
    })
    const signed = `${token}.${await makeSignature(token, secret!)}`
    writeFileSync(
      file,
      JSON.stringify({
        cookies: [
          {
            name: COOKIE_NAME,
            value: signed,
            domain: "localhost",
            path: "/",
            httpOnly: true,
            secure: false,
            sameSite: "Lax",
            expires: Math.floor(expiresAt.getTime() / 1000),
          },
        ],
        origins: [],
      }),
    )
  }

  const userAState = path.join(AUTH_DIR, "userA.json")
  const userBState = path.join(AUTH_DIR, "userB.json")
  await writeAuthState(userA.id, userAState)
  await writeAuthState(userB.id, userBState)

  writeFileSync(
    path.join(AUTH_DIR, "seed.json"),
    JSON.stringify(
      {
        projectId: project.id,
        buildUnitName: BUILD_UNIT_NAME,
        channelName: CHANNEL_NAME,
        resourceName: RESOURCE_NAME,
        userA: { id: userA.id, statePath: userAState },
        userB: { id: userB.id, statePath: userBState },
      },
      null,
      2,
    ),
  )

  await closeDb()
}
