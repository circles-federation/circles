CREATE TYPE "public"."resource_icon" AS ENUM('folder', 'file');--> statement-breakpoint
CREATE TABLE "circle_resources" (
	"id" text PRIMARY KEY NOT NULL,
	"circle_id" text NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"icon" "resource_icon" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "circle_resources" ADD CONSTRAINT "circle_resources_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "circle_resources_circle_id_idx" ON "circle_resources" USING btree ("circle_id");