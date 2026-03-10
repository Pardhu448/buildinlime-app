ALTER TABLE "tasks" RENAME COLUMN "text" TO "name";
--> statement-breakpoint
ALTER TABLE "tasks" RENAME COLUMN "created_at" TO "opened_at";
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "description" varchar(500) NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "description" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "member_ids" text[] NOT NULL DEFAULT '{}';
--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "member_ids" DROP DEFAULT;
