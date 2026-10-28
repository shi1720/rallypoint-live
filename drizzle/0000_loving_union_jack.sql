CREATE TABLE `integrations` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`broadcaster_id` text NOT NULL,
	`channel` text NOT NULL,
	`encrypted_tokens` text NOT NULL,
	`scopes` text NOT NULL,
	`subscription_ids` text DEFAULT '[]' NOT NULL,
	`status` text NOT NULL,
	`error` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `integrations_broadcaster_id_unique` ON `integrations` (`broadcaster_id`);--> statement-breakpoint
CREATE TABLE `oauth_states` (
	`hash` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `oauth_expiry` ON `oauth_states` (`expires_at`);--> statement-breakpoint
CREATE TABLE `outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`reply` text NOT NULL,
	`parent_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	`error` text
);
--> statement-breakpoint
CREATE INDEX `outbox_owner` ON `outbox` (`owner_id`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`public_id` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`state` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rooms_owner_id_unique` ON `rooms` (`owner_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `rooms_public_id_unique` ON `rooms` (`public_id`);