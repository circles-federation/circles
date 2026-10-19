CREATE TABLE "neighborhood_notifications" (
	"post_id" text,
	"proposal_id" text,
	"member_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"last_error" text,
	CONSTRAINT "neighborhood_notifications_one_item" CHECK (("neighborhood_notifications"."post_id" is null) <> ("neighborhood_notifications"."proposal_id" is null))
);
--> statement-breakpoint
CREATE TABLE "neighborhood_posts" (
	"id" text PRIMARY KEY NOT NULL,
	"neighborhood_id" text NOT NULL,
	"circle_id" text NOT NULL,
	"title" text NOT NULL,
	"url" text,
	"message" text,
	"icon" "resource_icon" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer,
	"published_at" timestamp with time zone,
	CONSTRAINT "neighborhood_posts_link_or_message" CHECK (("neighborhood_posts"."icon"::text = 'announcement' and "neighborhood_posts"."message" is not null and "neighborhood_posts"."url" is null) or ("neighborhood_posts"."icon"::text <> 'announcement' and "neighborhood_posts"."url" is not null and "neighborhood_posts"."message" is null))
);
--> statement-breakpoint
DROP INDEX "circle_proposals_one_open";--> statement-breakpoint
ALTER TABLE "circle_proposals" ADD COLUMN "kind" text DEFAULT 'change' NOT NULL;--> statement-breakpoint
ALTER TABLE "circle_proposals" ADD COLUMN "subject_circle_id" text;--> statement-breakpoint
ALTER TABLE "circle_proposals" ADD COLUMN "post_id" text;--> statement-breakpoint
-- an event proposal was told apart by its event (or, once that's gone, its first line, "Title"); say so outright now, before the one-open index counts only changes
UPDATE "circle_proposals" SET "kind" = 'event' WHERE "event_id" IS NOT NULL OR ("changes" = '{}'::jsonb AND "lines"->0->>'label' = 'Title');--> statement-breakpoint
ALTER TABLE "neighborhood_notifications" ADD CONSTRAINT "neighborhood_notifications_post_id_neighborhood_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."neighborhood_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "neighborhood_notifications" ADD CONSTRAINT "neighborhood_notifications_proposal_id_circle_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."circle_proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "neighborhood_notifications" ADD CONSTRAINT "neighborhood_notifications_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "neighborhood_posts" ADD CONSTRAINT "neighborhood_posts_neighborhood_id_circles_id_fk" FOREIGN KEY ("neighborhood_id") REFERENCES "public"."circles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "neighborhood_posts" ADD CONSTRAINT "neighborhood_posts_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "neighborhood_posts" ADD CONSTRAINT "neighborhood_posts_created_by_members_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "neighborhood_notifications_post" ON "neighborhood_notifications" USING btree ("post_id","member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "neighborhood_notifications_proposal" ON "neighborhood_notifications" USING btree ("proposal_id","member_id");--> statement-breakpoint
CREATE INDEX "neighborhood_notifications_pending_idx" ON "neighborhood_notifications" USING btree ("created_at") WHERE "neighborhood_notifications"."sent_at" is null;--> statement-breakpoint
CREATE INDEX "neighborhood_posts_neighborhood_idx" ON "neighborhood_posts" USING btree ("neighborhood_id");--> statement-breakpoint
ALTER TABLE "circle_proposals" ADD CONSTRAINT "circle_proposals_subject_circle_id_circles_id_fk" FOREIGN KEY ("subject_circle_id") REFERENCES "public"."circles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_proposals" ADD CONSTRAINT "circle_proposals_post_id_neighborhood_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."neighborhood_posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "circle_proposals_subject_idx" ON "circle_proposals" USING btree ("subject_circle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "circle_proposals_one_open" ON "circle_proposals" USING btree (coalesce("subject_circle_id", "circle_id")) WHERE "circle_proposals"."status" = 'open' and "circle_proposals"."kind" = 'change';