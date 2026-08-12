CREATE TABLE `abastecimentosDiesel` (
	`id` int AUTO_INCREMENT NOT NULL,
	`destino` varchar(200) NOT NULL,
	`responsavel` varchar(200),
	`litros` decimal(14,3) NOT NULL,
	`custoUnitario` decimal(14,4) NOT NULL,
	`custoTotal` decimal(14,2) NOT NULL,
	`dataAbastecimento` timestamp NOT NULL,
	`observacoes` text,
	`criadoPor` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `abastecimentosDiesel_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notasDiesel` (
	`id` int AUTO_INCREMENT NOT NULL,
	`numeroNota` varchar(100),
	`fornecedorId` int NOT NULL,
	`litros` decimal(14,3) NOT NULL,
	`valorTotal` decimal(14,2) NOT NULL,
	`dataNota` timestamp NOT NULL,
	`dataVencimento` timestamp NOT NULL,
	`observacoes` text,
	`criadoPor` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notasDiesel_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `titulosFinanceiros` MODIFY COLUMN `origem` enum('orcamento','romaneio_carga','nota_diesel','manual','recorrencia') NOT NULL DEFAULT 'manual';--> statement-breakpoint
ALTER TABLE `titulosFinanceiros` ADD `notaDieselId` int;--> statement-breakpoint
ALTER TABLE `titulosFinanceiros` ADD CONSTRAINT `titulosFinanceiros_notaDieselId_unique` UNIQUE(`notaDieselId`);