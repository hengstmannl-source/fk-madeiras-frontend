CREATE TABLE `romaneiosCargaToras` (
	`id` int AUTO_INCREMENT NOT NULL,
	`numero` varchar(30) NOT NULL,
	`dataCarga` timestamp NOT NULL,
	`origem` varchar(200),
	`responsavel` varchar(200),
	`observacoes` text,
	`totalPlaquetas` int NOT NULL DEFAULT 0,
	`volumeTotal` decimal(14,6) NOT NULL DEFAULT '0',
	`criadoPor` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `romaneiosCargaToras_id` PRIMARY KEY(`id`),
	CONSTRAINT `romaneiosCargaToras_numero_unique` UNIQUE(`numero`)
);
--> statement-breakpoint
ALTER TABLE `plaquetas` ADD `diametro` decimal(8,2);--> statement-breakpoint
ALTER TABLE `plaquetas` ADD `romaneioCargaId` int;