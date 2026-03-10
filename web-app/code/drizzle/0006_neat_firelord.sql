CREATE TABLE "resources_raw" (
	"id" text PRIMARY KEY NOT NULL,
	"resource_id" text NOT NULL,
	"storage_path" text NOT NULL,
	"original_filename" text NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"file_size_bytes" bigint NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_assignee_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "resources" ALTER COLUMN "message_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "resources" ALTER COLUMN "channel_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "assignee_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "name" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "mime_type" varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "file_size_bytes" bigint NOT NULL;--> statement-breakpoint
ALTER TABLE "resources_raw" ADD CONSTRAINT "resources_raw_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" DROP COLUMN "text";