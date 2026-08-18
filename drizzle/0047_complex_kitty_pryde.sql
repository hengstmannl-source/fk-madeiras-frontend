CREATE TABLE `componentesPacoteOrcamento` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`itemOrcamentoId` int NOT NULL,
	`descricao` varchar(240) NOT NULL,
	`madeiraNome` varchar(200),
	`espessura` decimal(8,2),
	`largura` decimal(8,2),
	`comprimento` decimal(8,2),
	`quantidadePorPacote` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `componentesPacoteOrcamento_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `componentesProdutoComercial` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`produtoComercialId` int NOT NULL,
	`descricao` varchar(240) NOT NULL,
	`madeiraNome` varchar(200),
	`espessura` decimal(8,2),
	`largura` decimal(8,2),
	`comprimento` decimal(8,2),
	`quantidade` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `componentesProdutoComercial_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `produtosComerciais` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`nome` varchar(200) NOT NULL,
	`tipoComercializacao` enum('unidade','pacote') NOT NULL,
	`precoPadrao` decimal(12,2) NOT NULL,
	`ativo` boolean NOT NULL DEFAULT true,
	`observacoes` text,
	`criadoPor` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `produtosComerciais_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `itensOrcamento` ADD `produtoComercialId` int;--> statement-breakpoint
CREATE INDEX `produtosComerciais_empresa_ativo_idx` ON `produtosComerciais` (`empresaId`,`ativo`);