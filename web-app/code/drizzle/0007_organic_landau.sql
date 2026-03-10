ALTER TABLE "messages" ADD COLUMN "mention_ids" text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "resource_ids" text[] NOT NULL;