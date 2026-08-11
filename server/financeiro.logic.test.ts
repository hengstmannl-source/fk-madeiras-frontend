import { describe, expect, it } from "vitest";
import {
  calcularEstadoTitulo,
  calcularParcelas,
  proximoVencimento,
  saldoAbertoTitulo,
} from "./financeiro.logic";

describe("regras financeiras", () => {
  it("calcula os estados aberto, parcial, quitado e vencido", () => {
    const hoje = new Date(2026, 7, 11);
    expect(calcularEstadoTitulo({ valorOriginal: "100", dataVencimento: hoje, agora: hoje })).toBe("aberto");
    expect(calcularEstadoTitulo({ valorOriginal: "100", valorBaixado: "30", dataVencimento: hoje, agora: hoje })).toBe("parcial");
    expect(calcularEstadoTitulo({ valorOriginal: "100", valorBaixado: "100", dataVencimento: hoje, agora: hoje })).toBe("quitado");
    expect(calcularEstadoTitulo({ valorOriginal: "100", dataVencimento: new Date(2026, 7, 10), agora: hoje })).toBe("vencido");
  });

  it("distribui o valor das parcelas sem perder centavos", () => {
    expect(calcularParcelas("100", 3)).toEqual(["33.34", "33.33", "33.33"]);
    expect(calcularParcelas("10.01", 2)).toEqual(["5.01", "5.00"]);
  });

  it("avança o vencimento de uma recorrência conforme sua frequência", () => {
    expect(proximoVencimento(new Date(2026, 0, 15), "mensal")).toEqual(new Date(2026, 1, 15));
    expect(proximoVencimento(new Date(2026, 0, 15), "trimestral")).toEqual(new Date(2026, 3, 15));
  });

  it("calcula o saldo em aberto considerando descontos e juros", () => {
    expect(saldoAbertoTitulo("100", "10", "5", "30")).toBe(65);
  });
});
