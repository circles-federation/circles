ALTER TABLE "events" ADD COLUMN "cancelled_automatically" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "slots_warned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "auto_cancel" boolean DEFAULT true NOT NULL;