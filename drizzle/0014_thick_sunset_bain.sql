CREATE TABLE "event_series" (
	"id" text PRIMARY KEY NOT NULL,
	"frequency" text NOT NULL,
	"starts_on" date NOT NULL,
	"until" date,
	"generated_through" date NOT NULL,
	"approved_at" timestamp with time zone,
	"title" text NOT NULL,
	"kind" text,
	"circle_id" text NOT NULL,
	"host_circle_id" text,
	"organizer_id" integer NOT NULL,
	"start" time NOT NULL,
	"end" time NOT NULL,
	"location" text NOT NULL,
	"description" text NOT NULL,
	"roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "event_series_frequency" CHECK ("event_series"."frequency" in ('weekly', 'monthly'))
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "series_id" text;--> statement-breakpoint
ALTER TABLE "event_series" ADD CONSTRAINT "event_series_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_series" ADD CONSTRAINT "event_series_host_circle_id_circles_id_fk" FOREIGN KEY ("host_circle_id") REFERENCES "public"."circles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_series" ADD CONSTRAINT "event_series_organizer_id_members_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_series_id_event_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."event_series"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_series_id_idx" ON "events" USING btree ("series_id");