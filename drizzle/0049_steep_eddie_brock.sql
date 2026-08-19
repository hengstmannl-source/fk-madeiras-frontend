ALTER TABLE `folhasPagamentoRh` ADD `tituloEncargosFinanceiroId` int;--> statement-breakpoint
ALTER TABLE `folhasPagamentoRh` ADD COLUMN `tituloEncargosFinanceiroId` int;
--> statement-breakpoint
ALTER TABLE `folhasPagamentoRh` ADD CONSTRAINT `folhasPagamentoRh_tituloEncargosFinanceiroId_unique` UNIQUE(`tituloEncargosFinanceiroId`);
