import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./identidade", () => ({
  getEmpresaUnica: vi.fn(async () => ({ id: 1 })),
}));

vi.mock("./core", () => ({
  getDb: vi.fn(),
}));

import { garantirTituloFinanceiroAutomatico } from "./financeiro";

describe("motor financeiro automático", () => {
  const titulos: Array<Record<string, unknown>> = [];

  const database = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [...titulos],
        }),
      }),
    }),
    insert: () => ({
      values: async (dados: Record<string, unknown>) => {
        const titulo = { id: titulos.length + 1, ...dados };
        titulos.push(titulo);
        return [{ insertId: titulo.id }, undefined] as const;
      },
    }),
  };

  const entrada = {
    tipo: "receber" as const,
    origem: "orcamento" as const,
    chaveIdempotencia: "FIN-ORCAMENTO-42-PARCELA-1",
    descricao: "Venda VEN-000042",
    clienteId: 9,
    orcamentoId: 42,
    categoriaId: 3,
    valorOriginal: "1250.00",
    dataEmissao: new Date("2026-08-25T12:00:00.000Z"),
    dataVencimento: new Date("2026-09-25T12:00:00.000Z"),
    criadoPor: 1,
    database,
  };

  beforeEach(() => {
    titulos.splice(0, titulos.length);
  });

  it("reutiliza o mesmo título quando recebe a mesma chave de origem", async () => {
    const primeiro = await garantirTituloFinanceiroAutomatico(entrada);
    const repetido = await garantirTituloFinanceiroAutomatico(entrada);

    expect(primeiro).toMatchObject({ id: 1, criado: true });
    expect(repetido).toMatchObject({ id: 1, criado: false });
    expect(titulos).toHaveLength(1);
    expect(titulos[0]).toMatchObject({
      chaveImportacao: "FIN-ORCAMENTO-42-PARCELA-1",
      origem: "orcamento",
      empresaId: 1,
    });
  });

  it("recusa reutilizar uma chave de outra origem financeira", async () => {
    await garantirTituloFinanceiroAutomatico(entrada);

    await expect(garantirTituloFinanceiroAutomatico({
      ...entrada,
      origem: "nota_diesel",
    })).rejects.toThrow("outra origem financeira");
  });
});
