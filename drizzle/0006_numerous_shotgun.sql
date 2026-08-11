CREATE TABLE `baixasFinanceiras` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tituloId` int NOT NULL,
	`contaFinanceiraId` int NOT NULL,
	`valor` decimal(14,2) NOT NULL,
	`dataBaixa` timestamp NOT NULL,
	`formaPagamento` varchar(50) NOT NULL,
	`observacoes` text,
	`conciliada` boolean NOT NULL DEFAULT false,
	`conciliadaEm` timestamp,
	`criadoPor` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `baixasFinanceiras_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `categoriasFinanceiras` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(150) NOT NULL,
	`tipo` enum('receita','despesa','ambos') NOT NULL DEFAULT 'ambos',
	`categoriaPaiId` int,
	`ativo` boolean NOT NULL DEFAULT true,
	`criadoPor` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `categoriasFinanceiras_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `configuracoesFinanceiras` (
	`id` int NOT NULL,
	`alertaDiasAntecedencia` int NOT NULL DEFAULT 7,
	`alertaCronTaskUid` varchar(65),
	`ultimoProcessamentoEm` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `configuracoesFinanceiras_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contasFinanceiras` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(150) NOT NULL,
	`tipo` enum('caixa','banco','carteira','outro') NOT NULL DEFAULT 'caixa',
	`saldoInicial` decimal(14,2) NOT NULL DEFAULT '0',
	`ativa` boolean NOT NULL DEFAULT true,
	`observacoes` text,
	`criadoPor` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contasFinanceiras_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fornecedores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(300) NOT NULL,
	`contacto` varchar(100),
	`email` varchar(300),
	`documento` varchar(30),
	`endereco` text,
	`observacoes` text,
	`ativo` boolean NOT NULL DEFAULT true,
	`criadoPor` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fornecedores_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recorrenciasFinanceiras` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tipo` enum('receber','pagar') NOT NULL,
	`descricao` varchar(300) NOT NULL,
	`clienteId` int,
	`fornecedorId` int,
	`contraparteNome` varchar(300),
	`categoriaId` int NOT NULL,
	`contaFinanceiraId` int,
	`valor` decimal(14,2) NOT NULL,
	`frequencia` enum('semanal','mensal','trimestral','semestral','anual') NOT NULL,
	`proximoVencimento` timestamp NOT NULL,
	`dataFim` timestamp,
	`ativa` boolean NOT NULL DEFAULT true,
	`observacoes` text,
	`criadoPor` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `recorrenciasFinanceiras_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `titulosFinanceiros` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tipo` enum('receber','pagar') NOT NULL,
	`origem` enum('orcamento','manual','recorrencia') NOT NULL DEFAULT 'manual',
	`descricao` varchar(300) NOT NULL,
	`clienteId` int,
	`fornecedorId` int,
	`contraparteNome` varchar(300),
	`orcamentoId` int,
	`categoriaId` int NOT NULL,
	`recorrenciaId` int,
	`grupoParcelamento` varchar(64),
	`numeroParcela` int,
	`totalParcelas` int,
	`valorOriginal` decimal(14,2) NOT NULL,
	`desconto` decimal(14,2) NOT NULL DEFAULT '0',
	`juros` decimal(14,2) NOT NULL DEFAULT '0',
	`valorBaixado` decimal(14,2) NOT NULL DEFAULT '0',
	`dataEmissao` timestamp NOT NULL,
	`dataVencimento` timestamp NOT NULL,
	`estado` enum('aberto','parcial','quitado','vencido','cancelado') NOT NULL DEFAULT 'aberto',
	`observacoes` text,
	`canceladoEm` timestamp,
	`canceladoPor` int,
	`criadoPor` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `titulosFinanceiros_id` PRIMARY KEY(`id`)
);
