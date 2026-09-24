CREATE TABLE "member_photos" (
	"member_id" integer PRIMARY KEY NOT NULL,
	"data" "bytea" NOT NULL,
	"content_type" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "member_photos" ADD CONSTRAINT "member_photos_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;