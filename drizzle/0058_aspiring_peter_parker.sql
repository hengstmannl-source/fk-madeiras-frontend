ALTER TABLE `orcamentos` ADD `fretePorTonelada` decimal(12,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `pesoCargaToneladas` decimal(12,3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `abatimentoFrete` decimal(12,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `baseAposFrete` decimal(14,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `comissaoTipo` enum('percentual','fixo') DEFAULT 'percentual' NOT NULL;--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `comissaoValor` decimal(12,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `comissaoCalculada` decimal(12,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `taxaDescricao` varchar(120);--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `taxaTipo` enum('percentual','fixo') DEFAULT 'percentual' NOT NULL;--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `taxaValor` decimal(12,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `taxaCalculada` decimal(12,2) DEFAULT '0' NOT NULL;