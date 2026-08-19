import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  listarEmpresasDoUsuario: vi.fn(),
}));

import * as db from "./db";
import { appRouter } from "./routers";

function criarContextoAutenticado(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-teste",
      name: "Administrador de Teste",
      email: "admin@fkmadeiras.com.br",
      loginMethod: "local",
      role: "admin",
      createdAt: new Date("2026-08-01T10:00:00Z"),
      updatedAt: new Date("2026-08-01T10:00:00Z"),
      lastSignedIn: new Date("2026-08-01T10:00:00Z"),
    },
    empresaAtiva: {
      empresa: { id: 7, nome: "FK Madeiras", ativa: true },
      membro: { id: 10, empresaId: 7, usuarioId: 1, papel: "administrador", ativo: true },
    },
    req: {},
    res: {},
  } as unknown as TrpcContext;
}

describe("auth.contexto", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolve as empresas disponíveis antes de devolver o contexto tRPC", async () => {
    const empresas = [{ empresa: { id: 7, nome: "FK Madeiras" }, membro: { papel: "administrador" } }];
    vi.mocked(db.listarEmpresasDoUsuario).mockResolvedValue(empresas as never);
    const caller = appRouter.createCaller(criarContextoAutenticado());

    const resultado = await caller.auth.contexto();

    expect(resultado.empresasDisponiveis).toEqual(empresas);
    expect(resultado.empresasDisponiveis).not.toBeInstanceOf(Promise);
    expect(db.listarEmpresasDoUsuario).toHaveBeenCalledWith(1);
  });
});
