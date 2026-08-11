ALTER TABLE `baixasFinanceiras` ADD `estornada` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `baixasFinanceiras` ADD `estornadaEm` timestamp;--> statement-breakpoint
ALTER TABLE `baixasFinanceiras` ADD `estornadaPor` int;--> statement-breakpoint
ALTER TABLE `baixasFinanceiras` ADD `motivoEstorno` text;