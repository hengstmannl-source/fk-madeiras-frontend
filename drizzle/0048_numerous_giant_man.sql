CREATE TABLE `adiantamentosRh` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`colaboradorId` int NOT NULL,
	`competencia` timestamp NOT NULL,
	`dataAdiantamento` timestamp NOT NULL,
	`valor` decimal(14,2) NOT NULL,
	`saldoPendente` decimal(14,2) NOT NULL,
	`estado` enum('aberto','descontado','cancelado') NOT NULL DEFAULT 'aberto',
	`tituloFinanceiroId` int,
	`observacoes` text,
	`criadoPor` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `adiantamentosRh_id` PRIMARY KEY(`id`),
	CONSTRAINT `adiantamentosRh_tituloFinanceiroId_unique` UNIQUE(`tituloFinanceiroId`)
);
--> statement-breakpoint
CREATE TABLE `auditoriasRh` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`entidade` varchar(80) NOT NULL,
	`entidadeId` int NOT NULL,
	`acao` varchar(80) NOT NULL,
	`detalhes` text,
	`usuarioId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditoriasRh_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cargosRh` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`nome` varchar(160) NOT NULL,
	`descricao` text,
	`cbo` varchar(20),
	`ativo` boolean NOT NULL DEFAULT true,
	`criadoPor` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cargosRh_id` PRIMARY KEY(`id`),
	CONSTRAINT `cargos_rh_empresa_nome_unico` UNIQUE(`empresaId`,`nome`)
);
--> statement-breakpoint
CREATE TABLE `colaboradoresRh` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`usuarioId` int,
	`departamentoId` int,
	`cargoId` int,
	`nome` varchar(300) NOT NULL,
	`cpf` varchar(20),
	`rg` varchar(30),
	`pis` varchar(30),
	`email` varchar(320),
	`telefone` varchar(100),
	`dataNascimento` timestamp,
	`dataAdmissao` timestamp NOT NULL,
	`dataDesligamento` timestamp,
	`tipoContrato` enum('clt','temporario','aprendiz','estagiario','autonomo') NOT NULL DEFAULT 'clt',
	`situacao` enum('ativo','afastado','desligado') NOT NULL DEFAULT 'ativo',
	`salarioAtual` decimal(14,2) NOT NULL,
	`cargaHorariaSemanal` decimal(6,2) NOT NULL DEFAULT '44',
	`banco` varchar(120),
	`agencia` varchar(40),
	`contaBancaria` varchar(80),
	`chavePix` varchar(320),
	`observacoes` text,
	`criadoPor` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `colaboradoresRh_id` PRIMARY KEY(`id`),
	CONSTRAINT `colaboradores_rh_empresa_cpf_unico` UNIQUE(`empresaId`,`cpf`)
);
--> statement-breakpoint
CREATE TABLE `departamentosRh` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`nome` varchar(160) NOT NULL,
	`descricao` text,
	`ativo` boolean NOT NULL DEFAULT true,
	`criadoPor` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `departamentosRh_id` PRIMARY KEY(`id`),
	CONSTRAINT `departamentos_rh_empresa_nome_unico` UNIQUE(`empresaId`,`nome`)
);
--> statement-breakpoint
CREATE TABLE `dependentesRh` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`colaboradorId` int NOT NULL,
	`nome` varchar(300) NOT NULL,
	`cpf` varchar(20),
	`dataNascimento` timestamp,
	`deduzIrrf` boolean NOT NULL DEFAULT true,
	`ativo` boolean NOT NULL DEFAULT true,
	`criadoPor` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dependentesRh_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `eventosFolhaRh` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`codigo` varchar(30) NOT NULL,
	`nome` varchar(200) NOT NULL,
	`tipo` enum('provento','desconto','informativo') NOT NULL,
	`incideInss` boolean NOT NULL DEFAULT false,
	`incideIrrf` boolean NOT NULL DEFAULT false,
	`incideFgts` boolean NOT NULL DEFAULT false,
	`ativo` boolean NOT NULL DEFAULT true,
	`criadoPor` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `eventosFolhaRh_id` PRIMARY KEY(`id`),
	CONSTRAINT `eventos_folha_rh_empresa_codigo_unico` UNIQUE(`empresaId`,`codigo`)
);
--> statement-breakpoint
CREATE TABLE `eventosItensFolhaRh` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`itemFolhaId` int NOT NULL,
	`eventoId` int,
	`descricao` varchar(300) NOT NULL,
	`tipo` enum('provento','desconto','informativo') NOT NULL,
	`valor` decimal(14,2) NOT NULL,
	`incideInss` boolean NOT NULL DEFAULT false,
	`incideIrrf` boolean NOT NULL DEFAULT false,
	`incideFgts` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `eventosItensFolhaRh_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `faixasTributariasRh` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`tabelaTributariaId` int NOT NULL,
	`limiteInferior` decimal(14,2) NOT NULL DEFAULT '0',
	`limiteSuperior` decimal(14,2),
	`aliquota` decimal(8,4) NOT NULL,
	`parcelaDeduzir` decimal(14,2) NOT NULL DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `faixasTributariasRh_id` PRIMARY KEY(`id`),
	CONSTRAINT `faixas_tributarias_rh_tabela_inferior_unico` UNIQUE(`tabelaTributariaId`,`limiteInferior`)
);
--> statement-breakpoint
CREATE TABLE `folhasPagamentoRh` (
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
		`tituloEncargosFinanceiroId` int,
		`criadoPor` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `folhasPagamentoRh_id` PRIMARY KEY(`id`),
	CONSTRAINT `folhas_pagamento_rh_empresa_competencia_unico` UNIQUE(`empresaId`,`competencia`)
);
--> statement-breakpoint
CREATE TABLE `historicosSalariaisRh` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`colaboradorId` int NOT NULL,
	`salario` decimal(14,2) NOT NULL,
	`vigenciaInicio` timestamp NOT NULL,
	`motivo` varchar(300),
	`criadoPor` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `historicosSalariaisRh_id` PRIMARY KEY(`id`),
	CONSTRAINT `historicos_salariais_rh_colaborador_vigencia_unico` UNIQUE(`empresaId`,`colaboradorId`,`vigenciaInicio`)
);
--> statement-breakpoint
CREATE TABLE `itensFolhaPagamentoRh` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`folhaId` int NOT NULL,
	`colaboradorId` int NOT NULL,
	`salarioBase` decimal(14,2) NOT NULL,
	`totalProventos` decimal(14,2) NOT NULL DEFAULT '0',
	`inss` decimal(14,2) NOT NULL DEFAULT '0',
	`irrf` decimal(14,2) NOT NULL DEFAULT '0',
	`adiantamentos` decimal(14,2) NOT NULL DEFAULT '0',
	`outrosDescontos` decimal(14,2) NOT NULL DEFAULT '0',
	`totalDescontos` decimal(14,2) NOT NULL DEFAULT '0',
	`salarioLiquido` decimal(14,2) NOT NULL,
	`fgts` decimal(14,2) NOT NULL DEFAULT '0',
	`custoEmpresa` decimal(14,2) NOT NULL,
	`tituloFinanceiroId` int,
	`criadoAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `itensFolhaPagamentoRh_id` PRIMARY KEY(`id`),
	CONSTRAINT `itensFolhaPagamentoRh_tituloFinanceiroId_unique` UNIQUE(`tituloFinanceiroId`),
	CONSTRAINT `itens_folha_pagamento_rh_folha_colaborador_unico` UNIQUE(`empresaId`,`folhaId`,`colaboradorId`)
);
--> statement-breakpoint
CREATE TABLE `tabelasTributariasRh` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`nome` varchar(200) NOT NULL,
	`tipo` enum('inss','irrf','fgts') NOT NULL,
	`vigenciaInicio` timestamp NOT NULL,
	`vigenciaFim` timestamp,
	`deducaoDependente` decimal(14,2) NOT NULL DEFAULT '0',
	`aliquotaFixa` decimal(8,4) NOT NULL DEFAULT '0',
	`ativo` boolean NOT NULL DEFAULT true,
	`criadoPor` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tabelasTributariasRh_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `convitesEmpresa` MODIFY COLUMN `papel` enum('administrador','financeiro','rh','vendas','producao','consulta') NOT NULL DEFAULT 'consulta';--> statement-breakpoint
ALTER TABLE `empresaMembros` MODIFY COLUMN `papel` enum('proprietario','administrador','financeiro','rh','vendas','producao','consulta') NOT NULL DEFAULT 'consulta';--> statement-breakpoint
ALTER TABLE `titulosFinanceiros` MODIFY COLUMN `origem` enum('orcamento','romaneio_carga','nota_diesel','serragem_terceiros','folha_pagamento','manual','recorrencia') NOT NULL DEFAULT 'manual';--> statement-breakpoint
CREATE INDEX `adiantamentos_rh_colaborador_competencia_indice` ON `adiantamentosRh` (`empresaId`,`colaboradorId`,`competencia`,`estado`);--> statement-breakpoint
CREATE INDEX `auditorias_rh_entidade_indice` ON `auditoriasRh` (`empresaId`,`entidade`,`entidadeId`);--> statement-breakpoint
CREATE INDEX `colaboradores_rh_empresa_situacao_indice` ON `colaboradoresRh` (`empresaId`,`situacao`);--> statement-breakpoint
CREATE INDEX `tabelas_tributarias_rh_empresa_tipo_vigencia_indice` ON `tabelasTributariasRh` (`empresaId`,`tipo`,`vigenciaInicio`);