import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

export const ItemSchema = z.object({
  madeiraId: z.number().nullable().optional(),
  bitolaId: z.number().nullable().optional(),
  madeiraNome: z.string(),
  bitolaDescricao: z.string(),
  espessura: z.string(),
  largura: z.string(),
  comprimento: z.string(),
  quantidade: z.number(),
  precoM3: z.string(),
  precoLinear: z.string(),
  valorPeca: z.string(),
  valorTotal: z.string(),
  orcamentoId: z.number().optional(),
});

export const FormaPagamentoSchema = z.enum([
  "pix",
  "dinheiro",
  "cartao_credito",
  "cartao_debito",
  "transferencia",
  "boleto",
  "outro",
]);

export const RegistroPagamentoSchema = z.object({
  id: z.number(),
  formaPagamento: FormaPagamentoSchema.default("outro"),
  pagoEm: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data de pagamento válida").default(() => new Date().toISOString().slice(0, 10)),
});

const DataFinanceiraSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida");

function parseDataFinanceira(data: string) {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(ano, mes - 1, dia, 12, 0, 0);
}

export const orcamentoRouter = router({
  list: protectedProcedure
    .input(z.object({
      estado: z.string().optional(),
      clienteId: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      return db.listOrcamentos(input);
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return db.getOrcamentoWithItems(input.id);
    }),

  create: protectedProcedure
    .input(z.object({
      clienteId: z.number(),
      estado: z.enum(["rascunho", "enviado", "aprovado", "rejeitado"]).default("rascunho"),
      desconto: z.string().default("0"),
      frete: z.string().default("0"),
      subtotal: z.string(),
      total: z.string(),
      totalPecas: z.number(),
      totalMetroLinear: z.string(),
      totalVolume: z.string(),
      observacoes: z.string().optional(),
      vendedor: z.string().optional(),
      dataVencimento: DataFinanceiraSchema.optional(),
      competencia: DataFinanceiraSchema.optional(),
      itens: z.array(ItemSchema),
    }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      const estadoInicial = input.estado === "aprovado" ? "rascunho" : input.estado;
      const orcamento = await db.createOrcamento(
        {
          numero: null,
          clienteId: input.clienteId,
          estado: estadoInicial,
          desconto: input.desconto,
          frete: input.frete,
          subtotal: input.subtotal,
          total: input.total,
          totalPecas: input.totalPecas,
          totalMetroLinear: input.totalMetroLinear,
          totalVolume: input.totalVolume,
          observacoes: input.observacoes ?? null,
          vendedor: input.vendedor ?? null,
          criadoPor: ctx.user.id,
          dataVencimento: input.dataVencimento ? parseDataFinanceira(input.dataVencimento) : now,
          competencia: input.competencia ? parseDataFinanceira(input.competencia) : now,
        },
        input.itens
      );
      if (input.estado === "aprovado") {
        await db.updateOrcamentoEstado(orcamento.id, "aprovado", ctx.user.id);
      }
      return orcamento;
    }),

  updateEstado: protectedProcedure
    .input(z.object({
      id: z.number(),
      estado: z.enum(["rascunho", "enviado", "aprovado", "rejeitado"]),
      confirmacaoDupla: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.updateOrcamentoEstado(input.id, input.estado, ctx.user.id, input.confirmacaoDupla);
      if (input.estado === "aprovado") {
        await db.criarTituloReceberDeOrcamento(input.id, ctx.user.id);
      }
      return { success: true };
    }),

  atualizarDatas: protectedProcedure
    .input(z.object({
      id: z.number(),
      dataVencimento: DataFinanceiraSchema,
      competencia: DataFinanceiraSchema,
      confirmacaoDupla: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      return db.atualizarDatasOrcamento(input.id, {
        dataVencimento: parseDataFinanceira(input.dataVencimento),
        competencia: parseDataFinanceira(input.competencia),
      }, input.confirmacaoDupla);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number(), confirmacaoDupla: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteOrcamento(input.id, input.confirmacaoDupla, ctx.user.id);
      return { success: true };
    }),

  registrarPagamento: protectedProcedure
    .input(RegistroPagamentoSchema)
    .mutation(async ({ ctx, input }) => {
      const dataPagamento = parseDataFinanceira(input.pagoEm);
      return db.registrarPagamentoOrcamento(input.id, ctx.user.id, input.formaPagamento, dataPagamento);
    }),

  entregarFisicamente: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ ctx, input }) => db.entregarVendaFisicamente(input.id, ctx.user.id)),

  estornarEntrega: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), motivo: z.string().trim().min(3, "Informe o motivo do estorno") }))
    .mutation(({ ctx, input }) => db.estornarEntregaVenda(input.id, ctx.user.id, input.motivo)),

  duplicate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return db.duplicateOrcamento(input.id);
    }),
});
