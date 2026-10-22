CREATE TABLE "event_share_links" (
	"token" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"member_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_share_links_event_member" UNIQUE("event_id","member_id")
);
--> statement-breakpoint
ALTER TABLE "event_share_links" ADD CONSTRAINT "event_share_links_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_share_links" ADD CONSTRAINT "event_share_links_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;