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
  numero: varchar("numero", { length: 20 }).notNull().unique(),
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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Orcamento = typeof orcamentos.$inferSelect;
export type InsertOrcamento = typeof orcamentos.$inferInsert;

export const itensOrcamento = mysqlTable("itensOrcamento", {
  id: int("id").autoincrement().primaryKey(),
  orcamentoId: int("orcamentoId").notNull(),
  madeiraId: int("madeiraId").notNull(),
  bitolaId: int("bitolaId").notNull(),
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
