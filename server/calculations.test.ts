import { describe, expect, it } from "vitest";
import {
  calculatePrecoLinear,
  calculateValorPeca,
  calculateValorTotal,
  calculateVolume,
  calculateMetroLinear,
  formatCurrency,
  formatNumber,
} from "../client/src/lib/utils";

describe("Cálculos de Orçamento FK Madeiras", () => {
  it("calcula preço linear corretamente", () => {
    // espessura 25mm, largura 150mm, preço 800/m³
    // espessura em metros = 0.025, largura em metros = 0.150
    const precoLinear = calculatePrecoLinear(25, 150, 800);
    // 0.025 * 0.150 * 800 = 3.00 €/m
    expect(precoLinear).toBeCloseTo(3.0, 2);
  });

  it("calcula valor por peça", () => {
    const valorPeca = calculateValorPeca(3.0, 3); // 3€/m × 3m = 9€
    expect(valorPeca).toBeCloseTo(9.0, 2);
  });

  it("calcula valor total", () => {
    const total = calculateValorTotal(9.0, 10); // 9€ × 10 = 90€
    expect(total).toBeCloseTo(90.0, 2);
  });

  it("calcula volume corretamente", () => {
    // 25mm × 150mm × 3m × 10 peças
    // 0.025 * 0.150 * 3 * 10 = 0.1125 m³
    const volume = calculateVolume(25, 150, 3, 10);
    expect(volume).toBeCloseTo(0.1125, 4);
  });

  it("calcula metro linear total", () => {
    const ml = calculateMetroLinear(3, 10); // 3m × 10 = 30m
    expect(ml).toBe(30);
  });

  it("formata moeda em Euros", () => {
    const formatted = formatCurrency("1234.56");
    expect(formatted).toContain("1234,56");
    expect(formatted).toContain("€");
    expect(formatCurrency("0")).toContain("0,00");
    expect(formatCurrency("100")).toContain("100,00");
  });

  it("formata números com separadores", () => {
    expect(formatNumber("1234.5")).toContain("1234,5");
    expect(formatNumber("0.5")).toContain("0,5");
    expect(formatNumber("100")).toContain("100");
  });

  it("calcula com dimensões variadas", () => {
    // 50mm × 100mm × 4m × 5 peças @ 600/m³
    const precoLinear = calculatePrecoLinear(50, 100, 600);
    // 0.050 * 0.100 * 600 = 3.00 €/m
    expect(precoLinear).toBeCloseTo(3.0, 2);

    const valorPeca = calculateValorPeca(precoLinear, 4);
    expect(valorPeca).toBeCloseTo(12.0, 2);

    const total = calculateValorTotal(valorPeca, 5);
    expect(total).toBeCloseTo(60.0, 2);
  });

  it("lida com valores zero", () => {
    expect(calculatePrecoLinear(0, 0, 0)).toBe(0);
    expect(calculateValorPeca(0, 0)).toBe(0);
    expect(calculateValorTotal(0, 0)).toBe(0);
    expect(calculateVolume(0, 0, 0, 0)).toBe(0);
    expect(calculateMetroLinear(0, 0)).toBe(0);
  });
});
