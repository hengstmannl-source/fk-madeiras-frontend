CREATE TABLE `itensRomaneioProducao` (
	`id` int AUTO_INCREMENT NOT NULL,
	`romaneioId` int NOT NULL,
	`madeiraNome` varchar(200) NOT NULL,
	`espessura` decimal(8,2) NOT NULL,
	`largura` decimal(8,2) NOT NULL,
	`comprimento` decimal(8,2) NOT NULL,
	`quantidade` int NOT NULL,
	`metrosLineares` decimal(14,4) NOT NULL,
	`volume` decimal(14,6) NOT NULL,
	`observacoes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `itensRomaneioProducao_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lotesPecasSerradas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`romaneioId` int NOT NULL,
	`itemRomaneioId` int NOT NULL,
	`madeiraNome` varchar(200) NOT NULL,
	`espessura` decimal(8,2) NOT NULL,
	`largura` decimal(8,2) NOT NULL,
	`comprimento` decimal(8,2) NOT NULL,
	`quantidadeProduzida` int NOT NULL,
	`quantidadeDisponivel` int NOT NULL,
	`metrosLineares` decimal(14,4) NOT NULL,
	`volume` decimal(14,6) NOT NULL,
	`estado` enum('disponivel','esgotado','cancelado') NOT NULL DEFAULT 'disponivel',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lotesPecasSerradas_id` PRIMARY KEY(`id`),
	CONSTRAINT `lotesPecasSerradas_itemRomaneioId_unique` UNIQUE(`itemRomaneioId`)
);
--> statement-breakpoint
CREATE TABLE `movimentacoesEstoqueSerrado` (
	`id` int AUTO_INCREMENT NOT NULL,
	`loteId` int NOT NULL,
	`itemVendaId` int,
	`tipo` enum('entrada_producao','saida_entrega','estorno_entrega','ajuste') NOT NULL,
	`quantidade` int NOT NULL,
	`motivo` text,
	`criadoPor` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `movimentacoesEstoqueSerrado_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `movimentacoesPlaquetas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`plaquetaId` int NOT NULL,
	`romaneioId` int,
	`tipo` enum('entrada','consumo','estorno','ajuste') NOT NULL,
	`volume` decimal(14,6) NOT NULL,
	`motivo` text,
	`criadoPor` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `movimentacoesPlaquetas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `plaquetas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`codigo` varchar(80) NOT NULL,
	`madeiraNome` varchar(200) NOT NULL,
	`volumeInicial` decimal(14,6) NOT NULL,
	`volumeDisponivel` decimal(14,6) NOT NULL,
	`dataEntrada` timestamp NOT NULL,
	`origem` varchar(200),
	`localizacao` varchar(200),
	`observacoes` text,
	`estado` enum('disponivel','consumida','cancelada') NOT NULL DEFAULT 'disponivel',
	`criadoPor` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `plaquetas_id` PRIMARY KEY(`id`),
	CONSTRAINT `plaquetas_codigo_unique` UNIQUE(`codigo`)
);
--> statement-breakpoint
CREATE TABLE `romaneiosProducao` (
	`id` int AUTO_INCREMENT NOT NULL,
	`numero` varchar(30) NOT NULL,
	`plaquetaId` int NOT NULL,
	`dataProducao` timestamp NOT NULL,
	`fita` varchar(100),
	`responsavel` varchar(200),
	`observacoes` text,
	`estado` enum('rascunho','confirmado','cancelado') NOT NULL DEFAULT 'rascunho',
	`confirmadoEm` timestamp,
	`confirmadoPor` int,
	`canceladoEm` timestamp,
	`canceladoPor` int,
	`motivoCancelamento` text,
	`criadoPor` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `romaneiosProducao_id` PRIMARY KEY(`id`),
	CONSTRAINT `romaneiosProducao_numero_unique` UNIQUE(`numero`),
	CONSTRAINT `romaneiosProducao_plaquetaId_unique` UNIQUE(`plaquetaId`)
);
