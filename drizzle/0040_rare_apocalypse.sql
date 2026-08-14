CREATE TABLE `itensRetiradaSerragemTerceiros` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`retiradaId` int NOT NULL,
	`loteId` int NOT NULL,
	`quantidade` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `itensRetiradaSerragemTerceiros_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `retiradasSerragemTerceiros` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`serragemId` int NOT NULL,
	`clienteId` int NOT NULL,
	`dataRetirada` timestamp NOT NULL,
	`responsavel` varchar(200),
	`observacoes` text,
	`criadoPor` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `retiradasSerragemTerceiros_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `movimentacoesEstoqueSerrado` MODIFY COLUMN `tipo` enum('entrada_producao','saida_entrega','estorno_entrega','retirada_terceiro','ajuste') NOT NULL;--> statement-breakpoint
CREATE INDEX `itens_retirada_serragem_terceiros_retirada_indice` ON `itensRetiradaSerragemTerceiros` (`empresaId`,`retiradaId`);--> statement-breakpoint
CREATE INDEX `itens_retirada_serragem_terceiros_lote_indice` ON `itensRetiradaSerragemTerceiros` (`empresaId`,`loteId`);--> statement-breakpoint
CREATE INDEX `retiradas_serragem_terceiros_serragem_indice` ON `retiradasSerragemTerceiros` (`empresaId`,`serragemId`);