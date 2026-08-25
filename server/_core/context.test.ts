import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  getUserById: vi.fn(),
  getEmpresaAtivaDoUsuario: vi.fn(),
}));

const localAuthMocks = vi.hoisted(() => ({ lerSessaoLocal: vi.fn() }));
const sdkMocks = vi.hoisted(() => ({ authenticateRequest: vi.fn() }));

vi.mock("../db", () => dbMocks);
vi.mock("../autenticacao-local", () => ({
  COOKIE_SESSAO_LOCAL: "fk_sessao_local",
  lerSessaoLocal: localAuthMocks.lerSessaoLocal,
}));
vi.mock("./sdk", () => ({ sdk: sdkMocks }));

import { createContext } from "./context";

function request(cookie?: string) {
  return {
    req: { headers: cookie ? { cookie } : {}, protocol: "http" },
    res: {},
  } as Parameters<typeof createContext>[0];
}

describe("contexto autenticado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deriva a empresa ativa e o papel do usuário autenticado pela sessão local", async () => {
    const user = { id: 34, openId: "local:34", role: "user" };
    const empresaAtiva = {
      empresa: { id: 9, nome: "Empresa B" },
      membro: { id: 4, usuarioId: 34, empresaId: 9, papel: "vendas" },
    };
    localAuthMocks.lerSessaoLocal.mockReturnValue({ usuarioId: 34, expiraEm: Date.now() + 1000 });
    dbMocks.getUserById.mockResolvedValue(user);
    dbMocks.getEmpresaAtivaDoUsuario.mockResolvedValue(empresaAtiva);

    const ctx = await createContext(request("fk_sessao_local=sessao-valida"));

    expect(ctx.user).toBe(user);
    expect(ctx.empresaAtiva).toBe(empresaAtiva);
    expect(dbMocks.getEmpresaAtivaDoUsuario).toHaveBeenCalledWith(34);
    expect(sdkMocks.authenticateRequest).not.toHaveBeenCalled();
  });

  it("usa o usuário da sessão OAuth quando não há sessão local e preserva seu vínculo ativo", async () => {
    const user = { id: 51, openId: "oauth:51", role: "user" };
    const empresaAtiva = {
      empresa: { id: 12, nome: "Empresa C" },
      membro: { id: 7, usuarioId: 51, empresaId: 12, papel: "financeiro" },
    };
    localAuthMocks.lerSessaoLocal.mockReturnValue(undefined);
    sdkMocks.authenticateRequest.mockResolvedValue(user);
    dbMocks.getEmpresaAtivaDoUsuario.mockResolvedValue(empresaAtiva);

    const ctx = await createContext(request());

    expect(ctx.user).toBe(user);
    expect(ctx.empresaAtiva).toBe(empresaAtiva);
    expect(dbMocks.getEmpresaAtivaDoUsuario).toHaveBeenCalledWith(51);
  });
});
