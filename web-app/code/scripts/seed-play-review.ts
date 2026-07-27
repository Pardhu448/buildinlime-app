/**
 * Provisions the Google Play reviewer account and its demo data.
 *
 * Two things make this script necessary rather than a convenience:
 *
 * 1. `disableSignUp: true` (infrastructure/auth/server.ts) means the reviewer
 *    cannot register. Worse, the failure is silent by design — better-auth's
 *    send-OTP route deletes the verification and returns `{ success: true }` for
 *    an unknown address, so a missing user row looks to the client like a code
 *    was sent and simply never arrives.
 *
 * 2. Visibility is gated on `memberships`, not ownership. A project with no
 *    membership rows syncs nothing through Electric, so the reviewer would log in
 *    successfully and land in an empty app — which reads as a broken or
 *    non-functional submission, itself a rejection reason.
 *
 * The sign-in code lives in PLAY_REVIEW_OTP and is handled entirely by
 * ./src/infrastructure/auth/play-review.ts. This script never touches it; it only
 * needs the address to exist as a user.
 *
 * IDEMPOTENT. Re-running adopts whatever already exists and fills in the rest, so
 * it is safe against a partial previous run. Nothing is ever deleted or
 * overwritten.
 *
 *   pnpm seed:play-review
 *
 * Requires DATABASE_URL and PLAY_REVIEW_EMAIL in the environment.
 */
import { and, eq, isNull } from "drizzle-orm"
import { db } from "../src/infrastructure/database/connection"
import { users } from "../src/infrastructure/database/schema/auth-schema"
import {
  CHANNEL_NAMES,
  buildUnitsTable,
  channelsTable,
  membershipTable,
  projectsTable,
} from "../src/infrastructure/database/schema/organization-tables"
import {
  messagesTable,
  tasksTable,
} from "../src/infrastructure/database/schema/communication-tables"

/**
 * Drizzle types a query result as `T[]`, so destructuring `const [row] = await …`
 * gives `T`, not `T | undefined` — the compiler then believes every `if (row)`
 * below is redundant and no-unnecessary-condition flags it, even though an empty
 * result is the normal case this whole script is built around. Going through
 * `.at(0)` restores the honest type instead of silencing the rule.
 */
function first<T>(rows: T[]): T | undefined {
  return rows.at(0)
}

/** For inserts with `.returning()`, where no row back means something is wrong. */
function requireFirst<T>(rows: T[], what: string): T {
  const row = rows.at(0)
  if (!row) throw new Error(`Expected ${what} to be returned from the insert`)
  return row
}

const PROJECT_NAME = "Riverside Apartments (Demo)"

const BUILD_UNITS = [
  {
    name: "Block A — Foundation",
    description: "Excavation, footings and raft slab for the east block.",
    health: "On track" as const,
    priority: "High" as const,
    status_percent: "70",
  },
  {
    name: "Block A — Superstructure",
    description: "Columns, beams and slab casting up to the third floor.",
    health: "At risk" as const,
    priority: "Mid" as const,
    status_percent: "35",
  },
]

/** Seeded into the first build unit so the reviewer sees a populated feed. */
const DEMO_MESSAGES: Array<{ channel: string; text: string }> = [
  {
    channel: "Execution",
    text: "Raft slab pour completed on the east side this morning. Curing started, covers are on.",
  },
  {
    channel: "Execution",
    text: "Steel fixing for the north footings is done and ready for inspection tomorrow.",
  },
  {
    channel: "Materials",
    text: "Cement delivery arrived — 240 bags received against the 250 ordered. Short by 10, chasing the supplier.",
  },
  {
    channel: "Finance",
    text: "Contractor invoice for the excavation stage has been raised. Awaiting approval.",
  },
  {
    channel: "Design",
    text: "Revised footing layout shared by the structural consultant. Column positions on grid C are unchanged.",
  },
]

const DEMO_TASKS: Array<{
  channel: string
  name: string
  description: string
  completed: boolean
}> = [
  {
    channel: "Execution",
    name: "Slab curing check",
    description: "Confirm water curing is maintained on the east raft slab for 7 days.",
    completed: false,
  },
  {
    channel: "Materials",
    name: "Reconcile cement delivery",
    description: "Follow up with the supplier on the 10-bag shortfall and update the register.",
    completed: false,
  },
  {
    channel: "Execution",
    name: "Excavation sign-off",
    description: "Site engineer to sign off excavation depth against the drawing.",
    completed: true,
  },
]

async function main() {
  const email = process.env.PLAY_REVIEW_EMAIL?.trim().toLowerCase()
  if (!email) {
    throw new Error(
      "PLAY_REVIEW_EMAIL is not set. It must match the address entered in the Play Console Sign-in details form."
    )
  }

  console.log(`Seeding Play review account for ${email}\n`)

  // --- user ---------------------------------------------------------------
  // Matched on email, which is unique in the schema. Never overwrite an existing
  // row: if this address is somehow a real account, adopting it is correct and
  // clobbering its name is not.
  let user = first(await db.select().from(users).where(eq(users.email, email)))

  if (user) {
    console.log(`  user            exists (${user.id})`)
  } else {
    const now = new Date()
    user = requireFirst(
      await db
        .insert(users)
        .values({
          id: crypto.randomUUID(),
          name: "Play Reviewer",
          email,
          // The OTP flow is the verification. Leaving this false would be
          // inconsistent with how a normal signed-in user looks.
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        })
        .returning(),
      "the reviewer user"
    )
    console.log(`  user            created (${user.id})`)
  }

  // --- project ------------------------------------------------------------
  let project = first(
    await db
      .select()
      .from(projectsTable)
      .where(
        and(
          eq(projectsTable.owner_id, user.id),
          eq(projectsTable.name, PROJECT_NAME),
          isNull(projectsTable.deleted_at)
        )
      )
  )

  if (project) {
    console.log(`  project         exists (${project.id})`)
  } else {
    project = requireFirst(
      await db
        .insert(projectsTable)
        .values({
          id: crypto.randomUUID(),
          name: PROJECT_NAME,
          description:
            "A sample residential construction project, provided so app reviewers can see every feature with realistic data.",
          owner_id: user.id,
          priority: "High",
          status_percent: "45",
        })
        .returning(),
      "the demo project"
    )
    console.log(`  project         created (${project.id})`)
  }

  // --- build units, channels, memberships ---------------------------------
  const channelIdsByUnit = new Map<string, Map<string, string>>()

  for (const spec of BUILD_UNITS) {
    let unit = first(
      await db
        .select()
        .from(buildUnitsTable)
        .where(
          and(
            eq(buildUnitsTable.project_id, project.id),
            eq(buildUnitsTable.name, spec.name),
            isNull(buildUnitsTable.deleted_at)
          )
        )
    )

    if (unit) {
      console.log(`  build unit      exists  ${spec.name}`)
    } else {
      unit = requireFirst(
        await db
          .insert(buildUnitsTable)
          .values({
            id: crypto.randomUUID(),
            name: spec.name,
            description: spec.description,
            health: spec.health,
            priority: spec.priority,
            status_percent: spec.status_percent,
            project_id: project.id,
            owner_id: user.id,
          })
          .returning(),
        `build unit ${spec.name}`
      )
      console.log(`  build unit      created  ${spec.name}`)
    }

    const byName = new Map<string, string>()
    channelIdsByUnit.set(unit.id, byName)

    // Every build unit gets the full set. The app's own channel router creates a
    // membership row alongside each channel (routers/channels.ts) — that pairing
    // is what makes the channel visible through Electric, so the seed has to
    // reproduce it rather than just inserting channels.
    for (const name of CHANNEL_NAMES) {
      let channel = first(
        await db
          .select()
          .from(channelsTable)
          .where(
            and(
              eq(channelsTable.buildunit_id, unit.id),
              eq(channelsTable.name, name),
              isNull(channelsTable.deleted_at)
            )
          )
      )

      if (!channel) {
        channel = requireFirst(
          await db
            .insert(channelsTable)
            .values({
              id: crypto.randomUUID(),
              name,
              buildunit_id: unit.id,
              owner_id: user.id,
            })
            .returning(),
          `channel ${name}`
        )
      }

      byName.set(name, channel.id)

      const membership = first(
        await db
          .select()
          .from(membershipTable)
          .where(
            and(
              eq(membershipTable.user_id, user.id),
              eq(membershipTable.channel_id, channel.id)
            )
          )
      )

      if (!membership) {
        await db.insert(membershipTable).values({
          id: crypto.randomUUID(),
          user_id: user.id,
          channel_id: channel.id,
          buildunit_id: unit.id,
          project_id: project.id,
          member_flag: true,
          role: "owner",
        })
      }
    }
    console.log(`                  ${CHANNEL_NAMES.length} channels + memberships ready`)
  }

  // --- messages and tasks in the first build unit -------------------------
  const firstUnit = first(
    await db
      .select()
      .from(buildUnitsTable)
      .where(
        and(
          eq(buildUnitsTable.project_id, project.id),
          eq(buildUnitsTable.name, BUILD_UNITS[0].name),
          isNull(buildUnitsTable.deleted_at)
        )
      )
  )
  if (!firstUnit) throw new Error("The first build unit was not created")
  const channels = channelIdsByUnit.get(firstUnit.id)!

  let messagesAdded = 0
  for (const spec of DEMO_MESSAGES) {
    const channelId = channels.get(spec.channel)!
    const existing = first(
      await db
        .select()
        .from(messagesTable)
        .where(
          and(eq(messagesTable.channel_id, channelId), eq(messagesTable.text, spec.text))
        )
    )
    if (existing) continue

    await db.insert(messagesTable).values({
      id: crypto.randomUUID(),
      text: spec.text,
      channel_id: channelId,
      buildunit_id: firstUnit.id,
      project_id: project.id,
      createdby_id: user.id,
      mention_ids: [],
      resource_ids: [],
    })
    messagesAdded++
  }
  console.log(`  messages        ${messagesAdded} added, ${DEMO_MESSAGES.length - messagesAdded} already present`)

  let tasksAdded = 0
  for (const spec of DEMO_TASKS) {
    const channelId = channels.get(spec.channel)!
    // Task names are unique per channel (partial unique index on lower(name)), so
    // this check mirrors the constraint rather than relying on catching a 23505.
    const existing = first(
      await db
        .select()
        .from(tasksTable)
        .where(
          and(
            eq(tasksTable.channel_id, channelId),
            eq(tasksTable.name, spec.name),
            isNull(tasksTable.deleted_at)
          )
        )
    )
    if (existing) continue

    await db.insert(tasksTable).values({
      id: crypto.randomUUID(),
      name: spec.name,
      description: spec.description,
      completed: spec.completed,
      channel_id: channelId,
      buildunit_id: firstUnit.id,
      createdby_id: user.id,
      assignee_id: user.id,
    })
    tasksAdded++
  }
  console.log(`  tasks           ${tasksAdded} added, ${DEMO_TASKS.length - tasksAdded} already present`)

  console.log(`\nDone. Sign in as ${email} using the code in PLAY_REVIEW_OTP.`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nseed-play-review failed:", error)
    process.exit(1)
  })
