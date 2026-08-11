import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

export const clienteRouter = router({
  list: protectedProcedure.query(async () => {
    return db.listClientes();
  }),
  listAll: protectedProcedure.query(async () => {
    return db.listAllClientes();
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
      const created = await db.createCliente({ ...input, criadoPor: ctx.user.id });
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
    .mutation(async ({ input }) => {
      await db.updateCliente(input.id, {
        nome: input.nome, contacto: input.contacto,
        email: input.email, morada: input.morada, nif: input.nif, observacoes: input.observacoes,
      });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteCliente(input.id);
      return { success: true };
    }),
});
