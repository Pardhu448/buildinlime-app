-- Transfer ownership of public tables to the `electric` role.
--
-- RUN THIS AFTER EVERY MIGRATION (deploymentPlan.md §6). Not once — every time.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f 02-electric-own-tables.sql
--
-- Runs as the APP role (no superuser needed), which works because
-- 01-electric-role.sql granted the app membership of `electric`.
--
-- ---------------------------------------------------------------------------
-- Why this is needed, and why it must repeat
-- ---------------------------------------------------------------------------
-- Electric-managed mode requires Electric to OWN the tables it syncs: it sets
-- REPLICA IDENTITY FULL and adds them to its publication, both of which are
-- owner-only operations.
--
-- Verified behaviour (electricsql/electric:1.4.10): Electric configures tables
-- LAZILY — on the first shape request for each table, not at startup. So a table
-- it does not own fails at first sync, not at deploy time. That is a slow,
-- confusing failure mode, which is exactly why this sweep runs eagerly.
--
-- drizzle-kit runs as the app role, and tables it CREATEs are owned by the app
-- role. So every migration that adds a table re-introduces the problem. Hence:
-- after every migration.
--
-- Idempotent — it only touches tables not already owned by electric.

\set ON_ERROR_STOP on

DO $$
DECLARE
  r record;
  moved int := 0;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tableowner <> 'electric'
    ORDER BY tablename
  LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO electric', r.tablename);
    RAISE NOTICE 'transferred: %', r.tablename;
    moved := moved + 1;
  END LOOP;

  IF moved = 0 THEN
    RAISE NOTICE 'all public tables already owned by electric';
  ELSE
    RAISE NOTICE '% table(s) transferred', moved;
  END IF;
END $$;

-- Sequences too: a table owned by electric whose sequence is not can fail on
-- insert. Cheap to include, annoying to diagnose if missed.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT sequencename FROM pg_sequences
    WHERE schemaname = 'public' AND sequenceowner <> 'electric'
  LOOP
    EXECUTE format('ALTER SEQUENCE public.%I OWNER TO electric', r.sequencename);
  END LOOP;
END $$;
