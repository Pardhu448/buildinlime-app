CREATE TABLE "teams" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"member_ids" text[] NOT NULL
);
--> statement-breakpoint
DROP TABLE "memberships" CASCADE;