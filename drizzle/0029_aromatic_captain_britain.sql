CREATE TABLE `convitesEmpresa` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`emailNormalizado` varchar(320) NOT NULL,
	`papel` enum('administrador','financeiro','vendas','producao','consulta') NOT NULL DEFAULT 'consulta',
	`tokenHash` varchar(128) NOT NULL,
	`expiraEm` timestamp NOT NULL,
	`aceitoEm` timestamp,
	`canceladoEm` timestamp,
	`convidadoPor` int NOT NULL,
	`aceitoPor` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `convitesEmpresa_id` PRIMARY KEY(`id`),
	CONSTRAINT `convitesEmpresa_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `credenciaisUsuarios` (
	`id` int AUTO_INCREMENT NOT NULL,
	`usuarioId` int NOT NULL,
	`emailNormalizado` varchar(320) NOT NULL,
	`senhaHash` varchar(500) NOT NULL,
	`senhaDefinidaEm` timestamp NOT NULL DEFAULT (now()),
	`tentativasFalhas` int NOT NULL DEFAULT 0,
	`bloqueadoAte` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `credenciaisUsuarios_id` PRIMARY KEY(`id`),
	CONSTRAINT `credenciaisUsuarios_usuarioId_unique` UNIQUE(`usuarioId`),
	CONSTRAINT `credenciaisUsuarios_emailNormalizado_unique` UNIQUE(`emailNormalizado`)
);
--> statement-breakpoint
CREATE TABLE `empresaMembros` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`usuarioId` int NOT NULL,
	`papel` enum('proprietario','administrador','financeiro','vendas','producao','consulta') NOT NULL DEFAULT 'consulta',
	`ativo` boolean NOT NULL DEFAULT true,
	`convidadoPor` int,
	`entrouEm` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `empresaMembros_id` PRIMARY KEY(`id`),
	CONSTRAINT `empresa_membros_empresa_usuario_unico` UNIQUE(`empresaId`,`usuarioId`)
);
--> statement-breakpoint
CREATE TABLE `empresas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(300) NOT NULL,
	`nomeFantasia` varchar(300),
	`documento` varchar(30),
	`email` varchar(320),
	`telefone` varchar(100),
	`ativa` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `empresas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recuperacoesSenha` (
	`id` int AUTO_INCREMENT NOT NULL,
	`usuarioId` int NOT NULL,
	`tokenHash` varchar(128) NOT NULL,
	`expiraEm` timestamp NOT NULL,
	`usadoEm` timestamp,
	`solicitadoEm` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `recuperacoesSenha_id` PRIMARY KEY(`id`),
	CONSTRAINT `recuperacoesSenha_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE INDEX `empresa_membros_empresa_indice` ON `empresaMembros` (`empresaId`);--> statement-breakpoint
CREATE INDEX `empresa_membros_usuario_indice` ON `empresaMembros` (`usuarioId`);