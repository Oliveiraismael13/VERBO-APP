ALTER TABLE `users` ADD `email` text;
--> statement-breakpoint
ALTER TABLE `users` ADD `password_hash` text;
--> statement-breakpoint
ALTER TABLE `users` ADD `password_salt` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_email` ON `users` (`email`);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_expires_at` ON `sessions` (`expires_at`);
--> statement-breakpoint
PRAGMA optimize;
