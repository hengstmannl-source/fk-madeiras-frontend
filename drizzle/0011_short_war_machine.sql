CREATE TABLE `sequenciasVendas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orcamentoId` int NOT NULL,
	`numero` varchar(20) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sequenciasVendas_id` PRIMARY KEY(`id`),
	CONSTRAINT `sequenciasVendas_orcamentoId_unique` UNIQUE(`orcamentoId`),
	CONSTRAINT `sequenciasVendas_numero_unique` UNIQUE(`numero`)
);
--> statement-breakpoint
ALTER TABLE `orcamentos` MODIFY COLUMN `numero` varchar(20);