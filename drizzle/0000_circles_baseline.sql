CREATE TYPE "public"."circle_type" AS ENUM('neighborhood', 'council', 'collective', 'cooperative', 'other');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "circle_members" (
	"circle_id" text NOT NULL,
	"circle_type" "circle_type" NOT NULL,
	"member_id" integer NOT NULL,
	CONSTRAINT "circle_members_circle_id_member_id_pk" PRIMARY KEY("circle_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "circles" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "circle_type" NOT NULL,
	"name" text NOT NULL,
	"parent_id" text,
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
	"hours" jsonb,
	CONSTRAINT "circles_id_type_unique" UNIQUE("id","type")
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
	"circle_id" text NOT NULL,
	"organizer_id" integer,
	"date" date NOT NULL,
	"start" time NOT NULL,
	"end" time NOT NULL,
	"location" text NOT NULL,
	"description" text NOT NULL,
	"members_only" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"last_name" text,
	"pronouns" text NOT NULL,
	"role" text NOT NULL,
	"skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"interests" text[] DEFAULT '{}'::text[] NOT NULL,
	"bio" text NOT NULL,
	"email" text,
	CONSTRAINT "members_email_unique" UNIQUE("email")
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
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_members" ADD CONSTRAINT "circle_members_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_members" ADD CONSTRAINT "circle_members_circle_id_circle_type_circles_id_type_fk" FOREIGN KEY ("circle_id","circle_type") REFERENCES "public"."circles"("id","type") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "circles" ADD CONSTRAINT "circles_parent_id_circles_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."circles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circles" ADD CONSTRAINT "circles_last_edited_by_members_id_fk" FOREIGN KEY ("last_edited_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_rsvps" ADD CONSTRAINT "event_rsvps_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_rsvps" ADD CONSTRAINT "event_rsvps_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_votes" ADD CONSTRAINT "event_votes_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_votes" ADD CONSTRAINT "event_votes_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_organizer_id_members_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_members" ADD CONSTRAINT "role_members_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_members" ADD CONSTRAINT "role_members_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "circle_members_one_neighborhood" ON "circle_members" USING btree ("member_id") WHERE "circle_members"."circle_type" = 'neighborhood';--> statement-breakpoint
CREATE UNIQUE INDEX "circles_single_root" ON "circles" USING btree (("parent_id" is null)) WHERE "circles"."parent_id" is null;--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");