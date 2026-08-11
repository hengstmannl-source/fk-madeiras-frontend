import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { madeiraRouter } from "./routers/madeira";
import { bitolaRouter } from "./routers/bitola";
import { clienteRouter } from "./routers/cliente";
import { orcamentoRouter } from "./routers/orcamento";
import { dashboardRouter } from "./routers/dashboard";
import { empresaRouter } from "./routers/empresa";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  madeira: madeiraRouter,
  bitola: bitolaRouter,
  cliente: clienteRouter,
  orcamento: orcamentoRouter,
  dashboard: dashboardRouter,
  empresa: empresaRouter,
});

export type AppRouter = typeof appRouter;
