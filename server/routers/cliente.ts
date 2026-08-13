import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

export const clienteRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.listClientes(ctx.empresaAtiva!.empresa.id);
  }),
  listAll: protectedProcedure.query(async ({ ctx }) => {
    return db.listAllClientes(ctx.empresaAtiva!.empresa.id);
  }),

  create: protectedProcedure
    .input(z.object({
      nome: z.string().min(1, "Nome é obrigatório"),
      contacto: z.string().optional(),
      email: z.string().optional(),
      morada: z.string().optional(),
      nif: z.string().optional(),
      observacoes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const created = await db.createCliente({ ...input, criadoPor: ctx.user.id, empresaId: ctx.empresaAtiva!.empresa.id });
      return { success: true, id: created.id || null };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      nome: z.string().min(1),
      contacto: z.string().optional(),
      email: z.string().optional(),
      morada: z.string().optional(),
      nif: z.string().optional(),
      observacoes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.updateCliente(input.id, {
        nome: input.nome, contacto: input.contacto,
        email: input.email, morada: input.morada, nif: input.nif, observacoes: input.observacoes,
      }, ctx.empresaAtiva!.empresa.id);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteCliente(input.id, ctx.empresaAtiva!.empresa.id);
      return { success: true };
    }),
});
