ALTER TABLE "announcement_notifications" ADD COLUMN "channel" text DEFAULT 'email' NOT NULL;--> statement-breakpoint
ALTER TABLE "event_notifications" ADD COLUMN "channel" text DEFAULT 'email' NOT NULL;--> statement-breakpoint
ALTER TABLE "announcement_notifications" DROP CONSTRAINT "announcement_notifications_resource_id_member_id_pk";--> statement-breakpoint
ALTER TABLE "event_notifications" DROP CONSTRAINT "event_notifications_event_id_member_id_kind_pk";--> statement-breakpoint
ALTER TABLE "announcement_notifications" ADD CONSTRAINT "announcement_notifications_resource_id_member_id_channel_pk" PRIMARY KEY("resource_id","member_id","channel");--> statement-breakpoint
ALTER TABLE "event_notifications" ADD CONSTRAINT "event_notifications_event_id_member_id_kind_channel_pk" PRIMARY KEY("event_id","member_id","kind","channel");
