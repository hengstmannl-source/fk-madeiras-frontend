ALTER TABLE `chequesFinanceiros` DROP INDEX `chequesFinanceiros_baixaSaidaId_unique`;--> statement-breakpoint
CREATE INDEX `cheques_financeiros_saida_indice` ON `chequesFinanceiros` (`baixaSaidaId`);