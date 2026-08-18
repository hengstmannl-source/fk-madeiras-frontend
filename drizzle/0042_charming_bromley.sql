CREATE TABLE `conferenciasVariacaoPlaquetas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`essencia` varchar(200) NOT NULL,
	`assinatura` varchar(255) NOT NULL,
	`confirmadoPor` int NOT NULL,
	`confirmadoEm` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conferenciasVariacaoPlaquetas_id` PRIMARY KEY(`id`),
	CONSTRAINT `conferencias_variacao_plaquetas_empresa_essencia_unica` UNIQUE(`empresaId`,`essencia`)
);
--> statement-breakpoint
CREATE INDEX `conferencias_variacao_plaquetas_empresa_indice` ON `conferenciasVariacaoPlaquetas` (`empresaId`);