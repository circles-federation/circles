CREATE TABLE "event_agenda_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "event_agenda_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"event_id" text NOT NULL,
	"position" integer NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"details" text,
	CONSTRAINT "event_agenda_items_event_position" UNIQUE("event_id","position"),
	CONSTRAINT "event_agenda_items_category" CHECK ("event_agenda_items"."category" in ('report', 'explore', 'decide'))
);
--> statement-breakpoint
ALTER TABLE "event_agenda_items" ADD CONSTRAINT "event_agenda_items_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- A meeting's agenda was its free-text description; it's now a list of items.
-- Each existing meeting's text is kept as a single "Explore" item (the one
-- category that doesn't claim a report or a decision it may not be), for its
-- organizer to split up, and meetings stop carrying a description.
INSERT INTO "event_agenda_items" ("event_id", "position", "category", "title", "details")
SELECT "id", 0, 'explore', 'Agenda', "description" FROM "events"
WHERE "kind" = 'meeting' AND btrim("description") NOT IN ('', 'No agenda yet.');--> statement-breakpoint
UPDATE "events" SET "description" = '' WHERE "kind" = 'meeting';
