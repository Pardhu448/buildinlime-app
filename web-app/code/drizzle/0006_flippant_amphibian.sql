DROP INDEX "tasks_channel_name_unique";--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "deleted_by_id" text;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "deleted_by_id" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "deleted_by_id" text;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_channel_name_unique" ON "tasks" USING btree ("channel_id",lower("name")) WHERE "tasks"."deleted_at" IS NULL;