ALTER TABLE "build_units" ADD COLUMN "health" jsonb;--> statement-breakpoint
ALTER TABLE "build_units" ADD COLUMN "priority" jsonb;--> statement-breakpoint
ALTER TABLE "build_units" ADD COLUMN "task_name" varchar(255);--> statement-breakpoint
ALTER TABLE "build_units" ADD COLUMN "task_assignee" varchar(255);--> statement-breakpoint
ALTER TABLE "build_units" ADD COLUMN "task_since" varchar(100);--> statement-breakpoint
ALTER TABLE "build_units" ADD COLUMN "target_date" varchar(100);--> statement-breakpoint
ALTER TABLE "build_units" ADD COLUMN "status_percent" varchar(10);--> statement-breakpoint
ALTER TABLE "build_units" ADD COLUMN "member_ids" text[] NOT NULL DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "member_ids" text[] NOT NULL DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "member_ids" text[] NOT NULL DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "priority" jsonb;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "target_date" varchar(100);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "member_ids" text[] NOT NULL DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "status_percent" varchar(10);--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "member_ids" text[] NOT NULL DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "member_ids" text[] NOT NULL DEFAULT '{}';