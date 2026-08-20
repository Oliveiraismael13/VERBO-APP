ALTER TABLE `users` ADD `profile_photo` text;
--> statement-breakpoint
CREATE TABLE `user_library` (
	`user_id` text PRIMARY KEY NOT NULL,
	`favorites_json` text DEFAULT '[]' NOT NULL,
	`highlights_json` text DEFAULT '{}' NOT NULL,
	`notes_json` text DEFAULT '{}' NOT NULL,
	`plans_json` text DEFAULT '[]' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
PRAGMA optimize;
