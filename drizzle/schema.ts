import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const madeiras = mysqlTable("madeiras", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 200 }).notNull(),
  descricao: text("descricao"),
  precoM3: decimal("precoM3", { precision: 12, scale: 2 }).notNull().default("0"),
  unidadeMedida: varchar("unidadeMedida", { length: 20 }).notNull().default("m³"),
  ativo: boolean("ativo").notNull().default(true),
  criadoPor: int("criadoPor"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Madeira = typeof madeiras.$inferSelect;
export type InsertMadeira = typeof madeiras.$inferInsert;

export const bitolas = mysqlTable("bitolas", {
  id: int("id").autoincrement().primaryKey(),
  madeiraId: int("madeiraId").notNull(),
  espessura: decimal("espessura", { precision: 8, scale: 2 }).notNull(),
  largura: decimal("largura", { precision: 8, scale: 2 }).notNull(),
  comprimento: decimal("comprimento", { precision: 8, scale: 2 }),
  descricao: text("descricao"),
  criadoPor: int("criadoPor"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Bitola = typeof bitolas.$inferSelect;
export type InsertBitola = typeof bitolas.$inferInsert;

export const clientes = mysqlTable("clientes", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 300 }).notNull(),
  contacto: varchar("contacto", { length: 100 }),
  email: varchar("email", { length: 300 }),
  morada: text("morada"),
  nif: varchar("nif", { length: 20 }),
  observacoes: text("observacoes"),
  ativo: boolean("ativo").notNull().default(true),
  criadoPor: int("criadoPor"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Cliente = typeof clientes.$inferSelect;
export type InsertCliente = typeof clientes.$inferInsert;

export const orcamentos = mysqlTable("orcamentos", {
  id: int("id").autoincrement().primaryKey(),
  numero: varchar("numero", { length: 20 }).unique(),
  clienteId: int("clienteId").notNull(),
  estado: mysqlEnum("estado", ["rascunho", "enviado", "aprovado", "rejeitado"]).notNull().default("rascunho"),
  desconto: decimal("desconto", { precision: 12, scale: 2 }).notNull().default("0"),
  frete: decimal("frete", { precision: 12, scale: 2 }).notNull().default("0"),
  subtotal: decimal("subtotal", { precision: 14, scale: 2 }).notNull().default("0"),
  total: decimal("total", { precision: 14, scale: 2 }).notNull().default("0"),
  totalPecas: int("totalPecas").notNull().default(0),
  totalMetroLinear: decimal("totalMetroLinear", { precision: 14, scale: 4 }).notNull().default("0"),
  totalVolume: decimal("totalVolume", { precision: 14, scale: 6 }).notNull().default("0"),
  observacoes: text("observacoes"),
  vendedor: varchar("vendedor", { length: 200 }),
  criadoPor: int("criadoPor"),
  dataValidade: timestamp("dataValidade"),
  dataVencimento: timestamp("dataVencimento"),
  competencia: timestamp("competencia"),
  pago: boolean("pago").notNull().default(false),
  pagoEm: timestamp("pagoEm"),
  formaPagamento: varchar("formaPagamento", { length: 50 }),
  pagoPor: int("pagoPor"),
  entregue: boolean("entregue").notNull().default(false),
  entregueEm: timestamp("entregueEm"),
  entreguePor: int("entreguePor"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Orcamento = typeof orcamentos.$inferSelect;
export type InsertOrcamento = typeof orcamentos.$inferInsert;

/** Sequência imutável usada exclusivamente para numerar vendas aprovadas. */
export const sequenciasVendas = mysqlTable("sequenciasVendas", {
  id: int("id").autoincrement().primaryKey(),
  orcamentoId: int("orcamentoId").notNull().unique(),
  numero: varchar("numero", { length: 20 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SequenciaVenda = typeof sequenciasVendas.$inferSelect;

export const itensOrcamento = mysqlTable("itensOrcamento", {
  id: int("id").autoincrement().primaryKey(),
  orcamentoId: int("orcamentoId").notNull(),
  madeiraId: int("madeiraId"),
  bitolaId: int("bitolaId"),
  madeiraNome: varchar("madeiraNome", { length: 200 }).notNull(),
  bitolaDescricao: varchar("bitolaDescricao", { length: 200 }).notNull(),
  espessura: decimal("espessura", { precision: 8, scale: 2 }).notNull(),
  largura: decimal("largura", { precision: 8, scale: 2 }).notNull(),
  comprimento: decimal("comprimento", { precision: 8, scale: 2 }).notNull(),
  quantidade: int("quantidade").notNull(),
  precoM3: decimal("precoM3", { precision: 12, scale: 2 }).notNull(),
  precoLinear: decimal("precoLinear", { precision: 12, scale: 4 }).notNull(),
  valorPeca: decimal("valorPeca", { precision: 12, scale: 2 }).notNull(),
  valorTotal: decimal("valorTotal", { precision: 12, scale: 2 }).notNull(),
});

export type ItemOrcamento = typeof itensOrcamento.$inferSelect;
export type InsertItemOrcamento = typeof itensOrcamento.$inferInsert;

export const historicoAlteracoes = mysqlTable("historicoAlteracoes", {
  id: int("id").autoincrement().primaryKey(),
  orcamentoId: int("orcamentoId").notNull(),
  usuarioId: int("usuarioId").notNull(),
  tipo: mysqlEnum("tipo", ["criacao", "alteracao", "exclusao", "estado"]).notNull(),
  detalhes: text("detalhes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type HistoricoAlteracao = typeof historicoAlteracoes.$inferSelect;

export const empresaConfiguracoes = mysqlTable("empresaConfiguracoes", {
  /** Registo único da empresa, sempre persistido com id 1. */
  id: int("id").primaryKey(),
  logoKey: varchar("logoKey", { length: 500 }),
  logoUrl: varchar("logoUrl", { length: 700 }),
  logoMimeType: varchar("logoMimeType", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EmpresaConfiguracao = typeof empresaConfiguracoes.$inferSelect;
export type InsertEmpresaConfiguracao = typeof empresaConfiguracoes.$inferInsert;

// ─── Produção e estoque de madeira serrada ───
export const romaneiosCargaToras = mysqlTable("romaneiosCargaToras", {
  id: int("id").autoincrement().primaryKey(),
  numero: varchar("numero", { length: 30 }).notNull().unique(),
  dataCarga: timestamp("dataCarga").notNull(),
  origem: varchar("origem", { length: 200 }),
  responsavel: varchar("responsavel", { length: 200 }),
  observacoes: text("observacoes"),
  totalPlaquetas: int("totalPlaquetas").notNull().default(0),
  volumeTotal: decimal("volumeTotal", { precision: 14, scale: 6 }).notNull().default("0"),
  valorProdutos: decimal("valorProdutos", { precision: 14, scale: 2 }).notNull().default("0"),
  fretePorMetroCubico: decimal("fretePorMetroCubico", { precision: 14, scale: 2 }).notNull().default("0"),
  frete: decimal("frete", { precision: 14, scale: 2 }).notNull().default("0"),
  valorTotal: decimal("valorTotal", { precision: 14, scale: 2 }).notNull().default("0"),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type RomaneioCargaToras = typeof romaneiosCargaToras.$inferSelect;

export const plaquetas = mysqlTable("plaquetas", {
  id: int("id").autoincrement().primaryKey(),
  codigo: varchar("codigo", { length: 80 }).notNull().unique(),
  madeiraNome: varchar("madeiraNome", { length: 200 }).notNull(),
  espessura: decimal("espessura", { precision: 8, scale: 2 }),
  largura: decimal("largura", { precision: 8, scale: 2 }),
  comprimento: decimal("comprimento", { precision: 8, scale: 2 }),
  diametro: decimal("diametro", { precision: 8, scale: 2 }),
  volumeInicial: decimal("volumeInicial", { precision: 14, scale: 6 }).notNull(),
  volumeDisponivel: decimal("volumeDisponivel", { precision: 14, scale: 6 }).notNull(),
  valorMetroCubico: decimal("valorMetroCubico", { precision: 14, scale: 2 }).notNull().default("0"),
  valorTotal: decimal("valorTotal", { precision: 14, scale: 2 }).notNull().default("0"),
  dataEntrada: timestamp("dataEntrada").notNull(),
  romaneioCargaId: int("romaneioCargaId"),
  origem: varchar("origem", { length: 200 }),
  localizacao: varchar("localizacao", { length: 200 }),
  observacoes: text("observacoes"),
  estado: mysqlEnum("estado", ["disponivel", "consumida", "cancelada"]).notNull().default("disponivel"),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Plaqueta = typeof plaquetas.$inferSelect;
export type InsertPlaqueta = typeof plaquetas.$inferInsert;

export const romaneiosProducao = mysqlTable("romaneiosProducao", {
  id: int("id").autoincrement().primaryKey(),
  numero: varchar("numero", { length: 30 }).notNull().unique(),
  plaquetaId: int("plaquetaId"),
  totalToras: int("totalToras").notNull().default(1),
  madeiraTora: varchar("madeiraTora", { length: 200 }),
  espessuraTora: decimal("espessuraTora", { precision: 8, scale: 2 }),
  larguraTora: decimal("larguraTora", { precision: 8, scale: 2 }),
  comprimentoTora: decimal("comprimentoTora", { precision: 8, scale: 2 }),
  volumeTora: decimal("volumeTora", { precision: 14, scale: 6 }),
  aproveitamento: decimal("aproveitamento", { precision: 8, scale: 2 }),
  dataProducao: timestamp("dataProducao").notNull(),
  fita: varchar("fita", { length: 100 }),
  responsavel: varchar("responsavel", { length: 200 }),
  observacoes: text("observacoes"),
  estado: mysqlEnum("estado", ["rascunho", "confirmado", "cancelado"]).notNull().default("rascunho"),
  confirmadoEm: timestamp("confirmadoEm"),
  confirmadoPor: int("confirmadoPor"),
  canceladoEm: timestamp("canceladoEm"),
  canceladoPor: int("canceladoPor"),
  motivoCancelamento: text("motivoCancelamento"),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type RomaneioProducao = typeof romaneiosProducao.$inferSelect;
export type InsertRomaneioProducao = typeof romaneiosProducao.$inferInsert;

export const itensRomaneioToras = mysqlTable("itensRomaneioToras", {
  id: int("id").autoincrement().primaryKey(),
  romaneioId: int("romaneioId").notNull(),
  plaquetaId: int("plaquetaId").notNull().unique(),
  madeiraNome: varchar("madeiraNome", { length: 200 }).notNull(),
  diametro: decimal("diametro", { precision: 8, scale: 2 }),
  comprimento: decimal("comprimento", { precision: 8, scale: 2 }),
  volume: decimal("volume", { precision: 14, scale: 6 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ItemRomaneioTora = typeof itensRomaneioToras.$inferSelect;
export type InsertItemRomaneioTora = typeof itensRomaneioToras.$inferInsert;

export const itensRomaneioProducao = mysqlTable("itensRomaneioProducao", {
  id: int("id").autoincrement().primaryKey(),
  romaneioId: int("romaneioId").notNull(),
  madeiraNome: varchar("madeiraNome", { length: 200 }).notNull(),
  espessura: decimal("espessura", { precision: 8, scale: 2 }).notNull(),
  largura: decimal("largura", { precision: 8, scale: 2 }).notNull(),
  comprimento: decimal("comprimento", { precision: 8, scale: 2 }).notNull(),
  quantidade: int("quantidade").notNull(),
  metrosLineares: decimal("metrosLineares", { precision: 14, scale: 4 }).notNull(),
  volume: decimal("volume", { precision: 14, scale: 6 }).notNull(),
  observacoes: text("observacoes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ItemRomaneioProducao = typeof itensRomaneioProducao.$inferSelect;
export type InsertItemRomaneioProducao = typeof itensRomaneioProducao.$inferInsert;

export const lotesPecasSerradas = mysqlTable("lotesPecasSerradas", {
  id: int("id").autoincrement().primaryKey(),
  romaneioId: int("romaneioId").notNull(),
  itemRomaneioId: int("itemRomaneioId").notNull().unique(),
  madeiraNome: varchar("madeiraNome", { length: 200 }).notNull(),
  espessura: decimal("espessura", { precision: 8, scale: 2 }).notNull(),
  largura: decimal("largura", { precision: 8, scale: 2 }).notNull(),
  comprimento: decimal("comprimento", { precision: 8, scale: 2 }).notNull(),
  quantidadeProduzida: int("quantidadeProduzida").notNull(),
  quantidadeDisponivel: int("quantidadeDisponivel").notNull(),
  metrosLineares: decimal("metrosLineares", { precision: 14, scale: 4 }).notNull(),
  volume: decimal("volume", { precision: 14, scale: 6 }).notNull(),
  estado: mysqlEnum("estado", ["disponivel", "esgotado", "cancelado"]).notNull().default("disponivel"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LotePecasSerradas = typeof lotesPecasSerradas.$inferSelect;
export type InsertLotePecasSerradas = typeof lotesPecasSerradas.$inferInsert;

export const movimentacoesPlaquetas = mysqlTable("movimentacoesPlaquetas", {
  id: int("id").autoincrement().primaryKey(),
  plaquetaId: int("plaquetaId").notNull(),
  romaneioId: int("romaneioId"),
  tipo: mysqlEnum("tipo", ["entrada", "consumo", "estorno", "ajuste"]).notNull(),
  volume: decimal("volume", { precision: 14, scale: 6 }).notNull(),
  motivo: text("motivo"),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MovimentacaoPlaqueta = typeof movimentacoesPlaquetas.$inferSelect;

export const movimentacoesEstoqueSerrado = mysqlTable("movimentacoesEstoqueSerrado", {
  id: int("id").autoincrement().primaryKey(),
  loteId: int("loteId").notNull(),
  itemVendaId: int("itemVendaId"),
  tipo: mysqlEnum("tipo", ["entrada_producao", "saida_entrega", "estorno_entrega", "ajuste"]).notNull(),
  quantidade: int("quantidade").notNull(),
  motivo: text("motivo"),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MovimentacaoEstoqueSerrado = typeof movimentacoesEstoqueSerrado.$inferSelect;

// ─── Financeiro ───
export const fornecedores = mysqlTable("fornecedores", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 300 }).notNull(),
  contacto: varchar("contacto", { length: 100 }),
  email: varchar("email", { length: 300 }),
  documento: varchar("documento", { length: 30 }),
  endereco: text("endereco"),
  observacoes: text("observacoes"),
  ativo: boolean("ativo").notNull().default(true),
  criadoPor: int("criadoPor"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Fornecedor = typeof fornecedores.$inferSelect;
export type InsertFornecedor = typeof fornecedores.$inferInsert;

export const categoriasFinanceiras = mysqlTable("categoriasFinanceiras", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 150 }).notNull(),
  tipo: mysqlEnum("tipo", ["receita", "despesa", "ambos"]).notNull().default("ambos"),
  categoriaPaiId: int("categoriaPaiId"),
  ativo: boolean("ativo").notNull().default(true),
  criadoPor: int("criadoPor"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CategoriaFinanceira = typeof categoriasFinanceiras.$inferSelect;
export type InsertCategoriaFinanceira = typeof categoriasFinanceiras.$inferInsert;

export const contasFinanceiras = mysqlTable("contasFinanceiras", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 150 }).notNull(),
  tipo: mysqlEnum("tipo", ["caixa", "banco", "carteira", "outro"]).notNull().default("caixa"),
  saldoInicial: decimal("saldoInicial", { precision: 14, scale: 2 }).notNull().default("0"),
  ativa: boolean("ativa").notNull().default(true),
  observacoes: text("observacoes"),
  criadoPor: int("criadoPor"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ContaFinanceira = typeof contasFinanceiras.$inferSelect;
export type InsertContaFinanceira = typeof contasFinanceiras.$inferInsert;

export const titulosFinanceiros = mysqlTable("titulosFinanceiros", {
  id: int("id").autoincrement().primaryKey(),
  tipo: mysqlEnum("tipo", ["receber", "pagar"]).notNull(),
  origem: mysqlEnum("origem", ["orcamento", "manual", "recorrencia"]).notNull().default("manual"),
  chaveImportacao: varchar("chaveImportacao", { length: 120 }).unique(),
  descricao: varchar("descricao", { length: 300 }).notNull(),
  clienteId: int("clienteId"),
  fornecedorId: int("fornecedorId"),
  contraparteNome: varchar("contraparteNome", { length: 300 }),
  orcamentoId: int("orcamentoId"),
  categoriaId: int("categoriaId").notNull(),
  recorrenciaId: int("recorrenciaId"),
  grupoParcelamento: varchar("grupoParcelamento", { length: 64 }),
  numeroParcela: int("numeroParcela"),
  totalParcelas: int("totalParcelas"),
  valorOriginal: decimal("valorOriginal", { precision: 14, scale: 2 }).notNull(),
  desconto: decimal("desconto", { precision: 14, scale: 2 }).notNull().default("0"),
  juros: decimal("juros", { precision: 14, scale: 2 }).notNull().default("0"),
  valorBaixado: decimal("valorBaixado", { precision: 14, scale: 2 }).notNull().default("0"),
  dataEmissao: timestamp("dataEmissao").notNull(),
  dataVencimento: timestamp("dataVencimento").notNull(),
  competencia: timestamp("competencia"),
  estado: mysqlEnum("estado", ["aberto", "parcial", "quitado", "vencido", "cancelado"]).notNull().default("aberto"),
  observacoes: text("observacoes"),
  canceladoEm: timestamp("canceladoEm"),
  canceladoPor: int("canceladoPor"),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TituloFinanceiro = typeof titulosFinanceiros.$inferSelect;
export type InsertTituloFinanceiro = typeof titulosFinanceiros.$inferInsert;

export const baixasFinanceiras = mysqlTable("baixasFinanceiras", {
  id: int("id").autoincrement().primaryKey(),
  tituloId: int("tituloId").notNull(),
  contaFinanceiraId: int("contaFinanceiraId").notNull(),
  valor: decimal("valor", { precision: 14, scale: 2 }).notNull(),
  dataBaixa: timestamp("dataBaixa").notNull(),
  formaPagamento: varchar("formaPagamento", { length: 50 }).notNull(),
  observacoes: text("observacoes"),
  conciliada: boolean("conciliada").notNull().default(false),
  conciliadaEm: timestamp("conciliadaEm"),
  estornada: boolean("estornada").notNull().default(false),
  estornadaEm: timestamp("estornadaEm"),
  estornadaPor: int("estornadaPor"),
  motivoEstorno: text("motivoEstorno"),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BaixaFinanceira = typeof baixasFinanceiras.$inferSelect;
export type InsertBaixaFinanceira = typeof baixasFinanceiras.$inferInsert;

export const recorrenciasFinanceiras = mysqlTable("recorrenciasFinanceiras", {
  id: int("id").autoincrement().primaryKey(),
  tipo: mysqlEnum("tipo", ["receber", "pagar"]).notNull(),
  descricao: varchar("descricao", { length: 300 }).notNull(),
  clienteId: int("clienteId"),
  fornecedorId: int("fornecedorId"),
  contraparteNome: varchar("contraparteNome", { length: 300 }),
  categoriaId: int("categoriaId").notNull(),
  contaFinanceiraId: int("contaFinanceiraId"),
  valor: decimal("valor", { precision: 14, scale: 2 }).notNull(),
  frequencia: mysqlEnum("frequencia", ["semanal", "mensal", "trimestral", "semestral", "anual"]).notNull(),
  proximoVencimento: timestamp("proximoVencimento").notNull(),
  dataFim: timestamp("dataFim"),
  ativa: boolean("ativa").notNull().default(true),
  observacoes: text("observacoes"),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type RecorrenciaFinanceira = typeof recorrenciasFinanceiras.$inferSelect;
export type InsertRecorrenciaFinanceira = typeof recorrenciasFinanceiras.$inferInsert;

export const configuracoesFinanceiras = mysqlTable("configuracoesFinanceiras", {
  id: int("id").primaryKey(),
  alertaDiasAntecedencia: int("alertaDiasAntecedencia").notNull().default(7),
  alertaCronTaskUid: varchar("alertaCronTaskUid", { length: 65 }),
  ultimoProcessamentoEm: timestamp("ultimoProcessamentoEm"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ConfiguracaoFinanceira = typeof configuracoesFinanceiras.$inferSelect;

export const alertasFinanceiros = mysqlTable("alertasFinanceiros", {
  id: int("id").autoincrement().primaryKey(),
  tituloId: int("tituloId").notNull(),
  tipo: mysqlEnum("tipo", ["vence_em_breve", "vencido"]).notNull(),
  mensagem: varchar("mensagem", { length: 500 }).notNull(),
  estado: mysqlEnum("estado", ["ativo", "resolvido"]).notNull().default("ativo"),
  criadoEm: timestamp("criadoEm").defaultNow().notNull(),
  resolvidoEm: timestamp("resolvidoEm"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AlertaFinanceiro = typeof alertasFinanceiros.$inferSelect;
export type InsertAlertaFinanceiro = typeof alertasFinanceiros.$inferInsert;
