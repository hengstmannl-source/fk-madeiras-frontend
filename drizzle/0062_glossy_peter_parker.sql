ALTER TABLE `users` ADD `papel` enum('proprietario','administrador','financeiro','rh','vendas','producao','consulta');--> statement-breakpoint
UPDATE `users` AS `u`
LEFT JOIN `empresaMembros` AS `em`
  ON `em`.`usuarioId` = `u`.`id` AND `em`.`ativo` = 1
SET `u`.`papel` = CASE
  WHEN `em`.`papel` IS NOT NULL THEN `em`.`papel`
  WHEN `u`.`role` = 'admin' THEN 'administrador'
  ELSE NULL
END;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `empresaAtivaId`;
