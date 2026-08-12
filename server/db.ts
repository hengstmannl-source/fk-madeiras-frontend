import { eq, and, asc, desc, gte, lte, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users, madeiras, bitolas, clientes,
  orcamentos, itensOrcamento, historicoAlteracoes, empresaConfiguracoes,
  fornecedores, categoriasFinanceiras, contasFinanceiras, titulosFinanceiros, sequenciasVendas,
  baixasFinanceiras, recorrenciasFinanceiras, configuracoesFinanceiras, alertasFinanceiros,
  plaquetas, romaneiosCargaToras, romaneiosProducao, itensRomaneioToras, itensRomaneioProducao, lotesPecasSerradas, movimentacoesPlaquetas, movimentacoesEstoqueSerrado,
  type InsertMadeira, type InsertBitola, type InsertCliente,
  type InsertOrcamento, type InsertItemOrcamento, type InsertFornecedor,
  type InsertCategoriaFinanceira, type InsertContaFinanceira,
  type InsertTituloFinanceiro, type InsertBaixaFinanceira, type InsertRecorrenciaFinanceira,
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { calcularEstadoTitulo, calcularRelatorioFluxoCaixa, classificarAlertaVencimento, decimalParaNumero, planejarAtualizacaoAlertas, podeCancelarTituloFinanceiro, podeEstornarBaixa, proximoVencimento, saldoAbertoTitulo } from "./financeiro.logic";
import { criarModeloCsvLancamentos, exportarLancamentosCsv, prepararImportacaoLancamentos } from "./financeiro.intercambio";
import { criarModeloCsvPlaquetasCarga, prepararImportacaoPlaquetasCarga } from "./estoque.intercambio";
import { alocarPecasParaEntrega, agruparEstoquePecas, calcularVolumeToraCilindrica, normalizarCodigoPlaqueta, validarConfirmacaoRomaneio, type ItemProducaoEntrada } from "./producao.logic";

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

async function validarAlteracaoOrcamento(id: number, confirmacaoDupla = false, database?: any) {
  const db = database ?? await getDb();
  if (!db) throw new Error("Database not available");
  const resultado = await db.select().from(orcamentos).where(eq(orcamentos.id, id)).limit(1);
  const orcamento = resultado[0];
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

export async function cancelarRecebivelDeVendaExcluida(orcamentoId: number, userId: number, database?: any) {
  const db = database ?? await getDb();
  if (!db) throw new Error("Database not available");
  const titulo = await db.select().from(titulosFinanceiros)
    .where(and(eq(titulosFinanceiros.origem, "orcamento"), eq(titulosFinanceiros.orcamentoId, orcamentoId))).limit(1);
  if (!titulo[0]) return { cancelado: false };
  if (decimalParaNumero(titulo[0].valorBaixado) > 0) {
    throw new Error("A venda possui recebimentos registrados e não pode ser excluída. Regularize as baixas primeiro.");
  }
  const resolvidoEm = new Date();
  await db.update(titulosFinanceiros).set({ estado: "cancelado", canceladoEm: resolvidoEm, canceladoPor: userId }).where(eq(titulosFinanceiros.id, titulo[0].id));
  await db.update(alertasFinanceiros).set({ resolvidoEm }).where(eq(alertasFinanceiros.tituloId, titulo[0].id));
  return { cancelado: true, tituloId: titulo[0].id };
}

export async function deleteOrcamento(id: number, confirmacaoDupla = false, userId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await validarAlteracaoOrcamento(id, confirmacaoDupla);
  if (userId) await cancelarRecebivelDeVendaExcluida(id, userId, db);
  await db.delete(itensOrcamento).where(eq(itensOrcamento.orcamentoId, id));
  await db.delete(orcamentos).where(eq(orcamentos.id, id));
  return { success: true };
}

export async function atribuirNumeroVendaAprovada(orcamentoId: number, database?: any) {
  const db = database ?? await getDb();
  if (!db) throw new Error("Database not available");
  const venda = await db.select().from(orcamentos).where(eq(orcamentos.id, orcamentoId)).limit(1);
  if (!venda[0]) throw new Error("Venda não encontrada");
  if (venda[0].numero) return venda[0].numero;

  const reserva = await db.insert(sequenciasVendas).values({ orcamentoId, numero: `PENDENTE-${orcamentoId}` });
  const sequenciaId = getInsertedId(reserva as MysqlInsertResult);
  const numero = `VND-${String(sequenciaId).padStart(6, "0")}`;
  await db.update(sequenciasVendas).set({ numero }).where(eq(sequenciasVendas.id, sequenciaId));
  await db.update(orcamentos).set({ numero }).where(eq(orcamentos.id, orcamentoId));
  return numero;
}

export async function updateOrcamentoEstado(
  id: number,
  novoEstado: "rascunho" | "enviado" | "aprovado" | "rejeitado",
  userId?: number,
  confirmacaoDupla = false,
  dependencias?: { database?: any; criarTituloReceber?: (orcamentoId: number, usuarioId: number) => Promise<unknown>; atribuirNumero?: (orcamentoId: number) => Promise<string> },
) {
  const db = dependencias?.database ?? await getDb();
  if (!db) throw new Error("Database not available");
  await validarAlteracaoOrcamento(id, confirmacaoDupla, db);
  const numeroAprovado = novoEstado === "aprovado"
    ? await (dependencias?.atribuirNumero ?? ((orcamentoId: number) => atribuirNumeroVendaAprovada(orcamentoId, db)))(id)
    : undefined;
  await db.update(orcamentos).set({ estado: novoEstado }).where(eq(orcamentos.id, id));
  if (userId) {
    await db.insert(historicoAlteracoes).values({
      orcamentoId: id,
      usuarioId: userId,
      tipo: "estado" as any,
      detalhes: JSON.stringify({ novoEstado, numero: numeroAprovado }),
    });
  }
  if (novoEstado === "aprovado" && userId) {
    await (dependencias?.criarTituloReceber ?? criarTituloReceberDeOrcamento)(id, userId);
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
  const novoOrc: InsertOrcamento = {
    numero: null,
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
    dataVencimento: orcamento.dataVencimento,
    competencia: orcamento.competencia,
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
  chaveImportacao?: string | null;
  descricao: string;
  categoriaId: number;
  valorOriginal: string;
  dataEmissao: Date;
  dataVencimento: Date;
  competencia?: Date | null;
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
    chaveImportacao: input.chaveImportacao ?? null,
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
    competencia: input.competencia ?? null,
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

export async function listTitulosFinanceiros(
  filters?: { tipo?: TipoTituloFinanceiro; estado?: string; clienteId?: number; fornecedorId?: number },
  dependencias?: { database?: any; atualizarEstado?: (titulo: any) => Promise<any>; titulos?: any[] },
) {
  const db = dependencias?.database ?? await getDb();
  if (!db && !dependencias?.titulos) return [];
  const conditions = [];
  if (filters?.tipo) conditions.push(eq(titulosFinanceiros.tipo, filters.tipo));
  if (filters?.estado) conditions.push(eq(titulosFinanceiros.estado, filters.estado as any));
  else conditions.push(ne(titulosFinanceiros.estado, "cancelado"));
  if (filters?.clienteId) conditions.push(eq(titulosFinanceiros.clienteId, filters.clienteId));
  if (filters?.fornecedorId) conditions.push(eq(titulosFinanceiros.fornecedorId, filters.fornecedorId));
  const titulos = dependencias?.titulos ?? await db.select().from(titulosFinanceiros)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(titulosFinanceiros.dataVencimento));
  const titulosVisiveis = titulos.filter((titulo: any) => {
    if (!filters?.estado && titulo.estado === "cancelado") return false;
    if (filters?.estado && titulo.estado !== filters.estado) return false;
    if (filters?.tipo && titulo.tipo !== filters.tipo) return false;
    if (filters?.clienteId && titulo.clienteId !== filters.clienteId) return false;
    if (filters?.fornecedorId && titulo.fornecedorId !== filters.fornecedorId) return false;
    return true;
  });
  return Promise.all(titulosVisiveis.map((titulo: any) => dependencias?.atualizarEstado ? dependencias.atualizarEstado(titulo) : atualizarEstadoTituloFinanceiro(titulo)));
}

function dataImportada(valor: string): Date {
  const [ano, mes, dia] = valor.split("-").map(Number);
  return new Date(ano, mes - 1, dia, 12, 0, 0);
}

export function getModeloImportacaoLancamentosCsv() {
  return criarModeloCsvLancamentos();
}

export async function exportarLancamentosFinanceirosCsv(filters?: { tipo?: TipoTituloFinanceiro }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [titulos, categorias] = await Promise.all([
    listTitulosFinanceiros(filters),
    listCategoriasFinanceiras(),
  ]);
  const categoriasPorId = new Map(categorias.map((categoria) => [categoria.id, categoria.nome]));
  return exportarLancamentosCsv(titulos
    .filter((titulo) => titulo.origem === "manual")
    .map((titulo) => ({
      id: titulo.id,
      chaveImportacao: titulo.chaveImportacao,
      tipo: titulo.tipo,
      descricao: titulo.descricao,
      categoria: categoriasPorId.get(titulo.categoriaId) ?? `Categoria ${titulo.categoriaId}`,
      valor: titulo.valorOriginal,
      dataEmissao: titulo.dataEmissao,
      dataVencimento: titulo.dataVencimento,
      competencia: titulo.competencia,
      contraparte: titulo.contraparteNome,
      observacoes: titulo.observacoes,
    })));
}

export async function importarLancamentosFinanceirosCsv(
  conteudo: string,
  userId: number,
  dependencias?: { database?: any; categorias?: any[]; titulosExistentes?: Array<{ id: number; chaveImportacao?: string | null }> },
) {
  const db = dependencias?.database ?? await getDb();
  if (!db) throw new Error("Database not available");
  const [categorias, titulosExistentes] = await Promise.all([
    dependencias?.categorias ?? listCategoriasFinanceiras(),
    dependencias?.titulosExistentes ?? db.select({ id: titulosFinanceiros.id, chaveImportacao: titulosFinanceiros.chaveImportacao }).from(titulosFinanceiros),
  ]);
  const preparo = prepararImportacaoLancamentos({ conteudo, categorias, titulosExistentes });
  if (preparo.erros.length) return { importados: 0, erros: preparo.erros };
  await db.transaction(async (tx: any) => {
    await tx.insert(titulosFinanceiros).values(preparo.linhas.map((linha) => ({
      tipo: linha.tipo,
      origem: "manual" as const,
      chaveImportacao: linha.referencia,
      descricao: linha.descricao,
      categoriaId: linha.categoriaId,
      valorOriginal: linha.valor,
      desconto: "0",
      juros: "0",
      valorBaixado: "0",
      dataEmissao: dataImportada(linha.dataEmissao),
      dataVencimento: dataImportada(linha.dataVencimento),
      competencia: linha.competencia ? dataImportada(linha.competencia) : null,
      contraparteNome: linha.contraparte,
      estado: calcularEstadoTitulo({ valorOriginal: linha.valor, dataVencimento: dataImportada(linha.dataVencimento) }),
      observacoes: linha.observacoes,
      criadoPor: userId,
    })));
  });
  return { importados: preparo.linhas.length, erros: [] as string[] };
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
    estornada: baixasFinanceiras.estornada,
    estornadaEm: baixasFinanceiras.estornadaEm,
    estornadaPor: baixasFinanceiras.estornadaPor,
    motivoEstorno: baixasFinanceiras.motivoEstorno,
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

export async function getRelatorioFluxoCaixa(periodo: { dataInicio: Date; dataFim: Date }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const fim = new Date(periodo.dataFim);
  fim.setHours(23, 59, 59, 999);
  const [contas, movimentos] = await Promise.all([
    db.select({ saldoInicial: contasFinanceiras.saldoInicial }).from(contasFinanceiras),
    db.select({
      id: baixasFinanceiras.id,
      tituloId: baixasFinanceiras.tituloId,
      tipo: titulosFinanceiros.tipo,
      descricao: titulosFinanceiros.descricao,
      valor: baixasFinanceiras.valor,
      dataBaixa: baixasFinanceiras.dataBaixa,
      formaPagamento: baixasFinanceiras.formaPagamento,
      estornada: baixasFinanceiras.estornada,
      contaNome: contasFinanceiras.nome,
    }).from(baixasFinanceiras)
      .innerJoin(titulosFinanceiros, eq(baixasFinanceiras.tituloId, titulosFinanceiros.id))
      .leftJoin(contasFinanceiras, eq(baixasFinanceiras.contaFinanceiraId, contasFinanceiras.id))
      .where(and(eq(baixasFinanceiras.estornada, false), lte(baixasFinanceiras.dataBaixa, fim)))
      .orderBy(asc(baixasFinanceiras.dataBaixa), asc(baixasFinanceiras.id)),
  ]);
  const saldoInicialContas = contas.reduce((total, conta) => total + decimalParaNumero(conta.saldoInicial), 0);
  return calcularRelatorioFluxoCaixa({ ...periodo, saldoInicialContas, movimentos });
}

export async function estornarBaixaFinanceira(
  id: number,
  userId: number,
  motivo: string,
  dependencias?: { database?: any; buscarBaixa?: (id: number) => Promise<any>; buscarTitulo?: (id: number) => Promise<any>; agora?: Date },
) {
  const db = dependencias?.database ?? await getDb();
  if (!db) throw new Error("Database not available");
  const baixa = dependencias?.buscarBaixa
    ? await dependencias.buscarBaixa(id)
    : (await db.select().from(baixasFinanceiras).where(eq(baixasFinanceiras.id, id)).limit(1))[0];
  if (!baixa) throw new Error("Baixa financeira não encontrada");
  if (!podeEstornarBaixa(baixa.estornada)) throw new Error("Esta baixa já foi estornada e não pode ser revertida novamente");

  const titulo = dependencias?.buscarTitulo
    ? await dependencias.buscarTitulo(baixa.tituloId)
    : await getTituloFinanceiroById(baixa.tituloId);
  if (!titulo) throw new Error("Título financeiro não encontrado para a baixa selecionada");
  if (titulo.estado === "cancelado") throw new Error("Não é possível estornar uma baixa de título cancelado");

  const novoValorBaixado = Math.max(0, decimalParaNumero(titulo.valorBaixado) - decimalParaNumero(baixa.valor)).toFixed(2);
  const novoEstado = calcularEstadoTitulo({
    valorOriginal: titulo.valorOriginal,
    desconto: titulo.desconto,
    juros: titulo.juros,
    valorBaixado: novoValorBaixado,
    dataVencimento: titulo.dataVencimento,
  });
  const estornadaEm = dependencias?.agora ?? new Date();

  await db.update(baixasFinanceiras).set({
    estornada: true,
    estornadaEm,
    estornadaPor: userId,
    motivoEstorno: motivo.trim(),
    conciliada: false,
    conciliadaEm: null,
  }).where(eq(baixasFinanceiras.id, id));
  await db.update(titulosFinanceiros).set({ valorBaixado: novoValorBaixado, estado: novoEstado }).where(eq(titulosFinanceiros.id, titulo.id));
  return { success: true, tituloId: titulo.id, estado: novoEstado, valorBaixado: novoValorBaixado };
}

export async function cancelarTituloFinanceiro(id: number, userId: number, dependencias?: { database?: any; buscarTitulo?: (id: number) => Promise<any> }) {
  const db = dependencias?.database ?? await getDb();
  if (!db) throw new Error("Database not available");
  const titulo = dependencias?.buscarTitulo ? await dependencias.buscarTitulo(id) : await getTituloFinanceiroById(id);
  if (!titulo) throw new Error("Título financeiro não encontrado");
  if (!podeCancelarTituloFinanceiro(titulo.valorBaixado)) throw new Error("Títulos com baixas devem ser regularizados por estorno antes do cancelamento");
  await db.update(titulosFinanceiros).set({ estado: "cancelado", canceladoEm: new Date(), canceladoPor: userId }).where(eq(titulosFinanceiros.id, id));
  return { success: true };
}

export async function criarTituloReceberDeOrcamento(orcamentoId: number, userId: number, dataVencimento?: Date) {
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
    descricao: `Venda ${orcamento.numero}`,
    clienteId: orcamento.clienteId,
    orcamentoId,
    categoriaId,
    valorOriginal: orcamento.total,
    dataEmissao: new Date(),
    dataVencimento: orcamento.dataVencimento ?? dataVencimento ?? new Date(),
    competencia: orcamento.competencia,
    criadoPor: userId,
  });
  return getTituloFinanceiroById(criacao.id);
}

export async function atualizarDatasOrcamento(
  id: number,
  datas: { dataVencimento: Date; competencia: Date },
  confirmacaoDupla = false,
  database?: any,
) {
  const db = database ?? await getDb();
  if (!db) throw new Error("Database not available");
  await validarAlteracaoOrcamento(id, confirmacaoDupla, db);
  await db.update(orcamentos).set(datas).where(eq(orcamentos.id, id));

  const titulo = await db.select().from(titulosFinanceiros)
    .where(and(eq(titulosFinanceiros.origem, "orcamento"), eq(titulosFinanceiros.orcamentoId, id))).limit(1);
  if (titulo[0]) {
    const estado = calcularEstadoTitulo({
      valorOriginal: titulo[0].valorOriginal,
      desconto: titulo[0].desconto,
      juros: titulo[0].juros,
      valorBaixado: titulo[0].valorBaixado,
      dataVencimento: datas.dataVencimento,
      cancelado: titulo[0].estado === "cancelado",
    });
    await db.update(titulosFinanceiros).set({
      dataVencimento: datas.dataVencimento,
      competencia: datas.competencia,
      estado,
    }).where(eq(titulosFinanceiros.id, titulo[0].id));
  }
  return { success: true, tituloAtualizado: Boolean(titulo[0]) };
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

export async function listAlertasFinanceiros() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: alertasFinanceiros.id,
    tituloId: alertasFinanceiros.tituloId,
    tipo: alertasFinanceiros.tipo,
    mensagem: alertasFinanceiros.mensagem,
    criadoEm: alertasFinanceiros.criadoEm,
    descricao: titulosFinanceiros.descricao,
    valorOriginal: titulosFinanceiros.valorOriginal,
    dataVencimento: titulosFinanceiros.dataVencimento,
    tipoTitulo: titulosFinanceiros.tipo,
  }).from(alertasFinanceiros)
    .innerJoin(titulosFinanceiros, eq(alertasFinanceiros.tituloId, titulosFinanceiros.id))
    .where(eq(alertasFinanceiros.estado, "ativo"))
    .orderBy(desc(alertasFinanceiros.createdAt));
}

export async function processarAlertasFinanceiros(agora = new Date(), database?: any) {
  const db = database ?? await getDb();
  if (!db) throw new Error("Database not available");
  const configuracao = (await db.select().from(configuracoesFinanceiras).where(eq(configuracoesFinanceiras.id, 1)).limit(1))[0];
  const diasAntecedencia = configuracao?.alertaDiasAntecedencia ?? 7;
  const titulos = await db.select().from(titulosFinanceiros);
  let alertasCriados = 0;
  let alertasResolvidos = 0;

  for (const titulo of titulos) {
    const estado = calcularEstadoTitulo({
      valorOriginal: titulo.valorOriginal,
      desconto: titulo.desconto,
      juros: titulo.juros,
      valorBaixado: titulo.valorBaixado,
      dataVencimento: titulo.dataVencimento,
      cancelado: titulo.estado === "cancelado",
      agora,
    });
    if (estado !== titulo.estado) {
      await db.update(titulosFinanceiros).set({ estado }).where(eq(titulosFinanceiros.id, titulo.id));
    }
    const tipoAtual = classificarAlertaVencimento({ estado, dataVencimento: titulo.dataVencimento, diasAntecedencia, agora });
    const ativos = await db.select().from(alertasFinanceiros).where(and(eq(alertasFinanceiros.tituloId, titulo.id), eq(alertasFinanceiros.estado, "ativo")));
    const plano = planejarAtualizacaoAlertas(tipoAtual, ativos.map((alerta: { tipo: "vence_em_breve" | "vencido" }) => alerta.tipo));

    if (plano.resolver.length) {
      await db.update(alertasFinanceiros).set({ estado: "resolvido", resolvidoEm: agora })
        .where(and(eq(alertasFinanceiros.tituloId, titulo.id), eq(alertasFinanceiros.estado, "ativo")));
      alertasResolvidos += plano.resolver.length;
    }
    if (plano.criar) {
      const vencimentoFormatado = titulo.dataVencimento.toLocaleDateString("pt-BR");
      const mensagem = plano.criar === "vencido"
        ? `${titulo.descricao} está vencido desde ${vencimentoFormatado}.`
        : `${titulo.descricao} vence em ${vencimentoFormatado}.`;
      await db.insert(alertasFinanceiros).values({ tituloId: titulo.id, tipo: plano.criar, mensagem, estado: "ativo" });
      alertasCriados += 1;
    }
  }
  return { alertasCriados, alertasResolvidos };
}

export async function processarRecorrenciasFinanceiras(agora = new Date(), database?: any) {
  const db = database ?? await getDb();
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

  const alertas = await processarAlertasFinanceiros(agora, db);
  await db.update(configuracoesFinanceiras).set({ ultimoProcessamentoEm: agora }).where(eq(configuracoesFinanceiras.id, 1));
  return { titulosGerados, recorrenciasAnalisadas: recorrencias.length, ...alertas };
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

// ─── Produção e estoque de madeira serrada ───
export function ordenarPlaquetasPorEntradaMaisRecente<T extends { createdAt: Date | string | null; id: number }>(itens: T[]) {
  return [...itens].sort((primeira, segunda) => {
    const primeiraData = primeira.createdAt ? new Date(primeira.createdAt).getTime() : 0;
    const segundaData = segunda.createdAt ? new Date(segunda.createdAt).getTime() : 0;
    return segundaData - primeiraData || segunda.id - primeira.id;
  });
}

export async function listPlaquetas(parametros: { busca?: string; limite?: number; deslocamento?: number } = {}) {
  const db = await getDb();
  if (!db) return { itens: [], total: 0, totalDisponiveis: 0, proximoDeslocamento: null };
  const todas = ordenarPlaquetasPorEntradaMaisRecente(await db.select().from(plaquetas).orderBy(desc(plaquetas.createdAt), desc(plaquetas.id)));
  const termo = (parametros.busca ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const filtradas = termo ? todas.filter((item) => {
    const codigo = item.codigo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
    const essencia = item.madeiraNome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
    return codigo.includes(termo) || essencia.includes(termo);
  }) : todas;
  const limite = Math.min(Math.max(parametros.limite ?? 10, 1), 500);
  const deslocamento = Math.max(parametros.deslocamento ?? 0, 0);
  const itens = filtradas.slice(deslocamento, deslocamento + limite);
  const proximoDeslocamento = deslocamento + itens.length < filtradas.length ? deslocamento + itens.length : null;
  return { itens, total: filtradas.length, totalDisponiveis: todas.filter((item) => item.estado === "disponivel").length, proximoDeslocamento };
}

export async function listRomaneiosCargaToras(filtros: { dataInicial?: Date; dataFinal?: Date; origem?: string } = {}) {
  const db = await getDb();
  if (!db) return [];
  const origem = filtros.origem?.trim().toLocaleLowerCase("pt-BR");
  const condicoes = [
    filtros.dataInicial ? gte(romaneiosCargaToras.dataCarga, filtros.dataInicial) : undefined,
    filtros.dataFinal ? lte(romaneiosCargaToras.dataCarga, filtros.dataFinal) : undefined,
  ];
  const resultado = await db.select().from(romaneiosCargaToras).where(and(...condicoes)).orderBy(desc(romaneiosCargaToras.dataCarga), desc(romaneiosCargaToras.id));
  return origem ? resultado.filter((item) => (item.origem ?? "").toLocaleLowerCase("pt-BR").includes(origem)) : resultado;
}

export async function getRomaneioCargaComPlaquetas(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const carga = await db.select().from(romaneiosCargaToras).where(eq(romaneiosCargaToras.id, id)).limit(1);
  if (!carga[0]) return undefined;
  const itens = await db.select().from(plaquetas).where(eq(plaquetas.romaneioCargaId, id)).orderBy(asc(plaquetas.id));
  return { carga: carga[0], plaquetas: itens };
}

export function getModeloImportacaoPlaquetasCargaCsv() {
  return criarModeloCsvPlaquetasCarga();
}

export async function importarPlaquetasCargaCsv(
  input: { conteudo: string; dataCarga: Date; origem?: string | null; responsavel?: string | null; observacoes?: string | null; fretePorMetroCubico: string },
  criadoPor: number,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const codigosExistentes = await db.select({ codigo: plaquetas.codigo }).from(plaquetas);
  const preparo = prepararImportacaoPlaquetasCarga({ conteudo: input.conteudo, codigosExistentes });
  if (preparo.erros.length) return { importados: 0, erros: preparo.erros, numero: null as string | null };
  const carga = await criarRomaneioCargaToras({
    dataCarga: input.dataCarga,
    origem: input.origem ?? null,
    responsavel: input.responsavel ?? null,
    observacoes: input.observacoes ?? null,
    fretePorMetroCubico: input.fretePorMetroCubico,
    plaquetas: preparo.linhas.map(({ codigo, madeiraNome, diametro, comprimento, valorMetroCubico, observacoes }) => ({ codigo, madeiraNome, diametro, comprimento, valorMetroCubico, observacoes })),
    criadoPor,
  });
  return { importados: preparo.linhas.length, erros: [] as string[], numero: carga.numero };
}

type PlaquetaCargaEntrada = { codigo: string; madeiraNome: string; diametro: string; comprimento: string; valorMetroCubico: string; observacoes?: string | null };

function prepararPlaquetasCarga(entrada: PlaquetaCargaEntrada[]) {
  if (!entrada.length) throw new Error("Adicione ao menos uma plaqueta ao romaneio de carga");
  if (entrada.length > 200) throw new Error("O romaneio de carga suporta no máximo 200 plaquetas");
  const codigos = entrada.map((plaqueta) => normalizarCodigoPlaqueta(plaqueta.codigo));
  if (codigos.some((codigo) => !codigo)) throw new Error("Informe o código de todas as plaquetas");
  if (new Set(codigos).size !== codigos.length) throw new Error("Há códigos de plaqueta repetidos no mesmo romaneio de carga");
  return entrada.map((plaqueta, indice) => {
    const codigo = codigos[indice];
    const madeiraNome = plaqueta.madeiraNome.trim();
    if (!madeiraNome) throw new Error(`Informe a essência da plaqueta ${codigo}`);
    const diametro = Number(String(plaqueta.diametro).replace(",", "."));
    const comprimento = Number(String(plaqueta.comprimento).replace(",", "."));
    const valorMetroCubico = Number(String(plaqueta.valorMetroCubico).replace(",", "."));
    const volume = calcularVolumeToraCilindrica(diametro, comprimento);
    if (!Number.isFinite(valorMetroCubico) || valorMetroCubico <= 0) throw new Error(`Informe o valor por m³ da plaqueta ${codigo}`);
    return { codigo, madeiraNome, diametro, comprimento, volume, valorMetroCubico, valorTotal: Number((volume * valorMetroCubico).toFixed(2)), observacoes: plaqueta.observacoes?.trim() || null };
  });
}

function normalizarFreteCarga(valor: string) {
  const fretePorMetroCubico = Number(String(valor ?? "0").replace(",", "."));
  if (!Number.isFinite(fretePorMetroCubico) || fretePorMetroCubico < 0) throw new Error("Informe um frete por m³ válido");
  return fretePorMetroCubico;
}

export async function criarRomaneioCargaToras(data: {
  dataCarga: Date;
  origem?: string | null;
  responsavel?: string | null;
  observacoes?: string | null;
  fretePorMetroCubico: string;
  plaquetas: PlaquetaCargaEntrada[];
  criadoPor: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const plaquetasPreparadas = prepararPlaquetasCarga(data.plaquetas);
  const volumeTotal = plaquetasPreparadas.reduce((total, plaqueta) => total + plaqueta.volume, 0);
  const valorProdutos = plaquetasPreparadas.reduce((total, plaqueta) => total + plaqueta.valorTotal, 0);
  const fretePorMetroCubico = normalizarFreteCarga(data.fretePorMetroCubico);
  const frete = Number((volumeTotal * fretePorMetroCubico).toFixed(2));
  const valorTotal = valorProdutos + frete;
  return db.transaction(async (tx: any) => {
    for (const plaqueta of plaquetasPreparadas) {
      const existente = (await tx.select({ id: plaquetas.id }).from(plaquetas).where(eq(plaquetas.codigo, plaqueta.codigo)).limit(1))[0];
      if (existente) throw new Error(`A plaqueta ${plaqueta.codigo} já está cadastrada`);
    }
    const temporario = `TMP-${crypto.randomUUID().slice(0, 20)}`;
    const insercao = await tx.insert(romaneiosCargaToras).values({
      numero: temporario,
      dataCarga: data.dataCarga,
      origem: data.origem?.trim() || null,
      responsavel: data.responsavel?.trim() || null,
      observacoes: data.observacoes?.trim() || null,
      totalPlaquetas: plaquetasPreparadas.length,
      volumeTotal: volumeTotal.toFixed(6),
      valorProdutos: valorProdutos.toFixed(2),
      fretePorMetroCubico: fretePorMetroCubico.toFixed(2),
      frete: frete.toFixed(2),
      valorTotal: valorTotal.toFixed(2),
      criadoPor: data.criadoPor,
    });
    const id = getInsertedId(insercao as MysqlInsertResult);
    const numero = `CARGA-${String(id).padStart(6, "0")}`;
    await tx.update(romaneiosCargaToras).set({ numero }).where(eq(romaneiosCargaToras.id, id));
    for (const plaqueta of plaquetasPreparadas) {
      const insercaoPlaqueta = await tx.insert(plaquetas).values({
        codigo: plaqueta.codigo,
        madeiraNome: plaqueta.madeiraNome,
        comprimento: plaqueta.comprimento.toFixed(2),
        diametro: plaqueta.diametro.toFixed(2),
        volumeInicial: plaqueta.volume.toFixed(6),
        volumeDisponivel: plaqueta.volume.toFixed(6),
        valorMetroCubico: plaqueta.valorMetroCubico.toFixed(2),
        valorTotal: plaqueta.valorTotal.toFixed(2),
        dataEntrada: data.dataCarga,
        romaneioCargaId: id,
        origem: data.origem?.trim() || null,
        observacoes: plaqueta.observacoes,
        estado: "disponivel",
        criadoPor: data.criadoPor,
      });
      const plaquetaId = getInsertedId(insercaoPlaqueta as MysqlInsertResult);
      await tx.insert(movimentacoesPlaquetas).values({ plaquetaId, tipo: "entrada", volume: plaqueta.volume.toFixed(6), motivo: `Entrada pelo romaneio ${numero}`, criadoPor: data.criadoPor });
    }
    return { id, numero, totalPlaquetas: plaquetasPreparadas.length, volumeTotal, valorProdutos, fretePorMetroCubico, frete, valorTotal };
  });
}

export async function atualizarRomaneioCargaToras(id: number, data: {
  dataCarga: Date;
  origem?: string | null;
  responsavel?: string | null;
  observacoes?: string | null;
  fretePorMetroCubico: string;
  plaquetas: PlaquetaCargaEntrada[];
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const plaquetasPreparadas = prepararPlaquetasCarga(data.plaquetas);
  const volumeTotal = plaquetasPreparadas.reduce((total, plaqueta) => total + plaqueta.volume, 0);
  const valorProdutos = plaquetasPreparadas.reduce((total, plaqueta) => total + plaqueta.valorTotal, 0);
  const fretePorMetroCubico = normalizarFreteCarga(data.fretePorMetroCubico);
  const frete = Number((volumeTotal * fretePorMetroCubico).toFixed(2));
  const valorTotal = valorProdutos + frete;

  return db.transaction(async (tx: any) => {
    const carga = (await tx.select().from(romaneiosCargaToras).where(eq(romaneiosCargaToras.id, id)).limit(1))[0];
    if (!carga) throw new Error("Romaneio de carga não encontrado");
    const existentes = await tx.select().from(plaquetas).where(eq(plaquetas.romaneioCargaId, id));
    if (existentes.some((plaqueta: any) => plaqueta.estado !== "disponivel")) throw new Error("Este romaneio possui toras utilizadas na produção e não pode ser alterado");
    const existentesPorCodigo = new Map<string, any>(existentes.map((plaqueta: any) => [plaqueta.codigo, plaqueta]));

    for (const plaqueta of plaquetasPreparadas) {
      if (existentesPorCodigo.has(plaqueta.codigo)) continue;
      const duplicada = (await tx.select({ id: plaquetas.id }).from(plaquetas).where(eq(plaquetas.codigo, plaqueta.codigo)).limit(1))[0];
      if (duplicada) throw new Error(`A plaqueta ${plaqueta.codigo} já está cadastrada`);
    }
    for (const plaqueta of existentes) await tx.delete(movimentacoesPlaquetas).where(eq(movimentacoesPlaquetas.plaquetaId, plaqueta.id));
    const codigosAtualizados = new Set(plaquetasPreparadas.map((plaqueta) => plaqueta.codigo));
    for (const plaqueta of existentes) {
      if (!codigosAtualizados.has(plaqueta.codigo)) await tx.delete(plaquetas).where(eq(plaquetas.id, plaqueta.id));
    }

    for (const plaqueta of plaquetasPreparadas) {
      const valores = {
        madeiraNome: plaqueta.madeiraNome,
        comprimento: plaqueta.comprimento.toFixed(2),
        diametro: plaqueta.diametro.toFixed(2),
        volumeInicial: plaqueta.volume.toFixed(6),
        volumeDisponivel: plaqueta.volume.toFixed(6),
        valorMetroCubico: plaqueta.valorMetroCubico.toFixed(2),
        valorTotal: plaqueta.valorTotal.toFixed(2),
        dataEntrada: data.dataCarga,
        origem: data.origem?.trim() || null,
        observacoes: plaqueta.observacoes,
      };
      const existente = existentesPorCodigo.get(plaqueta.codigo);
      const plaquetaId = existente ? existente.id : getInsertedId(await tx.insert(plaquetas).values({ ...valores, codigo: plaqueta.codigo, romaneioCargaId: id, estado: "disponivel", criadoPor: carga.criadoPor }) as MysqlInsertResult);
      if (existente) await tx.update(plaquetas).set(valores).where(eq(plaquetas.id, plaquetaId));
      await tx.insert(movimentacoesPlaquetas).values({ plaquetaId, tipo: "entrada", volume: plaqueta.volume.toFixed(6), motivo: `Entrada pelo romaneio ${carga.numero}`, criadoPor: carga.criadoPor });
    }
    await tx.update(romaneiosCargaToras).set({ dataCarga: data.dataCarga, origem: data.origem?.trim() || null, responsavel: data.responsavel?.trim() || null, observacoes: data.observacoes?.trim() || null, totalPlaquetas: plaquetasPreparadas.length, volumeTotal: volumeTotal.toFixed(6), valorProdutos: valorProdutos.toFixed(2), fretePorMetroCubico: fretePorMetroCubico.toFixed(2), frete: frete.toFixed(2), valorTotal: valorTotal.toFixed(2) }).where(eq(romaneiosCargaToras.id, id));
    return { id, numero: carga.numero, totalPlaquetas: plaquetasPreparadas.length, volumeTotal, valorProdutos, fretePorMetroCubico, frete, valorTotal };
  });
}

export async function excluirRomaneioCargaToras(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.transaction(async (tx: any) => {
    const carga = (await tx.select().from(romaneiosCargaToras).where(eq(romaneiosCargaToras.id, id)).limit(1))[0];
    if (!carga) throw new Error("Romaneio de carga não encontrado");
    const itens = await tx.select().from(plaquetas).where(eq(plaquetas.romaneioCargaId, id));
    if (itens.some((plaqueta: any) => plaqueta.estado !== "disponivel")) {
      throw new Error("Este romaneio possui toras utilizadas na produção e não pode ser excluído");
    }

    for (const plaqueta of itens) {
      await tx.delete(movimentacoesPlaquetas).where(eq(movimentacoesPlaquetas.plaquetaId, plaqueta.id));
      await tx.delete(plaquetas).where(eq(plaquetas.id, plaqueta.id));
    }
    await tx.delete(romaneiosCargaToras).where(eq(romaneiosCargaToras.id, id));
    return { id, numero: carga.numero, totalPlaquetas: itens.length };
  });
}

export async function createPlaqueta(data: {
  codigo: string;
  madeiraNome: string;
  espessura?: string | null;
  largura?: string | null;
  comprimento?: string | null;
  volumeInicial: string;
  dataEntrada: Date;
  origem?: string | null;
  localizacao?: string | null;
  observacoes?: string | null;
  criadoPor: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const codigo = normalizarCodigoPlaqueta(data.codigo);
  const volumeInicial = Number(String(data.volumeInicial).replace(",", "."));
  if (!codigo || !data.madeiraNome.trim() || !Number.isFinite(volumeInicial) || volumeInicial <= 0) {
    throw new Error("Informe código, madeira e volume inicial válidos para a plaqueta");
  }
  const existente = await db.select({ id: plaquetas.id }).from(plaquetas).where(eq(plaquetas.codigo, codigo)).limit(1);
  if (existente[0]) throw new Error(`A plaqueta ${codigo} já está cadastrada`);
  const result = await db.insert(plaquetas).values({
    codigo,
    madeiraNome: data.madeiraNome.trim(),
    espessura: data.espessura ? Number(String(data.espessura).replace(",", ".")).toFixed(2) : null,
    largura: data.largura ? Number(String(data.largura).replace(",", ".")).toFixed(2) : null,
    comprimento: data.comprimento ? Number(String(data.comprimento).replace(",", ".")).toFixed(2) : null,
    volumeInicial: volumeInicial.toFixed(6),
    volumeDisponivel: volumeInicial.toFixed(6),
    dataEntrada: data.dataEntrada,
    origem: data.origem?.trim() || null,
    localizacao: data.localizacao?.trim() || null,
    observacoes: data.observacoes?.trim() || null,
    estado: "disponivel",
    criadoPor: data.criadoPor,
  });
  const id = getInsertedId(result as MysqlInsertResult);
  await db.insert(movimentacoesPlaquetas).values({ plaquetaId: id, tipo: "entrada", volume: volumeInicial.toFixed(6), motivo: "Entrada manual de plaqueta", criadoPor: data.criadoPor });
  return { id, codigo };
}

export async function listRomaneiosProducao() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: romaneiosProducao.id,
    numero: romaneiosProducao.numero,
    dataProducao: romaneiosProducao.dataProducao,
    fita: romaneiosProducao.fita,
    responsavel: romaneiosProducao.responsavel,
    estado: romaneiosProducao.estado,
    observacoes: romaneiosProducao.observacoes,
    plaquetaId: romaneiosProducao.plaquetaId,
    plaquetaCodigo: plaquetas.codigo,
    madeiraNome: plaquetas.madeiraNome,
    volumePlaqueta: plaquetas.volumeInicial,
    madeiraTora: romaneiosProducao.madeiraTora,
    espessuraTora: romaneiosProducao.espessuraTora,
    larguraTora: romaneiosProducao.larguraTora,
    comprimentoTora: romaneiosProducao.comprimentoTora,
    volumeTora: romaneiosProducao.volumeTora,
    aproveitamento: romaneiosProducao.aproveitamento,
    confirmadoEm: romaneiosProducao.confirmadoEm,
  }).from(romaneiosProducao)
    .innerJoin(plaquetas, eq(romaneiosProducao.plaquetaId, plaquetas.id))
    .orderBy(desc(romaneiosProducao.dataProducao), desc(romaneiosProducao.id));
}

export async function listItensRomaneioProducao(romaneioId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(itensRomaneioProducao).where(eq(itensRomaneioProducao.romaneioId, romaneioId)).orderBy(itensRomaneioProducao.id);
}

export async function getRomaneioProducaoComItens(romaneioId: number) {
  const db = await getDb();
  if (!db) return null;
  const romaneio = (await db.select({
    id: romaneiosProducao.id,
    numero: romaneiosProducao.numero,
    dataProducao: romaneiosProducao.dataProducao,
    fita: romaneiosProducao.fita,
    responsavel: romaneiosProducao.responsavel,
    observacoes: romaneiosProducao.observacoes,
    madeiraTora: romaneiosProducao.madeiraTora,
    espessuraTora: romaneiosProducao.espessuraTora,
    larguraTora: romaneiosProducao.larguraTora,
    comprimentoTora: romaneiosProducao.comprimentoTora,
    volumeTora: romaneiosProducao.volumeTora,
    aproveitamento: romaneiosProducao.aproveitamento,
    plaquetaCodigo: plaquetas.codigo,
    origemPlaqueta: plaquetas.origem,
    localizacaoPlaqueta: plaquetas.localizacao,
  }).from(romaneiosProducao).leftJoin(plaquetas, eq(romaneiosProducao.plaquetaId, plaquetas.id)).where(eq(romaneiosProducao.id, romaneioId)).limit(1))[0];
  if (!romaneio) return null;
  const [itens, toras] = await Promise.all([
    listItensRomaneioProducao(romaneioId),
    db.select({
      id: itensRomaneioToras.id,
      plaquetaId: itensRomaneioToras.plaquetaId,
      codigo: plaquetas.codigo,
      madeiraNome: itensRomaneioToras.madeiraNome,
      diametro: itensRomaneioToras.diametro,
      comprimento: itensRomaneioToras.comprimento,
      volume: itensRomaneioToras.volume,
    }).from(itensRomaneioToras).innerJoin(plaquetas, eq(itensRomaneioToras.plaquetaId, plaquetas.id)).where(eq(itensRomaneioToras.romaneioId, romaneioId)),
  ]);
  return { romaneio, itens, toras };
}

export async function confirmarRomaneioProducao(data: {
  plaquetaId?: number;
  tora?: { madeiraNome: string; diametro?: string | null; espessura?: string | null; largura?: string | null; comprimento?: string | null; volume: string };
  toras?: Array<{ plaquetaId: number; tora: { madeiraNome: string; diametro?: string | null; comprimento?: string | null; volume: string } }>;
  dataProducao: Date;
  fita?: string | null;
  responsavel?: string | null;
  observacoes?: string | null;
  itens: ItemProducaoEntrada[];
  criadoPor: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async (tx) => {
    const entradasToras = data.toras ?? (data.plaquetaId && data.tora ? [{ plaquetaId: data.plaquetaId, tora: data.tora }] : []);
    if (!entradasToras.length) throw new Error("Selecione ao menos uma plaqueta para o romaneio");
    const plaquetasSelecionadas = [];
    for (const entrada of entradasToras) {
      const plaqueta = (await tx.select().from(plaquetas).where(eq(plaquetas.id, entrada.plaquetaId)).limit(1))[0];
      plaquetasSelecionadas.push({ plaqueta, tora: entrada.tora });
    }
    const calculo = validarConfirmacaoRomaneio({ toras: plaquetasSelecionadas, itens: data.itens });
    const primeiraTora = calculo.toras[0];
    const numeroTemporario = `TMP-${crypto.randomUUID().slice(0, 20)}`;
    const insercaoRomaneio = await tx.insert(romaneiosProducao).values({
      numero: numeroTemporario,
      plaquetaId: primeiraTora.plaqueta.id,
      totalToras: calculo.totalToras,
      madeiraTora: primeiraTora.tora.madeiraNome.trim(),
      espessuraTora: null,
      larguraTora: null,
      comprimentoTora: primeiraTora.tora.comprimento ? Number(primeiraTora.tora.comprimento).toFixed(2) : null,
      volumeTora: calculo.volumeTora.toFixed(6),
      aproveitamento: calculo.aproveitamento.toFixed(2),
      dataProducao: data.dataProducao,
      fita: data.fita?.trim() || null,
      responsavel: data.responsavel?.trim() || null,
      observacoes: data.observacoes?.trim() || null,
      estado: "confirmado",
      confirmadoEm: new Date(),
      confirmadoPor: data.criadoPor,
      criadoPor: data.criadoPor,
    });
    const romaneioId = getInsertedId(insercaoRomaneio as MysqlInsertResult);
    const numero = `ROM-${String(romaneioId).padStart(6, "0")}`;
    await tx.update(romaneiosProducao).set({ numero }).where(eq(romaneiosProducao.id, romaneioId));

    for (const entrada of calculo.toras) {
      const plaquetaId = entrada.plaqueta.id!;
      await tx.insert(itensRomaneioToras).values({
        romaneioId,
        plaquetaId,
        madeiraNome: entrada.tora.madeiraNome.trim(),
        diametro: entrada.tora.diametro ? Number(entrada.tora.diametro).toFixed(2) : null,
        comprimento: entrada.tora.comprimento ? Number(entrada.tora.comprimento).toFixed(2) : null,
        volume: entrada.volume.toFixed(6),
      });
      await tx.update(plaquetas).set({
        madeiraNome: entrada.tora.madeiraNome.trim(),
        diametro: entrada.tora.diametro ? Number(entrada.tora.diametro).toFixed(2) : null,
        comprimento: entrada.tora.comprimento ? Number(entrada.tora.comprimento).toFixed(2) : null,
        volumeInicial: entrada.volume.toFixed(6),
        volumeDisponivel: "0.000000",
        estado: "consumida",
      }).where(eq(plaquetas.id, plaquetaId));
      await tx.insert(movimentacoesPlaquetas).values({
        plaquetaId,
        romaneioId,
        tipo: "consumo",
        volume: entrada.volume.toFixed(6),
        motivo: `Consumo no romaneio ${numero}`,
        criadoPor: data.criadoPor,
      });
    }

    for (const item of calculo.itens) {
      const dimensoes = {
        madeiraNome: item.madeiraNome,
        espessura: item.espessura.toFixed(2),
        largura: item.largura.toFixed(2),
        comprimento: item.comprimento.toFixed(2),
      };
      const insercaoItem = await tx.insert(itensRomaneioProducao).values({
        romaneioId,
        ...dimensoes,
        quantidade: item.quantidade,
        metrosLineares: item.metrosLineares.toFixed(4),
        volume: item.volume.toFixed(6),
      });
      const itemRomaneioId = getInsertedId(insercaoItem as MysqlInsertResult);
      const insercaoLote = await tx.insert(lotesPecasSerradas).values({
        romaneioId,
        itemRomaneioId,
        ...dimensoes,
        quantidadeProduzida: item.quantidade,
        quantidadeDisponivel: item.quantidade,
        metrosLineares: item.metrosLineares.toFixed(4),
        volume: item.volume.toFixed(6),
        estado: "disponivel",
      });
      const loteId = getInsertedId(insercaoLote as MysqlInsertResult);
      await tx.insert(movimentacoesEstoqueSerrado).values({ loteId, tipo: "entrada_producao", quantidade: item.quantidade, motivo: `Entrada do romaneio ${numero}`, criadoPor: data.criadoPor });
    }
    return { id: romaneioId, numero, ...calculo };
  });
}

export async function getResumoEstoqueSerrado() {
  const db = await getDb();
  if (!db) return [];
  const lotes = await db.select().from(lotesPecasSerradas);
  return agruparEstoquePecas(lotes.filter((lote) => lote.estado === "disponivel" && lote.quantidadeDisponivel > 0));
}

export async function entregarVendaFisicamente(vendaId: number, userId: number, dependencias?: { database?: any }) {
  const db = dependencias?.database ?? await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async (tx: any) => {
    const venda = (await tx.select().from(orcamentos).where(eq(orcamentos.id, vendaId)).limit(1))[0];
    if (!venda) throw new Error("Venda não encontrada");
    if (venda.estado !== "aprovado") throw new Error("Somente vendas aprovadas podem ser entregues");
    if (!venda.pago) throw new Error("Confirme o recebimento antes de registrar a entrega física");
    if (venda.entregue) throw new Error("Esta venda já possui entrega física registrada");

    const [itens, lotes] = await Promise.all([
      tx.select().from(itensOrcamento).where(eq(itensOrcamento.orcamentoId, vendaId)),
      tx.select().from(lotesPecasSerradas),
    ]);
    const alocacoes = alocarPecasParaEntrega(itens, lotes);
    const lotesPorId = new Map<number, any>(lotes.map((lote: any) => [lote.id, lote] as [number, any]));
    for (const alocacao of alocacoes) {
      const lote = lotesPorId.get(alocacao.loteId);
      if (!lote) throw new Error("Lote de peças não encontrado durante a entrega");
      const saldo = Number(lote.quantidadeDisponivel) - alocacao.quantidade;
      if (saldo < 0) throw new Error("O saldo do lote foi alterado durante a confirmação. Revise o estoque e tente novamente.");
      await tx.update(lotesPecasSerradas).set({ quantidadeDisponivel: saldo, estado: saldo === 0 ? "esgotado" : "disponivel" }).where(eq(lotesPecasSerradas.id, lote.id));
      await tx.insert(movimentacoesEstoqueSerrado).values({
        loteId: lote.id,
        itemVendaId: alocacao.itemVendaId,
        tipo: "saida_entrega",
        quantidade: alocacao.quantidade,
        motivo: `Entrega física da venda ${venda.numero ?? venda.id}`,
        criadoPor: userId,
      });
    }
    const entregueEm = new Date();
    await tx.update(orcamentos).set({ entregue: true, entregueEm, entreguePor: userId }).where(eq(orcamentos.id, vendaId));
    await tx.insert(historicoAlteracoes).values({
      orcamentoId: vendaId,
      usuarioId: userId,
      tipo: "alteracao" as any,
      detalhes: JSON.stringify({ acao: "entrega_fisica_confirmada", entregueEm: entregueEm.toISOString(), alocacoes }),
    });
    return { success: true, entregueEm, pecasEntregues: alocacoes.reduce((total, alocacao) => total + alocacao.quantidade, 0) };
  });
}

export async function estornarEntregaVenda(vendaId: number, userId: number, motivo: string, dependencias?: { database?: any }) {
  const db = dependencias?.database ?? await getDb();
  if (!db) throw new Error("Database not available");
  if (motivo.trim().length < 3) throw new Error("Informe o motivo do estorno da entrega");
  return db.transaction(async (tx: any) => {
    const venda = (await tx.select().from(orcamentos).where(eq(orcamentos.id, vendaId)).limit(1))[0];
    if (!venda?.entregue) throw new Error("Esta venda não possui entrega física para estornar");
    const itens = await tx.select({ id: itensOrcamento.id }).from(itensOrcamento).where(eq(itensOrcamento.orcamentoId, vendaId));
    const idsItens = new Set(itens.map((item: any) => item.id));
    const saidas = (await tx.select().from(movimentacoesEstoqueSerrado)).filter((movimento: any) => movimento.tipo === "saida_entrega" && movimento.itemVendaId && idsItens.has(movimento.itemVendaId));
    if (!saidas.length) throw new Error("Não foram encontradas peças baixadas para esta entrega");
    const lotes = await tx.select().from(lotesPecasSerradas);
    const lotesPorId = new Map<number, any>(lotes.map((lote: any) => [lote.id, lote] as [number, any]));
    for (const saida of saidas) {
      const lote = lotesPorId.get(saida.loteId);
      if (!lote) throw new Error("Lote de peças não encontrado durante o estorno");
      const saldo = Number(lote.quantidadeDisponivel) + saida.quantidade;
      await tx.update(lotesPecasSerradas).set({ quantidadeDisponivel: saldo, estado: "disponivel" }).where(eq(lotesPecasSerradas.id, lote.id));
      await tx.insert(movimentacoesEstoqueSerrado).values({ loteId: lote.id, itemVendaId: saida.itemVendaId, tipo: "estorno_entrega", quantidade: saida.quantidade, motivo: motivo.trim(), criadoPor: userId });
    }
    await tx.update(orcamentos).set({ entregue: false, entregueEm: null, entreguePor: null }).where(eq(orcamentos.id, vendaId));
    await tx.insert(historicoAlteracoes).values({ orcamentoId: vendaId, usuarioId: userId, tipo: "alteracao" as any, detalhes: JSON.stringify({ acao: "entrega_fisica_estornada", motivo: motivo.trim() }) });
    return { success: true, pecasDevolvidas: saidas.reduce((total: number, saida: any) => total + saida.quantidade, 0) };
  });
}
