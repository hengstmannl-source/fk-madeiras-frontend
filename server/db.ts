import { eq, and, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users, madeiras, bitolas, clientes,
  orcamentos, itensOrcamento, historicoAlteracoes,
  type InsertMadeira, type InsertBitola, type InsertCliente,
  type InsertOrcamento, type InsertItemOrcamento,
} from "../drizzle/schema";
import { ENV } from './_core/env';

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

export async function createOrcamento(data: InsertOrcamento, itens: Partial<InsertItemOrcamento>[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(orcamentos).values(data);
  const orcId = result[0].insertId;
  if (itens.length > 0) {
    const itensWithOrcId: InsertItemOrcamento[] = itens.map((i): InsertItemOrcamento => ({
      orcamentoId: orcId,
      madeiraId: i.madeiraId!,
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

export async function updateOrcamento(id: number, data: Partial<InsertOrcamento>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(orcamentos).set(data).where(eq(orcamentos.id, id));
  return { success: true };
}

export async function deleteOrcamento(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(itensOrcamento).where(eq(itensOrcamento.orcamentoId, id));
  await db.delete(orcamentos).where(eq(orcamentos.id, id));
  return { success: true };
}

export async function updateOrcamentoEstado(id: number, novoEstado: "rascunho" | "enviado" | "aprovado" | "rejeitado", userId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(orcamentos).set({ estado: novoEstado }).where(eq(orcamentos.id, id));
  if (userId) {
    await db.insert(historicoAlteracoes).values({
      orcamentoId: id,
      usuarioId: userId,
      tipo: "estado" as any,
      detalhes: JSON.stringify({ novoEstado }),
    });
  }
  return { success: true };
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
