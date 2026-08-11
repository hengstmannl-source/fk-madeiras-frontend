CREATE TABLE `empresaConfiguracoes` (
	`id` int NOT NULL,
	`logoKey` varchar(500),
	`logoUrl` varchar(700),
	`logoMimeType` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `empresaConfiguracoes_id` PRIMARY KEY(`id`)
);
