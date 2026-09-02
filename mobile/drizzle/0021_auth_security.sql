CREATE TABLE IF NOT EXISTS `auth_rate_limits` (
  `key_hash` text PRIMARY KEY NOT NULL,
  `attempt_count` integer NOT NULL,
  `window_started_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_auth_rate_limits_window` ON `auth_rate_limits` (`window_started_at`);
