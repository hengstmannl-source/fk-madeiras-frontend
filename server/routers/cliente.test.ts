import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

vi.mock("../db", () => ({
  createCliente: vi.fn(),
  listClientes: vi.fn(),
  listAllClientes: vi.fn(),
  getPerfilCliente: vi.fn(),
  updateCliente: vi.fn(),
  deleteCliente: vi.fn(),
}));

import * as db from "../db";
import { clienteRouter } from "./cliente";

const ctx = {
  user: {
    id: 7,
    openId: "teste-cliente",
    name: "Utilizador de Teste",
    email: "teste@exemplo.com",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
  empresaAtiva: {
    empresa: { id: 1, nome: "FK Madeiras" },
    membro: { id: 1, empresaId: 1, usuarioId: 7, papel: "proprietario", ativo: true },
  },
} as unknown as TrpcContext;

const ctxEmpresaDois = {
  ...ctx,
  empresaAtiva: {
    empresa: { id: 2, nome: "Empresa Isolada" },
    membro: { id: 2, empresaId: 2, usuarioId: 7, papel: "proprietario", ativo: true },
  },
} as unknown as TrpcContext;

describe("cliente.create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devolve o id do cliente recém-criado para seleção imediata no orçamento", async () => {
    vi.mocked(db.createCliente).mockResolvedValue({ id: 42 });
    const caller = clienteRouter.createCaller(ctx);

    const result = await caller.create({
      nome: "Madeireira Exemplo Ltda.",
      contacto: "+55 11 99999-9999",
      email: "contato@exemplo.com",
    });

    expect(db.createCliente).toHaveBeenCalledWith({
      nome: "Madeireira Exemplo Ltda.",
      contacto: "+55 11 99999-9999",
      email: "contato@exemplo.com",
      criadoPor: 7,
      empresaId: 1,
    });
    expect(result).toEqual({ success: true, id: 42 });
  });
});

describe("cliente.isolamento empresarial", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("consulta dados somente na empresa ativa, sem recorrer à empresa padrão", async () => {
    vi.mocked(db.listClientes).mockResolvedValue([] as any);
    const caller = clienteRouter.createCaller(ctxEmpresaDois);

    await caller.list();

    expect(db.listClientes).toHaveBeenCalledWith(2);
  });

  it("não expõe o perfil de outra empresa quando a busca escopada não encontra o cliente", async () => {
    vi.mocked(db.getPerfilCliente).mockResolvedValue(undefined as any);
    const caller = clienteRouter.createCaller(ctxEmpresaDois);

    await expect(caller.perfil({ id: 91 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.getPerfilCliente).toHaveBeenCalledWith(91, 2);
  });

  it("propaga a empresa ativa para alterações e exclusões", async () => {
    vi.mocked(db.updateCliente).mockResolvedValue(undefined as any);
    vi.mocked(db.deleteCliente).mockResolvedValue(undefined as any);
    const caller = clienteRouter.createCaller(ctxEmpresaDois);

    await caller.update({ id: 91, nome: "Cliente Isolado" });
    await caller.delete({ id: 91 });

    expect(db.updateCliente).toHaveBeenCalledWith(91, expect.objectContaining({ nome: "Cliente Isolado" }), 2);
    expect(db.deleteCliente).toHaveBeenCalledWith(91, 2);
  });

  it("nega acesso quando não há empresa ativa no contexto", async () => {
    const caller = clienteRouter.createCaller({ ...ctx, empresaAtiva: undefined } as unknown as TrpcContext);

    await expect(caller.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.listClientes).not.toHaveBeenCalled();
  });
});
