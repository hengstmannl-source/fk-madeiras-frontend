import { eq, and, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users, madeiras, bitolas, clientes,
  orcamentos, itensOrcamento, historicoAlteracoes, empresaConfiguracoes,
  fornecedores, categoriasFinanceiras, contasFinanceiras, titulosFinanceiros,
  baixasFinanceiras, recorrenciasFinanceiras, configuracoesFinanceiras,
  type InsertMadeira, type InsertBitola, type InsertCliente,
  type InsertOrcamento, type InsertItemOrcamento, type InsertFornecedor,
  type InsertCategoriaFinanceira, type InsertContaFinanceira,
  type InsertTituloFinanceiro, type InsertBaixaFinanceira, type InsertRecorrenciaFinanceira,
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { calcularEstadoTitulo, decimalParaNumero, proximoVencimento, saldoAbertoTitulo } from "./financeiro.logic";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ───
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      values[field] = value ?? null;
      updateSet[field] = value ?? null;
    };
    textFields.forEach(assignNullable);
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!user.lastSignedIn) values.lastSignedIn = new Date();
    if (!updateSet.lastSignedIn && !user.lastSignedIn) updateSet.lastSignedIn = new Date();
    if (user.lastSignedIn) updateSet.lastSignedIn = user.lastSignedIn;
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Madeiras ───
export async function listMadeiras() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(madeiras).orderBy(desc(madeiras.createdAt));
}

export async function getMadeiraById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(madeiras).where(eq(madeiras.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createMadeira(data: InsertMadeira) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(madeiras).values(data);
  return result;
}

export async function updateMadeira(id: number, data: Partial<InsertMadeira>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(madeiras).set(data).where(eq(madeiras.id, id));
  return { success: true };
}

export async function deleteMadeira(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(madeiras).set({ ativo: false }).where(eq(madeiras.id, id));
  return { success: true };
}

// ─── Bitolas ───
export async function listBitolas(madeiraId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (madeiraId) {
    return db.select().from(bitolas).where(eq(bitolas.madeiraId, madeiraId)).orderBy(desc(bitolas.createdAt));
  }
  return db.select().from(bitolas).orderBy(desc(bitolas.createdAt));
}

export async function getBitolaById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(bitolas).where(eq(bitolas.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createBitola(data: InsertBitola) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(bitolas).values(data);
  return result;
}

export async function updateBitola(id: number, data: Partial<InsertBitola>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(bitolas).set(data).where(eq(bitolas.id, id));
  return { success: true };
}

export async function deleteBitola(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(bitolas).where(eq(bitolas.id, id));
  return { success: true };
}

// ─── Clientes ───
export async function listClientes() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(clientes).where(eq(clientes.ativo, true)).orderBy(desc(clientes.createdAt));
}

export async function listAllClientes() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(clientes).orderBy(desc(clientes.createdAt));
}

export async function getClienteById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(clientes).where(eq(clientes.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

type MysqlInsertResult = readonly [{ insertId?: number | bigint }, unknown];

/** Extrai o ID devolvido pelo mysql2, cuja resposta é [ResultSetHeader, fields]. */
export function getInsertedId(result: MysqlInsertResult): number {
  const id = Number(result[0]?.insertId ?? 0);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("A criação do registo não devolveu um identificador válido");
  }
  return id;
}

export async function createCliente(data: InsertCliente) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(clientes).values(data);
  return { id: getInsertedId(result as MysqlInsertResult) };
}

export async function updateCliente(id: number, data: Partial<InsertCliente>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(clientes).set(data).where(eq(clientes.id, id));
  return { success: true };
}

export async function deleteCliente(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(clientes).set({ ativo: false }).where(eq(clientes.id, id));
  return { success: true };
}

// ─── Configuração da Empresa ───
export async function getEmpresaConfiguracao() {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(empresaConfiguracoes).where(eq(empresaConfiguracoes.id, 1)).limit(1);
  return result[0];
}

export async function saveEmpresaLogo(logo: { key: string; url: string; mimeType: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(empresaConfiguracoes).values({
    id: 1,
    logoKey: logo.key,
    logoUrl: logo.url,
    logoMimeType: logo.mimeType,
  }).onDuplicateKeyUpdate({
    set: {
      logoKey: logo.key,
      logoUrl: logo.url,
      logoMimeType: logo.mimeType,
    },
  });
  return getEmpresaConfiguracao();
}

export async function clearEmpresaLogo() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(empresaConfiguracoes).values({ id: 1 }).onDuplicateKeyUpdate({
    set: { logoKey: null, logoUrl: null, logoMimeType: null },
  });
  return getEmpresaConfiguracao();
}

// ─── Orçamentos ───
export async function listOrcamentos(filters?: { estado?: string; clienteId?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.estado) conditions.push(eq(orcamentos.estado, filters.estado as any));
  if (filters?.clienteId) conditions.push(eq(orcamentos.clienteId, filters.clienteId));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select().from(orcamentos).where(where).orderBy(desc(orcamentos.createdAt));
}

export async function getOrcamentoWithItems(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const orc = await db.select().from(orcamentos).where(eq(orcamentos.id, id)).limit(1);
  if (orc.length === 0) return undefined;
  const itens = await db.select().from(itensOrcamento).where(eq(itensOrcamento.orcamentoId, id));
  return { orcamento: orc[0], itens };
}

export function podeAlterarOrcamentoPago(pago: boolean, confirmacaoDupla: boolean) {
  return !pago || confirmacaoDupla;
}

export async function getOrcamentoById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(orcamentos).where(eq(orcamentos.id, id)).limit(1);
  return result[0];
}

async function validarAlteracaoOrcamento(id: number, confirmacaoDupla = false) {
  const orcamento = await getOrcamentoById(id);
  if (!orcamento) throw new Error("Orçamento não encontrado");
  if (!podeAlterarOrcamentoPago(orcamento.pago, confirmacaoDupla)) {
    throw new Error("Orçamento pago está bloqueado. Confirme duas vezes para prosseguir.");
  }
  return orcamento;
}

export async function createOrcamento(data: InsertOrcamento, itens: Partial<InsertItemOrcamento>[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(orcamentos).values(data);
  const orcId = result[0].insertId;
  if (itens.length > 0) {
    const itensWithOrcId: InsertItemOrcamento[] = itens.map((i): InsertItemOrcamento => ({
      orcamentoId: orcId,
      madeiraId: i.madeiraId ?? null,
      bitolaId: i.bitolaId!,
      madeiraNome: i.madeiraNome!,
      bitolaDescricao: i.bitolaDescricao!,
      espessura: i.espessura!,
      largura: i.largura!,
      comprimento: i.comprimento!,
      quantidade: i.quantidade!,
      precoM3: i.precoM3!,
      precoLinear: i.precoLinear!,
      valorPeca: i.valorPeca!,
      valorTotal: i.valorTotal!,
    }));
    await db.insert(itensOrcamento).values(itensWithOrcId);
  }
  if (data.criadoPor) {
    await db.insert(historicoAlteracoes).values({
      orcamentoId: orcId,
      usuarioId: data.criadoPor,
      tipo: "criacao" as any,
      detalhes: JSON.stringify({ numero: data.numero, estado: data.estado }),
    });
  }
  return { id: orcId };
}

export async function updateOrcamento(id: number, data: Partial<InsertOrcamento>, confirmacaoDupla = false) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await validarAlteracaoOrcamento(id, confirmacaoDupla);
  await db.update(orcamentos).set(data).where(eq(orcamentos.id, id));
  return { success: true };
}

export async function deleteOrcamento(id: number, confirmacaoDupla = false) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await validarAlteracaoOrcamento(id, confirmacaoDupla);
  await db.delete(itensOrcamento).where(eq(itensOrcamento.orcamentoId, id));
  await db.delete(orcamentos).where(eq(orcamentos.id, id));
  return { success: true };
}

export async function updateOrcamentoEstado(id: number, novoEstado: "rascunho" | "enviado" | "aprovado" | "rejeitado", userId?: number, confirmacaoDupla = false) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await validarAlteracaoOrcamento(id, confirmacaoDupla);
  await db.update(orcamentos).set({ estado: novoEstado }).where(eq(orcamentos.id, id));
  if (userId) {
    await db.insert(historicoAlteracoes).values({
      orcamentoId: id,
      usuarioId: userId,
      tipo: "estado" as any,
      detalhes: JSON.stringify({ novoEstado }),
    });
  }
  if (novoEstado === "aprovado" && userId) {
    await criarTituloReceberDeOrcamento(id, userId);
  }
  return { success: true };
}

export async function registrarPagamentoOrcamento(id: number, userId: number, formaPagamento: string, pagoEm: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const orcamento = await getOrcamentoById(id);
  if (!orcamento) throw new Error("Orçamento não encontrado");
  if (orcamento.estado !== "aprovado") throw new Error("Apenas orçamentos aprovados podem ser marcados como pagos");
  if (orcamento.pago) throw new Error("Este orçamento já foi registrado como pago");

  const titulo = await criarTituloReceberDeOrcamento(id, userId, pagoEm);
  if (titulo) {
    const contaFinanceiraId = await getOrCreateContaFinanceiraPadrao(userId);
    await registrarBaixaFinanceira({
      tituloId: titulo.id,
      contaFinanceiraId,
      valor: saldoAbertoTitulo(titulo.valorOriginal, titulo.desconto, titulo.juros, titulo.valorBaixado).toFixed(2),
      dataBaixa: pagoEm,
      formaPagamento,
      criadoPor: userId,
    });
  }
  await db.update(orcamentos).set({ pago: true, pagoEm, formaPagamento, pagoPor: userId }).where(eq(orcamentos.id, id));
  await db.insert(historicoAlteracoes).values({
    orcamentoId: id,
    usuarioId: userId,
    tipo: "alteracao" as any,
    detalhes: JSON.stringify({ acao: "pagamento_registrado", formaPagamento, pagoEm: pagoEm.toISOString() }),
  });
  return { success: true, pagoEm, formaPagamento };
}

export async function duplicateOrcamento(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const data = await getOrcamentoWithItems(id);
  if (!data) throw new Error("Orçamento não encontrado");
  const { orcamento, itens } = data;
  // Generate new number
  const now = new Date();
  const ano = now.getFullYear();
  const mes = String(now.getMonth() + 1).padStart(2, "0");
  const random = Math.floor(Math.random() * 9000 + 1000);
  const novoNumero = `ORC-${ano}${mes}-${random}`;
  const novoOrc: InsertOrcamento = {
    numero: novoNumero,
    clienteId: orcamento.clienteId,
    estado: "rascunho",
    desconto: orcamento.desconto,
    frete: orcamento.frete,
    subtotal: orcamento.subtotal,
    total: orcamento.total,
    totalPecas: orcamento.totalPecas,
    totalMetroLinear: orcamento.totalMetroLinear,
    totalVolume: orcamento.totalVolume,
    observacoes: orcamento.observacoes,
    vendedor: orcamento.vendedor,
    criadoPor: orcamento.criadoPor,
    pago: false,
    pagoEm: null,
    formaPagamento: null,
    pagoPor: null,
  };
  const novosItens: Omit<InsertItemOrcamento, "id">[] = itens.map(i => ({
    orcamentoId: 0, // will be replaced by createOrcamento
    madeiraId: i.madeiraId,
    bitolaId: i.bitolaId,
    madeiraNome: i.madeiraNome,
    bitolaDescricao: i.bitolaDescricao,
    espessura: i.espessura,
    largura: i.largura,
    comprimento: i.comprimento,
    quantidade: i.quantidade,
    precoM3: i.precoM3,
    precoLinear: i.precoLinear,
    valorPeca: i.valorPeca,
    valorTotal: i.valorTotal,
  }));
  return createOrcamento(novoOrc, novosItens);
}

// ─── Financeiro ───
export type TipoTituloFinanceiro = "receber" | "pagar";
export type OrigemTituloFinanceiro = "orcamento" | "manual" | "recorrencia";

export type CriarTituloFinanceiroInput = {
  tipo: TipoTituloFinanceiro;
  origem?: OrigemTituloFinanceiro;
  descricao: string;
  categoriaId: number;
  valorOriginal: string;
  dataEmissao: Date;
  dataVencimento: Date;
  criadoPor: number;
  clienteId?: number | null;
  fornecedorId?: number | null;
  contraparteNome?: string | null;
  orcamentoId?: number | null;
  recorrenciaId?: number | null;
  grupoParcelamento?: string | null;
  numeroParcela?: number | null;
  totalParcelas?: number | null;
  desconto?: string;
  juros?: string;
  observacoes?: string | null;
};

export async function listFornecedores() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(fornecedores).where(eq(fornecedores.ativo, true)).orderBy(desc(fornecedores.createdAt));
}

export async function createFornecedor(data: InsertFornecedor) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(fornecedores).values(data);
  return { id: getInsertedId(result as MysqlInsertResult) };
}

export async function updateFornecedor(id: number, data: Partial<InsertFornecedor>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(fornecedores).set(data).where(eq(fornecedores.id, id));
  return { success: true };
}

export async function archiveFornecedor(id: number) {
  return updateFornecedor(id, { ativo: false });
}

export async function listCategoriasFinanceiras() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(categoriasFinanceiras).where(eq(categoriasFinanceiras.ativo, true)).orderBy(desc(categoriasFinanceiras.createdAt));
}

export async function createCategoriaFinanceira(data: InsertCategoriaFinanceira) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(categoriasFinanceiras).values(data);
  return { id: getInsertedId(result as MysqlInsertResult) };
}

export async function updateCategoriaFinanceira(id: number, data: Partial<InsertCategoriaFinanceira>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(categoriasFinanceiras).set(data).where(eq(categoriasFinanceiras.id, id));
  return { success: true };
}

export async function listContasFinanceiras() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contasFinanceiras).where(eq(contasFinanceiras.ativa, true)).orderBy(desc(contasFinanceiras.createdAt));
}

export async function createContaFinanceira(data: InsertContaFinanceira) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(contasFinanceiras).values(data);
  return { id: getInsertedId(result as MysqlInsertResult) };
}

export async function updateContaFinanceira(id: number, data: Partial<InsertContaFinanceira>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(contasFinanceiras).set(data).where(eq(contasFinanceiras.id, id));
  return { success: true };
}

export async function getOrCreateCategoriaReceitaVendas(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existente = await db.select().from(categoriasFinanceiras)
    .where(and(eq(categoriasFinanceiras.nome, "Receitas de vendas"), eq(categoriasFinanceiras.ativo, true))).limit(1);
  if (existente[0]) return existente[0].id;
  const result = await db.insert(categoriasFinanceiras).values({
    nome: "Receitas de vendas",
    tipo: "receita",
    ativo: true,
    criadoPor: userId,
  });
  return getInsertedId(result as MysqlInsertResult);
}

export async function getOrCreateContaFinanceiraPadrao(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existente = await db.select().from(contasFinanceiras)
    .where(and(eq(contasFinanceiras.nome, "Caixa geral"), eq(contasFinanceiras.ativa, true))).limit(1);
  if (existente[0]) return existente[0].id;
  const result = await db.insert(contasFinanceiras).values({
    nome: "Caixa geral",
    tipo: "caixa",
    saldoInicial: "0",
    ativa: true,
    criadoPor: userId,
  });
  return getInsertedId(result as MysqlInsertResult);
}

export async function createTituloFinanceiro(input: CriarTituloFinanceiroInput) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (!input.descricao.trim()) throw new Error("Informe uma descrição para o lançamento");
  if (decimalParaNumero(input.valorOriginal) <= 0) throw new Error("O valor do título deve ser maior que zero");
  const data: InsertTituloFinanceiro = {
    tipo: input.tipo,
    origem: input.origem ?? "manual",
    descricao: input.descricao.trim(),
    clienteId: input.clienteId ?? null,
    fornecedorId: input.fornecedorId ?? null,
    contraparteNome: input.contraparteNome ?? null,
    orcamentoId: input.orcamentoId ?? null,
    categoriaId: input.categoriaId,
    recorrenciaId: input.recorrenciaId ?? null,
    grupoParcelamento: input.grupoParcelamento ?? null,
    numeroParcela: input.numeroParcela ?? null,
    totalParcelas: input.totalParcelas ?? null,
    valorOriginal: input.valorOriginal,
    desconto: input.desconto ?? "0",
    juros: input.juros ?? "0",
    valorBaixado: "0",
    dataEmissao: input.dataEmissao,
    dataVencimento: input.dataVencimento,
    estado: calcularEstadoTitulo({ valorOriginal: input.valorOriginal, dataVencimento: input.dataVencimento }),
    observacoes: input.observacoes ?? null,
    criadoPor: input.criadoPor,
  };
  const result = await db.insert(titulosFinanceiros).values(data);
  return { id: getInsertedId(result as MysqlInsertResult) };
}

export async function getTituloFinanceiroById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(titulosFinanceiros).where(eq(titulosFinanceiros.id, id)).limit(1);
  return result[0];
}

export async function atualizarEstadoTituloFinanceiro(titulo: any) {
  const novoEstado = calcularEstadoTitulo({
    valorOriginal: titulo.valorOriginal,
    desconto: titulo.desconto,
    juros: titulo.juros,
    valorBaixado: titulo.valorBaixado,
    dataVencimento: titulo.dataVencimento,
    cancelado: titulo.estado === "cancelado",
  });
  if (novoEstado !== titulo.estado) {
    const db = await getDb();
    if (db) await db.update(titulosFinanceiros).set({ estado: novoEstado }).where(eq(titulosFinanceiros.id, titulo.id));
  }
  return { ...titulo, estado: novoEstado };
}

export async function listTitulosFinanceiros(filters?: { tipo?: TipoTituloFinanceiro; estado?: string; clienteId?: number; fornecedorId?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.tipo) conditions.push(eq(titulosFinanceiros.tipo, filters.tipo));
  if (filters?.estado) conditions.push(eq(titulosFinanceiros.estado, filters.estado as any));
  if (filters?.clienteId) conditions.push(eq(titulosFinanceiros.clienteId, filters.clienteId));
  if (filters?.fornecedorId) conditions.push(eq(titulosFinanceiros.fornecedorId, filters.fornecedorId));
  const titulos = await db.select().from(titulosFinanceiros)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(titulosFinanceiros.dataVencimento));
  return Promise.all(titulos.map(atualizarEstadoTituloFinanceiro));
}

export async function registrarBaixaFinanceira(data: Pick<InsertBaixaFinanceira, "tituloId" | "contaFinanceiraId" | "valor" | "dataBaixa" | "formaPagamento" | "observacoes" | "criadoPor">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const titulo = await getTituloFinanceiroById(data.tituloId);
  if (!titulo) throw new Error("Título financeiro não encontrado");
  if (titulo.estado === "cancelado" || titulo.estado === "quitado") throw new Error("Este título não aceita novas baixas");
  const conta = await db.select().from(contasFinanceiras).where(and(eq(contasFinanceiras.id, data.contaFinanceiraId), eq(contasFinanceiras.ativa, true))).limit(1);
  if (!conta[0]) throw new Error("Informe uma conta financeira ativa para a baixa");
  const valorBaixa = decimalParaNumero(data.valor);
  const saldoAberto = saldoAbertoTitulo(titulo.valorOriginal, titulo.desconto, titulo.juros, titulo.valorBaixado);
  if (valorBaixa <= 0 || valorBaixa > saldoAberto + 0.005) throw new Error("O valor da baixa deve ser maior que zero e não pode exceder o saldo em aberto");
  const result = await db.insert(baixasFinanceiras).values({ ...data, valor: valorBaixa.toFixed(2) });
  const novoValorBaixado = (decimalParaNumero(titulo.valorBaixado) + valorBaixa).toFixed(2);
  const novoEstado = calcularEstadoTitulo({
    valorOriginal: titulo.valorOriginal,
    desconto: titulo.desconto,
    juros: titulo.juros,
    valorBaixado: novoValorBaixado,
    dataVencimento: titulo.dataVencimento,
  });
  await db.update(titulosFinanceiros).set({ valorBaixado: novoValorBaixado, estado: novoEstado }).where(eq(titulosFinanceiros.id, titulo.id));
  return { id: getInsertedId(result as MysqlInsertResult), estado: novoEstado, valorBaixado: novoValorBaixado };
}

export async function listBaixasFinanceiras(tituloId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: baixasFinanceiras.id,
    tituloId: baixasFinanceiras.tituloId,
    contaFinanceiraId: baixasFinanceiras.contaFinanceiraId,
    valor: baixasFinanceiras.valor,
    dataBaixa: baixasFinanceiras.dataBaixa,
    formaPagamento: baixasFinanceiras.formaPagamento,
    observacoes: baixasFinanceiras.observacoes,
    conciliada: baixasFinanceiras.conciliada,
    conciliadaEm: baixasFinanceiras.conciliadaEm,
    criadoPor: baixasFinanceiras.criadoPor,
    createdAt: baixasFinanceiras.createdAt,
    contaNome: contasFinanceiras.nome,
    contaTipo: contasFinanceiras.tipo,
  }).from(baixasFinanceiras)
    .leftJoin(contasFinanceiras, eq(baixasFinanceiras.contaFinanceiraId, contasFinanceiras.id))
    .where(eq(baixasFinanceiras.tituloId, tituloId))
    .orderBy(desc(baixasFinanceiras.dataBaixa));
}

export async function conciliarBaixaFinanceira(id: number, conciliada: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(baixasFinanceiras).set({ conciliada, conciliadaEm: conciliada ? new Date() : null }).where(eq(baixasFinanceiras.id, id));
  return { success: true };
}

export async function cancelarTituloFinanceiro(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const titulo = await getTituloFinanceiroById(id);
  if (!titulo) throw new Error("Título financeiro não encontrado");
  if (decimalParaNumero(titulo.valorBaixado) > 0) throw new Error("Títulos com baixas devem ser regularizados por estorno antes do cancelamento");
  await db.update(titulosFinanceiros).set({ estado: "cancelado", canceladoEm: new Date(), canceladoPor: userId }).where(eq(titulosFinanceiros.id, id));
  return { success: true };
}

export async function criarTituloReceberDeOrcamento(orcamentoId: number, userId: number, dataVencimento = new Date()) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const orcamento = await getOrcamentoById(orcamentoId);
  if (!orcamento || orcamento.estado !== "aprovado" || orcamento.pago) return undefined;
  const existente = await db.select().from(titulosFinanceiros)
    .where(and(eq(titulosFinanceiros.origem, "orcamento"), eq(titulosFinanceiros.orcamentoId, orcamentoId))).limit(1);
  if (existente[0]) return existente[0];
  const categoriaId = await getOrCreateCategoriaReceitaVendas(userId);
  const criacao = await createTituloFinanceiro({
    tipo: "receber",
    origem: "orcamento",
    descricao: `Orçamento ${orcamento.numero}`,
    clienteId: orcamento.clienteId,
    orcamentoId,
    categoriaId,
    valorOriginal: orcamento.total,
    dataEmissao: new Date(),
    dataVencimento,
    criadoPor: userId,
  });
  return getTituloFinanceiroById(criacao.id);
}

export async function listRecorrenciasFinanceiras() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(recorrenciasFinanceiras).orderBy(desc(recorrenciasFinanceiras.proximoVencimento));
}

export async function createRecorrenciaFinanceira(data: InsertRecorrenciaFinanceira) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (decimalParaNumero(data.valor) <= 0) throw new Error("O valor da recorrência deve ser maior que zero");
  const result = await db.insert(recorrenciasFinanceiras).values(data);
  return { id: getInsertedId(result as MysqlInsertResult) };
}

export async function updateRecorrenciaFinanceira(id: number, data: Partial<InsertRecorrenciaFinanceira>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(recorrenciasFinanceiras).set(data).where(eq(recorrenciasFinanceiras.id, id));
  return { success: true };
}

export async function getConfiguracaoFinanceiraByTaskUid(taskUid: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(configuracoesFinanceiras)
    .where(eq(configuracoesFinanceiras.alertaCronTaskUid, taskUid)).limit(1);
  return result[0];
}

export async function configurarProcessamentoFinanceiro(taskUid: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existente = await db.select().from(configuracoesFinanceiras).where(eq(configuracoesFinanceiras.id, 1)).limit(1);
  if (existente[0]) {
    await db.update(configuracoesFinanceiras).set({ alertaCronTaskUid: taskUid }).where(eq(configuracoesFinanceiras.id, 1));
  } else {
    await db.insert(configuracoesFinanceiras).values({ id: 1, alertaCronTaskUid: taskUid, alertaDiasAntecedencia: 7 });
  }
  return { success: true };
}

export async function processarRecorrenciasFinanceiras(agora = new Date()) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const recorrencias = await db.select().from(recorrenciasFinanceiras).where(eq(recorrenciasFinanceiras.ativa, true));
  let titulosGerados = 0;

  for (const recorrencia of recorrencias) {
    let vencimento = new Date(recorrencia.proximoVencimento);
    const fim = recorrencia.dataFim ? new Date(recorrencia.dataFim) : null;
    while (vencimento <= agora && (!fim || vencimento <= fim)) {
      const existentes = await db.select().from(titulosFinanceiros).where(and(
        eq(titulosFinanceiros.recorrenciaId, recorrencia.id),
        eq(titulosFinanceiros.dataVencimento, vencimento),
      )).limit(1);
      if (!existentes[0]) {
        await createTituloFinanceiro({
          tipo: recorrencia.tipo,
          origem: "recorrencia",
          descricao: recorrencia.descricao,
          clienteId: recorrencia.clienteId,
          fornecedorId: recorrencia.fornecedorId,
          contraparteNome: recorrencia.contraparteNome,
          categoriaId: recorrencia.categoriaId,
          recorrenciaId: recorrencia.id,
          valorOriginal: recorrencia.valor,
          dataEmissao: vencimento,
          dataVencimento: vencimento,
          observacoes: recorrencia.observacoes,
          criadoPor: recorrencia.criadoPor,
        });
        titulosGerados += 1;
      }
      vencimento = proximoVencimento(vencimento, recorrencia.frequencia);
    }
    if (vencimento.getTime() !== new Date(recorrencia.proximoVencimento).getTime()) {
      const ativa = !fim || vencimento <= fim;
      await db.update(recorrenciasFinanceiras).set({ proximoVencimento: vencimento, ativa }).where(eq(recorrenciasFinanceiras.id, recorrencia.id));
    }
  }

  await db.update(configuracoesFinanceiras).set({ ultimoProcessamentoEm: agora }).where(eq(configuracoesFinanceiras.id, 1));
  return { titulosGerados, recorrenciasAnalisadas: recorrencias.length };
}

// ─── Dashboard ───
export async function getDashboardStats() {
  const db = await getDb();
  if (!db) return { totalOrcamentos: 0, totalAprovados: 0, totalRascunhos: 0, totalEnviados: 0, totalRejeitados: 0, totalValor: "0", totalClientes: 0, totalMadeiras: 0 };
  const allOrcamentos = await db.select().from(orcamentos);
  const totalOrcamentos = allOrcamentos.length;
  const totalAprovados = allOrcamentos.filter(o => o.estado === "aprovado").length;
  const totalRascunhos = allOrcamentos.filter(o => o.estado === "rascunho").length;
  const totalEnviados = allOrcamentos.filter(o => o.estado === "enviado").length;
  const totalRejeitados = allOrcamentos.filter(o => o.estado === "rejeitado").length;
  const totalValor = allOrcamentos.reduce((sum, o) => sum + parseFloat(o.total ?? "0"), 0).toFixed(2);
  const allClientes = await db.select().from(clientes).where(eq(clientes.ativo, true));
  const totalClientes = allClientes.length;
  const allMadeiras = await db.select().from(madeiras).where(eq(madeiras.ativo, true));
  const totalMadeiras = allMadeiras.length;
  // Recent orcamentos (last 5)
  const recent = allOrcamentos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);
  return { totalOrcamentos, totalAprovados, totalRascunhos, totalEnviados, totalRejeitados, totalValor, totalClientes, totalMadeiras, recent };
}
