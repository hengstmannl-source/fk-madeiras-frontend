import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { COOKIE_SESSAO_LOCAL, criarSessaoLocal, DURACAO_SESSAO_LOCAL_MS, gerarHashSenha, normalizarEmail, validarSenha } from "./autenticacao-local";
import * as db from "./db";
import { madeiraRouter } from "./routers/madeira";
import { bitolaRouter } from "./routers/bitola";
import { clienteRouter } from "./routers/cliente";
import { orcamentoRouter } from "./routers/orcamento";
import { dashboardRouter } from "./routers/dashboard";
import { empresaRouter } from "./routers/empresa";
import { financeiroRouter } from "./routers/financeiro";
import { producaoRouter } from "./routers/producao";
import { dieselRouter } from "./routers/diesel";
import { rhRouter } from "./routers/rh";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    contexto: protectedProcedure.query(({ ctx }) => ({
      usuario: ctx.user,
      empresa: ctx.empresaAtiva.empresa,
      membro: ctx.empresaAtiva.membro,
      empresasDisponiveis: db.listarEmpresasDoUsuario(ctx.user.id),
    })),
    entrar: publicProcedure
      .input(z.object({ email: z.string().email(), senha: z.string().min(1).max(200) }))
      .mutation(async ({ ctx, input }) => {
        const emailNormalizado = normalizarEmail(input.email);
        const acesso = await db.getCredencialPorEmail(emailNormalizado);
        const erroPadrao = new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha inválidos." });
        if (!acesso || (acesso.credencial.bloqueadoAte && acesso.credencial.bloqueadoAte > new Date())) throw erroPadrao;
        if (!(await validarSenha(input.senha, acesso.credencial.senhaHash))) {
          const proximaTentativa = acesso.credencial.tentativasFalhas + 1;
          await db.registrarFalhaAutenticacao(acesso.credencial.id, proximaTentativa >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null);
          throw erroPadrao;
        }
        const empresaAtiva = await db.getEmpresaAtivaDoUsuario(acesso.usuario.id);
        if (!empresaAtiva) throw new TRPCError({ code: "FORBIDDEN", message: "O utilizador não possui acesso a uma empresa ativa." });
        await db.limparFalhasAutenticacao(acesso.credencial.id);
        const token = criarSessaoLocal(acesso.usuario.id);
        ctx.res.cookie(COOKIE_SESSAO_LOCAL, token, { ...getSessionCookieOptions(ctx.req), maxAge: DURACAO_SESSAO_LOCAL_MS });
        return { success: true, empresa: empresaAtiva.empresa, papel: empresaAtiva.membro.papel };
      }),
    cadastrarEmpresa: publicProcedure
      .input(z.object({
        nomeEmpresa: z.string().trim().min(2).max(300),
        nomeFantasia: z.string().trim().max(300).optional(),
        documento: z.string().trim().max(30).optional(),
        telefone: z.string().trim().max(100).optional(),
        nomeProprietario: z.string().trim().min(2).max(300),
        email: z.string().email(),
        senha: z.string().min(8, "A senha deve ter pelo menos 8 caracteres.").max(200).regex(/[A-Z]/, "A senha deve ter letra maiúscula.").regex(/[0-9]/, "A senha deve ter número."),
      }))
      .mutation(async ({ ctx, input }) => {
        const emailNormalizado = normalizarEmail(input.email);
        try {
          const criado = await db.criarEmpresaComProprietario({
            nomeEmpresa: input.nomeEmpresa,
            nomeFantasia: input.nomeFantasia,
            documento: input.documento,
            telefone: input.telefone,
            nomeProprietario: input.nomeProprietario,
            emailNormalizado,
            senhaHash: await gerarHashSenha(input.senha),
            openId: `local:${randomBytes(24).toString("hex")}`,
          });
          ctx.res.cookie(COOKIE_SESSAO_LOCAL, criarSessaoLocal(criado.usuarioId), { ...getSessionCookieOptions(ctx.req), maxAge: DURACAO_SESSAO_LOCAL_MS });
          return { success: true, empresaId: criado.empresaId };
        } catch (error) {
          if (error instanceof Error && error.message === "EMAIL_JA_CADASTRADO") {
            throw new TRPCError({ code: "CONFLICT", message: "Já existe uma conta com este e-mail." });
          }
          throw error;
        }
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      ctx.res.clearCookie(COOKIE_SESSAO_LOCAL, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  equipe: router({
    listar: adminProcedure.query(({ ctx }) => db.listarMembrosEmpresa(ctx.empresaAtiva!.empresa.id)),
    criarConvite: adminProcedure
      .input(z.object({ email: z.string().email(), papel: z.enum(["administrador", "financeiro", "rh", "vendas", "producao", "consulta"]) }))
      .mutation(async ({ ctx, input }) => {
        const papelAtual = ctx.empresaAtiva!.membro.papel;
        if (papelAtual !== "proprietario" && papelAtual !== "administrador") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas proprietários e administradores podem convidar colaboradores." });
        }
        const token = randomBytes(32).toString("base64url");
        const tokenHash = createHash("sha256").update(token).digest("hex");
        await db.criarConviteEmpresa({
          empresaId: ctx.empresaAtiva!.empresa.id,
          emailNormalizado: normalizarEmail(input.email),
          papel: input.papel,
          tokenHash,
          expiraEm: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          convidadoPor: ctx.user.id,
        });
        const protocolo = ctx.req.protocol;
        const conviteUrl = `${protocolo}://${ctx.req.get("host")}/convite/${token}`;
        return { success: true, conviteUrl, expiraEm: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) };
      }),
    consultarConvite: publicProcedure
      .input(z.object({ token: z.string().min(20).max(200) }))
      .query(async ({ input }) => {
        const convite = await db.getConviteValidoPorHash(createHash("sha256").update(input.token).digest("hex"));
        if (!convite) throw new TRPCError({ code: "NOT_FOUND", message: "Este convite é inválido ou expirou." });
        return { empresa: { nome: convite.empresa.nome, nomeFantasia: convite.empresa.nomeFantasia }, email: convite.convite.emailNormalizado, papel: convite.convite.papel };
      }),
    aceitarConvite: publicProcedure
      .input(z.object({ token: z.string().min(20).max(200), nome: z.string().trim().min(2).max(300), senha: z.string().min(8).max(200).regex(/[A-Z]/).regex(/[0-9]/) }))
      .mutation(async ({ ctx, input }) => {
        try {
          const criado = await db.aceitarConviteCriandoUsuario({
            tokenHash: createHash("sha256").update(input.token).digest("hex"),
            nome: input.nome,
            senhaHash: await gerarHashSenha(input.senha),
            openId: `local:${randomBytes(24).toString("hex")}`,
          });
          ctx.res.cookie(COOKIE_SESSAO_LOCAL, criarSessaoLocal(criado.usuarioId), { ...getSessionCookieOptions(ctx.req), maxAge: DURACAO_SESSAO_LOCAL_MS });
          return { success: true, empresaId: criado.empresaId };
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          if (message === "CONVITE_INVALIDO") throw new TRPCError({ code: "BAD_REQUEST", message: "Este convite é inválido ou expirou." });
          if (message === "EMAIL_JA_CADASTRADO") throw new TRPCError({ code: "CONFLICT", message: "Já existe uma conta com este e-mail." });
          throw error;
        }
      }),
  }),
  madeira: madeiraRouter,
  bitola: bitolaRouter,
  cliente: clienteRouter,
  orcamento: orcamentoRouter,
  dashboard: dashboardRouter,
  empresa: empresaRouter,
  financeiro: financeiroRouter,
  producao: producaoRouter,
  diesel: dieselRouter,
  rh: rhRouter,
});

export type AppRouter = typeof appRouter;
