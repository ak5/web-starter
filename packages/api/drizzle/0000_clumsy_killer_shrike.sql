CREATE TABLE `admin_users` (
	`id` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`email` text NOT NULL,
	`username` text NOT NULL,
	`display_name` text,
	`email_verified` integer DEFAULT true NOT NULL,
	`last_login_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_users_public_id_unique` ON `admin_users` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `admin_users_email_unique` ON `admin_users` (`email`) WHERE "admin_users"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX `admin_users_username_unique` ON `admin_users` (`username`) WHERE "admin_users"."deleted_at" is null;--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`user_id` text NOT NULL,
	`label` text NOT NULL,
	`key_prefix` text NOT NULL,
	`key_hash` text NOT NULL,
	`scopes` text,
	`expires_at` integer,
	`last_used_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_public_id_unique` ON `api_keys` (`public_id`);--> statement-breakpoint
CREATE INDEX `api_keys_user_idx` ON `api_keys` (`user_id`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_id` text,
	`action` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`payload` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`admin_id`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_log_admin_idx` ON `audit_log` (`admin_id`);--> statement-breakpoint
CREATE INDEX `audit_log_action_idx` ON `audit_log` (`action`);--> statement-breakpoint
CREATE INDEX `audit_log_entity_idx` ON `audit_log` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `audit_log_created_idx` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `auth_discord` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_type` text NOT NULL,
	`subject_id` text NOT NULL,
	`discord_id` text NOT NULL,
	`discord_username` text,
	`discord_avatar` text,
	`discord_email` text,
	`discord_data` text,
	`access_token` text,
	`refresh_token` text,
	`token_expires_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "auth_discord_subject_type" CHECK("auth_discord"."subject_type" IN ('user', 'admin'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_discord_id_unique` ON `auth_discord` (`subject_type`,`discord_id`);--> statement-breakpoint
CREATE INDEX `auth_discord_subject_idx` ON `auth_discord` (`subject_type`,`subject_id`);--> statement-breakpoint
CREATE TABLE `auth_email` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_type` text NOT NULL,
	`subject_id` text NOT NULL,
	`email` text NOT NULL,
	`password_hashed` text NOT NULL,
	`verified` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "auth_email_subject_type" CHECK("auth_email"."subject_type" IN ('user', 'admin'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_email_email_unique` ON `auth_email` (`subject_type`,`email`);--> statement-breakpoint
CREATE INDEX `auth_email_subject_idx` ON `auth_email` (`subject_type`,`subject_id`);--> statement-breakpoint
CREATE TABLE `config` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`user_id` text NOT NULL,
	`data` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`modified_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `items_public_id_unique` ON `items` (`public_id`);--> statement-breakpoint
CREATE INDEX `items_user_idx` ON `items` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `logs` (
	`id` text PRIMARY KEY NOT NULL,
	`timestamp` integer NOT NULL,
	`level` text NOT NULL,
	`context` text NOT NULL,
	`data` text NOT NULL,
	CONSTRAINT "logs_level" CHECK("logs"."level" IN ('debug', 'info', 'warn', 'error'))
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`extra_privileges` text,
	`last_login_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`admin_id` text,
	`purpose` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`payload` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`admin_id`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "tokens_purpose" CHECK("tokens"."purpose" IN ('verify_email', 'reset_password', 'magic_login', 'email_change')),
	CONSTRAINT "tokens_exclusive_arc" CHECK(("tokens"."user_id" IS NOT NULL) + ("tokens"."admin_id" IS NOT NULL) = 1)
);
--> statement-breakpoint
CREATE INDEX `tokens_hash_idx` ON `tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `tokens_user_purpose_idx` ON `tokens` (`user_id`,`purpose`);--> statement-breakpoint
CREATE INDEX `tokens_admin_purpose_idx` ON `tokens` (`admin_id`,`purpose`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`username` text NOT NULL,
	`display_name` text,
	`avatar` text,
	`avatar_source` text,
	`email` text,
	`email_verified` integer DEFAULT false NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`banned_at` integer,
	`terms_accepted_at` integer,
	`terms_version` text,
	`privacy_version` text,
	`acceptable_use_version` text,
	`username_change_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`last_login_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`deleted_at` integer,
	CONSTRAINT "users_role" CHECK("users"."role" IN ('user', 'admin')),
	CONSTRAINT "users_avatar_source" CHECK("users"."avatar_source" IS NULL OR "users"."avatar_source" IN ('discord', 'upload'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_public_id_unique` ON `users` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`) WHERE "users"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`) WHERE "users"."deleted_at" is null;