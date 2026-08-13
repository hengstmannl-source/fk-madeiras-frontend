CREATE TABLE `modelosMedidaVenda` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(120) NOT NULL,
	`madeiraId` int,
	`madeiraNome` varchar(200) NOT NULL,
	`precoM3` decimal(12,2) NOT NULL,
	`espessuraCm` decimal(8,2) NOT NULL,
	`larguraCm` decimal(8,2) NOT NULL,
	`comprimentos` text NOT NULL,
	`criadoPor` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `modelosMedidaVenda_id` PRIMARY KEY(`id`)
);
