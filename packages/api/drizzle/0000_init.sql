CREATE TYPE "public"."avatar_source" AS ENUM('discord', 'upload');--> statement-breakpoint
CREATE TYPE "public"."log_level" AS ENUM('debug', 'info', 'warn', 'error');--> statement-breakpoint
CREATE TYPE "public"."subject_type" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."token_purpose" AS ENUM('verify_email', 'reset_password', 'magic_login', 'email_change');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"public_id" varchar(24) NOT NULL,
	"email" varchar(320) NOT NULL,
	"username" varchar(64) NOT NULL,
	"display_name" varchar(128),
	"email_verified" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "admin_users_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"public_id" varchar(24) NOT NULL,
	"user_id" varchar(21) NOT NULL,
	"label" varchar(64) NOT NULL,
	"key_prefix" varchar(32) NOT NULL,
	"key_hash" varchar(256) NOT NULL,
	"scopes" jsonb,
	"expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"admin_id" varchar(21),
	"action" varchar(128) NOT NULL,
	"entity_type" varchar(64),
	"entity_id" varchar(24),
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_discord" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"subject_type" "subject_type" NOT NULL,
	"subject_id" varchar(21) NOT NULL,
	"discord_id" varchar(64) NOT NULL,
	"discord_username" varchar(128),
	"discord_avatar" varchar(512),
	"discord_email" varchar(320),
	"discord_data" jsonb,
	"access_token" varchar(1024),
	"refresh_token" varchar(1024),
	"token_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_email" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"subject_type" "subject_type" NOT NULL,
	"subject_id" varchar(21) NOT NULL,
	"email" varchar(320) NOT NULL,
	"password_hashed" varchar(256) NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "config" (
	"key" varchar(128) PRIMARY KEY NOT NULL,
	"value" varchar(4096) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"public_id" varchar(24) NOT NULL,
	"user_id" varchar(21) NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "items_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "logs" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"level" "log_level" NOT NULL,
	"context" jsonb NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"user_id" varchar(21) NOT NULL,
	"extra_privileges" jsonb,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tokens" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"user_id" varchar(21),
	"admin_id" varchar(21),
	"purpose" "token_purpose" NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tokens_exclusive_arc" CHECK (num_nonnulls("tokens"."user_id", "tokens"."admin_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"public_id" varchar(24) NOT NULL,
	"username" varchar(64) NOT NULL,
	"display_name" varchar(128),
	"avatar" varchar(512),
	"avatar_source" "avatar_source",
	"email" varchar(320),
	"email_verified" boolean DEFAULT false NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"banned_at" timestamp with time zone,
	"terms_accepted_at" timestamp with time zone,
	"terms_version" varchar(32),
	"privacy_version" varchar(32),
	"acceptable_use_version" varchar(32),
	"username_change_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_admin_id_admin_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_admin_id_admin_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_users_email_unique" ON "admin_users" USING btree ("email") WHERE "admin_users"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_users_username_unique" ON "admin_users" USING btree ("username") WHERE "admin_users"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "api_keys_user_idx" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_log_admin_idx" ON "audit_log" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "audit_log_action_idx" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_discord_id_unique" ON "auth_discord" USING btree ("subject_type","discord_id");--> statement-breakpoint
CREATE INDEX "auth_discord_subject_idx" ON "auth_discord" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_email_email_unique" ON "auth_email" USING btree ("subject_type","email");--> statement-breakpoint
CREATE INDEX "auth_email_subject_idx" ON "auth_email" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "items_user_idx" ON "items" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "tokens_hash_idx" ON "tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "tokens_user_purpose_idx" ON "tokens" USING btree ("user_id","purpose");--> statement-breakpoint
CREATE INDEX "tokens_admin_purpose_idx" ON "tokens" USING btree ("admin_id","purpose");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_unique" ON "users" USING btree ("username") WHERE "users"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email") WHERE "users"."deleted_at" is null;