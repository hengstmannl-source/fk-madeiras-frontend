import { describe, expect, it, vi } from "vitest";
import { updateOrcamentoEstado } from "./db";

function criarBancoDeOrcamentoFalso() {
  const historicos: any[] = [];
  const db = {
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({ limit: async () => [{ id: 150001, pago: false }] }),
      }),
    })),
    update: vi.fn(() => ({
      set: () => ({ where: async () => undefined }),
    })),
    insert: vi.fn(() => ({
      values: async (valor: any) => {
        historicos.push(valor);
        return [{ insertId: 1 }];
      },
    })),
  };
  return { db, historicos };
}

describe("mudança de estado de orçamento", () => {
  it("envia o orçamento e grava o histórico de estado", async () => {
    const { db, historicos } = criarBancoDeOrcamentoFalso();

    await updateOrcamentoEstado(150001, "enviado", 1, false, { database: db });

    expect(historicos).toEqual([{
      orcamentoId: 150001,
      usuarioId: 1,
      tipo: "estado",
      detalhes: JSON.stringify({ novoEstado: "enviado" }),
    }]);
  });

  it("aprova o orçamento, grava o histórico e cria o recebível", async () => {
    const { db, historicos } = criarBancoDeOrcamentoFalso();
    const criarTituloReceber = vi.fn().mockResolvedValue({ id: 101 });

    await updateOrcamentoEstado(150001, "aprovado", 1, false, { database: db, criarTituloReceber });

    expect(historicos[0]).toMatchObject({
      orcamentoId: 150001,
      usuarioId: 1,
      tipo: "estado",
      detalhes: JSON.stringify({ novoEstado: "aprovado" }),
    });
    expect(criarTituloReceber).toHaveBeenCalledWith(150001, 1);
  });
});
