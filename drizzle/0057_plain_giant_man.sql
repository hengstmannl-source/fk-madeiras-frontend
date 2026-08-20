CREATE TABLE `categoriasLancamentosRh` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`nome` varchar(160) NOT NULL,
	`tipo` enum('credito','debito','ambos') NOT NULL DEFAULT 'ambos',
	`ativo` boolean NOT NULL DEFAULT true,
	`criadoPor` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `categoriasLancamentosRh_id` PRIMARY KEY(`id`),
	CONSTRAINT `categorias_lancamentos_rh_empresa_nome_unico` UNIQUE(`empresaId`,`nome`)
);
--> statement-breakpoint
CREATE TABLE `competenciasFinanceirasRh` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`competencia` timestamp NOT NULL,
	`estado` enum('aberta','fechada') NOT NULL DEFAULT 'aberta',
	`observacoes` text,
	`fechadaEm` timestamp,
	`fechadaPor` int,
	`reabertaEm` timestamp,
	`reabertaPor` int,
	`motivoReabertura` text,
	`criadoPor` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `competenciasFinanceirasRh_id` PRIMARY KEY(`id`),
	CONSTRAINT `competencias_financeiras_rh_empresa_competencia_unico` UNIQUE(`empresaId`,`competencia`)
);
--> statement-breakpoint
CREATE TABLE `encargosGerenciaisRh` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`nome` varchar(160) NOT NULL,
	`tipo` enum('fixo','percentual') NOT NULL DEFAULT 'percentual',
	`valor` decimal(14,4) NOT NULL,
	`baseCalculo` enum('salario_bruto') NOT NULL DEFAULT 'salario_bruto',
	`ativo` boolean NOT NULL DEFAULT true,
	`criadoPor` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `encargosGerenciaisRh_id` PRIMARY KEY(`id`),
	CONSTRAINT `encargos_gerenciais_rh_empresa_nome_unico` UNIQUE(`empresaId`,`nome`)
);
--> statement-breakpoint
CREATE TABLE `lancamentosColaboradoresRh` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`colaboradorId` int NOT NULL,
	`categoriaId` int,
	`tipo` enum('credito','debito','pagamento') NOT NULL,
	`origem` enum('manual','adiantamento','migracao') NOT NULL DEFAULT 'manual',
	`competencia` timestamp NOT NULL,
	`dataLancamento` timestamp NOT NULL,
	`descricao` varchar(300) NOT NULL,
	`valor` decimal(14,2) NOT NULL,
	`estado` enum('pendente','liquidado','cancelado') NOT NULL DEFAULT 'pendente',
	`tituloFinanceiroId` int,
	`observacoes` text,
	`canceladoEm` timestamp,
	`canceladoPor` int,
	`motivoCancelamento` text,
	`criadoPor` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lancamentosColaboradoresRh_id` PRIMARY KEY(`id`),
	CONSTRAINT `lancamentosColaboradoresRh_tituloFinanceiroId_unique` UNIQUE(`tituloFinanceiroId`)
);
--> statement-breakpoint
CREATE TABLE `salariosCompetenciasRh` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`competenciaId` int NOT NULL,
	`colaboradorId` int NOT NULL,
	`salarioBruto` decimal(14,2) NOT NULL,
	`fgtsEstimado` decimal(14,2) NOT NULL DEFAULT '0',
	`inssPatronalEstimado` decimal(14,2) NOT NULL DEFAULT '0',
	`outrosEncargosEstimados` decimal(14,2) NOT NULL DEFAULT '0',
	`provisaoDecimoTerceiro` decimal(14,2) NOT NULL DEFAULT '0',
	`provisaoFerias` decimal(14,2) NOT NULL DEFAULT '0',
	`provisaoTercoFerias` decimal(14,2) NOT NULL DEFAULT '0',
	`beneficios` decimal(14,2) NOT NULL DEFAULT '0',
	`custoMensalEstimado` decimal(14,2) NOT NULL DEFAULT '0',
	`criadoPor` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `salariosCompetenciasRh_id` PRIMARY KEY(`id`),
	CONSTRAINT `salarios_competencias_rh_competencia_colaborador_unico` UNIQUE(`empresaId`,`competenciaId`,`colaboradorId`)
);
--> statement-breakpoint
ALTER TABLE `configuracoesCustosRh` ADD `inssPatronalPercentual` decimal(8,4) DEFAULT '20' NOT NULL;--> statement-breakpoint
ALTER TABLE `configuracoesCustosRh` ADD `inssPatronalEstimadoAtivo` boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX `lancamentos_colaboradores_rh_colaborador_competencia_indice` ON `lancamentosColaboradoresRh` (`empresaId`,`colaboradorId`,`competencia`,`dataLancamento`);--> statement-breakpoint
CREATE INDEX `lancamentos_colaboradores_rh_competencia_estado_indice` ON `lancamentosColaboradoresRh` (`empresaId`,`competencia`,`estado`);