CREATE TABLE "meeting_attendance" (
	"event_id" text NOT NULL,
	"member_id" integer NOT NULL,
	CONSTRAINT "meeting_attendance_event_id_member_id_pk" PRIMARY KEY("event_id","member_id")
);
--> statement-breakpoint
ALTER TABLE "meeting_topic_notes" ADD COLUMN "id" text DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "meeting_attendance" ADD CONSTRAINT "meeting_attendance_event_id_meeting_sessions_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."meeting_sessions"("event_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_attendance" ADD CONSTRAINT "meeting_attendance_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_topic_notes" ADD CONSTRAINT "meeting_topic_notes_event_id_id" UNIQUE("event_id","id");
--> statement-breakpoint
INSERT INTO "meeting_attendance" ("event_id", "member_id") SELECT r."event_id", r."member_id" FROM "event_rsvps" r JOIN "meeting_sessions" s ON s."event_id" = r."event_id";
