ALTER TABLE `titulosFinanceiros` MODIFY COLUMN `origem` enum('orcamento','romaneio_carga','manual','recorrencia') NOT NULL DEFAULT 'manual';--> statement-breakpoint
ALTER TABLE `romaneiosCargaToras` ADD `dataVencimento` timestamp NULL;--> statement-breakpoint
UPDATE `romaneiosCargaToras` SET `dataVencimento` = `dataCarga` WHERE `dataVencimento` IS NULL;--> statement-breakpoint
ALTER TABLE `romaneiosCargaToras` MODIFY `dataVencimento` timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE `romaneiosCargaToras` ADD `fornecedorId` int;--> statement-breakpoint
ALTER TABLE `romaneiosCargaToras` ADD `tituloFinanceiroId` int;--> statement-breakpoint
ALTER TABLE `titulosFinanceiros` ADD `romaneioCargaId` int;--> statement-breakpoint
ALTER TABLE `titulosFinanceiros` MODIFY `origem` enum('orcamento','romaneio_carga','manual','recorrencia') NOT NULL DEFAULT 'manual';--> statement-breakpoint
ALTER TABLE `romaneiosCargaToras` ADD CONSTRAINT `romaneiosCargaToras_tituloFinanceiroId_unique` UNIQUE(`tituloFinanceiroId`);--> statement-breakpoint
ALTER TABLE `titulosFinanceiros` ADD CONSTRAINT `titulosFinanceiros_romaneioCargaId_unique` UNIQUE(`romaneioCargaId`);
