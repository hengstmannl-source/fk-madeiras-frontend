import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { calcularParcelas } from "../financeiro.logic";

export const TipoTituloSchema = z.enum(["receber", "pagar"]);
export const FormaPagamentoFinanceiraSchema = z.enum([
  "pix", "dinheiro", "cartao_credito", "cartao_debito", "transferencia", "boleto", "outro",
]);
export const DataFinanceiraSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida");

function dataLocal(data: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(ano, mes - 1, dia, 12, 0, 0);
}

function fimDoDiaLocal(data: string): Date {
  const resultado = dataLocal(data);
  resultado.setHours(23, 59, 59, 999);
  return resultado;
}

function adicionarMeses(data: Date, meses: number): Date {
  const proxima = new Date(data);
  proxima.setMonth(proxima.getMonth() + meses);
  return proxima;
}

export const LancamentoManualSchema = z.object({
  tipo: TipoTituloSchema,
  descricao: z.string().trim().min(2, "Informe uma descrição"),
  categoriaId: z.number().int().positive(),
  valorOriginal: z.string().regex(/^\d+(?:[.,]\d{1,2})?$/, "Informe um valor válido"),
  dataEmissao: DataFinanceiraSchema,
  dataVencimento: DataFinanceiraSchema,
  clienteId: z.number().int().positive().nullable().optional(),
  fornecedorId: z.number().int().positive().nullable().optional(),
  contraparteNome: z.string().trim().max(300).nullable().optional(),
  desconto: z.string().regex(/^\d+(?:[.,]\d{1,2})?$/).optional(),
  juros: z.string().regex(/^\d+(?:[.,]\d{1,2})?$/).optional(),
  observacoes: z.string().max(4000).nullable().optional(),
});

const FornecedorSchema = z.object({
  nome: z.string().trim().min(2).max(300),
  contacto: z.string().trim().max(100).nullable().optional(),
  email: z.string().email().max(300).nullable().optional(),
  documento: z.string().trim().max(30).nullable().optional(),
  endereco: z.string().max(3000).nullable().optional(),
  observacoes: z.string().max(4000).nullable().optional(),
});

const CategoriaSchema = z.object({
  nome: z.string().trim().min(2).max(150),
  tipo: z.enum(["receita", "despesa", "ambos"]).default("ambos"),
  categoriaPaiId: z.number().int().positive().nullable().optional(),
});

const ContaSchema = z.object({
  nome: z.string().trim().min(2).max(150),
  tipo: z.enum(["caixa", "banco", "carteira", "outro"]).default("caixa"),
  saldoInicial: z.string().regex(/^-?\d+(?:[.,]\d{1,2})?$/).default("0"),
  observacoes: z.string().max(4000).nullable().optional(),
});

export const RecorrenciaSchema = z.object({
  tipo: TipoTituloSchema,
  descricao: z.string().trim().min(2).max(300),
  categoriaId: z.number().int().positive(),
  contaFinanceiraId: z.number().int().positive().nullable().optional(),
  clienteId: z.number().int().positive().nullable().optional(),
  fornecedorId: z.number().int().positive().nullable().optional(),
  contraparteNome: z.string().trim().max(300).nullable().optional(),
  valor: z.string().regex(/^\d+(?:[.,]\d{1,2})?$/, "Informe um valor válido"),
  frequencia: z.enum(["semanal", "mensal", "trimestral", "semestral", "anual"]),
  proximoVencimento: DataFinanceiraSchema,
  dataFim: DataFinanceiraSchema.nullable().optional(),
  observacoes: z.string().max(4000).nullable().optional(),
});

export const financeiroRouter = router({
  fornecedores: router({
    list: protectedProcedure.query(() => db.listFornecedores()),
    create: protectedProcedure.input(FornecedorSchema).mutation(({ ctx, input }) => (
      db.createFornecedor({ ...input, criadoPor: ctx.user.id, ativo: true })
    )),
    update: protectedProcedure.input(FornecedorSchema.partial().extend({ id: z.number().int().positive() })).mutation(({ input }) => {
      const { id, ...dados } = input;
      return db.updateFornecedor(id, dados);
    }),
    archive: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => db.archiveFornecedor(input.id)),
  }),

  categorias: router({
    list: protectedProcedure.query(() => db.listCategoriasFinanceiras()),
    create: protectedProcedure.input(CategoriaSchema).mutation(({ ctx, input }) => (
      db.createCategoriaFinanceira({ ...input, criadoPor: ctx.user.id, ativo: true })
    )),
    update: protectedProcedure.input(CategoriaSchema.partial().extend({ id: z.number().int().positive() })).mutation(({ input }) => {
      const { id, ...dados } = input;
      return db.updateCategoriaFinanceira(id, dados);
    }),
  }),

  contas: router({
    list: protectedProcedure.query(() => db.listContasFinanceiras()),
    create: protectedProcedure.input(ContaSchema).mutation(({ ctx, input }) => (
      db.createContaFinanceira({ ...input, saldoInicial: input.saldoInicial.replace(",", "."), criadoPor: ctx.user.id, ativa: true })
    )),
    update: protectedProcedure.input(ContaSchema.partial().extend({ id: z.number().int().positive() })).mutation(({ input }) => {
      const { id, saldoInicial, ...dados } = input;
      return db.updateContaFinanceira(id, {
        ...dados,
        ...(saldoInicial !== undefined ? { saldoInicial: saldoInicial.replace(",", ".") } : {}),
      });
    }),
  }),

  alertas: router({
    list: protectedProcedure.query(() => db.listAlertasFinanceiros()),
  }),

  relatorios: router({
    fluxoCaixa: protectedProcedure.input(z.object({
      dataInicio: DataFinanceiraSchema,
      dataFim: DataFinanceiraSchema,
    }).refine((periodo) => periodo.dataInicio <= periodo.dataFim, {
      message: "A data inicial não pode ser posterior à data final",
      path: ["dataFim"],
    })).query(({ input }) => db.getRelatorioFluxoCaixa({
      dataInicio: dataLocal(input.dataInicio),
      dataFim: fimDoDiaLocal(input.dataFim),
    })),
  }),

  titulos: router({
    list: protectedProcedure.input(z.object({
      tipo: TipoTituloSchema.optional(),
      estado: z.enum(["aberto", "parcial", "quitado", "vencido", "cancelado"]).optional(),
      clienteId: z.number().int().positive().optional(),
      fornecedorId: z.number().int().positive().optional(),
    }).optional()).query(({ input }) => db.listTitulosFinanceiros(input)),

    createManual: protectedProcedure.input(LancamentoManualSchema).mutation(({ ctx, input }) => (
      db.createTituloFinanceiro({
        ...input,
        origem: "manual",
        valorOriginal: input.valorOriginal.replace(",", "."),
        desconto: input.desconto?.replace(",", "."),
        juros: input.juros?.replace(",", "."),
        dataEmissao: dataLocal(input.dataEmissao),
        dataVencimento: dataLocal(input.dataVencimento),
        criadoPor: ctx.user.id,
      })
    )),

    createParcelado: protectedProcedure.input(LancamentoManualSchema.extend({
      quantidadeParcelas: z.number().int().min(2).max(120),
    })).mutation(async ({ ctx, input }) => {
      const valores = calcularParcelas(input.valorOriginal.replace(",", "."), input.quantidadeParcelas);
      const grupoParcelamento = `PARC-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const vencimentoInicial = dataLocal(input.dataVencimento);
      const titulos = await Promise.all(valores.map((valorOriginal, indice) => (
        db.createTituloFinanceiro({
          ...input,
          origem: "manual",
          valorOriginal,
          desconto: indice === 0 ? input.desconto?.replace(",", ".") : "0",
          juros: indice === 0 ? input.juros?.replace(",", ".") : "0",
          dataEmissao: dataLocal(input.dataEmissao),
          dataVencimento: adicionarMeses(vencimentoInicial, indice),
          grupoParcelamento,
          numeroParcela: indice + 1,
          totalParcelas: input.quantidadeParcelas,
          criadoPor: ctx.user.id,
        })
      )));
      return { grupoParcelamento, titulos };
    }),

    baixas: protectedProcedure.input(z.object({ tituloId: z.number().int().positive() })).query(({ input }) => db.listBaixasFinanceiras(input.tituloId)),
    baixar: protectedProcedure.input(z.object({
      tituloId: z.number().int().positive(),
      contaFinanceiraId: z.number().int().positive(),
      valor: z.string().regex(/^\d+(?:[.,]\d{1,2})?$/),
      dataBaixa: DataFinanceiraSchema,
      formaPagamento: FormaPagamentoFinanceiraSchema,
      observacoes: z.string().max(4000).optional(),
    })).mutation(({ ctx, input }) => db.registrarBaixaFinanceira({
      ...input,
      valor: input.valor.replace(",", "."),
      dataBaixa: dataLocal(input.dataBaixa),
      criadoPor: ctx.user.id,
    })),
    conciliarBaixa: protectedProcedure.input(z.object({ id: z.number().int().positive(), conciliada: z.boolean() }))
      .mutation(({ input }) => db.conciliarBaixaFinanceira(input.id, input.conciliada)),
    estornarBaixa: protectedProcedure.input(z.object({
      id: z.number().int().positive(),
      motivo: z.string().trim().min(3, "Informe o motivo do estorno").max(2000),
    })).mutation(({ ctx, input }) => db.estornarBaixaFinanceira(input.id, ctx.user.id, input.motivo)),
    cancelar: protectedProcedure.input(z.object({ id: z.number().int().positive() }))
      .mutation(({ ctx, input }) => db.cancelarTituloFinanceiro(input.id, ctx.user.id)),
  }),

  recorrencias: router({
    list: protectedProcedure.query(() => db.listRecorrenciasFinanceiras()),
    create: protectedProcedure.input(RecorrenciaSchema).mutation(({ ctx, input }) => (
      db.createRecorrenciaFinanceira({
        ...input,
        valor: input.valor.replace(",", "."),
        proximoVencimento: dataLocal(input.proximoVencimento),
        dataFim: input.dataFim ? dataLocal(input.dataFim) : null,
        ativa: true,
        criadoPor: ctx.user.id,
      })
    )),
    update: protectedProcedure.input(RecorrenciaSchema.partial().extend({ id: z.number().int().positive(), ativa: z.boolean().optional() })).mutation(({ input }) => {
      const { id, valor, proximoVencimento, dataFim, ...dados } = input;
      return db.updateRecorrenciaFinanceira(id, {
        ...dados,
        ...(valor !== undefined ? { valor: valor.replace(",", ".") } : {}),
        ...(proximoVencimento !== undefined ? { proximoVencimento: dataLocal(proximoVencimento) } : {}),
        ...(dataFim !== undefined ? { dataFim: dataFim ? dataLocal(dataFim) : null } : {}),
      });
    }),
  }),
});
