ALTER TABLE "members" ADD COLUMN "notify_email" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "notify_push" boolean DEFAULT true NOT NULL;