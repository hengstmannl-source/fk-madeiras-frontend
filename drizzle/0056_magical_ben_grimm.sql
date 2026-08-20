CREATE TABLE `parcelasAdiantamentosRh` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaId` int NOT NULL,
	`adiantamentoId` int NOT NULL,
	`numero` int NOT NULL,
	`competencia` timestamp NOT NULL,
	`valor` decimal(14,2) NOT NULL,
	`estado` enum('pendente','descontada','cancelada') NOT NULL DEFAULT 'pendente',
	`folhaId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `parcelasAdiantamentosRh_id` PRIMARY KEY(`id`),
	CONSTRAINT `parcelas_adiantamentos_rh_numero_unico` UNIQUE(`adiantamentoId`,`numero`)
);
--> statement-breakpoint
CREATE INDEX `parcelas_adiantamentos_rh_competencia_indice` ON `parcelasAdiantamentosRh` (`empresaId`,`competencia`,`estado`);