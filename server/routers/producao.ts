import { z } from "zod";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

const DataSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida");
const DecimalPositivo = z.union([z.string(), z.number()]).transform((valor) => String(valor).replace(",", ".")).refine((valor) => Number(valor) > 0, "Informe um valor positivo");
const DecimalNaoNegativo = z.union([z.string(), z.number()]).transform((valor) => String(valor).replace(",", ".")).refine((valor) => Number(valor) >= 0, "Informe um valor válido");

function dataLocal(data: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(ano, mes - 1, dia, 12, 0, 0);
}

const PlaquetaSchema = z.object({
  codigo: z.string().trim().min(2).max(80),
  madeiraNome: z.string().trim().min(2).max(200),
  espessura: DecimalPositivo.optional().nullable(),
  largura: DecimalPositivo.optional().nullable(),
  comprimento: DecimalPositivo.optional().nullable(),
  volumeInicial: DecimalPositivo,
  dataEntrada: DataSchema,
  origem: z.string().trim().max(200).nullable().optional(),
  localizacao: z.string().trim().max(200).nullable().optional(),
  observacoes: z.string().max(4000).nullable().optional(),
});

const PlaquetaCargaSchema = z.object({
  codigo: z.string().trim().min(2).max(80),
  madeiraNome: z.string().trim().min(2).max(200),
  diametro: DecimalPositivo,
  comprimento: DecimalPositivo,
  valorMetroCubico: DecimalPositivo,
  observacoes: z.string().max(1000).nullable().optional(),
});

const RomaneioCargaSchema = z.object({
  dataCarga: DataSchema,
  origem: z.string().trim().max(200).nullable().optional(),
  responsavel: z.string().trim().max(200).nullable().optional(),
  observacoes: z.string().max(4000).nullable().optional(),
  fretePorMetroCubico: DecimalNaoNegativo.default("0"),
  plaquetas: z.array(PlaquetaCargaSchema).min(1, "Adicione ao menos uma plaqueta").max(200),
});

const FiltrosCargasSchema = z.object({
  dataInicial: DataSchema.optional(),
  dataFinal: DataSchema.optional(),
  origem: z.string().trim().max(200).optional(),
}).refine((valor) => !valor.dataInicial || !valor.dataFinal || valor.dataInicial <= valor.dataFinal, "A data inicial deve ser anterior à data final");

const ListaPlaquetasSchema = z.object({
  busca: z.string().trim().max(200).optional(),
  limite: z.number().int().min(1).max(500).default(10),
  deslocamento: z.number().int().min(0).default(0),
});

const RelatorioInventarioSchema = z.object({
  dataInicial: DataSchema.optional(),
  dataFinal: DataSchema.optional(),
}).refine((valor) => !valor.dataInicial || !valor.dataFinal || valor.dataInicial <= valor.dataFinal, "A data inicial deve ser anterior à data final");

const AjusteEstoqueSerradoSchema = z.object({
  madeiraNome: z.string().trim().min(2).max(200),
  espessura: DecimalPositivo,
  largura: DecimalPositivo,
  comprimento: DecimalPositivo,
  quantidadeContada: z.number().int().min(0).max(1_000_000),
  motivo: z.string().trim().min(3).max(1000),
});

const ItemRomaneioSchema = z.object({
  madeiraNome: z.string().trim().min(2).max(200),
  espessura: DecimalPositivo,
  largura: DecimalPositivo,
  comprimento: DecimalPositivo,
  quantidade: z.number().int().positive(),
});

const ToraRomaneioSchema = z.object({
    madeiraNome: z.string().trim().min(2).max(200),
    diametro: DecimalPositivo.optional().nullable(),
    comprimento: DecimalPositivo.optional().nullable(),
    volume: DecimalPositivo,
  });

const ToraEntradaRomaneioSchema = z.object({
  plaquetaId: z.number().int().positive().optional(),
  novaPlaqueta: z.object({
    codigo: z.string().trim().min(2).max(80),
  }).optional(),
  tora: ToraRomaneioSchema,
}).refine((entrada) => Boolean(entrada.plaquetaId) !== Boolean(entrada.novaPlaqueta), "Informe uma plaqueta disponível ou um novo código para entrada imediata");

const RomaneioSchema = z.object({
  toras: z.array(ToraEntradaRomaneioSchema).min(1, "Informe ao menos uma plaqueta serrada"),
  dataProducao: DataSchema,
  fita: z.string().trim().max(100).nullable().optional(),
  responsavel: z.string().trim().max(200).nullable().optional(),
  observacoes: z.string().max(4000).nullable().optional(),
  itens: z.array(ItemRomaneioSchema).min(1, "Adicione ao menos uma peça produzida"),
});

export const producaoRouter = router({
  cargas: router({
    list: protectedProcedure.input(FiltrosCargasSchema.optional()).query(({ input }) => db.listRomaneiosCargaToras({
      dataInicial: input?.dataInicial ? dataLocal(input.dataInicial) : undefined,
      dataFinal: input?.dataFinal ? dataLocal(input.dataFinal) : undefined,
      origem: input?.origem,
    })),
    get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(({ input }) => db.getRomaneioCargaComPlaquetas(input.id)),
    modeloPlaquetasCsv: protectedProcedure.query(() => db.getModeloImportacaoPlaquetasCargaCsv()),
    importarPlaquetasCsv: protectedProcedure.input(RomaneioCargaSchema.omit({ plaquetas: true }).extend({
      conteudo: z.string().min(1, "Selecione um arquivo CSV").max(1_000_000, "O arquivo excede o limite de 1 MB"),
    })).mutation(({ ctx, input }) => db.importarPlaquetasCargaCsv({
      ...input,
      dataCarga: dataLocal(input.dataCarga),
    }, ctx.user.id)),
    create: protectedProcedure.input(RomaneioCargaSchema).mutation(({ ctx, input }) => db.criarRomaneioCargaToras({
      ...input,
      dataCarga: dataLocal(input.dataCarga),
      criadoPor: ctx.user.id,
    })),
    update: protectedProcedure.input(RomaneioCargaSchema.extend({ id: z.number().int().positive() })).mutation(({ input }) => db.atualizarRomaneioCargaToras(input.id, {
      ...input,
      dataCarga: dataLocal(input.dataCarga),
    })),
    excluir: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => db.excluirRomaneioCargaToras(input.id)),
  }),
  plaquetas: router({
    list: protectedProcedure.input(ListaPlaquetasSchema.optional()).query(({ input }) => db.listPlaquetas(input)),
    create: protectedProcedure.input(PlaquetaSchema).mutation(({ ctx, input }) => db.createPlaqueta({
      ...input,
      dataEntrada: dataLocal(input.dataEntrada),
      criadoPor: ctx.user.id,
    })),
  }),
  romaneios: router({
    list: protectedProcedure.query(() => db.listRomaneiosProducao()),
    itens: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(({ input }) => db.listItensRomaneioProducao(input.id)),
    detalhe: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(({ input }) => db.getRomaneioProducaoComItens(input.id)),
    modeloTorasCsv: protectedProcedure.query(() => db.getModeloImportacaoTorasProducaoCsv()),
    importarTorasCsv: protectedProcedure.input(z.object({ conteudo: z.string().min(1, "Selecione um arquivo CSV").max(1_000_000, "O arquivo excede o limite de 1 MB") })).mutation(({ input }) => db.prepararTorasProducaoCsv(input.conteudo)),
    modeloPecasCsv: protectedProcedure.query(() => db.getModeloImportacaoPecasProducaoCsv()),
    importarPecasCsv: protectedProcedure.input(z.object({ conteudo: z.string().min(1, "Selecione um arquivo CSV").max(1_000_000, "O arquivo excede o limite de 1 MB") })).mutation(({ input }) => db.prepararPecasProducaoCsv(input.conteudo)),
    confirmar: protectedProcedure.input(RomaneioSchema).mutation(({ ctx, input }) => db.confirmarRomaneioProducao({
      ...input,
      dataProducao: dataLocal(input.dataProducao),
      criadoPor: ctx.user.id,
    })),
    update: protectedProcedure.input(RomaneioSchema.omit({ toras: true }).extend({ id: z.number().int().positive() })).mutation(({ ctx, input }) => db.atualizarRomaneioProducao(input.id, {
      ...input,
      dataProducao: dataLocal(input.dataProducao),
      atualizadoPor: ctx.user.id,
    })),
  }),
  estoque: router({
    resumo: protectedProcedure.query(() => db.getResumoEstoqueSerrado()),
    relatorio: protectedProcedure.input(RelatorioInventarioSchema.optional()).query(({ input }) => db.getRelatorioInventarioSerrado(
      input?.dataInicial ? dataLocal(input.dataInicial) : undefined,
      input?.dataFinal ? dataLocal(input.dataFinal) : undefined,
    )),
    ajustes: protectedProcedure.query(() => db.listAjustesEstoqueSerrado()),
    ajustar: adminProcedure.input(AjusteEstoqueSerradoSchema).mutation(({ ctx, input }) => db.ajustarEstoqueSerrado({ ...input, criadoPor: ctx.user.id })),
  }),
});
