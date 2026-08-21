CREATE TABLE `taxasAdicionaisOrcamento` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`orcamentoId` int NOT NULL,
	`descricao` varchar(120) NOT NULL,
	`tipo` enum('percentual','fixo') NOT NULL DEFAULT 'percentual',
	`valor` decimal(12,4) NOT NULL,
	`calculado` decimal(12,2) NOT NULL DEFAULT '0',
	`ordem` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `taxasAdicionaisOrcamento_id` PRIMARY KEY(`id`)
);
