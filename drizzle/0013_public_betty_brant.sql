ALTER TABLE `titulosFinanceiros` ADD COLUMN `chaveImportacao` varchar(120);
--> statement-breakpoint
ALTER TABLE `titulosFinanceiros` ADD CONSTRAINT `titulosFinanceiros_chaveImportacao_unique` UNIQUE(`chaveImportacao`);
