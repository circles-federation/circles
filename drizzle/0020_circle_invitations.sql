CREATE TABLE "circle_invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"circle_id" text NOT NULL,
	"member_id" integer NOT NULL,
	"invited_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "circle_invitations_circle_member_unique" UNIQUE("circle_id","member_id")
);
--> statement-breakpoint
ALTER TABLE "circle_invitations" ADD CONSTRAINT "circle_invitations_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_invitations" ADD CONSTRAINT "circle_invitations_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_invitations" ADD CONSTRAINT "circle_invitations_invited_by_members_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "circle_invitations_member_idx" ON "circle_invitations" USING btree ("member_id");