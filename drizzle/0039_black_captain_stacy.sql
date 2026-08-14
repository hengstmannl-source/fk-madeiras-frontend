CREATE TABLE `itensSerragemPecas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`serragemId` int NOT NULL,
	`madeiraNome` varchar(200) NOT NULL,
	`espessura` decimal(8,2) NOT NULL,
	`largura` decimal(8,2) NOT NULL,
	`comprimento` decimal(8,2) NOT NULL,
	`quantidade` int NOT NULL,
	`metrosLineares` decimal(14,4) NOT NULL,
	`volume` decimal(14,6) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `itensSerragemPecas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `itensSerragemToras` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`serragemId` int NOT NULL,
	`referencia` varchar(120) NOT NULL,
	`madeiraNome` varchar(200) NOT NULL,
	`diametro` decimal(8,2),
	`comprimento` decimal(8,2),
	`volume` decimal(14,6) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `itensSerragemToras_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `serragensTerceiros` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`numero` varchar(40) NOT NULL,
	`clienteId` int NOT NULL,
	`dataProducao` timestamp NOT NULL,
	`responsavel` varchar(200),
	`observacoes` text,
	`valorServico` decimal(14,2) NOT NULL,
	`dataVencimento` timestamp NOT NULL,
	`volumeToras` decimal(14,6) NOT NULL,
	`volumeProduzido` decimal(14,6) NOT NULL,
	`aproveitamento` decimal(8,2) NOT NULL,
	`criadoPor` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `serragensTerceiros_id` PRIMARY KEY(`id`),
	CONSTRAINT `serragensTerceiros_numero_unique` UNIQUE(`numero`)
);
--> statement-breakpoint
ALTER TABLE `titulosFinanceiros` MODIFY COLUMN `origem` enum('orcamento','romaneio_carga','nota_diesel','serragem_terceiros','manual','recorrencia') NOT NULL DEFAULT 'manual';--> statement-breakpoint
ALTER TABLE `lotesPecasSerradas` ADD `serragemTerceirosId` int;--> statement-breakpoint
ALTER TABLE `lotesPecasSerradas` ADD `itemSerragemId` int;--> statement-breakpoint
ALTER TABLE `lotesPecasSerradas` ADD `propriedade` enum('proprio','terceiro') DEFAULT 'proprio' NOT NULL;--> statement-breakpoint
ALTER TABLE `lotesPecasSerradas` ADD `clienteProprietarioId` int;--> statement-breakpoint
ALTER TABLE `titulosFinanceiros` ADD `serragemTerceirosId` int;--> statement-breakpoint
ALTER TABLE `lotesPecasSerradas` ADD CONSTRAINT `lotesPecasSerradas_itemSerragemId_unique` UNIQUE(`itemSerragemId`);--> statement-breakpoint
ALTER TABLE `titulosFinanceiros` ADD CONSTRAINT `titulosFinanceiros_serragemTerceirosId_unique` UNIQUE(`serragemTerceirosId`);--> statement-breakpoint
CREATE INDEX `serragens_terceiros_empresa_cliente_indice` ON `serragensTerceiros` (`empresaId`,`clienteId`,`dataProducao`);--> statement-breakpoint
CREATE INDEX `lotes_pecas_serradas_serragem_indice` ON `lotesPecasSerradas` (`empresaId`,`serragemTerceirosId`);