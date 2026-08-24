CREATE TABLE `coop_mission_sessions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `inviter_id` text NOT NULL,
  `partner_id` text NOT NULL,
  `daily_goal` integer NOT NULL CHECK(`daily_goal` BETWEEN 3 AND 10),
  `status` text DEFAULT 'pending' NOT NULL CHECK(`status` IN ('pending', 'active', 'declined', 'ended')),
  `current_round` integer DEFAULT 1 NOT NULL,
  `created_at` integer NOT NULL,
  `accepted_at` integer,
  `ended_at` integer,
  FOREIGN KEY (`inviter_id`) REFERENCES `users`(`id`),
  FOREIGN KEY (`partner_id`) REFERENCES `users`(`id`),
  CHECK(`inviter_id` <> `partner_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_coop_mission_sessions_inviter_status` ON `coop_mission_sessions` (`inviter_id`,`status`);
--> statement-breakpoint
CREATE INDEX `idx_coop_mission_sessions_partner_status` ON `coop_mission_sessions` (`partner_id`,`status`);
--> statement-breakpoint
CREATE TABLE `coop_mission_members` (
  `session_id` integer NOT NULL,
  `user_id` text NOT NULL,
  `round_progress` integer DEFAULT 0 NOT NULL CHECK(`round_progress` >= 0),
  `updated_at` integer NOT NULL,
  PRIMARY KEY(`session_id`, `user_id`),
  FOREIGN KEY (`session_id`) REFERENCES `coop_mission_sessions`(`id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
PRAGMA optimize;
