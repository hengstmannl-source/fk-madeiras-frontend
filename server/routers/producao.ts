import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
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
  frete: DecimalNaoNegativo.default("0"),
  plaquetas: z.array(PlaquetaCargaSchema).min(1, "Adicione ao menos uma plaqueta").max(200),
});

const ItemRomaneioSchema = z.object({
  madeiraNome: z.string().trim().min(2).max(200),
  espessura: DecimalPositivo,
  largura: DecimalPositivo,
  comprimento: DecimalPositivo,
  quantidade: z.number().int().positive(),
});

const RomaneioSchema = z.object({
  plaquetaId: z.number().int().positive(),
  tora: z.object({
    madeiraNome: z.string().trim().min(2).max(200),
    espessura: DecimalPositivo.optional().nullable(),
    largura: DecimalPositivo.optional().nullable(),
    comprimento: DecimalPositivo.optional().nullable(),
    volume: DecimalPositivo,
  }),
  dataProducao: DataSchema,
  fita: z.string().trim().max(100).nullable().optional(),
  responsavel: z.string().trim().max(200).nullable().optional(),
  observacoes: z.string().max(4000).nullable().optional(),
  itens: z.array(ItemRomaneioSchema).min(1, "Adicione ao menos uma peça produzida"),
});

export const producaoRouter = router({
  cargas: router({
    list: protectedProcedure.query(() => db.listRomaneiosCargaToras()),
    get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(({ input }) => db.getRomaneioCargaComPlaquetas(input.id)),
    create: protectedProcedure.input(RomaneioCargaSchema).mutation(({ ctx, input }) => db.criarRomaneioCargaToras({
      ...input,
      dataCarga: dataLocal(input.dataCarga),
      criadoPor: ctx.user.id,
    })),
    update: protectedProcedure.input(RomaneioCargaSchema.extend({ id: z.number().int().positive() })).mutation(({ input }) => db.atualizarRomaneioCargaToras(input.id, {
      ...input,
      dataCarga: dataLocal(input.dataCarga),
    })),
  }),
  plaquetas: router({
    list: protectedProcedure.query(() => db.listPlaquetas()),
    create: protectedProcedure.input(PlaquetaSchema).mutation(({ ctx, input }) => db.createPlaqueta({
      ...input,
      dataEntrada: dataLocal(input.dataEntrada),
      criadoPor: ctx.user.id,
    })),
  }),
  romaneios: router({
    list: protectedProcedure.query(() => db.listRomaneiosProducao()),
    itens: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(({ input }) => db.listItensRomaneioProducao(input.id)),
    confirmar: protectedProcedure.input(RomaneioSchema).mutation(({ ctx, input }) => db.confirmarRomaneioProducao({
      ...input,
      dataProducao: dataLocal(input.dataProducao),
      criadoPor: ctx.user.id,
    })),
  }),
  estoque: router({
    resumo: protectedProcedure.query(() => db.getResumoEstoqueSerrado()),
  }),
});
