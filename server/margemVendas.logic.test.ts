import { describe, expect, it } from "vitest";
import { calcularIndicadoresMargemVenda } from "./margemVendas.logic";

describe("calcularIndicadoresMargemVenda", () => {
  it("consolida todas as taxas e calcula a margem comercial sobre o subtotal", () => {
    const resultado = calcularIndicadoresMargemVenda({
      subtotal: "54000",
      desconto: "0",
      abatimentoFrete: "9680",
      comissaoCalculada: "886.4",
      taxas: [{ calculado: "1200" }, { calculado: "532.8" }],
      total: "41700.8",
    });

    expect(resultado.totalTaxas).toBeCloseTo(1732.8, 2);
    expect(resultado.deducoesComerciais).toBeCloseTo(12299.2, 2);
    expect(resultado.valorLiquido).toBeCloseTo(41700.8, 2);
    expect(resultado.margemPercentual).toBeCloseTo(77.2237, 3);
  });

  it("evita divisão inválida quando a venda não possui subtotal", () => {
    expect(calcularIndicadoresMargemVenda({
      subtotal: "0", desconto: "0", abatimentoFrete: "0", comissaoCalculada: "0", taxas: [], total: "0",
    }).margemPercentual).toBe(0);
  });
});
