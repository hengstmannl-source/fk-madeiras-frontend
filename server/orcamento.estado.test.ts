import { describe, expect, it, vi } from "vitest";
import { atualizarDatasOrcamento, updateOrcamentoEstado } from "./db";

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

  it("atualiza vencimento e competência da venda e do recebível vinculado", async () => {
    const atualizacoes: any[] = [];
    const venda = { id: 150001, pago: false };
    const titulo = {
      id: 101,
      valorOriginal: "1500.00",
      desconto: "0",
      juros: "0",
      valorBaixado: "0",
      estado: "aberto",
    };
    const db = {
      select: vi.fn()
        .mockImplementationOnce(() => ({ from: () => ({ where: () => ({ limit: async () => [venda] }) }) }))
        .mockImplementationOnce(() => ({ from: () => ({ where: () => ({ limit: async () => [titulo] }) }) })),
      update: vi.fn(() => ({
        set: (dados: any) => {
          atualizacoes.push(dados);
          return { where: async () => undefined };
        },
      })),
    };
    const dataVencimento = new Date(2030, 4, 15, 12);
    const competencia = new Date(2030, 4, 1, 12);

    const resultado = await atualizarDatasOrcamento(150001, { dataVencimento, competencia }, false, db);

    expect(resultado).toEqual({ success: true, tituloAtualizado: true });
    expect(atualizacoes[0]).toEqual({ dataVencimento, competencia });
    expect(atualizacoes[1]).toMatchObject({ dataVencimento, competencia, estado: "aberto" });
  });
});
