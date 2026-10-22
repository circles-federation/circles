ALTER TABLE "applications" ADD COLUMN "referred_by" integer;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "referred_event_id" text;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_referred_by_members_id_fk" FOREIGN KEY ("referred_by") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_referred_event_id_events_id_fk" FOREIGN KEY ("referred_event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;