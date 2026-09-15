ALTER TABLE `orcamentos` ADD `entregue` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `entregueEm` timestamp;--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `entreguePor` int;
