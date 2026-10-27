CREATE TABLE "guest_message_drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"circle_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"code_hash" text NOT NULL,
	"code_expires_at" timestamp with time zone NOT NULL,
	"code_attempts" integer DEFAULT 0 NOT NULL,
	"code_sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "circle_messages" ADD COLUMN "from_guest" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "guest_message_drafts" ADD CONSTRAINT "guest_message_drafts_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guest_message_drafts_email_idx" ON "guest_message_drafts" USING btree (lower("email"),"code_sent_at");--> statement-breakpoint
CREATE INDEX "guest_message_drafts_circle_idx" ON "guest_message_drafts" USING btree ("circle_id","created_at");--> statement-breakpoint
CREATE INDEX "circle_messages_guest_idx" ON "circle_messages" USING btree (lower("reply_email"),"created_at") WHERE "circle_messages"."from_guest";