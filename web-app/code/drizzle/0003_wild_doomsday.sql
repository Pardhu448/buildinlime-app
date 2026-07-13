CREATE TABLE "reads" (
	"user_id" text NOT NULL,
	"item_type" jsonb NOT NULL,
	"item_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reads_user_id_item_type_item_id_pk" PRIMARY KEY("user_id","item_type","item_id")
);
--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "task_status_value" jsonb;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "percent_complete" text;--> statement-breakpoint
ALTER TABLE "reads" ADD CONSTRAINT "reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reads" ADD CONSTRAINT "reads_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Backfill: percent_complete used to share the `pending_task` column with the
-- pendingTask property type. Move existing values into the new column, or every
-- existing percent row renders blank. `type` is jsonb, hence the ::jsonb compare.
UPDATE "properties"
SET "percent_complete" = "pending_task", "pending_task" = NULL
WHERE "type" = '"percent_complete"'::jsonb;