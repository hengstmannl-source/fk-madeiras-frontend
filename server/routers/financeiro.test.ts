import { describe, expect, it } from "vitest";
import { LancamentoManualSchema, RecorrenciaSchema } from "./financeiro";

describe("validação de lançamentos financeiros manuais", () => {
  const base = {
    tipo: "pagar" as const,
    descricao: "Frete excepcional",
    categoriaId: 1,
    valorOriginal: "150,50",
    dataEmissao: "2026-08-11",
    dataVencimento: "2026-08-20",
  };

  it("aceita um lançamento não programado sem orçamento, cliente ou fornecedor", () => {
    expect(LancamentoManualSchema.parse(base)).toMatchObject(base);
  });

  it("rejeita lançamentos manuais sem valor ou categoria", () => {
    expect(() => LancamentoManualSchema.parse({ ...base, valorOriginal: "" })).toThrow();
    expect(() => LancamentoManualSchema.parse({ ...base, categoriaId: 0 })).toThrow();
  });
});

describe("validação de recorrências financeiras", () => {
  const base = {
    tipo: "pagar" as const,
    descricao: "Aluguel do galpão",
    categoriaId: 1,
    valor: "2500,00",
    frequencia: "mensal" as const,
    proximoVencimento: "2026-09-10",
  };

  it("aceita uma recorrência com prazo final opcional", () => {
    expect(RecorrenciaSchema.parse(base)).toMatchObject(base);
  });

  it("rejeita uma recorrência sem frequência válida", () => {
    expect(() => RecorrenciaSchema.parse({ ...base, frequencia: "diaria" })).toThrow();
  });
});
