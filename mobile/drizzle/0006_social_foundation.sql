ALTER TABLE `users` ADD `public_handle` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_public_handle` ON `users` (`public_handle`);
--> statement-breakpoint
CREATE TABLE `social_privacy_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`profile_visibility` text DEFAULT 'friends' NOT NULL CHECK(`profile_visibility` IN ('friends', 'private')),
	`show_progress` integer DEFAULT 1 NOT NULL CHECK(`show_progress` IN (0, 1)),
	`show_favorites` integer DEFAULT 0 NOT NULL CHECK(`show_favorites` IN (0, 1)),
	`show_activities` integer DEFAULT 0 NOT NULL CHECK(`show_activities` IN (0, 1)),
	`show_stats` integer DEFAULT 1 NOT NULL CHECK(`show_stats` IN (0, 1)),
	`allow_friend_requests` integer DEFAULT 1 NOT NULL CHECK(`allow_friend_requests` IN (0, 1)),
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `friend_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sender_id` text NOT NULL,
	`recipient_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL CHECK(`status` IN ('pending', 'accepted', 'declined', 'cancelled')),
	`created_at` integer NOT NULL,
	`responded_at` integer,
	FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recipient_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CHECK(`sender_id` <> `recipient_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_friend_requests_recipient_status` ON `friend_requests` (`recipient_id`,`status`);
--> statement-breakpoint
CREATE INDEX `idx_friend_requests_sender_status` ON `friend_requests` (`sender_id`,`status`);
--> statement-breakpoint
CREATE TABLE `friendships` (
	`user_a_id` text NOT NULL,
	`user_b_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_a_id`, `user_b_id`),
	FOREIGN KEY (`user_a_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_b_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CHECK(`user_a_id` < `user_b_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_friendships_user_b` ON `friendships` (`user_b_id`);
--> statement-breakpoint
CREATE TABLE `social_activities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_id` text NOT NULL,
	`kind` text NOT NULL CHECK(`kind` IN ('mission_completed', 'chapter_completed', 'streak_milestone', 'achievement_unlocked')),
	`payload_json` text DEFAULT '{}' NOT NULL,
	`visibility` text DEFAULT 'friends' NOT NULL CHECK(`visibility` IN ('friends', 'private')),
	`created_at` integer NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_social_activities_actor_created` ON `social_activities` (`actor_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `social_reactions` (
	`activity_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`reaction` text NOT NULL CHECK(`reaction` IN ('amen', 'celebrate')),
	`created_at` integer NOT NULL,
	PRIMARY KEY(`activity_id`, `user_id`),
	FOREIGN KEY (`activity_id`) REFERENCES `social_activities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
PRAGMA optimize;
