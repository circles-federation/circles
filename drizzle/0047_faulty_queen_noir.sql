CREATE TABLE "circle_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"circle_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'todo' NOT NULL,
	"priority" text DEFAULT 'none' NOT NULL,
	"due_date" date,
	"assignee_id" integer,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "circle_tasks" ADD CONSTRAINT "circle_tasks_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_tasks" ADD CONSTRAINT "circle_tasks_assignee_id_members_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_tasks" ADD CONSTRAINT "circle_tasks_created_by_members_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "circle_tasks_circle_idx" ON "circle_tasks" USING btree ("circle_id");--> statement-breakpoint
CREATE INDEX "circle_tasks_assignee_idx" ON "circle_tasks" USING btree ("assignee_id");