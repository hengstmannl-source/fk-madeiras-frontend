ALTER TABLE `centrosCustosGerenciais` MODIFY COLUMN `codigo` varchar(80) NOT NULL;--> statement-breakpoint
ALTER TABLE `centrosCustosGerenciais` ADD `tipo` enum('industrial','comercial_administrativo','nao_apropriavel') DEFAULT 'industrial' NOT NULL;--> statement-breakpoint
ALTER TABLE `centrosCustosGerenciais` ADD `observacoes` text;--> statement-breakpoint
ALTER TABLE `recorrenciasFinanceiras` ADD `centroCustoId` int;--> statement-breakpoint
ALTER TABLE `titulosFinanceiros` ADD `centroCustoId` int;--> statement-breakpoint
CREATE INDEX `centros_custos_gerenciais_empresa_tipo_ativo_indice` ON `centrosCustosGerenciais` (`empresaId`,`tipo`,`ativo`);--> statement-breakpoint
CREATE INDEX `recorrencias_financeiras_centro_ativa_indice` ON `recorrenciasFinanceiras` (`empresaId`,`centroCustoId`,`ativa`);--> statement-breakpoint
CREATE INDEX `titulos_financeiros_centro_competencia_indice` ON `titulosFinanceiros` (`empresaId`,`centroCustoId`,`competencia`,`estado`);