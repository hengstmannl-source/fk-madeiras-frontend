CREATE TABLE `anexosFinanceiros` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tituloId` int NOT NULL,
	`nomeArquivo` varchar(300) NOT NULL,
	`mimeType` varchar(100) NOT NULL,
	`tamanhoBytes` int NOT NULL,
	`tipo` enum('nota_fiscal','boleto','comprovante','outro') NOT NULL DEFAULT 'outro',
	`storageKey` varchar(500) NOT NULL,
	`url` varchar(1000) NOT NULL,
	`criadoPor` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `anexosFinanceiros_id` PRIMARY KEY(`id`),
	CONSTRAINT `anexosFinanceiros_storageKey_unique` UNIQUE(`storageKey`)
);
--> statement-breakpoint
ALTER TABLE `titulosFinanceiros` ADD `codigoBarrasBoleto` varchar(60);--> statement-breakpoint
ALTER TABLE `titulosFinanceiros` ADD `linhaDigitavelBoleto` varchar(60);--> statement-breakpoint
ALTER TABLE `titulosFinanceiros` ADD `boletoConfirmadoEm` timestamp;