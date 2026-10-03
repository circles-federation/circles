CREATE TABLE "circle_proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"circle_id" text NOT NULL,
	"proposer_id" integer NOT NULL,
	"changes" jsonb NOT NULL,
	"lines" jsonb NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closes_at" timestamp with time zone NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "proposal_notifications" (
	"proposal_id" text NOT NULL,
	"member_id" integer NOT NULL,
	"kind" text NOT NULL,
	"channel" text DEFAULT 'email' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"last_error" text,
	CONSTRAINT "proposal_notifications_proposal_id_member_id_kind_channel_pk" PRIMARY KEY("proposal_id","member_id","kind","channel")
);
--> statement-breakpoint
CREATE TABLE "proposal_responses" (
	"proposal_id" text NOT NULL,
	"member_id" integer NOT NULL,
	"response" text NOT NULL,
	"reason" text,
	"responded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposal_responses_proposal_id_member_id_pk" PRIMARY KEY("proposal_id","member_id")
);
--> statement-breakpoint
ALTER TABLE "circle_proposals" ADD CONSTRAINT "circle_proposals_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_proposals" ADD CONSTRAINT "circle_proposals_proposer_id_members_id_fk" FOREIGN KEY ("proposer_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_notifications" ADD CONSTRAINT "proposal_notifications_proposal_id_circle_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."circle_proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_notifications" ADD CONSTRAINT "proposal_notifications_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_responses" ADD CONSTRAINT "proposal_responses_proposal_id_circle_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."circle_proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_responses" ADD CONSTRAINT "proposal_responses_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "circle_proposals_circle_idx" ON "circle_proposals" USING btree ("circle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "circle_proposals_one_open" ON "circle_proposals" USING btree ("circle_id") WHERE "circle_proposals"."status" = 'open';--> statement-breakpoint
CREATE INDEX "circle_proposals_open_idx" ON "circle_proposals" USING btree ("closes_at") WHERE "circle_proposals"."status" = 'open';--> statement-breakpoint
CREATE INDEX "proposal_notifications_pending_idx" ON "proposal_notifications" USING btree ("created_at") WHERE "proposal_notifications"."sent_at" is null;