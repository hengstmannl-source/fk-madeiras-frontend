CREATE TABLE `regrasReducaoIrrfRh` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`tabelaTributariaId` int NOT NULL,
	`tipo` enum('zera_imposto','formula_linear') NOT NULL,
	`limiteInferior` decimal(14,2) NOT NULL DEFAULT '0',
	`limiteSuperior` decimal(14,2),
	`valorMaximo` decimal(14,2) NOT NULL DEFAULT '0',
	`constante` decimal(16,6) NOT NULL DEFAULT '0',
	`coeficiente` decimal(16,6) NOT NULL DEFAULT '0',
	`ordem` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `regrasReducaoIrrfRh_id` PRIMARY KEY(`id`),
	CONSTRAINT `regras_reducao_irrf_rh_tabela_ordem_unico` UNIQUE(`tabelaTributariaId`,`ordem`)
);
--> statement-breakpoint
ALTER TABLE `itensFolhaPagamentoRh` ADD `baseIrrf` decimal(14,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `itensFolhaPagamentoRh` ADD `deducoesLegaisIrrf` decimal(14,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `itensFolhaPagamentoRh` ADD `descontoSimplificadoIrrf` decimal(14,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `itensFolhaPagamentoRh` ADD `metodoDeducaoIrrf` enum('legal','simplificado','nenhum');--> statement-breakpoint
ALTER TABLE `itensFolhaPagamentoRh` ADD `tabelaIrrfId` int;--> statement-breakpoint
ALTER TABLE `itensFolhaPagamentoRh` ADD `memoriaIrrf` text;--> statement-breakpoint
ALTER TABLE `tabelasTributariasRh` ADD `descontoSimplificado` decimal(14,2) DEFAULT '0' NOT NULL;