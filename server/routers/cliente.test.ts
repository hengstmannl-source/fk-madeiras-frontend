import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

vi.mock("../db", () => ({
  createCliente: vi.fn(),
  listClientes: vi.fn(),
  listAllClientes: vi.fn(),
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
    });
    expect(result).toEqual({ success: true, id: 42 });
  });
});
