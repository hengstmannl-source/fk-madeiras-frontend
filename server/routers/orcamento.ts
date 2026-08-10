import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

const ItemSchema = z.object({
  madeiraId: z.number(),
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
      itens: z.array(ItemSchema),
    }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      const ano = now.getFullYear();
      const mes = String(now.getMonth() + 1).padStart(2, "0");
      const seq = Math.floor(Math.random() * 9000 + 1000);
      const numero = `ORC-${ano}${mes}-${seq}`;
      return db.createOrcamento(
        {
          numero,
          clienteId: input.clienteId,
          estado: input.estado,
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
        },
        input.itens
      );
    }),

  updateEstado: protectedProcedure
    .input(z.object({
      id: z.number(),
      estado: z.enum(["rascunho", "enviado", "aprovado", "rejeitado"]),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.updateOrcamentoEstado(input.id, input.estado, ctx.user.id);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteOrcamento(input.id);
      return { success: true };
    }),

  duplicate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return db.duplicateOrcamento(input.id);
    }),
});
