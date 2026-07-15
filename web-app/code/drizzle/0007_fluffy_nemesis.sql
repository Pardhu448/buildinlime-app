CREATE TABLE "seen_state" (
	"user_id" text NOT NULL,
	"scope" jsonb NOT NULL,
	"scope_id" text DEFAULT '' NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seen_state_user_id_scope_scope_id_pk" PRIMARY KEY("user_id","scope","scope_id")
);
--> statement-breakpoint
ALTER TABLE "seen_state" ADD CONSTRAINT "seen_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
-- Seed existing users as "caught up" at migration time, so the per-item→timestamp
-- cutover does not flood every current message/task as unseen. Only activity
-- created AFTER now() will surface as unseen. `scope` is jsonb, hence to_jsonb().
-- Derived from memberships (the users who can actually see content); ON CONFLICT
-- keeps this safe to re-run.
INSERT INTO "seen_state" ("user_id","scope","scope_id","seen_at")
SELECT DISTINCT user_id, to_jsonb('inbox'::text), '', now() FROM "memberships"
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "seen_state" ("user_id","scope","scope_id","seen_at")
SELECT DISTINCT user_id, to_jsonb('mytasks'::text), '', now() FROM "memberships"
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "seen_state" ("user_id","scope","scope_id","seen_at")
SELECT DISTINCT user_id, to_jsonb('channel'::text), channel_id, now() FROM "memberships"
ON CONFLICT DO NOTHING;