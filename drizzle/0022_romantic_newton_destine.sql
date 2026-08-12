ALTER TABLE `lotesPecasSerradas` MODIFY COLUMN `romaneioId` int;--> statement-breakpoint
ALTER TABLE `lotesPecasSerradas` MODIFY COLUMN `romaneioId` int;--> statement-breakpoint
ALTER TABLE `lotesPecasSerradas` MODIFY COLUMN `itemRomaneioId` int;--> statement-breakpoint
ALTER TABLE `lotesPecasSerradas` MODIFY COLUMN `estado` enum('disponivel','esgotado','cancelado','negativo') NOT NULL DEFAULT 'disponivel';
