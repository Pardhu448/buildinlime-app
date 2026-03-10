CREATE TABLE "properties" (
	"id" text PRIMARY KEY NOT NULL,
	"type" jsonb NOT NULL,
	"entity" jsonb NOT NULL,
	"entity_id" text NOT NULL,
	"status_value" jsonb,
	"priority_value" jsonb,
	"target_date" text,
	"start_date" text,
	"pending_task" text,
	"member_ids" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "channels" ALTER COLUMN "name" SET DATA TYPE jsonb USING name::jsonb;