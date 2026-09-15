ALTER TABLE `lancamentosCustosGerenciais` ADD `unidadeValor` enum('monetario','percentual') DEFAULT 'monetario' NOT NULL;--> statement-breakpoint
ALTER TABLE `lancamentosCustosGerenciais` MODIFY COLUMN `valor` decimal(14,4) NOT NULL;
