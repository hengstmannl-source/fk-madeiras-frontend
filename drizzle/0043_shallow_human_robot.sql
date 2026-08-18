CREATE TABLE `aproveitamentosRomaneioProducao` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`romaneioId` int NOT NULL,
	`madeiraNome` varchar(200) NOT NULL,
	`volume` decimal(14,6) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `aproveitamentosRomaneioProducao_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `lotesPecasSerradas` ADD `tipo` enum('peca','aproveitamento') DEFAULT 'peca' NOT NULL;--> statement-breakpoint
ALTER TABLE `romaneiosProducao` ADD `volumeAproveitamento` decimal(14,6) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `romaneiosProducao` ADD `incluirAproveitamentoNoRendimento` boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `aproveitamentos_romaneio_producao_romaneio_indice` ON `aproveitamentosRomaneioProducao` (`empresaId`,`romaneioId`);