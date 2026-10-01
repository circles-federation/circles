CREATE TABLE "announcement_notifications" (
	"resource_id" text NOT NULL,
	"member_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"last_error" text,
	CONSTRAINT "announcement_notifications_resource_id_member_id_pk" PRIMARY KEY("resource_id","member_id")
);
--> statement-breakpoint
ALTER TABLE "announcement_notifications" ADD CONSTRAINT "announcement_notifications_resource_id_circle_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."circle_resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_notifications" ADD CONSTRAINT "announcement_notifications_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "announcement_notifications_pending_idx" ON "announcement_notifications" USING btree ("created_at") WHERE "announcement_notifications"."sent_at" is null;