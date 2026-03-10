ALTER TABLE "teams" ADD COLUMN "owner_id" text NOT NULL REFERENCES "public"."users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "project_id" text NOT NULL REFERENCES "public"."projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "member_ids" text[] NOT NULL DEFAULT '{}';
