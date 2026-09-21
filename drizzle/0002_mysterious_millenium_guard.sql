ALTER TABLE "events" ALTER COLUMN "organizer_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "events" DROP COLUMN "members_only";