CREATE TABLE `configuracoesCustosRh` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`fgtsPercentual` decimal(8,4) NOT NULL DEFAULT '8',
	`provisaoDecimoTerceiroAtiva` boolean NOT NULL DEFAULT true,
	`provisaoFeriasAtiva` boolean NOT NULL DEFAULT true,
	`provisaoTercoFeriasAtiva` boolean NOT NULL DEFAULT true,
	`observacoes` text,
	`criadoPor` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `configuracoesCustosRh_id` PRIMARY KEY(`id`),
	CONSTRAINT `configuracoes_custos_rh_empresa_unica` UNIQUE(`empresaId`)
);
--> statement-breakpoint
CREATE TABLE `custosColaboradorRh` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`colaboradorId` int NOT NULL,
	`descricao` varchar(200) NOT NULL,
	`tipo` enum('fixo','percentual') NOT NULL,
	`valor` decimal(14,4) NOT NULL,
	`recorrente` boolean NOT NULL DEFAULT true,
	`dataInicio` timestamp NOT NULL,
	`dataFim` timestamp,
	`ativo` boolean NOT NULL DEFAULT true,
	`criadoPor` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `custosColaboradorRh_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `custosEmpresaRh` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`descricao` varchar(200) NOT NULL,
	`tipo` enum('fixo','percentual') NOT NULL,
	`valor` decimal(14,4) NOT NULL,
	`escopo` enum('por_colaborador','equipe') NOT NULL DEFAULT 'por_colaborador',
	`recorrente` boolean NOT NULL DEFAULT true,
	`dataInicio` timestamp NOT NULL,
	`dataFim` timestamp,
	`ativo` boolean NOT NULL DEFAULT true,
	`criadoPor` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `custosEmpresaRh_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `custos_colaborador_rh_colaborador_ativo_indice` ON `custosColaboradorRh` (`empresaId`,`colaboradorId`,`ativo`);--> statement-breakpoint
CREATE INDEX `custos_empresa_rh_empresa_ativo_indice` ON `custosEmpresaRh` (`empresaId`,`ativo`);