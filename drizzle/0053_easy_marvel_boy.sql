ALTER TABLE "event_share_links" DROP CONSTRAINT "event_share_links_event_member";--> statement-breakpoint
ALTER TABLE "event_share_links" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "event_share_links_live" ON "event_share_links" USING btree ("event_id","member_id") WHERE "event_share_links"."revoked_at" is null;