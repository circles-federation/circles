CREATE TABLE "circle_roles" (
	"id" text PRIMARY KEY NOT NULL,
	"circle_id" text NOT NULL,
	"label" text NOT NULL,
	"builtin" boolean DEFAULT false NOT NULL,
	"member_id" integer,
	"position" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "circle_roles" ADD CONSTRAINT "circle_roles_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_roles" ADD CONSTRAINT "circle_roles_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "circle_roles_circle_label_unique" ON "circle_roles" USING btree ("circle_id",lower("label"));