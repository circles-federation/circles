CREATE TABLE "council_proposal_ratify_votes" (
	"proposal_id" text NOT NULL,
	"member_id" integer NOT NULL,
	CONSTRAINT "council_proposal_ratify_votes_proposal_id_member_id_pk" PRIMARY KEY("proposal_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "council_proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"assembly_id" text NOT NULL,
	"sponsor_hood" text NOT NULL,
	"sponsor_name" text NOT NULL,
	"proposed_by" integer NOT NULL,
	"title" text NOT NULL,
	"date" date NOT NULL,
	"start" time NOT NULL,
	"end" time NOT NULL,
	"location" text NOT NULL,
	"agenda" text NOT NULL,
	"ratified" boolean DEFAULT false NOT NULL,
	"council_id" text
);
--> statement-breakpoint
CREATE TABLE "event_rsvps" (
	"event_id" text NOT NULL,
	"member_id" integer NOT NULL,
	CONSTRAINT "event_rsvps_event_id_member_id_pk" PRIMARY KEY("event_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "event_votes" (
	"event_id" text NOT NULL,
	"member_id" integer NOT NULL,
	CONSTRAINT "event_votes_event_id_member_id_pk" PRIMARY KEY("event_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"kind" text,
	"host_member_id" integer,
	"host_org_id" text,
	"date" date NOT NULL,
	"start" time NOT NULL,
	"end" time NOT NULL,
	"location" text NOT NULL,
	"description" text NOT NULL,
	"members_only" boolean,
	"org_id" text,
	"scope" text,
	"sponsor_id" text,
	"sponsor_name" text,
	"sponsor_neighborhood" text,
	"endorsements" text[],
	"endorses_council_id" text,
	CONSTRAINT "event_host_exactly_one" CHECK (num_nonnulls("events"."host_member_id", "events"."host_org_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"last_name" text,
	"pronouns" text NOT NULL,
	"role" text NOT NULL,
	"neighborhood" text NOT NULL,
	"skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"interests" text[] DEFAULT '{}'::text[] NOT NULL,
	"bio" text NOT NULL,
	"email" text,
	CONSTRAINT "members_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "org_members" (
	"org_id" text NOT NULL,
	"member_id" integer NOT NULL,
	CONSTRAINT "org_members_org_id_member_id_pk" PRIMARY KEY("org_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "orgs" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"parent_id" text,
	"neighborhood" text,
	"tagline" text NOT NULL,
	"about" text NOT NULL,
	"offers" text[] DEFAULT '{}'::text[] NOT NULL,
	"last_edited_by" integer,
	"last_edited_at" timestamp with time zone,
	"facts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"join" text,
	"contact" text,
	"website" text,
	"address" text,
	"hours" jsonb
);
--> statement-breakpoint
CREATE TABLE "role_members" (
	"role_id" integer NOT NULL,
	"member_id" integer NOT NULL,
	CONSTRAINT "role_members_role_id_member_id_pk" PRIMARY KEY("role_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "roles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"event_id" text NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"min" integer NOT NULL,
	"max" integer,
	CONSTRAINT "roles_event_id_key_unique" UNIQUE("event_id","key")
);
--> statement-breakpoint
ALTER TABLE "council_proposal_ratify_votes" ADD CONSTRAINT "council_proposal_ratify_votes_proposal_id_council_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."council_proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "council_proposal_ratify_votes" ADD CONSTRAINT "council_proposal_ratify_votes_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "council_proposals" ADD CONSTRAINT "council_proposals_assembly_id_events_id_fk" FOREIGN KEY ("assembly_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "council_proposals" ADD CONSTRAINT "council_proposals_proposed_by_members_id_fk" FOREIGN KEY ("proposed_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "council_proposals" ADD CONSTRAINT "council_proposals_council_id_events_id_fk" FOREIGN KEY ("council_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_rsvps" ADD CONSTRAINT "event_rsvps_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_rsvps" ADD CONSTRAINT "event_rsvps_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_votes" ADD CONSTRAINT "event_votes_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_votes" ADD CONSTRAINT "event_votes_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_host_member_id_members_id_fk" FOREIGN KEY ("host_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_host_org_id_orgs_id_fk" FOREIGN KEY ("host_org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orgs" ADD CONSTRAINT "orgs_parent_id_orgs_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orgs" ADD CONSTRAINT "orgs_last_edited_by_members_id_fk" FOREIGN KEY ("last_edited_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_members" ADD CONSTRAINT "role_members_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_members" ADD CONSTRAINT "role_members_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;