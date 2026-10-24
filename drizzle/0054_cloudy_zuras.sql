CREATE TABLE "circle_message_reads" (
	"message_id" text NOT NULL,
	"member_id" integer NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "circle_message_reads_message_id_member_id_pk" PRIMARY KEY("message_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "circle_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"circle_id" text NOT NULL,
	"sender_id" integer,
	"sender_name" text NOT NULL,
	"reply_email" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"assignee_id" integer,
	"done_at" timestamp with time zone,
	"done_by" integer
);
--> statement-breakpoint
ALTER TABLE "circles" ADD COLUMN "inbox_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "circle_message_reads" ADD CONSTRAINT "circle_message_reads_message_id_circle_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."circle_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_message_reads" ADD CONSTRAINT "circle_message_reads_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_messages" ADD CONSTRAINT "circle_messages_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_messages" ADD CONSTRAINT "circle_messages_sender_id_members_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_messages" ADD CONSTRAINT "circle_messages_assignee_id_members_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_messages" ADD CONSTRAINT "circle_messages_done_by_members_id_fk" FOREIGN KEY ("done_by") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "circle_messages_circle_idx" ON "circle_messages" USING btree ("circle_id","created_at");--> statement-breakpoint
CREATE INDEX "circle_messages_sender_idx" ON "circle_messages" USING btree ("sender_id","created_at");