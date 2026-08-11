CREATE TABLE `alertasFinanceiros` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tituloId` int NOT NULL,
	`tipo` enum('vence_em_breve','vencido') NOT NULL,
	`mensagem` varchar(500) NOT NULL,
	`estado` enum('ativo','resolvido') NOT NULL DEFAULT 'ativo',
	`criadoEm` timestamp NOT NULL DEFAULT (now()),
	`resolvidoEm` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `alertasFinanceiros_id` PRIMARY KEY(`id`)
);
