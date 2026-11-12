CREATE TABLE "meeting_sessions" (
	"event_id" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'live' NOT NULL,
	"step" integer DEFAULT 0 NOT NULL,
	"facilitator_id" integer,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"rev" integer DEFAULT 0 NOT NULL,
	"minutes_edited_by" integer,
	"minutes_edited_at" timestamp with time zone,
	CONSTRAINT "meeting_sessions_status" CHECK ("meeting_sessions"."status" in ('live', 'finished'))
);
--> statement-breakpoint
CREATE TABLE "meeting_topic_notes" (
	"event_id" text NOT NULL,
	"position" integer NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"details" text,
	"notes" text DEFAULT '' NOT NULL,
	CONSTRAINT "meeting_topic_notes_event_id_position_pk" PRIMARY KEY("event_id","position")
);
--> statement-breakpoint
ALTER TABLE "circle_tasks" ADD COLUMN "meeting_event_id" text;--> statement-breakpoint
ALTER TABLE "meeting_sessions" ADD CONSTRAINT "meeting_sessions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_sessions" ADD CONSTRAINT "meeting_sessions_facilitator_id_members_id_fk" FOREIGN KEY ("facilitator_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_sessions" ADD CONSTRAINT "meeting_sessions_minutes_edited_by_members_id_fk" FOREIGN KEY ("minutes_edited_by") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_topic_notes" ADD CONSTRAINT "meeting_topic_notes_event_id_meeting_sessions_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."meeting_sessions"("event_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_tasks" ADD CONSTRAINT "circle_tasks_meeting_event_id_events_id_fk" FOREIGN KEY ("meeting_event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;