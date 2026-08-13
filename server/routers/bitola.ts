import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

export const bitolaRouter = router({
  list: protectedProcedure
    .input(z.object({ madeiraId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return db.listBitolas(input?.madeiraId, ctx.empresaAtiva!.empresa.id);
    }),

  create: protectedProcedure
    .input(z.object({
      madeiraId: z.number(),
      espessura: z.string().min(1),
      largura: z.string().min(1),
      comprimento: z.string().optional(),
      descricao: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.createBitola({ ...input, criadoPor: ctx.user.id, empresaId: ctx.empresaAtiva!.empresa.id });
      return { success: true };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      madeiraId: z.number(),
      espessura: z.string(),
      largura: z.string(),
      comprimento: z.string().optional(),
      descricao: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.updateBitola(input.id, {
        madeiraId: input.madeiraId, espessura: input.espessura,
        largura: input.largura, comprimento: input.comprimento, descricao: input.descricao,
      }, ctx.empresaAtiva!.empresa.id);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteBitola(input.id, ctx.empresaAtiva!.empresa.id);
      return { success: true };
    }),
});
