CREATE SEQUENCE "public"."circle_chat_rev_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "circle_chat_mentions" (
	"message_id" bigint NOT NULL,
	"member_id" integer NOT NULL,
	CONSTRAINT "circle_chat_mentions_message_id_member_id_pk" PRIMARY KEY("message_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "circle_chat_messages" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "circle_chat_messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"circle_id" text NOT NULL,
	"author_id" integer,
	"scheme" smallint DEFAULT 0 NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"rev" bigint DEFAULT nextval('circle_chat_rev_seq') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "circle_chat_reads" (
	"circle_id" text NOT NULL,
	"member_id" integer NOT NULL,
	"last_read_id" bigint NOT NULL,
	CONSTRAINT "circle_chat_reads_circle_id_member_id_pk" PRIMARY KEY("circle_id","member_id")
);
--> statement-breakpoint
ALTER TABLE "circle_chat_mentions" ADD CONSTRAINT "circle_chat_mentions_message_id_circle_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."circle_chat_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_chat_mentions" ADD CONSTRAINT "circle_chat_mentions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_chat_messages" ADD CONSTRAINT "circle_chat_messages_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_chat_messages" ADD CONSTRAINT "circle_chat_messages_author_id_members_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_chat_reads" ADD CONSTRAINT "circle_chat_reads_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_chat_reads" ADD CONSTRAINT "circle_chat_reads_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "circle_chat_mentions_member_idx" ON "circle_chat_mentions" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "circle_chat_messages_circle_idx" ON "circle_chat_messages" USING btree ("circle_id","id");--> statement-breakpoint
CREATE INDEX "circle_chat_messages_rev_idx" ON "circle_chat_messages" USING btree ("circle_id","rev");