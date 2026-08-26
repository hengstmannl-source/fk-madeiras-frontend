CREATE TABLE `auditoriasConciliacaoBancaria` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`movimentoExtratoBancarioId` int NOT NULL,
	`vinculoConciliacaoId` int,
	`acao` enum('importado','conciliado_baixa','conciliado_transferencia','ignorado','divergente','desfeito','baixa_criada') NOT NULL,
	`detalhes` text,
	`usuarioId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditoriasConciliacaoBancaria_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vinculosConciliacaoBancaria` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`movimentoExtratoBancarioId` int NOT NULL,
	`baixaFinanceiraId` int,
	`movimentoTransferenciaFinanceiraId` int,
	`tipo` enum('baixa_existente','baixa_gerada','transferencia') NOT NULL,
	`valorVinculado` decimal(14,2) NOT NULL,
	`criadoPor` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`desfeitoEm` timestamp,
	`desfeitoPor` int,
		`motivoDesfeito` text,
		CONSTRAINT `vinculosConciliacaoBancaria_id` PRIMARY KEY(`id`),
		CONSTRAINT `vinculos_conciliacao_baixa_unico` UNIQUE(`baixaFinanceiraId`),
		CONSTRAINT `vinculos_conciliacao_transferencia_unico` UNIQUE(`movimentoTransferenciaFinanceiraId`)
);
--> statement-breakpoint
ALTER TABLE `baixasFinanceiras` ADD `origemBaixa` enum('manual','conciliacao') DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `extratosBancarios` ADD `saldoFinalBanco` decimal(14,2);--> statement-breakpoint
ALTER TABLE `extratosBancarios` ADD `dataSaldoFinalBanco` timestamp;--> statement-breakpoint
ALTER TABLE `movimentosExtratoBancario` ADD `memoOriginal` text;--> statement-breakpoint
ALTER TABLE `movimentosExtratoBancario` ADD `numeroDocumento` varchar(160);--> statement-breakpoint
ALTER TABLE `movimentosExtratoBancario` ADD `saldoAposMovimento` decimal(14,2);--> statement-breakpoint
ALTER TABLE `movimentosExtratoBancario` ADD `movimentoTransferenciaFinanceiraId` int;--> statement-breakpoint
ALTER TABLE `movimentosExtratoBancario` ADD CONSTRAINT `movimentos_extrato_transferencia_unico` UNIQUE(`movimentoTransferenciaFinanceiraId`);--> statement-breakpoint
ALTER TABLE `movimentosExtratoBancario` ADD CONSTRAINT `movimentos_extrato_fitid_por_conta_unico` UNIQUE(`empresaId`,`contaFinanceiraId`,`identificadorExterno`);--> statement-breakpoint
CREATE INDEX `auditorias_conciliacao_movimento_data_indice` ON `auditoriasConciliacaoBancaria` (`empresaId`,`movimentoExtratoBancarioId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `vinculos_conciliacao_movimento_indice` ON `vinculosConciliacaoBancaria` (`empresaId`,`movimentoExtratoBancarioId`,`desfeitoEm`);--> statement-breakpoint
CREATE INDEX `vinculos_conciliacao_baixa_indice` ON `vinculosConciliacaoBancaria` (`empresaId`,`baixaFinanceiraId`);--> statement-breakpoint
CREATE INDEX `movimentos_extrato_conta_estado_data_indice` ON `movimentosExtratoBancario` (`empresaId`,`contaFinanceiraId`,`estado`,`dataMovimento`);
