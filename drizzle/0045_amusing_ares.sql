CREATE TABLE `aproveitamentosOrcamento` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`orcamentoId` int NOT NULL,
	`madeiraNome` varchar(200) NOT NULL,
	`volume` decimal(12,3) NOT NULL,
	`precoM3` decimal(12,2) NOT NULL,
	`valorTotal` decimal(12,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `aproveitamentosOrcamento_id` PRIMARY KEY(`id`)
);
