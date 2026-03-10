CREATE TABLE "memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"buildunit_id" text NOT NULL,
	"project_id" text NOT NULL,
	"member_flag" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_buildunit_id_build_units_id_fk" FOREIGN KEY ("buildunit_id") REFERENCES "public"."build_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_user_channel_unique" ON "memberships" USING btree ("user_id","channel_id");--> statement-breakpoint
ALTER TABLE "build_units" DROP COLUMN "member_ids";--> statement-breakpoint
ALTER TABLE "channels" DROP COLUMN "member_ids";--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "member_ids";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "member_ids";--> statement-breakpoint
ALTER TABLE "properties" DROP COLUMN "member_ids";--> statement-breakpoint
ALTER TABLE "resources" DROP COLUMN "member_ids";--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "member_ids";--> statement-breakpoint
ALTER TABLE "teams" DROP COLUMN "member_ids";