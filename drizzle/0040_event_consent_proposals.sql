DROP INDEX "circle_proposals_one_open";--> statement-breakpoint
ALTER TABLE "circle_proposals" ADD COLUMN "event_id" text;--> statement-breakpoint
ALTER TABLE "circle_proposals" ADD CONSTRAINT "circle_proposals_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "circle_proposals_one_open" ON "circle_proposals" USING btree ("circle_id") WHERE "circle_proposals"."status" = 'open' and "circle_proposals"."event_id" is null;