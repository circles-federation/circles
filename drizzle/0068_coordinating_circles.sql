ALTER TYPE "public"."circle_type" ADD VALUE 'federation';--> statement-breakpoint
CREATE TABLE "circle_proposal_deciders" (
	"proposal_id" text NOT NULL,
	"circle_id" text NOT NULL,
	"stage" integer NOT NULL,
	"released_at" timestamp with time zone,
	"closes_at" timestamp with time zone,
	"passed_at" timestamp with time zone,
	CONSTRAINT "circle_proposal_deciders_proposal_id_circle_id_pk" PRIMARY KEY("proposal_id","circle_id"),
	CONSTRAINT "circle_proposal_deciders_stage" CHECK ("circle_proposal_deciders"."stage" in (1, 2))
);
--> statement-breakpoint
CREATE TABLE "circle_proposal_nominees" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "circle_proposal_nominees_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"proposal_id" text NOT NULL,
	"circle_id" text NOT NULL,
	"member_id" integer NOT NULL,
	"nominated_by" integer NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"objected_by" integer,
	"objection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "circle_proposal_deciders" ADD CONSTRAINT "circle_proposal_deciders_proposal_id_circle_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."circle_proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_proposal_deciders" ADD CONSTRAINT "circle_proposal_deciders_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_proposal_nominees" ADD CONSTRAINT "circle_proposal_nominees_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_proposal_nominees" ADD CONSTRAINT "circle_proposal_nominees_nominated_by_members_id_fk" FOREIGN KEY ("nominated_by") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_proposal_nominees" ADD CONSTRAINT "circle_proposal_nominees_objected_by_members_id_fk" FOREIGN KEY ("objected_by") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_proposal_nominees" ADD CONSTRAINT "circle_proposal_nominees_decider_fk" FOREIGN KEY ("proposal_id","circle_id") REFERENCES "public"."circle_proposal_deciders"("proposal_id","circle_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "circle_proposal_deciders_circle_idx" ON "circle_proposal_deciders" USING btree ("circle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "circle_proposal_nominees_current" ON "circle_proposal_nominees" USING btree ("proposal_id","circle_id") WHERE "circle_proposal_nominees"."status" in ('open', 'chosen');