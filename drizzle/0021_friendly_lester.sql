CREATE TABLE `itensRomaneioToras` (
	`id` int AUTO_INCREMENT NOT NULL,
	`romaneioId` int NOT NULL,
	`plaquetaId` int NOT NULL,
	`madeiraNome` varchar(200) NOT NULL,
	`diametro` decimal(8,2),
	`comprimento` decimal(8,2),
	`volume` decimal(14,6) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `itensRomaneioToras_id` PRIMARY KEY(`id`),
	CONSTRAINT `itensRomaneioToras_plaquetaId_unique` UNIQUE(`plaquetaId`)
);
--> statement-breakpoint
ALTER TABLE `romaneiosProducao` DROP INDEX `romaneiosProducao_plaquetaId_unique`;--> statement-breakpoint
ALTER TABLE `romaneiosProducao` MODIFY COLUMN `plaquetaId` int;--> statement-breakpoint
ALTER TABLE `romaneiosProducao` ADD `totalToras` int DEFAULT 1 NOT NULL;