CREATE TABLE `chequesFinanceiros` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`contaFinanceiraId` int NOT NULL,
	`baixaEntradaId` int NOT NULL,
	`baixaSaidaId` int,
	`clienteId` int NOT NULL,
	`referencia` varchar(120) NOT NULL,
	`valor` decimal(14,2) NOT NULL,
	`dataRecebimento` timestamp NOT NULL,
	`utilizadoEm` timestamp,
	`estado` enum('disponivel','utilizado','estornado') NOT NULL DEFAULT 'disponivel',
	`estornadoEm` timestamp,
	`criadoPor` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chequesFinanceiros_id` PRIMARY KEY(`id`),
	CONSTRAINT `chequesFinanceiros_baixaSaidaId_unique` UNIQUE(`baixaSaidaId`),
	CONSTRAINT `cheques_financeiros_conta_referencia_unica` UNIQUE(`empresaId`,`contaFinanceiraId`,`referencia`)
);
--> statement-breakpoint
ALTER TABLE `contasFinanceiras` MODIFY COLUMN `tipo` enum('caixa','caixa_cheque','banco','carteira','outro') NOT NULL DEFAULT 'caixa';--> statement-breakpoint
CREATE INDEX `cheques_financeiros_conta_estado_indice` ON `chequesFinanceiros` (`empresaId`,`contaFinanceiraId`,`estado`);--> statement-breakpoint
CREATE INDEX `cheques_financeiros_cliente_indice` ON `chequesFinanceiros` (`empresaId`,`clienteId`);--> statement-breakpoint
CREATE INDEX `cheques_financeiros_entrada_indice` ON `chequesFinanceiros` (`baixaEntradaId`);