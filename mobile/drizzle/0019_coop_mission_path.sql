ALTER TABLE `coop_mission_sessions` ADD COLUMN `journey_mode` text NOT NULL DEFAULT 'whole';
--> statement-breakpoint
ALTER TABLE `coop_mission_sessions` ADD COLUMN `start_book_slug` text NOT NULL DEFAULT 'gen';
--> statement-breakpoint
ALTER TABLE `coop_mission_sessions` ADD COLUMN `start_chapter` integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `coop_mission_sessions` ADD COLUMN `end_book_slug` text NOT NULL DEFAULT 'apo';
--> statement-breakpoint
ALTER TABLE `coop_mission_sessions` ADD COLUMN `end_chapter` integer NOT NULL DEFAULT 22;
--> statement-breakpoint
ALTER TABLE `coop_mission_sessions` ADD COLUMN `current_book_slug` text NOT NULL DEFAULT 'gen';
--> statement-breakpoint
ALTER TABLE `coop_mission_sessions` ADD COLUMN `current_chapter` integer NOT NULL DEFAULT 1;
