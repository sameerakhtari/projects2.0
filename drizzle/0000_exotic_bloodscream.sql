CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`project_id` text,
	`detail` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_created` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `project_changes` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`expected_version` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_changes_version` ON `project_changes` (`project_id`,`expected_version`);--> statement-breakpoint
CREATE TABLE `architecture_edges` (
	`id` text PRIMARY KEY NOT NULL,
	`revision_id` text NOT NULL,
	`from_key` text NOT NULL,
	`to_key` text NOT NULL,
	`label` text NOT NULL,
	FOREIGN KEY (`revision_id`) REFERENCES `project_revisions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_edges_revision` ON `architecture_edges` (`revision_id`);--> statement-breakpoint
CREATE TABLE `project_links` (
	`id` text PRIMARY KEY NOT NULL,
	`revision_id` text NOT NULL,
	`label` text NOT NULL,
	`url` text NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`revision_id`) REFERENCES `project_revisions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_links_revision` ON `project_links` (`revision_id`,`position`);--> statement-breakpoint
CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`object_key` text NOT NULL,
	`mime` text NOT NULL,
	`bytes` integer NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`alt` text NOT NULL,
	`created_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_object_key_unique` ON `media` (`object_key`);--> statement-breakpoint
CREATE INDEX `idx_media_project` ON `media` (`project_id`,`deleted_at`);--> statement-breakpoint
CREATE TABLE `architecture_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`revision_id` text NOT NULL,
	`node_key` text NOT NULL,
	`label` text NOT NULL,
	`detail` text NOT NULL,
	`column_no` integer NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`revision_id`) REFERENCES `project_revisions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_nodes_revision_key` ON `architecture_nodes` (`revision_id`,`node_key`);--> statement-breakpoint
CREATE TABLE `project_media` (
	`id` text PRIMARY KEY NOT NULL,
	`revision_id` text NOT NULL,
	`media_id` text NOT NULL,
	`alt` text NOT NULL,
	`caption` text NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`revision_id`) REFERENCES `project_revisions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_project_media_revision` ON `project_media` (`revision_id`,`position`);--> statement-breakpoint
CREATE INDEX `idx_project_media_media` ON `project_media` (`media_id`);--> statement-breakpoint
CREATE TABLE `project_technologies` (
	`revision_id` text NOT NULL,
	`technology_id` text NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`revision_id`) REFERENCES `project_revisions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`technology_id`) REFERENCES `technologies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_project_technologies_unique` ON `project_technologies` (`revision_id`,`technology_id`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`draft_revision_id` text,
	`published_revision_id` text,
	`version` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`published_at` text,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_slug_unique` ON `projects` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_projects_published` ON `projects` (`published_revision_id`,`deleted_at`);--> statement-breakpoint
CREATE TABLE `project_relationships` (
	`id` text PRIMARY KEY NOT NULL,
	`revision_id` text NOT NULL,
	`target_project_id` text NOT NULL,
	`type` text NOT NULL,
	`note` text NOT NULL,
	FOREIGN KEY (`revision_id`) REFERENCES `project_revisions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_relationships_revision` ON `project_relationships` (`revision_id`);--> statement-breakpoint
CREATE INDEX `idx_relationships_target` ON `project_relationships` (`target_project_id`);--> statement-breakpoint
CREATE TABLE `project_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`subtitle` text NOT NULL,
	`summary` text NOT NULL,
	`status` text NOT NULL,
	`domain` text NOT NULL,
	`kind` text NOT NULL,
	`timeframe` text NOT NULL,
	`start_year` integer,
	`end_year` integer,
	`featured` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 100 NOT NULL,
	`next_iteration` text DEFAULT '' NOT NULL,
	`private_notes` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_revisions_project` ON `project_revisions` (`project_id`);--> statement-breakpoint
CREATE TABLE `project_sections` (
	`id` text PRIMARY KEY NOT NULL,
	`revision_id` text NOT NULL,
	`heading` text NOT NULL,
	`body` text NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`revision_id`) REFERENCES `project_revisions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_sections_revision` ON `project_sections` (`revision_id`,`position`);--> statement-breakpoint
CREATE TABLE `site_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `technologies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `technologies_name_unique` ON `technologies` (`name`);--> statement-breakpoint
CREATE TABLE `project_updates` (
	`id` text PRIMARY KEY NOT NULL,
	`revision_id` text NOT NULL,
	`date` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`kind` text NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`revision_id`) REFERENCES `project_revisions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_updates_revision` ON `project_updates` (`revision_id`,`position`);