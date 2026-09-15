ALTER TABLE `romaneiosCargaToras` ADD `valorProdutos` decimal(14,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `romaneiosCargaToras` ADD `frete` decimal(14,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
UPDATE `romaneiosCargaToras` SET `valorProdutos` = `valorTotal` WHERE `valorProdutos` = '0.00';
