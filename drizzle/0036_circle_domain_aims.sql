ALTER TABLE "circles" ADD COLUMN "domain" text;--> statement-breakpoint
ALTER TABLE "circles" ADD COLUMN "aims" text[] DEFAULT '{}'::text[] NOT NULL;