ALTER TABLE "events" ADD COLUMN "host_circle_id" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
-- every event that already exists was hosted by its organizer and is live
UPDATE "events" SET "approved_at" = now();--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_host_circle_id_circles_id_fk" FOREIGN KEY ("host_circle_id") REFERENCES "public"."circles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_live_or_proposed" CHECK ("events"."host_circle_id" is not null or "events"."approved_at" is not null);