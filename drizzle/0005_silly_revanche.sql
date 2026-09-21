ALTER TABLE "event_notifications" ADD COLUMN "kind" text DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE "event_notifications" DROP CONSTRAINT "event_notifications_event_id_member_id_pk";--> statement-breakpoint
ALTER TABLE "event_notifications" ADD CONSTRAINT "event_notifications_event_id_member_id_kind_pk" PRIMARY KEY("event_id","member_id","kind");
