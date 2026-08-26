CREATE TABLE `categoriasCustosGerenciais` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`centroCustoId` int NOT NULL,
	`categoriaFinanceiraId` int,
	`codigo` varchar(80) NOT NULL,
	`nome` varchar(150) NOT NULL,
	`tipo` enum('estrutural','direto_venda') NOT NULL DEFAULT 'estrutural',
	`baseApropriacao` enum('m3_produzido','m3_vendido','valor_vendido','quantidade_vendida','carga','pedido','percentual_receita','manual') NOT NULL,
	`ativo` boolean NOT NULL DEFAULT true,
	`criadoPor` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `categoriasCustosGerenciais_id` PRIMARY KEY(`id`),
	CONSTRAINT `categorias_custos_gerenciais_empresa_codigo_unico` UNIQUE(`empresaId`,`codigo`)
);
--> statement-breakpoint
CREATE TABLE `centrosCustosGerenciais` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`codigo` enum('industrial','comercial_administrativo') NOT NULL,
	`nome` varchar(150) NOT NULL,
	`ativo` boolean NOT NULL DEFAULT true,
	`criadoPor` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `centrosCustosGerenciais_id` PRIMARY KEY(`id`),
	CONSTRAINT `centros_custos_gerenciais_empresa_codigo_unico` UNIQUE(`empresaId`,`codigo`)
);
--> statement-breakpoint
CREATE TABLE `itensRateiosCustosGerenciais` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`rateioId` int NOT NULL,
	`categoriaCustoId` int NOT NULL,
	`baseApropriacao` enum('m3_produzido','m3_vendido','valor_vendido','quantidade_vendida','carga','pedido','percentual_receita','manual') NOT NULL,
	`baseTotal` decimal(18,6) NOT NULL,
	`valorRateado` decimal(14,2) NOT NULL,
	`fatorUnitario` decimal(18,8) NOT NULL,
	`coberturaPercentual` decimal(8,2) NOT NULL DEFAULT '100',
	`memoriaCalculo` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `itensRateiosCustosGerenciais_id` PRIMARY KEY(`id`),
	CONSTRAINT `itens_rateios_custos_gerenciais_rateio_categoria_unico` UNIQUE(`rateioId`,`categoriaCustoId`)
);
--> statement-breakpoint
CREATE TABLE `lancamentosCustosGerenciais` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`categoriaCustoId` int NOT NULL,
	`competencia` timestamp NOT NULL,
	`descricao` varchar(300) NOT NULL,
	`valor` decimal(14,2) NOT NULL,
	`origem` enum('manual','financeiro_referenciado','venda_direta') NOT NULL DEFAULT 'manual',
	`tituloFinanceiroId` int,
	`orcamentoId` int,
	`romaneioCargaId` int,
	`romaneioProducaoId` int,
	`loteId` int,
	`notaDieselId` int,
	`comprovanteUrl` varchar(1000),
	`observacoes` text,
	`estado` enum('ativo','cancelado') NOT NULL DEFAULT 'ativo',
	`canceladoEm` timestamp,
	`canceladoPor` int,
	`motivoCancelamento` text,
	`criadoPor` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lancamentosCustosGerenciais_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rateiosCustosGerenciais` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`competencia` timestamp NOT NULL,
	`versao` int NOT NULL,
	`estado` enum('vigente','substituido') NOT NULL DEFAULT 'vigente',
	`criteriosSnapshot` text NOT NULL,
	`criadoPor` int NOT NULL,
	`substituidoEm` timestamp,
	`substituidoPor` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rateiosCustosGerenciais_id` PRIMARY KEY(`id`),
	CONSTRAINT `rateios_custos_gerenciais_empresa_competencia_versao_unico` UNIQUE(`empresaId`,`competencia`,`versao`)
);
--> statement-breakpoint
CREATE INDEX `categorias_custos_gerenciais_centro_indice` ON `categoriasCustosGerenciais` (`empresaId`,`centroCustoId`,`ativo`);--> statement-breakpoint
CREATE INDEX `itens_rateios_custos_gerenciais_categoria_indice` ON `itensRateiosCustosGerenciais` (`empresaId`,`categoriaCustoId`);--> statement-breakpoint
CREATE INDEX `lancamentos_custos_gerenciais_competencia_indice` ON `lancamentosCustosGerenciais` (`empresaId`,`competencia`,`estado`);--> statement-breakpoint
CREATE INDEX `lancamentos_custos_gerenciais_categoria_competencia_indice` ON `lancamentosCustosGerenciais` (`empresaId`,`categoriaCustoId`,`competencia`);--> statement-breakpoint
CREATE INDEX `lancamentos_custos_gerenciais_venda_indice` ON `lancamentosCustosGerenciais` (`empresaId`,`orcamentoId`,`estado`);--> statement-breakpoint
CREATE INDEX `rateios_custos_gerenciais_competencia_estado_indice` ON `rateiosCustosGerenciais` (`empresaId`,`competencia`,`estado`);
