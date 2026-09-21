ALTER TABLE "event_notifications" ADD COLUMN "digest" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- digest used to be a kind of its own; it's now how a row is delivered, and the
-- kind says what it's about: a proposal if a circle hosts the event, else a new event
UPDATE "event_notifications" n SET "digest" = true, "kind" = CASE WHEN e."host_circle_id" IS NOT NULL THEN 'proposed' ELSE 'new' END FROM "events" e WHERE n."kind" = 'digest' AND e."id" = n."event_id";
