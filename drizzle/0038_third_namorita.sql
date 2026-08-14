ALTER TABLE `chequesFinanceiros` MODIFY COLUMN `estado` enum('disponivel','utilizado','estornado','depositado') NOT NULL DEFAULT 'disponivel';--> statement-breakpoint
ALTER TABLE `chequesFinanceiros` ADD `depositadoEm` timestamp;--> statement-breakpoint
ALTER TABLE `chequesFinanceiros` ADD `contaDestinoId` int;--> statement-breakpoint
CREATE INDEX `cheques_financeiros_destino_indice` ON `chequesFinanceiros` (`empresaId`,`contaDestinoId`,`depositadoEm`);