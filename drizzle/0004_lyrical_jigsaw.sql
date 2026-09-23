CREATE TABLE `diagram_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`guide_id` text NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `organization` (
	`id` integer PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL
);
