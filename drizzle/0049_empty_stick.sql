CREATE TABLE "event_guest_rsvps" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"invited_by" integer,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"code_hash" text,
	"code_expires_at" timestamp with time zone,
	"code_attempts" integer DEFAULT 0 NOT NULL,
	"code_sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_guest_rsvps" ADD CONSTRAINT "event_guest_rsvps_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_guest_rsvps" ADD CONSTRAINT "event_guest_rsvps_invited_by_members_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_guest_rsvps_event_email" ON "event_guest_rsvps" USING btree ("event_id",lower("email"));--> statement-breakpoint
CREATE INDEX "event_guest_rsvps_event_idx" ON "event_guest_rsvps" USING btree ("event_id");