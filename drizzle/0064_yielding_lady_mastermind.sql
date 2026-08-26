CREATE TABLE `movimentosTransferenciasFinanceiras` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`transferenciaId` int NOT NULL,
	`contaFinanceiraId` int NOT NULL,
	`tipo` enum('entrada','saida') NOT NULL,
	`valor` decimal(14,2) NOT NULL,
	`dataMovimento` timestamp NOT NULL,
	`descricao` varchar(300) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `movimentosTransferenciasFinanceiras_id` PRIMARY KEY(`id`),
	CONSTRAINT `movimentos_transferencia_tipo_unico` UNIQUE(`transferenciaId`,`tipo`)
);
--> statement-breakpoint
CREATE TABLE `transferenciasFinanceiras` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`contaOrigemId` int NOT NULL,
	`contaDestinoId` int NOT NULL,
	`valor` decimal(14,2) NOT NULL,
	`dataTransferencia` timestamp NOT NULL,
	`descricao` varchar(300),
	`observacoes` text,
	`estado` enum('efetivada','estornada') NOT NULL DEFAULT 'efetivada',
	`estornadaEm` timestamp,
	`estornadaPor` int,
	`motivoEstorno` text,
	`transferenciaOrigemId` int,
	`criadoPor` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `transferenciasFinanceiras_id` PRIMARY KEY(`id`),
	CONSTRAINT `transferenciasFinanceiras_transferenciaOrigemId_unique` UNIQUE(`transferenciaOrigemId`)
);
--> statement-breakpoint
CREATE INDEX `movimentos_transferencia_conta_data_indice` ON `movimentosTransferenciasFinanceiras` (`empresaId`,`contaFinanceiraId`,`dataMovimento`);--> statement-breakpoint
CREATE INDEX `transferencias_financeiras_origem_indice` ON `transferenciasFinanceiras` (`empresaId`,`contaOrigemId`,`dataTransferencia`);--> statement-breakpoint
CREATE INDEX `transferencias_financeiras_destino_indice` ON `transferenciasFinanceiras` (`empresaId`,`contaDestinoId`,`dataTransferencia`);--> statement-breakpoint
CREATE INDEX `transferencias_financeiras_estado_indice` ON `transferenciasFinanceiras` (`empresaId`,`estado`,`dataTransferencia`);