import { eq, and, asc, desc, gte, lte, ne, inArray, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users, madeiras, bitolas, clientes,
  orcamentos, itensOrcamento, modelosMedidaVenda, historicoAlteracoes, empresaConfiguracoes,
  empresas, empresaMembros, credenciaisUsuarios, convitesEmpresa, recuperacoesSenha,
  fornecedores, categoriasFinanceiras, contasFinanceiras, titulosFinanceiros, sequenciasVendas,
  baixasFinanceiras, recorrenciasFinanceiras, configuracoesFinanceiras, alertasFinanceiros, extratosBancarios, movimentosExtratoBancario, anexosFinanceiros,
  plaquetas, romaneiosCargaToras, romaneiosProducao, itensRomaneioToras, itensRomaneioProducao, lotesPecasSerradas, movimentacoesPlaquetas, movimentacoesEstoqueSerrado, notasDiesel, abastecimentosDiesel,
  type InsertMadeira, type InsertBitola, type InsertCliente,
  type InsertOrcamento, type InsertItemOrcamento, type InsertModeloMedidaVenda, type InsertFornecedor,
  type InsertCategoriaFinanceira, type InsertContaFinanceira,
  type InsertTituloFinanceiro, type InsertBaixaFinanceira, type InsertRecorrenciaFinanceira,
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { calcularEstadoTitulo, calcularPrevisaoSemanal, calcularRelatorioFluxoCaixa, decimalParaNumero, planejarAtualizacaoAlertas, podeCancelarTituloFinanceiro, podeEstornarBaixa, proximoVencimento, saldoAbertoTitulo, tipoAlertaAtualDoTitulo } from "./financeiro.logic";
import { criarModeloCsvLancamentos, exportarLancamentosCsv, prepararImportacaoLancamentos } from "./financeiro.intercambio";
import { criarModeloCsvFornecedores, prepararImportacaoFornecedores } from "./fornecedores.intercambio";
import { criarModeloCsvPlaquetasCarga, prepararImportacaoPlaquetasCarga } from "./estoque.intercambio";
import { alocarPecasPermitindoNegativo, agruparEstoquePecas, calcularItemRomaneio, calcularVolumeToraCilindrica, converterDimensoesVendaParaEstoque, normalizarCodigoPlaqueta, validarConfirmacaoRomaneio, type ItemProducaoEntrada } from "./producao.logic";
import { calcularRelatorioInventarioSerrado } from "./inventario.logic";
import { criarModeloCsvPecasProducao, criarModeloCsvTorasProducao, prepararImportacaoTorasProducao, validarCsvPecasProducao } from "./producao.intercambio";
import { calcularCustoAbastecimentoDiesel, calcularResumoTanqueDiesel } from "./diesel.logic";
import { criarModeloCsvExtratoBancario, prepararImportacaoExtrato } from "./conciliacao.intercambio";
import { sugerirConciliacoes } from "./conciliacao.logic";
import { numerarDuplicidadesPlaquetas } from "../shared/plaquetas";

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

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function getCredencialPorEmail(emailNormalizado: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select({ credencial: credenciaisUsuarios, usuario: users })
    .from(credenciaisUsuarios)
    .innerJoin(users, eq(users.id, credenciaisUsuarios.usuarioId))
    .where(eq(credenciaisUsuarios.emailNormalizado, emailNormalizado))
    .limit(1);
  return result[0];
}

export async function getEmpresaAtivaDoUsuario(usuarioId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select({ membro: empresaMembros, empresa: empresas })
    .from(empresaMembros)
    .innerJoin(empresas, eq(empresas.id, empresaMembros.empresaId))
    .where(and(eq(empresaMembros.usuarioId, usuarioId), eq(empresaMembros.ativo, true), eq(empresas.ativa, true)))
    .orderBy(asc(empresaMembros.id))
    .limit(1);
  return result[0];
}

export async function listarEmpresasDoUsuario(usuarioId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ membro: empresaMembros, empresa: empresas })
    .from(empresaMembros)
    .innerJoin(empresas, eq(empresas.id, empresaMembros.empresaId))
    .where(and(eq(empresaMembros.usuarioId, usuarioId), eq(empresaMembros.ativo, true), eq(empresas.ativa, true)))
    .orderBy(asc(empresas.nome));
}

export async function registrarFalhaAutenticacao(credencialId: number, bloqueadoAte: Date | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(credenciaisUsuarios)
    .set({ tentativasFalhas: sql`${credenciaisUsuarios.tentativasFalhas} + 1`, bloqueadoAte })
    .where(eq(credenciaisUsuarios.id, credencialId));
}

export async function limparFalhasAutenticacao(credencialId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(credenciaisUsuarios).set({ tentativasFalhas: 0, bloqueadoAte: null }).where(eq(credenciaisUsuarios.id, credencialId));
}

export async function listarMembrosEmpresa(empresaId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ membro: empresaMembros, usuario: users })
    .from(empresaMembros)
    .innerJoin(users, eq(users.id, empresaMembros.usuarioId))
    .where(eq(empresaMembros.empresaId, empresaId))
    .orderBy(asc(users.name));
}

export async function criarConviteEmpresa(data: {
  empresaId: number;
  emailNormalizado: string;
  papel: "administrador" | "financeiro" | "vendas" | "producao" | "consulta";
  tokenHash: string;
  expiraEm: Date;
  convidadoPor: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(convitesEmpresa).values(data);
  return getInsertedId(result as MysqlInsertResult);
}

export async function getConviteValidoPorHash(tokenHash: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select({ convite: convitesEmpresa, empresa: empresas })
    .from(convitesEmpresa)
    .innerJoin(empresas, eq(empresas.id, convitesEmpresa.empresaId))
    .where(eq(convitesEmpresa.tokenHash, tokenHash))
    .limit(1);
  const encontrado = result[0];
  if (!encontrado || encontrado.convite.aceitoEm || encontrado.convite.canceladoEm || encontrado.convite.expiraEm <= new Date() || !encontrado.empresa.ativa) return undefined;
  return encontrado;
}

export async function aceitarConviteCriandoUsuario(data: {
  tokenHash: string;
  nome: string;
  senhaHash: string;
  openId: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async tx => {
    const resultadoConvite = await tx
      .select()
      .from(convitesEmpresa)
      .where(eq(convitesEmpresa.tokenHash, data.tokenHash))
      .limit(1);
    const convite = resultadoConvite[0];
    if (!convite || convite.aceitoEm || convite.canceladoEm || convite.expiraEm <= new Date()) {
      throw new Error("CONVITE_INVALIDO");
    }

    const credencialExistente = await tx
      .select()
      .from(credenciaisUsuarios)
      .where(eq(credenciaisUsuarios.emailNormalizado, convite.emailNormalizado))
      .limit(1);
    if (credencialExistente[0]) throw new Error("EMAIL_JA_CADASTRADO");

    const resultadoUsuario = await tx.insert(users).values({
      openId: data.openId,
      name: data.nome,
      email: convite.emailNormalizado,
      loginMethod: "senha",
      role: "user",
      lastSignedIn: new Date(),
    });
    const usuarioId = Number((resultadoUsuario as MysqlInsertResult)[0]?.insertId ?? 0);
    if (!usuarioId) throw new Error("FALHA_AO_CRIAR_USUARIO");

    await tx.insert(credenciaisUsuarios).values({
      usuarioId,
      emailNormalizado: convite.emailNormalizado,
      senhaHash: data.senhaHash,
    });
    await tx.insert(empresaMembros).values({
      empresaId: convite.empresaId,
      usuarioId,
      papel: convite.papel,
      ativo: true,
      convidadoPor: convite.convidadoPor,
    });
    await tx.update(convitesEmpresa).set({ aceitoEm: new Date(), aceitoPor: usuarioId }).where(eq(convitesEmpresa.id, convite.id));
    return { usuarioId, empresaId: convite.empresaId };
  });
}

export async function criarEmpresaComProprietario(data: {
  nomeEmpresa: string;
  nomeFantasia?: string;
  documento?: string;
  emailEmpresa?: string;
  telefone?: string;
  nomeProprietario: string;
  emailNormalizado: string;
  senhaHash: string;
  openId: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async tx => {
    const emailExistente = await tx
      .select({ id: credenciaisUsuarios.id })
      .from(credenciaisUsuarios)
      .where(eq(credenciaisUsuarios.emailNormalizado, data.emailNormalizado))
      .limit(1);
    if (emailExistente[0]) throw new Error("EMAIL_JA_CADASTRADO");

    const resultadoEmpresa = await tx.insert(empresas).values({
      nome: data.nomeEmpresa,
      nomeFantasia: data.nomeFantasia ?? null,
      documento: data.documento ?? null,
      email: data.emailEmpresa ?? data.emailNormalizado,
      telefone: data.telefone ?? null,
    });
    const empresaId = Number((resultadoEmpresa as MysqlInsertResult)[0]?.insertId ?? 0);
    if (!empresaId) throw new Error("FALHA_AO_CRIAR_EMPRESA");

    const resultadoUsuario = await tx.insert(users).values({
      openId: data.openId,
      name: data.nomeProprietario,
      email: data.emailNormalizado,
      loginMethod: "senha",
      role: "user",
      lastSignedIn: new Date(),
    });
    const usuarioId = Number((resultadoUsuario as MysqlInsertResult)[0]?.insertId ?? 0);
    if (!usuarioId) throw new Error("FALHA_AO_CRIAR_USUARIO");

    await tx.insert(credenciaisUsuarios).values({ usuarioId, emailNormalizado: data.emailNormalizado, senhaHash: data.senhaHash });
    await tx.insert(empresaMembros).values({ empresaId, usuarioId, papel: "proprietario", ativo: true });
    await tx.insert(empresaConfiguracoes).values({ id: empresaId, empresaId });
    await tx.insert(configuracoesFinanceiras).values({ id: empresaId, empresaId });
    return { usuarioId, empresaId };
  });
}

// ─── Madeiras ───
export async function listMadeiras(empresaId = 1) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(madeiras).where(eq(madeiras.empresaId, empresaId)).orderBy(desc(madeiras.createdAt));
}

export async function getMadeiraById(id: number, empresaId = 1) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(madeiras).where(and(eq(madeiras.id, id), eq(madeiras.empresaId, empresaId))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createMadeira(data: InsertMadeira) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(madeiras).values(data);
  return result;
}

export async function updateMadeira(id: number, data: Partial<InsertMadeira>, empresaId = 1) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(madeiras).set(data).where(and(eq(madeiras.id, id), eq(madeiras.empresaId, empresaId)));
  return { success: true };
}

export async function deleteMadeira(id: number, empresaId = 1) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(madeiras).set({ ativo: false }).where(and(eq(madeiras.id, id), eq(madeiras.empresaId, empresaId)));
  return { success: true };
}

// ─── Bitolas ───
export async function listBitolas(madeiraId?: number, empresaId = 1) {
  const db = await getDb();
  if (!db) return [];
  if (madeiraId) {
    return db.select().from(bitolas).where(and(eq(bitolas.madeiraId, madeiraId), eq(bitolas.empresaId, empresaId))).orderBy(desc(bitolas.createdAt));
  }
  return db.select().from(bitolas).where(eq(bitolas.empresaId, empresaId)).orderBy(desc(bitolas.createdAt));
}

export async function getBitolaById(id: number, empresaId = 1) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(bitolas).where(and(eq(bitolas.id, id), eq(bitolas.empresaId, empresaId))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createBitola(data: InsertBitola) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(bitolas).values(data);
  return result;
}

export async function updateBitola(id: number, data: Partial<InsertBitola>, empresaId = 1) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(bitolas).set(data).where(and(eq(bitolas.id, id), eq(bitolas.empresaId, empresaId)));
  return { success: true };
}

export async function deleteBitola(id: number, empresaId = 1) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(bitolas).where(and(eq(bitolas.id, id), eq(bitolas.empresaId, empresaId)));
  return { success: true };
}

// ─── Clientes ───
export async function listClientes(empresaId = 1) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(clientes).where(and(eq(clientes.ativo, true), eq(clientes.empresaId, empresaId))).orderBy(desc(clientes.createdAt));
}

export async function listAllClientes(empresaId = 1) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(clientes).where(eq(clientes.empresaId, empresaId)).orderBy(desc(clientes.createdAt));
}

export async function getClienteById(id: number, empresaId = 1) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(clientes).where(and(eq(clientes.id, id), eq(clientes.empresaId, empresaId))).limit(1);
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

export async function updateCliente(id: number, data: Partial<InsertCliente>, empresaId = 1) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(clientes).set(data).where(and(eq(clientes.id, id), eq(clientes.empresaId, empresaId)));
  return { success: true };
}

export async function deleteCliente(id: number, empresaId = 1) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(clientes).set({ ativo: false }).where(and(eq(clientes.id, id), eq(clientes.empresaId, empresaId)));
  return { success: true };
}

// ─── Configuração da Empresa ───
export async function getEmpresaConfiguracao(empresaId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(empresaConfiguracoes).where(eq(empresaConfiguracoes.empresaId, empresaId)).limit(1);
  return result[0];
}

export async function saveEmpresaLogo(empresaId: number, logo: { key: string; url: string; mimeType: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(empresaConfiguracoes).values({
    id: empresaId,
    empresaId,
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
  return getEmpresaConfiguracao(empresaId);
}

export async function clearEmpresaLogo(empresaId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(empresaConfiguracoes).values({ id: empresaId, empresaId }).onDuplicateKeyUpdate({
    set: { logoKey: null, logoUrl: null, logoMimeType: null },
  });
  return getEmpresaConfiguracao(empresaId);
}

// ─── Orçamentos ───
export async function listModelosMedidaVenda(empresaId = 1) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(modelosMedidaVenda).where(eq(modelosMedidaVenda.empresaId, empresaId)).orderBy(asc(modelosMedidaVenda.nome));
}

export async function createModeloMedidaVenda(data: InsertModeloMedidaVenda) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const resultado = await db.insert(modelosMedidaVenda).values(data);
  return Number(resultado[0].insertId);
}

export async function deleteModeloMedidaVenda(id: number, userId: number, empresaId = 1) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(modelosMedidaVenda).where(and(eq(modelosMedidaVenda.id, id), eq(modelosMedidaVenda.criadoPor, userId), eq(modelosMedidaVenda.empresaId, empresaId)));
}

export async function listOrcamentos(filters?: { estado?: string; clienteId?: number }, empresaId = 1) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  conditions.push(eq(orcamentos.empresaId, empresaId));
  if (filters?.estado) conditions.push(eq(orcamentos.estado, filters.estado as any));
  if (filters?.clienteId) conditions.push(eq(orcamentos.clienteId, filters.clienteId));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select().from(orcamentos).where(where).orderBy(desc(orcamentos.createdAt));
}

export async function getOrcamentoWithItems(id: number, empresaId = 1) {
  const db = await getDb();
  if (!db) return undefined;
  const orc = await db.select().from(orcamentos).where(and(eq(orcamentos.id, id), eq(orcamentos.empresaId, empresaId))).limit(1);
  if (orc.length === 0) return undefined;
  const itens = await db.select().from(itensOrcamento).where(eq(itensOrcamento.orcamentoId, id));
  return { orcamento: orc[0], itens };
}

export function podeAlterarOrcamentoPago(pago: boolean, confirmacaoDupla: boolean) {
  return !pago || confirmacaoDupla;
}

export async function getOrcamentoById(id: number, empresaId = 1) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(orcamentos).where(and(eq(orcamentos.id, id), eq(orcamentos.empresaId, empresaId))).limit(1);
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
export type OrigemTituloFinanceiro = "orcamento" | "romaneio_carga" | "manual" | "recorrencia";

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
  empresaId?: number;
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

export async function listFornecedores(empresaId = 1) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(fornecedores).where(and(eq(fornecedores.ativo, true), eq(fornecedores.empresaId, empresaId))).orderBy(desc(fornecedores.createdAt));
}

export async function createFornecedor(data: InsertFornecedor) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(fornecedores).values(data);
  return { id: getInsertedId(result as MysqlInsertResult) };
}

export function getModeloImportacaoFornecedoresCsv() {
  return criarModeloCsvFornecedores();
}

export async function prepararImportacaoFornecedoresCsv(
  conteudo: string,
  dependencias?: { database?: any; empresaId?: number; fornecedoresExistentes?: Array<{ id: number; nome: string; email?: string | null; documento?: string | null }> },
) {
  const db = dependencias?.database ?? await getDb();
  if (!db) throw new Error("Database not available");
  const fornecedoresExistentes = dependencias?.fornecedoresExistentes ?? await db.select({
    id: fornecedores.id,
    nome: fornecedores.nome,
    email: fornecedores.email,
    documento: fornecedores.documento,
  }).from(fornecedores).where(eq(fornecedores.empresaId, dependencias?.empresaId ?? 1));
  return prepararImportacaoFornecedores({ conteudo, fornecedoresExistentes });
}

export async function importarFornecedoresCsv(
  conteudo: string,
  userId: number,
  empresaIdOuDependencias: number | { database?: any; fornecedoresExistentes?: Array<{ id: number; nome: string; email?: string | null; documento?: string | null }> } = 1,
  dependencias?: { database?: any; fornecedoresExistentes?: Array<{ id: number; nome: string; email?: string | null; documento?: string | null }> },
) {
  const empresaId = typeof empresaIdOuDependencias === "number" ? empresaIdOuDependencias : 1;
  const dependenciasResolvidas = typeof empresaIdOuDependencias === "number" ? dependencias : empresaIdOuDependencias;
  const db = dependenciasResolvidas?.database ?? await getDb();
  if (!db) throw new Error("Database not available");
  const preparo = await prepararImportacaoFornecedoresCsv(conteudo, { database: db, empresaId, fornecedoresExistentes: dependenciasResolvidas?.fornecedoresExistentes });
  if (preparo.erros.length) return { importados: 0, erros: preparo.erros };
  await db.transaction(async (tx: any) => {
    await tx.insert(fornecedores).values(preparo.linhas.map((linha) => ({
      nome: linha.nome,
      contacto: linha.contacto,
      email: linha.email,
      documento: linha.documento,
      endereco: linha.endereco,
      observacoes: linha.observacoes,
      ativo: true,
      criadoPor: userId,
      empresaId,
    })));
  });
  return { importados: preparo.linhas.length, erros: [] as string[] };
}

export async function updateFornecedor(id: number, data: Partial<InsertFornecedor>, empresaId = 1) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(fornecedores).set(data).where(and(eq(fornecedores.id, id), eq(fornecedores.empresaId, empresaId)));
  return { success: true };
}

export async function archiveFornecedor(id: number, empresaId = 1) {
  return updateFornecedor(id, { ativo: false }, empresaId);
}

export async function listCategoriasFinanceiras(empresaId = 1) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(categoriasFinanceiras).where(and(eq(categoriasFinanceiras.ativo, true), eq(categoriasFinanceiras.empresaId, empresaId))).orderBy(desc(categoriasFinanceiras.createdAt));
}

export async function createCategoriaFinanceira(data: InsertCategoriaFinanceira) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(categoriasFinanceiras).values(data);
  return { id: getInsertedId(result as MysqlInsertResult) };
}

export async function updateCategoriaFinanceira(id: number, data: Partial<InsertCategoriaFinanceira>, empresaId = 1) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(categoriasFinanceiras).set(data).where(and(eq(categoriasFinanceiras.id, id), eq(categoriasFinanceiras.empresaId, empresaId)));
  return { success: true };
}

export async function listContasFinanceiras(empresaId = 1) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contasFinanceiras).where(and(eq(contasFinanceiras.ativa, true), eq(contasFinanceiras.empresaId, empresaId))).orderBy(desc(contasFinanceiras.createdAt));
}

export async function createContaFinanceira(data: InsertContaFinanceira) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(contasFinanceiras).values(data);
  return { id: getInsertedId(result as MysqlInsertResult) };
}

export async function updateContaFinanceira(id: number, data: Partial<InsertContaFinanceira>, empresaId = 1) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(contasFinanceiras).set(data).where(and(eq(contasFinanceiras.id, id), eq(contasFinanceiras.empresaId, empresaId)));
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

async function getOrCreateCategoriaCustoMateriaPrima(tx: any, userId: number): Promise<number> {
  const existente = await tx.select().from(categoriasFinanceiras)
    .where(and(eq(categoriasFinanceiras.nome, "Custo de matéria-prima"), eq(categoriasFinanceiras.ativo, true))).limit(1);
  if (existente[0]) return existente[0].id;
  const result = await tx.insert(categoriasFinanceiras).values({
    nome: "Custo de matéria-prima",
    tipo: "despesa",
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
    empresaId: input.empresaId ?? 1,
  };
  const result = await db.insert(titulosFinanceiros).values(data);
  return { id: getInsertedId(result as MysqlInsertResult) };
}

export async function getTituloFinanceiroById(id: number, empresaId = 1) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(titulosFinanceiros).where(and(eq(titulosFinanceiros.id, id), eq(titulosFinanceiros.empresaId, empresaId))).limit(1);
  return result[0];
}

export async function listAnexosFinanceiros(tituloId: number, empresaId = 1) {
  const db = await getDb();
  if (!db) return [];
  const titulo = await getTituloFinanceiroById(tituloId, empresaId);
  if (!titulo) return [];
  return db.select().from(anexosFinanceiros)
    .where(eq(anexosFinanceiros.tituloId, tituloId))
    .orderBy(desc(anexosFinanceiros.createdAt));
}

export async function createAnexoFinanceiro(input: {
  tituloId: number;
  nomeArquivo: string;
  mimeType: string;
  tamanhoBytes: number;
  tipo: "nota_fiscal" | "boleto" | "comprovante" | "outro";
  storageKey: string;
  url: string;
  criadoPor: number;
  empresaId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const titulo = await getTituloFinanceiroById(input.tituloId, input.empresaId ?? 1);
  if (!titulo) throw new Error("Lançamento financeiro não encontrado");
  const result = await db.insert(anexosFinanceiros).values(input);
  return { id: getInsertedId(result as MysqlInsertResult), ...input };
}

export async function removerAnexoFinanceiro(input: { id: number; tituloId: number; empresaId?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const titulo = await getTituloFinanceiroById(input.tituloId, input.empresaId ?? 1);
  if (!titulo) throw new Error("Lançamento financeiro não encontrado");
  const anexo = (await db.select().from(anexosFinanceiros)
    .where(and(eq(anexosFinanceiros.id, input.id), eq(anexosFinanceiros.tituloId, input.tituloId))).limit(1))[0];
  if (!anexo) throw new Error("Anexo financeiro não encontrado");
  await db.delete(anexosFinanceiros).where(eq(anexosFinanceiros.id, anexo.id));
  return { success: true, id: anexo.id };
}

export async function atualizarDadosBoleto(input: {
  tituloId: number;
  codigoBarrasBoleto: string | null;
  linhaDigitavelBoleto: string | null;
  empresaId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const titulo = await getTituloFinanceiroById(input.tituloId, input.empresaId ?? 1);
  if (!titulo) throw new Error("Lançamento financeiro não encontrado");
  const boletoConfirmadoEm = input.codigoBarrasBoleto || input.linhaDigitavelBoleto ? new Date() : null;
  await db.update(titulosFinanceiros).set({
    codigoBarrasBoleto: input.codigoBarrasBoleto,
    linhaDigitavelBoleto: input.linhaDigitavelBoleto,
    boletoConfirmadoEm,
  }).where(and(eq(titulosFinanceiros.id, input.tituloId), eq(titulosFinanceiros.empresaId, input.empresaId ?? 1)));
  return { ...input, boletoConfirmadoEm };
}

export async function atualizarAgendamentoFinanceiro(input: { id: number; dataVencimento: Date; empresaId?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.transaction(async (tx: any) => {
    const titulo = (await tx.select().from(titulosFinanceiros).where(and(eq(titulosFinanceiros.id, input.id), eq(titulosFinanceiros.empresaId, input.empresaId ?? 1))).limit(1))[0];
    if (!titulo) throw new Error("Agendamento financeiro não encontrado");
    if (["quitado", "cancelado"].includes(titulo.estado)) {
      throw new Error("Não é possível alterar o vencimento de um título quitado ou cancelado");
    }

    const estado = calcularEstadoTitulo({
      valorOriginal: titulo.valorOriginal,
      desconto: titulo.desconto,
      juros: titulo.juros,
      valorBaixado: titulo.valorBaixado,
      dataVencimento: input.dataVencimento,
    });
    await tx.update(titulosFinanceiros).set({
      dataVencimento: input.dataVencimento,
      estado,
    }).where(eq(titulosFinanceiros.id, titulo.id));

    if (titulo.origem === "romaneio_carga" && titulo.romaneioCargaId) {
      await tx.update(romaneiosCargaToras).set({ dataVencimento: input.dataVencimento })
        .where(eq(romaneiosCargaToras.id, titulo.romaneioCargaId));
    }
    return { id: titulo.id, dataVencimento: input.dataVencimento, estado, romaneioCargaId: titulo.romaneioCargaId };
  });
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
  dependencias?: { database?: any; atualizarEstado?: (titulo: any) => Promise<any>; titulos?: any[]; empresaId?: number },
) {
  const db = dependencias?.database ?? await getDb();
  if (!db && !dependencias?.titulos) return [];
  const conditions = [];
  conditions.push(eq(titulosFinanceiros.empresaId, dependencias?.empresaId ?? 1));
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

export async function registrarBaixaFinanceira(data: Pick<InsertBaixaFinanceira, "tituloId" | "contaFinanceiraId" | "valor" | "dataBaixa" | "formaPagamento" | "observacoes" | "criadoPor">, empresaId = 1) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const titulo = await getTituloFinanceiroById(data.tituloId, empresaId);
  if (!titulo) throw new Error("Título financeiro não encontrado");
  if (titulo.estado === "cancelado" || titulo.estado === "quitado") throw new Error("Este título não aceita novas baixas");
  const conta = await db.select().from(contasFinanceiras).where(and(eq(contasFinanceiras.id, data.contaFinanceiraId), eq(contasFinanceiras.ativa, true), eq(contasFinanceiras.empresaId, empresaId))).limit(1);
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

export async function listBaixasFinanceiras(tituloId: number, empresaId = 1) {
  const db = await getDb();
  if (!db) return [];
  const titulo = await getTituloFinanceiroById(tituloId, empresaId);
  if (!titulo) return [];
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

export async function conciliarBaixaFinanceira(id: number, conciliada: boolean, empresaId = 1) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const baixa = (await db.select({ tituloId: baixasFinanceiras.tituloId }).from(baixasFinanceiras).where(eq(baixasFinanceiras.id, id)).limit(1))[0];
  if (!baixa || !(await getTituloFinanceiroById(baixa.tituloId, empresaId))) throw new Error("Baixa financeira não encontrada");
  await db.update(baixasFinanceiras).set({ conciliada, conciliadaEm: conciliada ? new Date() : null }).where(eq(baixasFinanceiras.id, id));
  return { success: true };
}

function chaveMovimentoExtrato(contaFinanceiraId: number, chaveBase: string): string {
  let hash = 5381;
  const texto = `${contaFinanceiraId}|${chaveBase}`;
  for (let indice = 0; indice < texto.length; indice += 1) hash = ((hash * 33) ^ texto.charCodeAt(indice)) >>> 0;
  return `EXT-${contaFinanceiraId}-${hash.toString(36)}-${texto.length}`;
}

function dataExtrato(data: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(ano, mes - 1, dia, 12, 0, 0);
}

export async function getModeloImportacaoExtratoBancarioCsv() {
  return criarModeloCsvExtratoBancario();
}

export async function prepararImportacaoExtratoBancario(conteudo: string, formato: "csv" | "ofx") {
  return prepararImportacaoExtrato(conteudo, formato);
}

export async function importarExtratoBancario(input: { contaFinanceiraId: number; nomeArquivo: string; formato: "csv" | "ofx"; conteudo: string }, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conta = await db.select().from(contasFinanceiras).where(and(eq(contasFinanceiras.id, input.contaFinanceiraId), eq(contasFinanceiras.ativa, true))).limit(1);
  if (!conta[0]) throw new Error("A conta financeira selecionada não está ativa");
  if (conta[0].tipo !== "banco") throw new Error("Selecione uma conta do tipo banco para importar um extrato");
  const preparo = prepararImportacaoExtrato(input.conteudo, input.formato);
  if (preparo.erros.length) return { importados: 0, erros: preparo.erros };
  const chaves = preparo.linhas.map((linha) => chaveMovimentoExtrato(input.contaFinanceiraId, linha.chaveBase));
  const existentes = chaves.length ? await db.select({ chaveUnica: movimentosExtratoBancario.chaveUnica }).from(movimentosExtratoBancario).where(inArray(movimentosExtratoBancario.chaveUnica, chaves)) : [];
  if (existentes.length) return { importados: 0, erros: [`${existentes.length} movimento(s) do arquivo já foram importados anteriormente para esta conta`] };
  const datas = preparo.linhas.map((linha) => dataExtrato(linha.dataMovimento));
  await db.transaction(async (tx: any) => {
    const criado = await tx.insert(extratosBancarios).values({
      contaFinanceiraId: input.contaFinanceiraId,
      nomeArquivo: input.nomeArquivo.slice(0, 300),
      formato: input.formato,
      periodoInicial: new Date(Math.min(...datas.map((data) => data.getTime()))),
      periodoFinal: new Date(Math.max(...datas.map((data) => data.getTime()))),
      totalLinhas: preparo.linhas.length,
      criadoPor: userId,
    });
    const extratoId = getInsertedId(criado as MysqlInsertResult);
    await tx.insert(movimentosExtratoBancario).values(preparo.linhas.map((linha) => ({
      extratoId,
      contaFinanceiraId: input.contaFinanceiraId,
      dataMovimento: dataExtrato(linha.dataMovimento),
      descricao: linha.descricao,
      tipo: linha.tipo,
      valor: linha.valor,
      identificadorExterno: linha.identificadorExterno,
      chaveUnica: chaveMovimentoExtrato(input.contaFinanceiraId, linha.chaveBase),
      estado: "pendente" as const,
    })));
  });
  return { importados: preparo.linhas.length, erros: [] as string[] };
}

export async function listConciliacaoBancaria(filtros?: { contaFinanceiraId?: number; estado?: "pendente" | "conciliado" | "ignorado" | "divergente" }) {
  const db = await getDb();
  if (!db) return [];
  const condicoes = [
    filtros?.contaFinanceiraId ? eq(movimentosExtratoBancario.contaFinanceiraId, filtros.contaFinanceiraId) : undefined,
    filtros?.estado ? eq(movimentosExtratoBancario.estado, filtros.estado) : undefined,
  ].filter(Boolean) as any[];
  const consultaMovimentos = db.select({
    id: movimentosExtratoBancario.id,
    extratoId: movimentosExtratoBancario.extratoId,
    contaFinanceiraId: movimentosExtratoBancario.contaFinanceiraId,
    contaNome: contasFinanceiras.nome,
    nomeArquivo: extratosBancarios.nomeArquivo,
    dataMovimento: movimentosExtratoBancario.dataMovimento,
    descricao: movimentosExtratoBancario.descricao,
    tipo: movimentosExtratoBancario.tipo,
    valor: movimentosExtratoBancario.valor,
    identificadorExterno: movimentosExtratoBancario.identificadorExterno,
    estado: movimentosExtratoBancario.estado,
    baixaFinanceiraId: movimentosExtratoBancario.baixaFinanceiraId,
    conciliadoEm: movimentosExtratoBancario.conciliadoEm,
    observacoes: movimentosExtratoBancario.observacoes,
    baixaValor: baixasFinanceiras.valor,
    baixaData: baixasFinanceiras.dataBaixa,
    baixaTituloId: baixasFinanceiras.tituloId,
    baixaDescricao: titulosFinanceiros.descricao,
    baixaContraparte: titulosFinanceiros.contraparteNome,
    baixaTipoTitulo: titulosFinanceiros.tipo,
  }).from(movimentosExtratoBancario)
    .innerJoin(contasFinanceiras, eq(movimentosExtratoBancario.contaFinanceiraId, contasFinanceiras.id))
    .innerJoin(extratosBancarios, eq(movimentosExtratoBancario.extratoId, extratosBancarios.id))
    .leftJoin(baixasFinanceiras, eq(movimentosExtratoBancario.baixaFinanceiraId, baixasFinanceiras.id))
    .leftJoin(titulosFinanceiros, eq(baixasFinanceiras.tituloId, titulosFinanceiros.id));
  const movimentos = condicoes.length ? await consultaMovimentos.where(and(...condicoes)).orderBy(desc(movimentosExtratoBancario.dataMovimento), desc(movimentosExtratoBancario.id)) : await consultaMovimentos.orderBy(desc(movimentosExtratoBancario.dataMovimento), desc(movimentosExtratoBancario.id));
  const contasIds = Array.from(new Set(movimentos.map((movimento) => movimento.contaFinanceiraId)));
  const baixas = contasIds.length ? await db.select({
    id: baixasFinanceiras.id,
    tituloId: baixasFinanceiras.tituloId,
    tipoTitulo: titulosFinanceiros.tipo,
    valor: baixasFinanceiras.valor,
    dataBaixa: baixasFinanceiras.dataBaixa,
    descricaoTitulo: titulosFinanceiros.descricao,
    contraparteNome: titulosFinanceiros.contraparteNome,
    contaFinanceiraId: baixasFinanceiras.contaFinanceiraId,
  }).from(baixasFinanceiras)
    .innerJoin(titulosFinanceiros, eq(baixasFinanceiras.tituloId, titulosFinanceiros.id))
    .where(and(inArray(baixasFinanceiras.contaFinanceiraId, contasIds), eq(baixasFinanceiras.estornada, false), eq(baixasFinanceiras.conciliada, false))) : [];
  return movimentos.map((movimento) => ({
    ...movimento,
    sugestoes: movimento.estado === "pendente" ? sugerirConciliacoes(movimento, baixas.filter((baixa) => baixa.contaFinanceiraId === movimento.contaFinanceiraId)) : [],
  }));
}

export async function confirmarConciliacaoBancaria(input: { movimentoId: number; baixaFinanceiraId: number }, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const movimento = await db.select().from(movimentosExtratoBancario).where(eq(movimentosExtratoBancario.id, input.movimentoId)).limit(1);
  if (!movimento[0]) throw new Error("Movimento bancário não encontrado");
  if (movimento[0].estado === "conciliado") throw new Error("Este movimento já foi conciliado");
  const baixa = await db.select({ id: baixasFinanceiras.id, contaFinanceiraId: baixasFinanceiras.contaFinanceiraId, valor: baixasFinanceiras.valor, estornada: baixasFinanceiras.estornada, conciliada: baixasFinanceiras.conciliada, tipoTitulo: titulosFinanceiros.tipo }).from(baixasFinanceiras).innerJoin(titulosFinanceiros, eq(baixasFinanceiras.tituloId, titulosFinanceiros.id)).where(eq(baixasFinanceiras.id, input.baixaFinanceiraId)).limit(1);
  if (!baixa[0] || baixa[0].estornada) throw new Error("A baixa selecionada não está disponível para conciliação");
  if (baixa[0].conciliada) throw new Error("A baixa selecionada já foi conciliada em outro movimento");
  if (baixa[0].contaFinanceiraId !== movimento[0].contaFinanceiraId) throw new Error("O movimento e a baixa devem pertencer à mesma conta financeira");
  if ((movimento[0].tipo === "entrada" ? "receber" : "pagar") !== baixa[0].tipoTitulo) throw new Error("O tipo do movimento não corresponde ao tipo da baixa");
  if (Math.abs(decimalParaNumero(movimento[0].valor) - decimalParaNumero(baixa[0].valor)) > 0.01) throw new Error("O valor do movimento é diferente do valor da baixa");
  await db.transaction(async (tx: any) => {
    await tx.update(baixasFinanceiras).set({ conciliada: true, conciliadaEm: new Date() }).where(eq(baixasFinanceiras.id, baixa[0].id));
    await tx.update(movimentosExtratoBancario).set({ estado: "conciliado", baixaFinanceiraId: baixa[0].id, conciliadoEm: new Date(), conciliadoPor: userId, observacoes: null }).where(eq(movimentosExtratoBancario.id, movimento[0].id));
  });
  return { success: true };
}

export async function desfazerConciliacaoBancaria(movimentoId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const movimento = await db.select().from(movimentosExtratoBancario).where(eq(movimentosExtratoBancario.id, movimentoId)).limit(1);
  if (!movimento[0] || movimento[0].estado !== "conciliado" || !movimento[0].baixaFinanceiraId) throw new Error("Este movimento não possui uma conciliação para desfazer");
  await db.transaction(async (tx: any) => {
    await tx.update(baixasFinanceiras).set({ conciliada: false, conciliadaEm: null }).where(eq(baixasFinanceiras.id, movimento[0].baixaFinanceiraId!));
    await tx.update(movimentosExtratoBancario).set({ estado: "pendente", baixaFinanceiraId: null, conciliadoEm: null, conciliadoPor: null }).where(eq(movimentosExtratoBancario.id, movimentoId));
  });
  return { success: true };
}

export async function criarLancamentoDaConciliacao(input: { movimentoId: number; categoriaId: number; descricao: string; observacoes?: string | null }, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const movimento = await db.select().from(movimentosExtratoBancario).where(eq(movimentosExtratoBancario.id, input.movimentoId)).limit(1);
  if (!movimento[0] || movimento[0].estado !== "pendente") throw new Error("O movimento deve estar pendente para criar um lançamento");
  const categoria = await db.select().from(categoriasFinanceiras).where(and(eq(categoriasFinanceiras.id, input.categoriaId), eq(categoriasFinanceiras.ativo, true))).limit(1);
  if (!categoria[0]) throw new Error("Selecione uma categoria financeira ativa");
  const tipo = movimento[0].tipo === "entrada" ? "receber" as const : "pagar" as const;
  if (categoria[0].tipo !== "ambos" && categoria[0].tipo !== (tipo === "receber" ? "receita" : "despesa")) throw new Error("A categoria selecionada não corresponde ao tipo do movimento");
  await db.transaction(async (tx: any) => {
    const tituloInserido = await tx.insert(titulosFinanceiros).values({
      tipo,
      origem: "manual",
      descricao: input.descricao.trim(),
      categoriaId: input.categoriaId,
      valorOriginal: movimento[0].valor,
      desconto: "0",
      juros: "0",
      valorBaixado: movimento[0].valor,
      dataEmissao: movimento[0].dataMovimento,
      dataVencimento: movimento[0].dataMovimento,
      competencia: movimento[0].dataMovimento,
      estado: "quitado",
      observacoes: input.observacoes ?? `Criado pela conciliação do movimento bancário #${movimento[0].id}`,
      criadoPor: userId,
    });
    const tituloId = getInsertedId(tituloInserido as MysqlInsertResult);
    const baixaInserida = await tx.insert(baixasFinanceiras).values({
      tituloId,
      contaFinanceiraId: movimento[0].contaFinanceiraId,
      valor: movimento[0].valor,
      dataBaixa: movimento[0].dataMovimento,
      formaPagamento: "extrato_bancario",
      observacoes: "Baixa criada automaticamente pela conciliação bancária",
      conciliada: true,
      conciliadaEm: new Date(),
      criadoPor: userId,
    });
    const baixaFinanceiraId = getInsertedId(baixaInserida as MysqlInsertResult);
    await tx.update(movimentosExtratoBancario).set({ estado: "conciliado", baixaFinanceiraId, conciliadoEm: new Date(), conciliadoPor: userId, observacoes: input.observacoes ?? null }).where(eq(movimentosExtratoBancario.id, movimento[0].id));
  });
  return { success: true };
}

export async function definirEstadoMovimentoBancario(input: { movimentoId: number; estado: "ignorado" | "divergente"; observacoes?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const movimento = await db.select().from(movimentosExtratoBancario).where(eq(movimentosExtratoBancario.id, input.movimentoId)).limit(1);
  if (!movimento[0]) throw new Error("Movimento bancário não encontrado");
  if (movimento[0].estado === "conciliado") throw new Error("Desfaça a conciliação antes de alterar o estado do movimento");
  await db.update(movimentosExtratoBancario).set({ estado: input.estado, observacoes: input.observacoes ?? null }).where(eq(movimentosExtratoBancario.id, input.movimentoId));
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

export async function getPrevisaoSemanalCaixa(semanas = 8) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const fimHoje = new Date(hoje);
  fimHoje.setHours(23, 59, 59, 999);
  const [contas, baixasRealizadas, titulos] = await Promise.all([
    db.select({ saldoInicial: contasFinanceiras.saldoInicial }).from(contasFinanceiras),
    db.select({
      tipo: titulosFinanceiros.tipo,
      valor: baixasFinanceiras.valor,
      dataBaixa: baixasFinanceiras.dataBaixa,
    }).from(baixasFinanceiras)
      .innerJoin(titulosFinanceiros, eq(baixasFinanceiras.tituloId, titulosFinanceiros.id))
      .where(and(eq(baixasFinanceiras.estornada, false), lte(baixasFinanceiras.dataBaixa, fimHoje))),
    db.select({
      tipo: titulosFinanceiros.tipo,
      valorOriginal: titulosFinanceiros.valorOriginal,
      valorBaixado: titulosFinanceiros.valorBaixado,
      desconto: titulosFinanceiros.desconto,
      juros: titulosFinanceiros.juros,
      dataVencimento: titulosFinanceiros.dataVencimento,
      estado: titulosFinanceiros.estado,
    }).from(titulosFinanceiros)
      .where(inArray(titulosFinanceiros.estado, ["aberto", "parcial", "vencido"])),
  ]);
  const saldoDasContas = contas.reduce((total, conta) => total + decimalParaNumero(conta.saldoInicial), 0);
  const saldoRealizado = baixasRealizadas.reduce((total, baixa) => (
    total + (baixa.tipo === "receber" ? decimalParaNumero(baixa.valor) : -decimalParaNumero(baixa.valor))
  ), 0);
  return calcularPrevisaoSemanal({
    saldoAtual: saldoDasContas + saldoRealizado,
    titulos,
    semanas,
    agora: hoje,
  });
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
  const agora = new Date();
  const configuracao = (await db.select().from(configuracoesFinanceiras).where(eq(configuracoesFinanceiras.id, 1)).limit(1))[0];
  const diasAntecedencia = configuracao?.alertaDiasAntecedencia ?? 7;
  const alertasAtivos = await db.select({
    id: alertasFinanceiros.id,
    tituloId: alertasFinanceiros.tituloId,
    tipo: alertasFinanceiros.tipo,
    mensagem: alertasFinanceiros.mensagem,
    criadoEm: alertasFinanceiros.criadoEm,
    descricao: titulosFinanceiros.descricao,
    valorOriginal: titulosFinanceiros.valorOriginal,
    desconto: titulosFinanceiros.desconto,
    juros: titulosFinanceiros.juros,
    valorBaixado: titulosFinanceiros.valorBaixado,
    dataVencimento: titulosFinanceiros.dataVencimento,
    estadoTitulo: titulosFinanceiros.estado,
    tipoTitulo: titulosFinanceiros.tipo,
  }).from(alertasFinanceiros)
    .innerJoin(titulosFinanceiros, eq(alertasFinanceiros.tituloId, titulosFinanceiros.id))
    .where(eq(alertasFinanceiros.estado, "ativo"))
    .orderBy(desc(alertasFinanceiros.createdAt));

  const alertasAtuais = [] as typeof alertasAtivos;
  for (const alerta of alertasAtivos) {
    const tipoAtual = tipoAlertaAtualDoTitulo({
      valorOriginal: alerta.valorOriginal,
      desconto: alerta.desconto,
      juros: alerta.juros,
      valorBaixado: alerta.valorBaixado,
      dataVencimento: alerta.dataVencimento,
      estadoPersistido: alerta.estadoTitulo,
      diasAntecedencia,
      agora,
    });

    if (tipoAtual === alerta.tipo) {
      alertasAtuais.push(alerta);
      continue;
    }

    await db.update(alertasFinanceiros)
      .set({ estado: "resolvido", resolvidoEm: agora })
      .where(and(eq(alertasFinanceiros.id, alerta.id), eq(alertasFinanceiros.estado, "ativo")));
  }
  return alertasAtuais;
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
    const tipoAtual = tipoAlertaAtualDoTitulo({
      valorOriginal: titulo.valorOriginal,
      desconto: titulo.desconto,
      juros: titulo.juros,
      valorBaixado: titulo.valorBaixado,
      dataVencimento: titulo.dataVencimento,
      estadoPersistido: titulo.estado,
      diasAntecedencia,
      agora,
    });
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
export async function getDashboardStats(empresaId = 1) {
  const db = await getDb();
  if (!db) return { totalOrcamentos: 0, totalAprovados: 0, totalRascunhos: 0, totalEnviados: 0, totalRejeitados: 0, totalValor: "0", totalClientes: 0, totalMadeiras: 0 };
  const allOrcamentos = await db.select().from(orcamentos).where(eq(orcamentos.empresaId, empresaId));
  const totalOrcamentos = allOrcamentos.length;
  const totalAprovados = allOrcamentos.filter(o => o.estado === "aprovado").length;
  const totalRascunhos = allOrcamentos.filter(o => o.estado === "rascunho").length;
  const totalEnviados = allOrcamentos.filter(o => o.estado === "enviado").length;
  const totalRejeitados = allOrcamentos.filter(o => o.estado === "rejeitado").length;
  const totalValor = allOrcamentos.reduce((sum, o) => sum + parseFloat(o.total ?? "0"), 0).toFixed(2);
  const allClientes = await db.select().from(clientes).where(and(eq(clientes.ativo, true), eq(clientes.empresaId, empresaId)));
  const totalClientes = allClientes.length;
  const allMadeiras = await db.select().from(madeiras).where(and(eq(madeiras.ativo, true), eq(madeiras.empresaId, empresaId)));
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

export async function listPlaquetas(parametros: { busca?: string; limite?: number; deslocamento?: number } = {}, empresaId = 1) {
  const db = await getDb();
  if (!db) return { itens: [], total: 0, totalDisponiveis: 0, proximoDeslocamento: null };
  const brutas = ordenarPlaquetasPorEntradaMaisRecente(await db.select().from(plaquetas).where(eq(plaquetas.empresaId, empresaId)).orderBy(desc(plaquetas.createdAt), desc(plaquetas.id)));
  const todas = numerarDuplicidadesPlaquetas(brutas);
  const termo = (parametros.busca ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const filtradas = termo ? todas.filter((item) => {
    const codigo = `${item.codigo} ${item.codigoFisico ?? ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
    const essencia = item.madeiraNome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
    return codigo.includes(termo) || essencia.includes(termo);
  }) : todas;
  const limite = Math.min(Math.max(parametros.limite ?? 10, 1), 500);
  const deslocamento = Math.max(parametros.deslocamento ?? 0, 0);
  const itens = filtradas.slice(deslocamento, deslocamento + limite);
  const proximoDeslocamento = deslocamento + itens.length < filtradas.length ? deslocamento + itens.length : null;
  return { itens, total: filtradas.length, totalDisponiveis: todas.filter((item) => item.estado === "disponivel").length, proximoDeslocamento };
}

export async function getRelatorioExcecoesPlaquetas(parametros: { busca?: string; situacao?: "todas" | "duplicada" | "sem_plaqueta"; somenteDisponiveis?: boolean } = {}, empresaId = 1) {
  const db = await getDb();
  if (!db) return { resumo: { duplicadas: 0, semPlaqueta: 0, pendentesConferencia: 0, disponiveis: 0 }, itens: [] };
  const brutas = await db.select().from(plaquetas).where(eq(plaquetas.empresaId, empresaId)).orderBy(desc(plaquetas.createdAt), desc(plaquetas.id));
  const numeradas = numerarDuplicidadesPlaquetas(brutas);
  const termo = (parametros.busca ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const excecoes = numeradas.filter((item) => item.situacaoIdentificacao !== "identificada");
  const itens = excecoes.filter((item) => {
    if (parametros.situacao && parametros.situacao !== "todas" && item.situacaoIdentificacao !== parametros.situacao) return false;
    if (parametros.somenteDisponiveis && item.estado !== "disponivel") return false;
    if (!termo) return true;
    const pesquisavel = `${item.codigo} ${item.codigoFisico ?? ""} ${item.madeiraNome}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
    return pesquisavel.includes(termo);
  });
  return {
    resumo: {
      duplicadas: excecoes.filter((item) => item.situacaoIdentificacao === "duplicada").length,
      semPlaqueta: excecoes.filter((item) => item.situacaoIdentificacao === "sem_plaqueta").length,
      pendentesConferencia: excecoes.filter((item) => item.situacaoIdentificacao === "duplicada" && item.estado === "disponivel").length,
      disponiveis: excecoes.filter((item) => item.estado === "disponivel").length,
    },
    itens,
  };
}

export function getModeloImportacaoTorasProducaoCsv() {
  return criarModeloCsvTorasProducao();
}

export function getModeloImportacaoPecasProducaoCsv() {
  return criarModeloCsvPecasProducao();
}

export function prepararPecasProducaoCsv(conteudo: string) {
  return validarCsvPecasProducao(conteudo);
}

export async function prepararTorasProducaoCsv(conteudo: string, empresaId = 1) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const estoque = await db.select({
    id: plaquetas.id,
    codigo: plaquetas.codigo,
    estado: plaquetas.estado,
    madeiraNome: plaquetas.madeiraNome,
    diametro: plaquetas.diametro,
    comprimento: plaquetas.comprimento,
    volumeDisponivel: plaquetas.volumeDisponivel,
  }).from(plaquetas).where(eq(plaquetas.empresaId, empresaId));
  return prepararImportacaoTorasProducao({ conteudo, plaquetas: estoque });
}

export async function listRomaneiosCargaToras(filtros: { dataInicial?: Date; dataFinal?: Date; origem?: string } = {}, empresaId = 1) {
  const db = await getDb();
  if (!db) return [];
  const origem = filtros.origem?.trim().toLocaleLowerCase("pt-BR");
  const condicoes = [
    eq(romaneiosCargaToras.empresaId, empresaId),
    filtros.dataInicial ? gte(romaneiosCargaToras.dataCarga, filtros.dataInicial) : undefined,
    filtros.dataFinal ? lte(romaneiosCargaToras.dataCarga, filtros.dataFinal) : undefined,
  ];
  const resultado = await db.select().from(romaneiosCargaToras).where(and(...condicoes)).orderBy(desc(romaneiosCargaToras.dataCarga), desc(romaneiosCargaToras.id));
  return origem ? resultado.filter((item) => (item.origem ?? "").toLocaleLowerCase("pt-BR").includes(origem)) : resultado;
}

export async function getRomaneioCargaComPlaquetas(id: number, empresaId = 1) {
  const db = await getDb();
  if (!db) return undefined;
  const carga = await db.select().from(romaneiosCargaToras).where(and(eq(romaneiosCargaToras.id, id), eq(romaneiosCargaToras.empresaId, empresaId))).limit(1);
  if (!carga[0]) return undefined;
  const itens = await db.select().from(plaquetas).where(and(eq(plaquetas.romaneioCargaId, id), eq(plaquetas.empresaId, empresaId))).orderBy(asc(plaquetas.id));
  const todas = await db.select().from(plaquetas).where(eq(plaquetas.empresaId, empresaId));
  const numeradas = numerarDuplicidadesPlaquetas(todas);
  const identificacaoPorId = new Map(numeradas.map((item) => [item.id, item]));
  return { carga: carga[0], plaquetas: itens.map((item) => ({ ...item, ...identificacaoPorId.get(item.id) })) };
}

export function getModeloImportacaoPlaquetasCargaCsv() {
  return criarModeloCsvPlaquetasCarga();
}

export async function importarPlaquetasCargaCsv(
  input: { conteudo: string; dataCarga: Date; dataVencimento: Date; origem?: string | null; fornecedorId?: number | null; responsavel?: string | null; observacoes?: string | null; fretePorMetroCubico: string },
  criadoPor: number,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const codigosExistentes = await db.select({ codigo: plaquetas.codigo }).from(plaquetas);
  const preparo = prepararImportacaoPlaquetasCarga({ conteudo: input.conteudo, codigosExistentes });
  if (preparo.erros.length) return { importados: 0, erros: preparo.erros, avisos: preparo.avisos, numero: null as string | null };
  const carga = await criarRomaneioCargaToras({
    dataCarga: input.dataCarga,
    dataVencimento: input.dataVencimento,
    origem: input.origem ?? null,
    fornecedorId: input.fornecedorId ?? null,
    responsavel: input.responsavel ?? null,
    observacoes: input.observacoes ?? null,
    fretePorMetroCubico: input.fretePorMetroCubico,
    plaquetas: preparo.linhas.map(({ codigo, madeiraNome, diametro, comprimento, valorMetroCubico, observacoes }) => ({ codigo, madeiraNome, diametro, comprimento, valorMetroCubico, observacoes })),
    criadoPor,
  });
  return { importados: preparo.linhas.length, erros: [] as string[], avisos: preparo.avisos, numero: carga.numero };
}

type PlaquetaCargaEntrada = { codigo?: string | null; madeiraNome: string; diametro: string; comprimento: string; valorMetroCubico: string; observacoes?: string | null };

type SituacaoIdentificacaoPlaqueta = "identificada" | "sem_plaqueta" | "duplicada";

function gerarCodigoInternoPlaqueta() {
  return `INT-${crypto.randomUUID().replaceAll("-", "").slice(0, 20).toUpperCase()}`;
}

async function prepararIdentificacaoPlaqueta(tx: any, codigoInformado?: string | null, empresaId = 1): Promise<{ codigo: string; codigoFisico: string | null; situacaoIdentificacao: SituacaoIdentificacaoPlaqueta }> {
  const codigoFisico = normalizarCodigoPlaqueta(codigoInformado ?? "") || null;
  if (!codigoFisico) {
    return { codigo: `SEM-PLQ-${gerarCodigoInternoPlaqueta().slice(4)}`, codigoFisico: null, situacaoIdentificacao: "sem_plaqueta" };
  }

  const mesmoCodigoFisico = or(eq(plaquetas.codigo, codigoFisico), eq(plaquetas.codigoFisico, codigoFisico));
  const existentes = await tx.select({ id: plaquetas.id }).from(plaquetas).where(and(mesmoCodigoFisico, eq(plaquetas.empresaId, empresaId)));
  if (!existentes.length) return { codigo: codigoFisico, codigoFisico, situacaoIdentificacao: "identificada" };

  await tx.update(plaquetas).set({ codigoFisico, situacaoIdentificacao: "duplicada" }).where(and(mesmoCodigoFisico, eq(plaquetas.empresaId, empresaId)));
  return { codigo: gerarCodigoInternoPlaqueta(), codigoFisico, situacaoIdentificacao: "duplicada" };
}

function prepararPlaquetasCarga(entrada: PlaquetaCargaEntrada[]) {
  if (!entrada.length) throw new Error("Adicione ao menos uma plaqueta ao romaneio de carga");
  if (entrada.length > 200) throw new Error("O romaneio de carga suporta no máximo 200 plaquetas");
  return entrada.map((plaqueta, indice) => {
    const codigoFisico = normalizarCodigoPlaqueta(plaqueta.codigo ?? "") || null;
    const referencia = codigoFisico ?? `sem plaqueta na linha ${indice + 1}`;
    const madeiraNome = plaqueta.madeiraNome.trim();
    if (!madeiraNome) throw new Error(`Informe a essência da tora ${referencia}`);
    const diametro = Number(String(plaqueta.diametro).replace(",", "."));
    const comprimento = Number(String(plaqueta.comprimento).replace(",", "."));
    const valorMetroCubico = Number(String(plaqueta.valorMetroCubico).replace(",", "."));
    const volume = calcularVolumeToraCilindrica(diametro, comprimento);
    if (!Number.isFinite(valorMetroCubico) || valorMetroCubico <= 0) throw new Error(`Informe o valor por m³ da tora ${referencia}`);
    return { codigoFisico, madeiraNome, diametro, comprimento, volume, valorMetroCubico, valorTotal: Number((volume * valorMetroCubico).toFixed(2)), observacoes: plaqueta.observacoes?.trim() || null };
  });
}

function normalizarFreteCarga(valor: string) {
  const fretePorMetroCubico = Number(String(valor ?? "0").replace(",", "."));
  if (!Number.isFinite(fretePorMetroCubico) || fretePorMetroCubico < 0) throw new Error("Informe um frete por m³ válido");
  return fretePorMetroCubico;
}

export async function criarRomaneioCargaToras(data: {
  dataCarga: Date;
  dataVencimento: Date;
  origem?: string | null;
  fornecedorId?: number | null;
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
    const temporario = `TMP-${crypto.randomUUID().slice(0, 20)}`;
    const insercao = await tx.insert(romaneiosCargaToras).values({
      numero: temporario,
      dataCarga: data.dataCarga,
      dataVencimento: data.dataVencimento,
      origem: data.origem?.trim() || null,
      fornecedorId: data.fornecedorId ?? null,
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
    await sincronizarTituloMateriaPrimaCarga(tx, {
      romaneioId: id,
      numero,
      dataCarga: data.dataCarga,
      dataVencimento: data.dataVencimento,
      origem: data.origem,
      fornecedorId: data.fornecedorId,
      observacoes: data.observacoes,
      valorTotal,
      criadoPor: data.criadoPor,
    });
    for (const plaqueta of plaquetasPreparadas) {
      const identificacao = await prepararIdentificacaoPlaqueta(tx, plaqueta.codigoFisico);
      const insercaoPlaqueta = await tx.insert(plaquetas).values({
        ...identificacao,
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
  dataVencimento: Date;
  origem?: string | null;
  fornecedorId?: number | null;
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
    for (const plaqueta of existentes) await tx.delete(movimentacoesPlaquetas).where(eq(movimentacoesPlaquetas.plaquetaId, plaqueta.id));
    for (const plaqueta of existentes) await tx.delete(plaquetas).where(eq(plaquetas.id, plaqueta.id));

    for (const plaqueta of plaquetasPreparadas) {
      const identificacao = await prepararIdentificacaoPlaqueta(tx, plaqueta.codigoFisico);
      const valores = {
        ...identificacao,
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
      const plaquetaId = getInsertedId(await tx.insert(plaquetas).values({ ...valores, romaneioCargaId: id, estado: "disponivel", criadoPor: carga.criadoPor }) as MysqlInsertResult);
      await tx.insert(movimentacoesPlaquetas).values({ plaquetaId, tipo: "entrada", volume: plaqueta.volume.toFixed(6), motivo: `Entrada pelo romaneio ${carga.numero}`, criadoPor: carga.criadoPor });
    }
    await tx.update(romaneiosCargaToras).set({ dataCarga: data.dataCarga, dataVencimento: data.dataVencimento, origem: data.origem?.trim() || null, fornecedorId: data.fornecedorId ?? null, responsavel: data.responsavel?.trim() || null, observacoes: data.observacoes?.trim() || null, totalPlaquetas: plaquetasPreparadas.length, volumeTotal: volumeTotal.toFixed(6), valorProdutos: valorProdutos.toFixed(2), fretePorMetroCubico: fretePorMetroCubico.toFixed(2), frete: frete.toFixed(2), valorTotal: valorTotal.toFixed(2) }).where(eq(romaneiosCargaToras.id, id));
    await sincronizarTituloMateriaPrimaCarga(tx, {
      romaneioId: id,
      numero: carga.numero,
      dataCarga: data.dataCarga,
      dataVencimento: data.dataVencimento,
      origem: data.origem,
      fornecedorId: data.fornecedorId,
      observacoes: data.observacoes,
      valorTotal,
      criadoPor: carga.criadoPor,
    });
    return { id, numero: carga.numero, totalPlaquetas: plaquetasPreparadas.length, volumeTotal, valorProdutos, fretePorMetroCubico, frete, valorTotal };
  });
}

async function sincronizarTituloMateriaPrimaCarga(tx: any, data: {
  romaneioId: number;
  numero: string;
  dataCarga: Date;
  dataVencimento: Date;
  origem?: string | null;
  fornecedorId?: number | null;
  observacoes?: string | null;
  valorTotal: number;
  criadoPor: number;
}) {
  const fornecedor = data.fornecedorId
    ? (await tx.select().from(fornecedores).where(eq(fornecedores.id, data.fornecedorId)).limit(1))[0]
    : null;
  if (data.fornecedorId && !fornecedor) throw new Error("Fornecedor não encontrado para a conta a pagar da carga");
  const categoriaId = await getOrCreateCategoriaCustoMateriaPrima(tx, data.criadoPor);
  const valorOriginal = data.valorTotal.toFixed(2);
  const observacoes = ["Lançamento automático vinculado ao romaneio de carga.", data.observacoes?.trim()].filter(Boolean).join("\n");
  const valores = {
    tipo: "pagar" as const,
    origem: "romaneio_carga" as const,
    descricao: `Custo de matéria-prima — ${data.numero}`,
    fornecedorId: data.fornecedorId ?? null,
    contraparteNome: fornecedor?.nome ?? data.origem?.trim() ?? null,
    romaneioCargaId: data.romaneioId,
    categoriaId,
    valorOriginal,
    dataEmissao: data.dataCarga,
    dataVencimento: data.dataVencimento,
    competencia: data.dataCarga,
    estado: calcularEstadoTitulo({ valorOriginal, dataVencimento: data.dataVencimento }),
    observacoes: observacoes || null,
  };
  const existente = (await tx.select().from(titulosFinanceiros).where(eq(titulosFinanceiros.romaneioCargaId, data.romaneioId)).limit(1))[0];
  if (existente) {
    if (decimalParaNumero(existente.valorBaixado) > 0) throw new Error("A carga possui uma conta a pagar com baixa registrada e não pode ser alterada");
    await tx.update(titulosFinanceiros).set(valores).where(eq(titulosFinanceiros.id, existente.id));
    await tx.update(romaneiosCargaToras).set({ tituloFinanceiroId: existente.id }).where(eq(romaneiosCargaToras.id, data.romaneioId));
    return { id: existente.id, atualizado: true };
  }
  const resultado = await tx.insert(titulosFinanceiros).values({
    ...valores,
    chaveImportacao: null,
    clienteId: null,
    orcamentoId: null,
    recorrenciaId: null,
    grupoParcelamento: null,
    numeroParcela: null,
    totalParcelas: null,
    desconto: "0",
    juros: "0",
    valorBaixado: "0",
    canceladoEm: null,
    canceladoPor: null,
    criadoPor: data.criadoPor,
  });
  const tituloFinanceiroId = getInsertedId(resultado as MysqlInsertResult);
  await tx.update(romaneiosCargaToras).set({ tituloFinanceiroId }).where(eq(romaneiosCargaToras.id, data.romaneioId));
  return { id: tituloFinanceiroId, atualizado: false };
}

export async function excluirRomaneioCargaToras(id: number, canceladoPor: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.transaction(async (tx: any) => {
    const carga = (await tx.select().from(romaneiosCargaToras).where(eq(romaneiosCargaToras.id, id)).limit(1))[0];
    if (!carga) throw new Error("Romaneio de carga não encontrado");
    const itens = await tx.select().from(plaquetas).where(eq(plaquetas.romaneioCargaId, id));
    if (itens.some((plaqueta: any) => plaqueta.estado !== "disponivel")) {
      throw new Error("Este romaneio possui toras utilizadas na produção e não pode ser excluído");
    }
    if (carga.tituloFinanceiroId) {
      const titulo = (await tx.select().from(titulosFinanceiros).where(eq(titulosFinanceiros.id, carga.tituloFinanceiroId)).limit(1))[0];
      if (titulo && decimalParaNumero(titulo.valorBaixado) > 0) throw new Error("A conta a pagar desta carga já possui baixa e o romaneio não pode ser excluído");
      if (titulo && titulo.estado !== "cancelado") {
        await tx.update(titulosFinanceiros).set({ estado: "cancelado", canceladoEm: new Date(), canceladoPor }).where(eq(titulosFinanceiros.id, titulo.id));
      }
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
  codigo?: string | null;
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
  empresaId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const volumeInicial = Number(String(data.volumeInicial).replace(",", "."));
  if (!data.madeiraNome.trim() || !Number.isFinite(volumeInicial) || volumeInicial <= 0) {
    throw new Error("Informe madeira e volume inicial válidos para a plaqueta");
  }
  return db.transaction(async (tx: any) => {
    const empresaId = data.empresaId ?? 1;
    const identificacao = await prepararIdentificacaoPlaqueta(tx, data.codigo, empresaId);
    const result = await tx.insert(plaquetas).values({
      empresaId,
      ...identificacao,
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
    await tx.insert(movimentacoesPlaquetas).values({ empresaId, plaquetaId: id, tipo: "entrada", volume: volumeInicial.toFixed(6), motivo: "Entrada manual de plaqueta", criadoPor: data.criadoPor });
    return { id, codigo: identificacao.codigo, codigoFisico: identificacao.codigoFisico, situacaoIdentificacao: identificacao.situacaoIdentificacao };
  });
}

export async function listRomaneiosProducao(empresaId = 1) {
  const db = await getDb();
  if (!db) return [];
  const [romaneios, totaisToras, totaisPecas] = await Promise.all([
    db.select({
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
      .leftJoin(plaquetas, and(eq(romaneiosProducao.plaquetaId, plaquetas.id), eq(plaquetas.empresaId, empresaId)))
      .where(eq(romaneiosProducao.empresaId, empresaId))
      .orderBy(desc(romaneiosProducao.dataProducao), desc(romaneiosProducao.id)),
    db.select({
      romaneioId: itensRomaneioToras.romaneioId,
      totalToras: sql<number>`count(*)`,
      volumeToras: sql<string>`coalesce(sum(${itensRomaneioToras.volume}), 0)`,
    }).from(itensRomaneioToras).groupBy(itensRomaneioToras.romaneioId),
    db.select({
      romaneioId: itensRomaneioProducao.romaneioId,
      totalPecas: sql<number>`coalesce(sum(${itensRomaneioProducao.quantidade}), 0)`,
      volumeProduzido: sql<string>`coalesce(sum(${itensRomaneioProducao.volume}), 0)`,
    }).from(itensRomaneioProducao).groupBy(itensRomaneioProducao.romaneioId),
  ]);
  const porRomaneioToras = new Map(totaisToras.map((total) => [total.romaneioId, total]));
  const porRomaneioPecas = new Map(totaisPecas.map((total) => [total.romaneioId, total]));
  return romaneios.map((romaneio) => {
    const toras = porRomaneioToras.get(romaneio.id);
    const pecas = porRomaneioPecas.get(romaneio.id);
    return {
      ...romaneio,
      totalToras: Number(toras?.totalToras ?? (romaneio.plaquetaId ? 1 : 0)),
      volumeTora: toras?.volumeToras ?? romaneio.volumeTora ?? romaneio.volumePlaqueta ?? "0",
      totalPecas: Number(pecas?.totalPecas ?? 0),
      volumeProduzido: pecas?.volumeProduzido ?? "0",
    };
  });
}

export async function listItensRomaneioProducao(romaneioId: number, empresaId = 1) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(itensRomaneioProducao).where(and(eq(itensRomaneioProducao.romaneioId, romaneioId), eq(itensRomaneioProducao.empresaId, empresaId))).orderBy(itensRomaneioProducao.id);
}

export async function getRomaneioProducaoComItens(romaneioId: number, empresaId = 1) {
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
  }).from(romaneiosProducao).leftJoin(plaquetas, and(eq(romaneiosProducao.plaquetaId, plaquetas.id), eq(plaquetas.empresaId, empresaId))).where(and(eq(romaneiosProducao.id, romaneioId), eq(romaneiosProducao.empresaId, empresaId))).limit(1))[0];
  if (!romaneio) return null;
  const [itens, toras] = await Promise.all([
    listItensRomaneioProducao(romaneioId, empresaId),
    db.select({
      id: itensRomaneioToras.id,
      plaquetaId: itensRomaneioToras.plaquetaId,
      codigo: plaquetas.codigo,
      madeiraNome: itensRomaneioToras.madeiraNome,
      diametro: itensRomaneioToras.diametro,
      comprimento: itensRomaneioToras.comprimento,
      volume: itensRomaneioToras.volume,
    }).from(itensRomaneioToras).innerJoin(plaquetas, and(eq(itensRomaneioToras.plaquetaId, plaquetas.id), eq(plaquetas.empresaId, empresaId))).where(and(eq(itensRomaneioToras.romaneioId, romaneioId), eq(itensRomaneioToras.empresaId, empresaId))),
  ]);
  return { romaneio, itens, toras };
}

export async function confirmarRomaneioProducao(data: {
  plaquetaId?: number;
  tora?: { madeiraNome: string; diametro?: string | null; espessura?: string | null; largura?: string | null; comprimento?: string | null; volume: string };
  toras?: Array<{ plaquetaId?: number; novaPlaqueta?: { codigo?: string | null }; medidasConferidasManual?: boolean; tora: { madeiraNome: string; diametro?: string | null; comprimento?: string | null; volume: string } }>;
  dataProducao: Date;
  fita?: string | null;
  responsavel?: string | null;
  observacoes?: string | null;
  itens: ItemProducaoEntrada[];
  criadoPor: number;
  empresaId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async (tx) => {
    const entradasToras = data.toras ?? (data.plaquetaId && data.tora ? [{ plaquetaId: data.plaquetaId, tora: data.tora }] : []);
    if (!entradasToras.length) throw new Error("Informe ao menos uma plaqueta para o romaneio");
    const plaquetasSelecionadas = [];
    for (const entrada of entradasToras) {
      let plaqueta;
      if (entrada.novaPlaqueta) {
        const volumeInicial = Number(String(entrada.tora.volume).replace(",", "."));
        if (!Number.isFinite(volumeInicial) || volumeInicial <= 0 || !entrada.tora.madeiraNome.trim()) {
          throw new Error("Informe essência e volume válidos para a nova plaqueta");
        }
        const identificacao = await prepararIdentificacaoPlaqueta(tx, entrada.novaPlaqueta.codigo, data.empresaId);
        const insercaoPlaqueta = await tx.insert(plaquetas).values({
          empresaId: data.empresaId,
          ...identificacao,
          madeiraNome: entrada.tora.madeiraNome.trim(),
          diametro: entrada.tora.diametro ? Number(String(entrada.tora.diametro).replace(",", ".")).toFixed(2) : null,
          comprimento: entrada.tora.comprimento ? Number(String(entrada.tora.comprimento).replace(",", ".")).toFixed(2) : null,
          volumeInicial: volumeInicial.toFixed(6),
          volumeDisponivel: volumeInicial.toFixed(6),
          dataEntrada: data.dataProducao,
          origem: "Produção — entrada imediata",
          observacoes: "Entrada e consumo imediato no romaneio diário",
          estado: "disponivel",
          criadoPor: data.criadoPor,
        });
        const plaquetaId = getInsertedId(insercaoPlaqueta as MysqlInsertResult);
        await tx.insert(movimentacoesPlaquetas).values({
          empresaId: data.empresaId,
          plaquetaId,
          tipo: "entrada",
          volume: volumeInicial.toFixed(6),
          motivo: "Entrada imediata pela Produção Diária",
          criadoPor: data.criadoPor,
        });
        plaqueta = (await tx.select().from(plaquetas).where(and(eq(plaquetas.id, plaquetaId), eq(plaquetas.empresaId, data.empresaId))).limit(1))[0];
      } else {
        plaqueta = (await tx.select().from(plaquetas).where(and(eq(plaquetas.id, entrada.plaquetaId!), eq(plaquetas.empresaId, data.empresaId))).limit(1))[0];
      }
      if (!plaqueta) throw new Error("A plaqueta selecionada não foi encontrada");
      if (plaqueta.situacaoIdentificacao === "duplicada") {
        const medidasPreenchidas = Boolean(entrada.tora.madeiraNome.trim() && entrada.tora.diametro && entrada.tora.comprimento && entrada.tora.volume);
        if (!entrada.medidasConferidasManual || !medidasPreenchidas) {
          throw new Error(`A plaqueta física ${plaqueta.codigoFisico ?? plaqueta.codigo} possui duplicidade. Confirme e preencha manualmente a essência, o diâmetro, o comprimento e o volume antes de continuar.`);
        }
      }
      plaquetasSelecionadas.push({ plaqueta, tora: entrada.tora });
    }
    const calculo = validarConfirmacaoRomaneio({ toras: plaquetasSelecionadas, itens: data.itens });
    const primeiraTora = calculo.toras[0];
    const numeroTemporario = `TMP-${crypto.randomUUID().slice(0, 20)}`;
    const insercaoRomaneio = await tx.insert(romaneiosProducao).values({
      empresaId: data.empresaId,
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
        empresaId: data.empresaId,
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
      }).where(and(eq(plaquetas.id, plaquetaId), eq(plaquetas.empresaId, data.empresaId)));
      await tx.insert(movimentacoesPlaquetas).values({
        empresaId: data.empresaId,
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
        empresaId: data.empresaId,
        romaneioId,
        ...dimensoes,
        quantidade: item.quantidade,
        metrosLineares: item.metrosLineares.toFixed(4),
        volume: item.volume.toFixed(6),
      });
      const itemRomaneioId = getInsertedId(insercaoItem as MysqlInsertResult);
      const insercaoLote = await tx.insert(lotesPecasSerradas).values({
        empresaId: data.empresaId,
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
      await tx.insert(movimentacoesEstoqueSerrado).values({ empresaId: data.empresaId, loteId, tipo: "entrada_producao", quantidade: item.quantidade, motivo: `Entrada do romaneio ${numero}`, criadoPor: data.criadoPor });
    }
    return { id: romaneioId, numero, ...calculo };
  });
}

export async function atualizarRomaneioProducao(id: number, data: {
  dataProducao: Date;
  fita?: string | null;
  responsavel?: string | null;
  observacoes?: string | null;
  itens: ItemProducaoEntrada[];
  atualizadoPor: number;
  empresaId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async (tx) => {
    const romaneio = (await tx.select().from(romaneiosProducao).where(and(eq(romaneiosProducao.id, id), eq(romaneiosProducao.empresaId, data.empresaId))).limit(1))[0];
    if (!romaneio) throw new Error("Romaneio de produção não encontrado");

    const lotes = await tx.select().from(lotesPecasSerradas).where(and(eq(lotesPecasSerradas.romaneioId, id), eq(lotesPecasSerradas.empresaId, data.empresaId)));
    for (const lote of lotes) {
      const movimentosPosteriores = await tx.select({ id: movimentacoesEstoqueSerrado.id }).from(movimentacoesEstoqueSerrado)
        .where(and(eq(movimentacoesEstoqueSerrado.loteId, lote.id), ne(movimentacoesEstoqueSerrado.tipo, "entrada_producao"))).limit(1);
      if (movimentosPosteriores[0] || lote.quantidadeDisponivel !== lote.quantidadeProduzida) {
        throw new Error("Este romaneio possui peças já movimentadas no estoque e não pode ser editado. Regularize as saídas antes de alterar a produção.");
      }
    }

    const torasRegistradas = await tx.select().from(itensRomaneioToras).where(and(eq(itensRomaneioToras.romaneioId, id), eq(itensRomaneioToras.empresaId, data.empresaId)));
    if (!torasRegistradas.length) throw new Error("O romaneio não possui toras rastreáveis para recalcular o aproveitamento");
    const toras = [] as Array<{ plaqueta: typeof plaquetas.$inferSelect; tora: { madeiraNome: string; diametro: string | null; comprimento: string | null; volume: string } }>;
    for (const toraRegistrada of torasRegistradas) {
      const plaqueta = (await tx.select().from(plaquetas).where(and(eq(plaquetas.id, toraRegistrada.plaquetaId), eq(plaquetas.empresaId, data.empresaId))).limit(1))[0];
      if (!plaqueta) throw new Error("Uma plaqueta vinculada a este romaneio não foi encontrada");
      toras.push({
        plaqueta,
        tora: {
          madeiraNome: toraRegistrada.madeiraNome,
          diametro: toraRegistrada.diametro,
          comprimento: toraRegistrada.comprimento,
          volume: toraRegistrada.volume,
        },
      });
    }
    const calculo = validarConfirmacaoRomaneio({ toras, itens: data.itens, permitirPlaquetasConsumidas: true });

    for (const lote of lotes) {
      await tx.delete(movimentacoesEstoqueSerrado).where(eq(movimentacoesEstoqueSerrado.loteId, lote.id));
    }
    await tx.delete(lotesPecasSerradas).where(eq(lotesPecasSerradas.romaneioId, id));
    await tx.delete(itensRomaneioProducao).where(eq(itensRomaneioProducao.romaneioId, id));

    await tx.update(romaneiosProducao).set({
      dataProducao: data.dataProducao,
      fita: data.fita?.trim() || null,
      responsavel: data.responsavel?.trim() || null,
      observacoes: data.observacoes?.trim() || null,
      volumeTora: calculo.volumeTora.toFixed(6),
      aproveitamento: calculo.aproveitamento.toFixed(2),
    }).where(and(eq(romaneiosProducao.id, id), eq(romaneiosProducao.empresaId, data.empresaId)));

    for (const item of calculo.itens) {
      const dimensoes = {
        madeiraNome: item.madeiraNome,
        espessura: item.espessura.toFixed(2),
        largura: item.largura.toFixed(2),
        comprimento: item.comprimento.toFixed(2),
      };
      const insercaoItem = await tx.insert(itensRomaneioProducao).values({
        empresaId: data.empresaId,
        romaneioId: id,
        ...dimensoes,
        quantidade: item.quantidade,
        metrosLineares: item.metrosLineares.toFixed(4),
        volume: item.volume.toFixed(6),
      });
      const itemRomaneioId = getInsertedId(insercaoItem as MysqlInsertResult);
      const insercaoLote = await tx.insert(lotesPecasSerradas).values({
        empresaId: data.empresaId,
        romaneioId: id,
        itemRomaneioId,
        ...dimensoes,
        quantidadeProduzida: item.quantidade,
        quantidadeDisponivel: item.quantidade,
        metrosLineares: item.metrosLineares.toFixed(4),
        volume: item.volume.toFixed(6),
        estado: "disponivel",
      });
      const loteId = getInsertedId(insercaoLote as MysqlInsertResult);
      await tx.insert(movimentacoesEstoqueSerrado).values({
        empresaId: data.empresaId,
        loteId,
        tipo: "entrada_producao",
        quantidade: item.quantidade,
        motivo: `Entrada revisada do romaneio ${romaneio.numero}`,
        criadoPor: data.atualizadoPor,
      });
    }
    return { id, numero: romaneio.numero, ...calculo };
  });
}

export async function getResumoEstoqueSerrado(empresaId = 1) {
  const db = await getDb();
  if (!db) return [];
  const lotes = await db.select().from(lotesPecasSerradas).where(eq(lotesPecasSerradas.empresaId, empresaId));
  return agruparEstoquePecas(lotes.filter((lote) => lote.estado !== "cancelado" && lote.quantidadeDisponivel !== 0));
}

export async function getRelatorioInventarioSerrado(dataInicial?: Date, dataFinal?: Date, empresaId = 1) {
  const db = await getDb();
  if (!db) return { linhas: [], resumo: { itensAnalisados: 0, itensEmRutura: 0, itensCriticos: 0, pecasEmDeficit: 0, saidasNoPeriodo: 0 }, periodo: { dataInicial: new Date(), dataFinal: new Date(), dias: 1 } };
  const fim = dataFinal ? new Date(dataFinal) : new Date();
  fim.setHours(23, 59, 59, 999);
  const inicio = dataInicial ? new Date(dataInicial) : new Date(fim);
  if (!dataInicial) inicio.setDate(inicio.getDate() - 89);
  inicio.setHours(0, 0, 0, 0);
  const [lotes, movimentos] = await Promise.all([
    db.select().from(lotesPecasSerradas).where(eq(lotesPecasSerradas.empresaId, empresaId)),
    db.select().from(movimentacoesEstoqueSerrado).where(eq(movimentacoesEstoqueSerrado.empresaId, empresaId)),
  ]);
  const movimentosNoPeriodo = movimentos.filter((movimento) => {
    const dataMovimento = new Date(movimento.createdAt).getTime();
    return dataMovimento >= inicio.getTime() && dataMovimento <= fim.getTime();
  });
  const dias = Math.max(1, Math.floor((fim.getTime() - inicio.getTime()) / 86_400_000) + 1);
  return {
    ...calcularRelatorioInventarioSerrado(lotes.filter((lote) => lote.estado !== "cancelado"), movimentosNoPeriodo, dias),
    periodo: { dataInicial: inicio, dataFinal: fim, dias },
  };
}

export async function listAjustesEstoqueSerrado(empresaId = 1) {
  const db = await getDb();
  if (!db) return [];
  const [movimentos, lotes, utilizadores] = await Promise.all([
    db.select().from(movimentacoesEstoqueSerrado).where(eq(movimentacoesEstoqueSerrado.empresaId, empresaId)),
    db.select().from(lotesPecasSerradas).where(eq(lotesPecasSerradas.empresaId, empresaId)),
    db.select({ id: users.id, name: users.name }).from(users),
  ]);
  const lotesPorId = new Map(lotes.map((lote) => [lote.id, lote]));
  const utilizadoresPorId = new Map(utilizadores.map((utilizador) => [utilizador.id, utilizador]));
  return movimentos
    .filter((movimento) => movimento.tipo === "ajuste")
    .sort((primeiro, segundo) => new Date(segundo.createdAt).getTime() - new Date(primeiro.createdAt).getTime())
    .slice(0, 30)
    .flatMap((movimento) => {
      const lote = lotesPorId.get(movimento.loteId);
      if (!lote) return [];
      return [{
        id: movimento.id,
        quantidade: movimento.quantidade,
        motivo: movimento.motivo,
        createdAt: movimento.createdAt,
        madeiraNome: lote.madeiraNome,
        espessura: lote.espessura,
        largura: lote.largura,
        comprimento: lote.comprimento,
        utilizador: utilizadoresPorId.get(movimento.criadoPor)?.name ?? `Utilizador #${movimento.criadoPor}`,
      }];
    });
}

export async function ajustarEstoqueSerrado(data: {
  madeiraNome: string;
  espessura: string | number;
  largura: string | number;
  comprimento: string | number;
  quantidadeContada: number;
  motivo: string;
  criadoPor: number;
  empresaId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const quantidadeContada = Number(data.quantidadeContada);
  if (!Number.isInteger(quantidadeContada) || quantidadeContada < 0) throw new Error("Informe uma contagem inteira igual ou superior a zero");
  if (data.motivo.trim().length < 3) throw new Error("Informe o motivo do ajuste de inventário");
  const dimensoes = calcularItemRomaneio({
    madeiraNome: data.madeiraNome,
    espessura: data.espessura,
    largura: data.largura,
    comprimento: data.comprimento,
    quantidade: 1,
  });
  return db.transaction(async (tx: any) => {
    const lotes = await tx.select().from(lotesPecasSerradas);
    const mesmaMedida = (lote: any) => lote.estado !== "cancelado"
      && lote.madeiraNome.trim().toLocaleUpperCase("pt-BR") === dimensoes.madeiraNome.trim().toLocaleUpperCase("pt-BR")
      && Math.abs(Number(lote.espessura) - dimensoes.espessura) < 0.0001
      && Math.abs(Number(lote.largura) - dimensoes.largura) < 0.0001
      && Math.abs(Number(lote.comprimento) - dimensoes.comprimento) < 0.0001;
    const saldoAnterior = lotes.filter(mesmaMedida).reduce((total: number, lote: any) => total + Number(lote.quantidadeDisponivel), 0);
    const variacao = quantidadeContada - saldoAnterior;
    if (!variacao) throw new Error("A contagem informada já corresponde ao saldo atual desta medida");
    const calculoVariacao = calcularItemRomaneio({ ...dimensoes, quantidade: Math.abs(variacao) });
    const insercao = await tx.insert(lotesPecasSerradas).values({
      romaneioId: null,
      itemRomaneioId: null,
      madeiraNome: calculoVariacao.madeiraNome,
      espessura: calculoVariacao.espessura.toFixed(2),
      largura: calculoVariacao.largura.toFixed(2),
      comprimento: calculoVariacao.comprimento.toFixed(2),
      quantidadeProduzida: Math.max(variacao, 0),
      quantidadeDisponivel: variacao,
      metrosLineares: calculoVariacao.metrosLineares.toFixed(4),
      volume: calculoVariacao.volume.toFixed(6),
      estado: variacao < 0 ? "negativo" : "disponivel",
    });
    const loteId = getInsertedId(insercao as MysqlInsertResult);
    await tx.insert(movimentacoesEstoqueSerrado).values({
      loteId,
      tipo: "ajuste",
      quantidade: variacao,
      motivo: `Inventário: ${data.motivo.trim()} | saldo anterior: ${saldoAnterior}; contagem: ${quantidadeContada}`,
      criadoPor: data.criadoPor,
    });
    return { success: true, saldoAnterior, quantidadeContada, variacao, loteId };
  });
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
    const itensParaEstoque = itens.map(converterDimensoesVendaParaEstoque);
    const { alocacoes, deficits } = alocarPecasPermitindoNegativo(itensParaEstoque, lotes);
    const lotesPorId = new Map<number, any>(lotes.map((lote: any) => [lote.id, lote] as [number, any]));
    const movimentacoes: Array<{ itemVendaId: number; loteId: number; quantidade: number }> = [];
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
      movimentacoes.push(alocacao);
    }
    for (const deficit of deficits) {
      const dimensoes = calcularItemRomaneio({
        madeiraNome: deficit.madeiraNome,
        espessura: deficit.espessura,
        largura: deficit.largura,
        comprimento: deficit.comprimento,
        quantidade: deficit.quantidade,
      });
      const insercao = await tx.insert(lotesPecasSerradas).values({
        romaneioId: null,
        itemRomaneioId: null,
        madeiraNome: dimensoes.madeiraNome,
        espessura: dimensoes.espessura.toFixed(2),
        largura: dimensoes.largura.toFixed(2),
        comprimento: dimensoes.comprimento.toFixed(2),
        quantidadeProduzida: 0,
        quantidadeDisponivel: -dimensoes.quantidade,
        metrosLineares: dimensoes.metrosLineares.toFixed(4),
        volume: dimensoes.volume.toFixed(6),
        estado: "negativo",
      });
      const loteId = getInsertedId(insercao as MysqlInsertResult);
      await tx.insert(movimentacoesEstoqueSerrado).values({
        loteId,
        itemVendaId: deficit.itemVendaId,
        tipo: "saida_entrega",
        quantidade: deficit.quantidade,
        motivo: `Entrega física sem saldo da venda ${venda.numero ?? venda.id}`,
        criadoPor: userId,
      });
      movimentacoes.push({ itemVendaId: deficit.itemVendaId, loteId, quantidade: deficit.quantidade });
    }
    const entregueEm = new Date();
    await tx.update(orcamentos).set({ entregue: true, entregueEm, entreguePor: userId }).where(eq(orcamentos.id, vendaId));
    await tx.insert(historicoAlteracoes).values({
      orcamentoId: vendaId,
      usuarioId: userId,
      tipo: "alteracao" as any,
      detalhes: JSON.stringify({ acao: "entrega_fisica_confirmada", entregueEm: entregueEm.toISOString(), alocacoes: movimentacoes }),
    });
    return { success: true, entregueEm, pecasEntregues: movimentacoes.reduce((total, alocacao) => total + alocacao.quantidade, 0), pecasSemEstoque: deficits.reduce((total, deficit) => total + deficit.quantidade, 0) };
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
      await tx.update(lotesPecasSerradas).set({ quantidadeDisponivel: saldo, estado: saldo === 0 ? "esgotado" : saldo < 0 ? "negativo" : "disponivel" }).where(eq(lotesPecasSerradas.id, lote.id));
      await tx.insert(movimentacoesEstoqueSerrado).values({ loteId: lote.id, itemVendaId: saida.itemVendaId, tipo: "estorno_entrega", quantidade: saida.quantidade, motivo: motivo.trim(), criadoPor: userId });
    }
    await tx.update(orcamentos).set({ entregue: false, entregueEm: null, entreguePor: null }).where(eq(orcamentos.id, vendaId));
    await tx.insert(historicoAlteracoes).values({ orcamentoId: vendaId, usuarioId: userId, tipo: "alteracao" as any, detalhes: JSON.stringify({ acao: "entrega_fisica_estornada", motivo: motivo.trim() }) });
    return { success: true, pecasDevolvidas: saidas.reduce((total: number, saida: any) => total + saida.quantidade, 0) };
  });
}

// ─── Tanque de diesel ───
async function getOrCreateCategoriaPagamentoDiesel(tx: any, userId: number): Promise<number> {
  const existente = await tx.select().from(categoriasFinanceiras)
    .where(and(eq(categoriasFinanceiras.nome, "Pagamento de nota de diesel"), eq(categoriasFinanceiras.ativo, true))).limit(1);
  if (existente[0]) return existente[0].id;
  const resultado = await tx.insert(categoriasFinanceiras).values({
    nome: "Pagamento de nota de diesel",
    tipo: "despesa",
    ativo: true,
    criadoPor: userId,
  });
  return getInsertedId(resultado as MysqlInsertResult);
}

export async function getResumoTanqueDiesel(empresaId = 1) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [notasComFornecedor, abastecimentos, titulos] = await Promise.all([
    db.select({ nota: notasDiesel, fornecedorNome: fornecedores.nome }).from(notasDiesel)
      .leftJoin(fornecedores, and(eq(notasDiesel.fornecedorId, fornecedores.id), eq(fornecedores.empresaId, empresaId)))
      .where(eq(notasDiesel.empresaId, empresaId)).orderBy(desc(notasDiesel.dataNota)),
    db.select().from(abastecimentosDiesel).where(eq(abastecimentosDiesel.empresaId, empresaId)).orderBy(desc(abastecimentosDiesel.dataAbastecimento)),
    db.select().from(titulosFinanceiros).where(and(eq(titulosFinanceiros.origem, "nota_diesel"), eq(titulosFinanceiros.empresaId, empresaId))),
  ]);
  const tituloPorNota = new Map<number, any>(titulos.filter((titulo: any) => titulo.notaDieselId).map((titulo: any) => [titulo.notaDieselId, titulo]));
  const resumo = calcularResumoTanqueDiesel(notasComFornecedor.map(({ nota }: any) => nota), abastecimentos);
  return {
    ...resumo,
    notas: notasComFornecedor.map(({ nota, fornecedorNome }: any) => ({
      ...nota,
      fornecedorNome: fornecedorNome ?? "Fornecedor não informado",
      titulo: tituloPorNota.get(nota.id) ?? null,
    })),
    abastecimentos,
  };
}

export async function criarNotaDiesel(data: {
  numeroNota?: string | null;
  fornecedorId: number;
  litros: string;
  valorTotal: string;
  dataNota: Date;
  dataVencimento: Date;
  observacoes?: string | null;
  criadoPor: number;
  empresaId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async (tx: any) => {
    const fornecedor = (await tx.select().from(fornecedores).where(and(eq(fornecedores.id, data.fornecedorId), eq(fornecedores.empresaId, data.empresaId))).limit(1))[0];
    if (!fornecedor) throw new Error("Fornecedor não encontrado para a nota de diesel");
    const litros = Number(data.litros.replace(",", "."));
    const valorTotal = Number(data.valorTotal.replace(",", "."));
    if (!(litros > 0) || !(valorTotal > 0)) throw new Error("Informe litros e valor total válidos para a nota de diesel");
    const notaResultado = await tx.insert(notasDiesel).values({
      empresaId: data.empresaId,
      numeroNota: data.numeroNota?.trim() || null,
      fornecedorId: data.fornecedorId,
      litros: litros.toFixed(3),
      valorTotal: valorTotal.toFixed(2),
      dataNota: data.dataNota,
      dataVencimento: data.dataVencimento,
      observacoes: data.observacoes?.trim() || null,
      criadoPor: data.criadoPor,
    });
    const notaDieselId = getInsertedId(notaResultado as MysqlInsertResult);
    const categoriaId = await getOrCreateCategoriaPagamentoDiesel(tx, data.criadoPor);
    const tituloResultado = await tx.insert(titulosFinanceiros).values({
      empresaId: data.empresaId,
      tipo: "pagar",
      origem: "nota_diesel",
      chaveImportacao: null,
      descricao: `Pagamento de diesel${data.numeroNota?.trim() ? ` — Nota ${data.numeroNota.trim()}` : ""}`,
      clienteId: null,
      fornecedorId: data.fornecedorId,
      contraparteNome: fornecedor.nome,
      orcamentoId: null,
      romaneioCargaId: null,
      notaDieselId,
      categoriaId,
      recorrenciaId: null,
      grupoParcelamento: null,
      numeroParcela: null,
      totalParcelas: null,
      valorOriginal: valorTotal.toFixed(2),
      desconto: "0",
      juros: "0",
      valorBaixado: "0",
      dataEmissao: data.dataNota,
      dataVencimento: data.dataVencimento,
      competencia: data.dataNota,
      estado: calcularEstadoTitulo({ valorOriginal: valorTotal.toFixed(2), dataVencimento: data.dataVencimento }),
      observacoes: ["Lembrete financeiro vinculado à nota de diesel.", data.observacoes?.trim()].filter(Boolean).join("\n") || null,
      canceladoEm: null,
      canceladoPor: null,
      criadoPor: data.criadoPor,
    });
    return { id: notaDieselId, tituloFinanceiroId: getInsertedId(tituloResultado as MysqlInsertResult) };
  });
}

export async function registrarAbastecimentoDiesel(data: {
  destino: string;
  responsavel?: string | null;
  litros: string;
  dataAbastecimento: Date;
  observacoes?: string | null;
  criadoPor: number;
  empresaId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (!data.destino.trim()) throw new Error("Informe o destino do abastecimento");
  return db.transaction(async (tx: any) => {
    const [notas, abastecimentos] = await Promise.all([
      tx.select().from(notasDiesel).where(eq(notasDiesel.empresaId, data.empresaId)),
      tx.select().from(abastecimentosDiesel).where(eq(abastecimentosDiesel.empresaId, data.empresaId)),
    ]);
    const custo = calcularCustoAbastecimentoDiesel(calcularResumoTanqueDiesel(notas, abastecimentos), data.litros);
    const resultado = await tx.insert(abastecimentosDiesel).values({
      empresaId: data.empresaId,
      destino: data.destino.trim(),
      responsavel: data.responsavel?.trim() || null,
      litros: custo.litros.toFixed(3),
      custoUnitario: custo.custoUnitario.toFixed(4),
      custoTotal: custo.custoTotal.toFixed(2),
      dataAbastecimento: data.dataAbastecimento,
      observacoes: data.observacoes?.trim() || null,
      criadoPor: data.criadoPor,
    });
    return { id: getInsertedId(resultado as MysqlInsertResult), ...custo };
  });
}
