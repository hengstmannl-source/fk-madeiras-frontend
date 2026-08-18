ALTER TABLE `movimentacoesEstoqueSerrado` ADD `orcamentoId` int;--> statement-breakpoint
ALTER TABLE `movimentacoesEstoqueSerrado` ADD `volume` decimal(14,6) DEFAULT '0' NOT NULL;