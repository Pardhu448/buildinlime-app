-- Electric database role — ONE-TIME setup. Run as the Cloud SQL admin user.
--
-- Implements deploymentPlan.md §4.2.1, "Electric-managed mode".
-- Every grant here was verified against postgres:17 + electricsql/electric:1.4.10;
-- removing any one of them produces a specific, non-obvious failure, noted inline.
--
--   psql "$ADMIN_URL" -v ON_ERROR_STOP=1 \
--        -v electric_pw="$(openssl rand -base64 32)" \
--        -f 01-electric-role.sql
--
-- Then run 02-electric-own-tables.sql AFTER EVERY MIGRATION (§6).

\set ON_ERROR_STOP on

-- REPLICATION is what lets Electric open a logical replication slot. Without
-- LOGIN it cannot connect at all.
--
-- Built with \gexec rather than a DO block: psql does NOT interpolate :variables
-- inside dollar-quoted strings, so `:'electric_pw'` within $$ ... $$ reaches the
-- server literally and fails with `syntax error at or near ":"`. Generating the
-- statement as text keeps the substitution outside the quoting.
SELECT format('CREATE ROLE electric WITH LOGIN REPLICATION PASSWORD %L', :'electric_pw')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'electric')
\gexec

GRANT CONNECT ON DATABASE :"db" TO electric;

-- USAGE alone is not enough. Postgres 15 removed the implicit PUBLIC create
-- privilege on schema public, and Electric needs CREATE here to take ownership
-- of tables. Electric's own docs omit this and are incomplete on PG15+:
-- without it, `ALTER TABLE ... OWNER TO electric` fails with
--   ERROR: permission denied for schema public
GRANT USAGE, CREATE ON SCHEMA public TO electric;

-- Database-level CREATE is what `CREATE PUBLICATION` requires. This is separate
-- from the schema grant above and is easy to conflate. Without it Electric
-- starts, acquires the Postgres lock, then dies with:
--   [emergency] Publication "electric_publication_default" not found in the database
GRANT CREATE ON DATABASE :"db" TO electric;

-- Reading table contents for the initial shape snapshot.
GRANT SELECT ON ALL TABLES IN SCHEMA public TO electric;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO electric;

-- Role membership, so the APP role can still ALTER tables that electric owns.
-- Without this, migrations fail on the first schema change after the ownership
-- sweep with:
--   ERROR: must be owner of table <name>
-- The app keeps its own identity; membership just lets it act as owner.
GRANT electric TO :"app_role";

-- Sanity check — fails loudly rather than leaving a half-configured role.
DO $$
BEGIN
  IF NOT has_schema_privilege('electric', 'public', 'CREATE') THEN
    RAISE EXCEPTION 'electric lacks CREATE on schema public';
  END IF;
  IF NOT has_database_privilege('electric', current_database(), 'CREATE') THEN
    RAISE EXCEPTION 'electric lacks CREATE on database %', current_database();
  END IF;
END $$;

\echo 'electric role configured. Run 02-electric-own-tables.sql next, and after every migration.'
