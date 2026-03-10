ALTER TABLE "teams" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;