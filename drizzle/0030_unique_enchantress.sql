INSERT INTO `empresas` (`id`, `nome`, `nomeFantasia`, `ativa`)
VALUES (1, 'FK Madeiras', 'FK Madeiras', true)
ON DUPLICATE KEY UPDATE `nome` = VALUES(`nome`), `nomeFantasia` = VALUES(`nomeFantasia`), `ativa` = true;
--> statement-breakpoint
SET @empresa_fk = 1;
--> statement-breakpoint
INSERT INTO `empresaMembros` (`empresaId`, `usuarioId`, `papel`, `ativo`)
SELECT @empresa_fk, `id`, 'proprietario', true FROM `users` WHERE `id` = 1
ON DUPLICATE KEY UPDATE `papel` = 'proprietario', `ativo` = true;
--> statement-breakpoint
ALTER TABLE `abastecimentosDiesel` ADD `empresaId` int;--> statement-breakpoint
ALTER TABLE `alertasFinanceiros` ADD `empresaId` int;--> statement-breakpoint
ALTER TABLE `anexosFinanceiros` ADD `empresaId` int;--> statement-breakpoint
ALTER TABLE `baixasFinanceiras` ADD `empresaId` int;--> statement-breakpoint
ALTER TABLE `bitolas` ADD `empresaId` int;--> statement-breakpoint
ALTER TABLE `categoriasFinanceiras` ADD `empresaId` int;--> statement-breakpoint
ALTER TABLE `clientes` ADD `empresaId` int;--> statement-breakpoint
ALTER TABLE `configuracoesFinanceiras` ADD `empresaId` int;--> statement-breakpoint
ALTER TABLE `contasFinanceiras` ADD `empresaId` int;--> statement-breakpoint
ALTER TABLE `empresaConfiguracoes` ADD `empresaId` int;--> statement-breakpoint
ALTER TABLE `extratosBancarios` ADD `empresaId` int;--> statement-breakpoint
ALTER TABLE `fornecedores` ADD `empresaId` int;--> statement-breakpoint
ALTER TABLE `historicoAlteracoes` ADD `empresaId` int;--> statement-breakpoint
ALTER TABLE `itensOrcamento` ADD `empresaId` int;--> statement-breakpoint
ALTER TABLE `itensRomaneioProducao` ADD `empresaId` int;--> statement-breakpoint
ALTER TABLE `itensRomaneioToras` ADD `empresaId` int;--> statement-breakpoint
ALTER TABLE `lotesPecasSerradas` ADD `empresaId` int;--> statement-breakpoint
ALTER TABLE `madeiras` ADD `empresaId` int;--> statement-breakpoint
ALTER TABLE `modelosMedidaVenda` ADD `empresaId` int;--> statement-breakpoint
ALTER TABLE `movimentacoesEstoqueSerrado` ADD `empresaId` int;--> statement-breakpoint
ALTER TABLE `movimentacoesPlaquetas` ADD `empresaId` int;--> statement-breakpoint
ALTER TABLE `movimentosExtratoBancario` ADD `empresaId` int;--> statement-breakpoint
ALTER TABLE `notasDiesel` ADD `empresaId` int;--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `empresaId` int;--> statement-breakpoint
ALTER TABLE `plaquetas` ADD `empresaId` int;--> statement-breakpoint
ALTER TABLE `recorrenciasFinanceiras` ADD `empresaId` int;--> statement-breakpoint
ALTER TABLE `romaneiosCargaToras` ADD `empresaId` int;--> statement-breakpoint
ALTER TABLE `romaneiosProducao` ADD `empresaId` int;--> statement-breakpoint
ALTER TABLE `sequenciasVendas` ADD `empresaId` int;--> statement-breakpoint
ALTER TABLE `titulosFinanceiros` ADD `empresaId` int;--> statement-breakpoint
UPDATE `abastecimentosDiesel` SET `empresaId` = @empresa_fk;--> statement-breakpoint
UPDATE `alertasFinanceiros` SET `empresaId` = @empresa_fk;--> statement-breakpoint
UPDATE `anexosFinanceiros` SET `empresaId` = @empresa_fk;--> statement-breakpoint
UPDATE `baixasFinanceiras` SET `empresaId` = @empresa_fk;--> statement-breakpoint
UPDATE `bitolas` SET `empresaId` = @empresa_fk;--> statement-breakpoint
UPDATE `categoriasFinanceiras` SET `empresaId` = @empresa_fk;--> statement-breakpoint
UPDATE `clientes` SET `empresaId` = @empresa_fk;--> statement-breakpoint
UPDATE `configuracoesFinanceiras` SET `empresaId` = @empresa_fk;--> statement-breakpoint
UPDATE `contasFinanceiras` SET `empresaId` = @empresa_fk;--> statement-breakpoint
UPDATE `empresaConfiguracoes` SET `empresaId` = @empresa_fk;--> statement-breakpoint
UPDATE `extratosBancarios` SET `empresaId` = @empresa_fk;--> statement-breakpoint
UPDATE `fornecedores` SET `empresaId` = @empresa_fk;--> statement-breakpoint
UPDATE `historicoAlteracoes` SET `empresaId` = @empresa_fk;--> statement-breakpoint
UPDATE `itensOrcamento` SET `empresaId` = @empresa_fk;--> statement-breakpoint
UPDATE `itensRomaneioProducao` SET `empresaId` = @empresa_fk;--> statement-breakpoint
UPDATE `itensRomaneioToras` SET `empresaId` = @empresa_fk;--> statement-breakpoint
UPDATE `lotesPecasSerradas` SET `empresaId` = @empresa_fk;--> statement-breakpoint
UPDATE `madeiras` SET `empresaId` = @empresa_fk;--> statement-breakpoint
UPDATE `modelosMedidaVenda` SET `empresaId` = @empresa_fk;--> statement-breakpoint
UPDATE `movimentacoesEstoqueSerrado` SET `empresaId` = @empresa_fk;--> statement-breakpoint
UPDATE `movimentacoesPlaquetas` SET `empresaId` = @empresa_fk;--> statement-breakpoint
UPDATE `movimentosExtratoBancario` SET `empresaId` = @empresa_fk;--> statement-breakpoint
UPDATE `notasDiesel` SET `empresaId` = @empresa_fk;--> statement-breakpoint
UPDATE `orcamentos` SET `empresaId` = @empresa_fk;--> statement-breakpoint
UPDATE `plaquetas` SET `empresaId` = @empresa_fk;--> statement-breakpoint
UPDATE `recorrenciasFinanceiras` SET `empresaId` = @empresa_fk;--> statement-breakpoint
UPDATE `romaneiosCargaToras` SET `empresaId` = @empresa_fk;--> statement-breakpoint
UPDATE `romaneiosProducao` SET `empresaId` = @empresa_fk;--> statement-breakpoint
UPDATE `sequenciasVendas` SET `empresaId` = @empresa_fk;--> statement-breakpoint
UPDATE `titulosFinanceiros` SET `empresaId` = @empresa_fk;--> statement-breakpoint
ALTER TABLE `abastecimentosDiesel` MODIFY `empresaId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `alertasFinanceiros` MODIFY `empresaId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `anexosFinanceiros` MODIFY `empresaId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `baixasFinanceiras` MODIFY `empresaId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `bitolas` MODIFY `empresaId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `categoriasFinanceiras` MODIFY `empresaId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `clientes` MODIFY `empresaId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `configuracoesFinanceiras` MODIFY `empresaId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `contasFinanceiras` MODIFY `empresaId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `empresaConfiguracoes` MODIFY `empresaId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `extratosBancarios` MODIFY `empresaId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `fornecedores` MODIFY `empresaId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `historicoAlteracoes` MODIFY `empresaId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `itensOrcamento` MODIFY `empresaId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `itensRomaneioProducao` MODIFY `empresaId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `itensRomaneioToras` MODIFY `empresaId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `lotesPecasSerradas` MODIFY `empresaId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `madeiras` MODIFY `empresaId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `modelosMedidaVenda` MODIFY `empresaId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `movimentacoesEstoqueSerrado` MODIFY `empresaId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `movimentacoesPlaquetas` MODIFY `empresaId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `movimentosExtratoBancario` MODIFY `empresaId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `notasDiesel` MODIFY `empresaId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `orcamentos` MODIFY `empresaId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `plaquetas` MODIFY `empresaId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `recorrenciasFinanceiras` MODIFY `empresaId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `romaneiosCargaToras` MODIFY `empresaId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `romaneiosProducao` MODIFY `empresaId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `sequenciasVendas` MODIFY `empresaId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `titulosFinanceiros` MODIFY `empresaId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `configuracoesFinanceiras` ADD CONSTRAINT `configuracoesFinanceiras_empresaId_unique` UNIQUE(`empresaId`);--> statement-breakpoint
ALTER TABLE `empresaConfiguracoes` ADD CONSTRAINT `empresaConfiguracoes_empresaId_unique` UNIQUE(`empresaId`);
