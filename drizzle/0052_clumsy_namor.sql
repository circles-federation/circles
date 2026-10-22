CREATE TABLE "guest_code_requests" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "guest_code_requests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"ip_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_guest_rsvps" ADD COLUMN "emails_off_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "guest_code_requests_ip_idx" ON "guest_code_requests" USING btree ("ip_hash","created_at");