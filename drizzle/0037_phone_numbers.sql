CREATE TABLE "phone_verifications" (
	"member_id" integer PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"sms_consent" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "phone_code_hash" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "phone_confirm_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "sms_consent" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "sms_consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "phone_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "sms_consent" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "sms_consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "notify_sms" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "phone_verifications" ADD CONSTRAINT "phone_verifications_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_phone_unique" UNIQUE("phone");