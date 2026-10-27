ALTER TABLE "event_series" ADD COLUMN "reminders" smallint[] DEFAULT '{24}'::smallint[] NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "reminders" smallint[] DEFAULT '{24}'::smallint[] NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "reminded_hours" smallint[] DEFAULT '{}'::smallint[] NOT NULL;--> statement-breakpoint
-- an event already reminded was reminded a day before, the one reminder there was
UPDATE "events" SET "reminded_hours" = '{24}'::smallint[] WHERE "reminded_at" IS NOT NULL;
