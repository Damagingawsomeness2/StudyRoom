CREATE TABLE `lecture_uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`size` integer NOT NULL,
	`upload_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `materials` ADD `lecture` text DEFAULT '{}' NOT NULL;