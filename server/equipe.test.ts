import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  listarMembrosEmpresa: vi.fn(),
  listarConvitesPendentesEmpresa: vi.fn(),
  reenviarConviteEmpresa: vi.fn(),
}));

import * as db from "./db";
import { appRouter } from "./routers";

function criarContextoEquipe(papel: "proprietario" | "administrador" | "vendas" = "administrador"): TrpcContext {
  return {
    user: {
      id: 31,
      openId: "usuario-teste",
      name: "Administrador de Teste",
      email: "admin@fkmadeiras.com.br",
      loginMethod: "local",
      role: "user",
      createdAt: new Date("2026-08-01T10:00:00Z"),
      updatedAt: new Date("2026-08-01T10:00:00Z"),
      lastSignedIn: new Date("2026-08-01T10:00:00Z"),
    },
    empresaAtiva: {
      empresa: { id: 7, ativa: true },
      membro: { id: 12, empresaId: 7, usuarioId: 31, papel, ativo: true },
    },
    req: {
      protocol: "https",
      get: vi.fn().mockReturnValue("erp.fkmadeiras.com.br"),
    },
    res: {},
  } as unknown as TrpcContext;
}

describe("gestão administrativa de equipa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lista membros e somente convites pendentes da empresa ativa", async () => {
    const membros = [{ membro: { id: 1, ativo: true }, usuario: { name: "Maria" } }];
    const convites = [{ convite: { id: 9, emailNormalizado: "novo@fkmadeiras.com.br" } }];
    vi.mocked(db.listarMembrosEmpresa).mockResolvedValue(membros as never);
    vi.mocked(db.listarConvitesPendentesEmpresa).mockResolvedValue(convites as never);
    const caller = appRouter.createCaller(criarContextoEquipe());

    await expect(caller.equipe.listar()).resolves.toEqual(membros);
    await expect(caller.equipe.listarConvitesPendentes()).resolves.toEqual(convites);
    expect(db.listarMembrosEmpresa).toHaveBeenCalledWith(7);
    expect(db.listarConvitesPendentesEmpresa).toHaveBeenCalledWith(7);
  });

  it("renova o convite, invalida o link anterior e devolve uma URL segura de primeiro acesso", async () => {
    vi.mocked(db.reenviarConviteEmpresa).mockResolvedValue(44);
    const caller = appRouter.createCaller(criarContextoEquipe("proprietario"));

    const resultado = await caller.equipe.reenviarConvite({ conviteId: 9 });

    expect(resultado).toMatchObject({ success: true, conviteUrl: expect.stringMatching(/^https:\/\/erp\.fkmadeiras\.com\.br\/convite\//) });
    expect(resultado.expiraEm.getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60 * 1000);
    expect(db.reenviarConviteEmpresa).toHaveBeenCalledWith(expect.objectContaining({
      conviteId: 9,
      empresaId: 7,
      convidadoPor: 31,
      tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
  });

  it("bloqueia perfis operacionais da listagem e do reenvio de convites", async () => {
    const caller = appRouter.createCaller(criarContextoEquipe("vendas"));

    await expect(caller.equipe.listarConvitesPendentes()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.equipe.reenviarConvite({ conviteId: 9 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.reenviarConviteEmpresa).not.toHaveBeenCalled();
  });
});
