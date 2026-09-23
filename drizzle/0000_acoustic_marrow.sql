CREATE TABLE `guides` (
	`id` text PRIMARY KEY NOT NULL,
	`subject` text NOT NULL,
	`source_count` integer NOT NULL,
	`card_count` integer NOT NULL,
	`mode` text NOT NULL,
	`created_at` integer NOT NULL,
	`progress` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `materials` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`size` integer NOT NULL,
	`units` integer NOT NULL,
	`warnings` text NOT NULL,
	`created_at` integer NOT NULL
);
