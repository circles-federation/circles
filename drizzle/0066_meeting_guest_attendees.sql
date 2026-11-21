CREATE TABLE "meeting_guest_attendees" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"event_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meeting_guest_attendees_event_email" UNIQUE("event_id","email")
);
--> statement-breakpoint
ALTER TABLE "meeting_guest_attendees" ADD CONSTRAINT "meeting_guest_attendees_event_id_meeting_sessions_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."meeting_sessions"("event_id") ON DELETE cascade ON UPDATE no action;