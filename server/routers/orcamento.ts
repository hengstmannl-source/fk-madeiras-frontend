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
  quantidade: z.number().int().positive("Informe uma quantidade inteira positiva"),
  tipoComercializacao: z.enum(["metro_cubico", "unidade", "pacote"]).default("metro_cubico"),
  unidadesPorComercializacao: z.number().int().min(0, "Informe a composição do pacote com zero ou mais unidades").default(1),
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

const BaixaAproveitamentoSchema = z.object({
  madeiraNome: z.string().trim().min(2, "Informe a essência do aproveitamento").max(200),
  volume: z.union([z.string(), z.number()])
    .transform((valor) => String(valor).replace(",", "."))
    .refine((valor) => Number(valor) > 0, "Informe um volume de aproveitamento positivo"),
});

export const AproveitamentoVendaSchema = BaixaAproveitamentoSchema.extend({
  precoM3: z.union([z.string(), z.number()])
    .transform((valor) => String(valor).replace(",", "."))
    .refine((valor) => Number(valor) >= 0, "Informe um preço por m³ válido"),
});

export const RegistroEntregaFisicaSchema = z.object({
  id: z.number().int().positive(),
  entregueEm: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida"),
  modalidadeEntrega: z.enum(["retirada", "entrega"]),
  responsavelEntrega: z.string().trim().min(2, "Informe o responsável pela entrega").max(200),
  observacoesEntrega: z.string().trim().max(4000).optional(),
  aproveitamentos: z.array(BaixaAproveitamentoSchema).max(30).default([]),
});

const DataFinanceiraSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida");
const LinhaModeloSchema = z.object({ comprimento: z.string().trim().min(1), quantidade: z.string().trim().min(1) });

function parseDataFinanceira(data: string) {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(ano, mes - 1, dia, 12, 0, 0);
}

async function garantirVendaDaEmpresa(id: number, empresaId: number) {
  const venda = await db.getOrcamentoById(id, empresaId);
  if (!venda) throw new Error("Venda não encontrada para a empresa ativa");
  return venda;
}

export const orcamentoRouter = router({
  list: protectedProcedure
    .input(z.object({
      estado: z.string().optional(),
      clienteId: z.number().optional(),
      categoria: z.enum(["aprovadas", "pagas", "entregues", "concluidas"]).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      return db.listOrcamentos(input, ctx.empresaAtiva!.empresa.id);
    }),

  resumoFilas: protectedProcedure
    .query(({ ctx }) => db.getResumoFilasVendas(ctx.empresaAtiva!.empresa.id)),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      return db.getOrcamentoWithItems(input.id, ctx.empresaAtiva!.empresa.id);
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
      aproveitamentos: z.array(AproveitamentoVendaSchema).max(30).default([]),
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
          empresaId: ctx.empresaAtiva!.empresa.id,
          dataVencimento: input.dataVencimento ? parseDataFinanceira(input.dataVencimento) : now,
          competencia: input.competencia ? parseDataFinanceira(input.competencia) : now,
        },
        input.itens,
        input.aproveitamentos,
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
      await garantirVendaDaEmpresa(input.id, ctx.empresaAtiva!.empresa.id);
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
    .mutation(async ({ ctx, input }) => {
      await garantirVendaDaEmpresa(input.id, ctx.empresaAtiva!.empresa.id);
      return db.atualizarDatasOrcamento(input.id, {
        dataVencimento: parseDataFinanceira(input.dataVencimento),
        competencia: parseDataFinanceira(input.competencia),
      }, input.confirmacaoDupla);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number(), confirmacaoDupla: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      await garantirVendaDaEmpresa(input.id, ctx.empresaAtiva!.empresa.id);
      await db.deleteOrcamento(input.id, input.confirmacaoDupla, ctx.user.id);
      return { success: true };
    }),

  registrarPagamento: protectedProcedure
    .input(RegistroPagamentoSchema)
    .mutation(async ({ ctx, input }) => {
      await garantirVendaDaEmpresa(input.id, ctx.empresaAtiva!.empresa.id);
      const dataPagamento = parseDataFinanceira(input.pagoEm);
      return db.registrarPagamentoOrcamento(input.id, ctx.user.id, input.formaPagamento, dataPagamento);
    }),

  entregarFisicamente: protectedProcedure
    .input(RegistroEntregaFisicaSchema)
    .mutation(async ({ ctx, input }) => {
      await garantirVendaDaEmpresa(input.id, ctx.empresaAtiva!.empresa.id);
      return db.entregarVendaFisicamente(input.id, ctx.user.id, {
        entregueEm: parseDataFinanceira(input.entregueEm),
        modalidadeEntrega: input.modalidadeEntrega,
        responsavelEntrega: input.responsavelEntrega,
        observacoesEntrega: input.observacoesEntrega,
        aproveitamentos: input.aproveitamentos,
      });
    }),

  estornarEntrega: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), motivo: z.string().trim().min(3, "Informe o motivo do estorno") }))
    .mutation(async ({ ctx, input }) => {
      await garantirVendaDaEmpresa(input.id, ctx.empresaAtiva!.empresa.id);
      return db.estornarEntregaVenda(input.id, ctx.user.id, input.motivo);
    }),

  modelosMedida: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const modelos = await db.listModelosMedidaVenda(ctx.empresaAtiva!.empresa.id);
      return modelos.map((modelo) => ({
        ...modelo,
        comprimentos: JSON.parse(modelo.comprimentos) as Array<{ comprimento: string; quantidade: string }>,
      }));
    }),
    create: protectedProcedure.input(z.object({
      nome: z.string().trim().min(2).max(120),
      madeiraId: z.number().int().positive().nullable(),
      madeiraNome: z.string().trim().min(2).max(200),
      precoM3: z.string().trim().min(1),
      espessuraCm: z.string().trim().min(1),
      larguraCm: z.string().trim().min(1),
      comprimentos: z.array(LinhaModeloSchema).min(1),
    })).mutation(async ({ ctx, input }) => {
      const id = await db.createModeloMedidaVenda({
        ...input,
        comprimentos: JSON.stringify(input.comprimentos),
        criadoPor: ctx.user.id,
        empresaId: ctx.empresaAtiva!.empresa.id,
      });
      return { id };
    }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() }))
      .mutation(({ ctx, input }) => db.deleteModeloMedidaVenda(input.id, ctx.user.id, ctx.empresaAtiva!.empresa.id)),
  }),

  duplicate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await garantirVendaDaEmpresa(input.id, ctx.empresaAtiva!.empresa.id);
      return db.duplicateOrcamento(input.id);
    }),
});
