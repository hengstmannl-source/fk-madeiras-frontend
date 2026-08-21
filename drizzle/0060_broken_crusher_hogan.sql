CREATE TABLE `sequenciasDocumentos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`tipo` enum('venda','romaneio_entrada') NOT NULL,
	`ultimoNumero` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sequenciasDocumentos_id` PRIMARY KEY(`id`),
	CONSTRAINT `sequenciasDocumentos_empresa_tipo_unq` UNIQUE(`empresaId`,`tipo`)
);
