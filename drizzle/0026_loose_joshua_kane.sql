CREATE TABLE `extratosBancarios` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contaFinanceiraId` int NOT NULL,
	`nomeArquivo` varchar(300) NOT NULL,
	`formato` enum('csv','ofx') NOT NULL,
	`periodoInicial` timestamp,
	`periodoFinal` timestamp,
	`totalLinhas` int NOT NULL DEFAULT 0,
	`criadoPor` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `extratosBancarios_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `movimentosExtratoBancario` (
	`id` int AUTO_INCREMENT NOT NULL,
	`extratoId` int NOT NULL,
	`contaFinanceiraId` int NOT NULL,
	`dataMovimento` timestamp NOT NULL,
	`descricao` varchar(500) NOT NULL,
	`tipo` enum('entrada','saida') NOT NULL,
	`valor` decimal(14,2) NOT NULL,
	`identificadorExterno` varchar(300),
	`chaveUnica` varchar(180) NOT NULL,
	`estado` enum('pendente','conciliado','ignorado','divergente') NOT NULL DEFAULT 'pendente',
	`baixaFinanceiraId` int,
	`conciliadoEm` timestamp,
	`conciliadoPor` int,
	`observacoes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `movimentosExtratoBancario_id` PRIMARY KEY(`id`),
	CONSTRAINT `movimentosExtratoBancario_chaveUnica_unique` UNIQUE(`chaveUnica`),
	CONSTRAINT `movimentosExtratoBancario_baixaFinanceiraId_unique` UNIQUE(`baixaFinanceiraId`)
);
