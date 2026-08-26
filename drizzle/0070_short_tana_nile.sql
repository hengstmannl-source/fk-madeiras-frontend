CREATE TABLE `regularizacoesVolumePlaquetas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`plaquetaId` int NOT NULL,
	`romaneioProducaoId` int,
	`volumeAnterior` decimal(14,6) NOT NULL,
	`volumeConfirmado` decimal(14,6) NOT NULL,
	`justificativa` text NOT NULL,
	`criadoPor` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `regularizacoesVolumePlaquetas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `regularizacoes_volume_plaquetas_plaqueta_indice` ON `regularizacoesVolumePlaquetas` (`empresaId`,`plaquetaId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `regularizacoes_volume_plaquetas_romaneio_indice` ON `regularizacoesVolumePlaquetas` (`empresaId`,`romaneioProducaoId`);