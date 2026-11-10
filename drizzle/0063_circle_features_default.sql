ALTER TABLE "circles" ALTER COLUMN "features" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "circles" ALTER COLUMN "features" DROP NOT NULL;
--> statement-breakpoint
UPDATE "circles" SET "features" = NULL WHERE "features" = '{}';
