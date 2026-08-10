CREATE TABLE `bitolas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`madeiraId` int NOT NULL,
	`espessura` decimal(8,2) NOT NULL,
	`largura` decimal(8,2) NOT NULL,
	`comprimento` decimal(8,2),
	`descricao` text,
	`criadoPor` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bitolas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clientes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(300) NOT NULL,
	`contacto` varchar(100),
	`email` varchar(300),
	`morada` text,
	`nif` varchar(20),
	`observacoes` text,
	`ativo` boolean NOT NULL DEFAULT true,
	`criadoPor` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clientes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `historicoAlteracoes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orcamentoId` int NOT NULL,
	`usuarioId` int NOT NULL,
	`tipo` enum('criacao','alteracao','exclusao','estado') NOT NULL,
	`detalhes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `historicoAlteracoes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `itensOrcamento` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orcamentoId` int NOT NULL,
	`madeiraId` int NOT NULL,
	`bitolaId` int NOT NULL,
	`madeiraNome` varchar(200) NOT NULL,
	`bitolaDescricao` varchar(200) NOT NULL,
	`espessura` decimal(8,2) NOT NULL,
	`largura` decimal(8,2) NOT NULL,
	`comprimento` decimal(8,2) NOT NULL,
	`quantidade` int NOT NULL,
	`precoM3` decimal(12,2) NOT NULL,
	`precoLinear` decimal(12,4) NOT NULL,
	`valorPeca` decimal(12,2) NOT NULL,
	`valorTotal` decimal(12,2) NOT NULL,
	CONSTRAINT `itensOrcamento_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `madeiras` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(200) NOT NULL,
	`descricao` text,
	`precoM3` decimal(12,2) NOT NULL DEFAULT '0',
	`unidadeMedida` varchar(20) NOT NULL DEFAULT 'm³',
	`ativo` boolean NOT NULL DEFAULT true,
	`criadoPor` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `madeiras_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orcamentos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`numero` varchar(20) NOT NULL,
	`clienteId` int NOT NULL,
	`estado` enum('rascunho','enviado','aprovado','rejeitado') NOT NULL DEFAULT 'rascunho',
	`desconto` decimal(12,2) NOT NULL DEFAULT '0',
	`frete` decimal(12,2) NOT NULL DEFAULT '0',
	`subtotal` decimal(14,2) NOT NULL DEFAULT '0',
	`total` decimal(14,2) NOT NULL DEFAULT '0',
	`totalPecas` int NOT NULL DEFAULT 0,
	`totalMetroLinear` decimal(14,4) NOT NULL DEFAULT '0',
	`totalVolume` decimal(14,6) NOT NULL DEFAULT '0',
	`observacoes` text,
	`vendedor` varchar(200),
	`criadoPor` int,
	`dataValidade` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orcamentos_id` PRIMARY KEY(`id`),
	CONSTRAINT `orcamentos_numero_unique` UNIQUE(`numero`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
