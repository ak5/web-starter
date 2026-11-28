CREATE TABLE `attachment_cleanup` (
	`object_key` text PRIMARY KEY NOT NULL,
	`after` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `attachment_cleanup_after_idx` ON `attachment_cleanup` (`after`);--> statement-breakpoint
CREATE TABLE `item_attachments` (
	`item_id` text PRIMARY KEY NOT NULL,
	`object_key` text NOT NULL,
	`name` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `item_attachments_object_key_unique` ON `item_attachments` (`object_key`);