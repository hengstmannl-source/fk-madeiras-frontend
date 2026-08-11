ALTER TABLE `orcamentos` ADD `pago` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `pagoEm` timestamp;--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `pagoPor` int;