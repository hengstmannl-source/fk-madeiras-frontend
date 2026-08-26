CREATE TABLE `calculosCustosGerenciais` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`entidadeTipo` enum('romaneio_producao','lote','venda') NOT NULL,
	`entidadeId` int NOT NULL,
	`competencia` timestamp NOT NULL,
	`versao` int NOT NULL,
	`estado` enum('vigente','substituido') NOT NULL DEFAULT 'vigente',
	`rateioId` int,
	`custoMateriaPrima` decimal(14,2) NOT NULL DEFAULT '0',
	`custoIndustrial` decimal(14,2) NOT NULL DEFAULT '0',
	`custoAdministrativo` decimal(14,2) NOT NULL DEFAULT '0',
	`custoComercial` decimal(14,2) NOT NULL DEFAULT '0',
	`custoTotal` decimal(14,2) NOT NULL DEFAULT '0',
	`coberturaPercentual` decimal(8,2) NOT NULL DEFAULT '0',
	`statusCobertura` enum('completo','parcial','nao_determinado','sem_volume_produzido') NOT NULL,
	`criteriosSnapshot` text NOT NULL,
	`criadoPor` int NOT NULL,
	`substituidoEm` timestamp,
	`substituidoPor` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `calculosCustosGerenciais_id` PRIMARY KEY(`id`),
	CONSTRAINT `calculos_custos_gerenciais_empresa_entidade_versao_unico` UNIQUE(`empresaId`,`entidadeTipo`,`entidadeId`,`versao`)
);
--> statement-breakpoint
CREATE TABLE `componentesCalculosCustosGerenciais` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`calculoId` int NOT NULL,
	`categoriaCustoId` int,
	`itemRateioId` int,
	`lancamentoCustoId` int,
	`tipo` enum('materia_prima','industrial','administrativo','comercial','frete_comercial','comissao','taxa','direto_venda') NOT NULL,
	`origemTipo` enum('consumo_tora','rateio_categoria','lancamento_direto','venda') NOT NULL,
	`origemId` int,
	`valor` decimal(14,2) NOT NULL,
	`coberturaPercentual` decimal(8,2) NOT NULL DEFAULT '100',
	`memoriaCalculo` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `componentesCalculosCustosGerenciais_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `lancamentosCustosGerenciais` ADD `competenciaOriginal` timestamp;--> statement-breakpoint
ALTER TABLE `lancamentosCustosGerenciais` ADD `competenciaAlteradaEm` timestamp;--> statement-breakpoint
ALTER TABLE `lancamentosCustosGerenciais` ADD `competenciaAlteradaPor` int;--> statement-breakpoint
ALTER TABLE `lancamentosCustosGerenciais` ADD `justificativaCompetencia` text;--> statement-breakpoint
CREATE INDEX `calculos_custos_gerenciais_entidade_estado_indice` ON `calculosCustosGerenciais` (`empresaId`,`entidadeTipo`,`entidadeId`,`estado`);--> statement-breakpoint
CREATE INDEX `calculos_custos_gerenciais_rateio_indice` ON `calculosCustosGerenciais` (`empresaId`,`rateioId`);--> statement-breakpoint
CREATE INDEX `componentes_calculos_custos_gerenciais_calculo_indice` ON `componentesCalculosCustosGerenciais` (`empresaId`,`calculoId`);--> statement-breakpoint
CREATE INDEX `componentes_calculos_custos_gerenciais_categoria_indice` ON `componentesCalculosCustosGerenciais` (`empresaId`,`categoriaCustoId`);--> statement-breakpoint
CREATE INDEX `componentes_calculos_custos_gerenciais_lancamento_indice` ON `componentesCalculosCustosGerenciais` (`empresaId`,`lancamentoCustoId`);