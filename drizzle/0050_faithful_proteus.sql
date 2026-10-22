CREATE TABLE "guest_notifications" (
	"guest_id" text NOT NULL,
	"kind" text NOT NULL,
	"change" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"last_error" text,
	CONSTRAINT "guest_notifications_guest_id_kind_pk" PRIMARY KEY("guest_id","kind")
);
--> statement-breakpoint
ALTER TABLE "guest_notifications" ADD CONSTRAINT "guest_notifications_guest_id_event_guest_rsvps_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."event_guest_rsvps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guest_notifications_pending_idx" ON "guest_notifications" USING btree ("created_at") WHERE "guest_notifications"."sent_at" is null;