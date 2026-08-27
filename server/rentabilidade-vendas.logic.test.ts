import { describe, expect, it } from "vitest";
import { calcularVolumeLiquidoVendido, consolidarMargemVendaRastreavel } from "./rentabilidade-vendas.logic";

describe("consolidarMargemVendaRastreavel", () => {
  it("compara o preço líquido por m³ com madeira, produção e custo comercial, sem somar frete ou comissão ao custo", () => {
    const resultado = consolidarMargemVendaRastreavel({
      receitaBrutaMadeira: 26_000,
      descontoComercial: 0,
      freteComercial: 4_000,
      comissao: 2_000,
      volumeNegociadoM3: 10,
      lotes: [{
        loteId: 4,
        itemVendaId: 8,
        essencia: "Cambará",
        tipo: "peca",
        quantidadeLiquida: 100,
        volumeVendidoM3: 10,
        custoMateriaPrimaPorM3: 900,
        custoIndustrialPorM3: 600,
        custoComercialAdministrativoPorM3: 100,
        coberturaMateriaPrimaPercentual: 100,
        motivoIndisponibilidade: null,
      }],
    });

    expect(resultado).toMatchObject({
      receitaLiquidaMadeira: 20_000,
      precoLiquidoPorM3: 2_000,
      custoMateriaPrima: 9_000,
      custoIndustrial: 6_000,
      custoComercialAdministrativo: 1_000,
      custoTotal: 16_000,
      custoTotalPorM3: 1_600,
      margem: 4_000,
      margemPorM3: 400,
      situacaoCobertura: "completa",
    });
  });

  it("mantém a margem total indisponível quando uma saída não possui volume ou origem física utilizável", () => {
    const resultado = consolidarMargemVendaRastreavel({
      receitaBrutaMadeira: 2_600,
      descontoComercial: 0,
      freteComercial: 0,
      comissao: 0,
      volumeNegociadoM3: 2,
      lotes: [
        { loteId: 1, itemVendaId: 1, essencia: "Cambará", tipo: "peca", quantidadeLiquida: 10, volumeVendidoM3: 1, custoMateriaPrimaPorM3: 900, custoIndustrialPorM3: 400, custoComercialAdministrativoPorM3: 100, coberturaMateriaPrimaPercentual: 100, motivoIndisponibilidade: null },
        { loteId: 2, itemVendaId: 1, essencia: "Cambará", tipo: "peca", quantidadeLiquida: 1, volumeVendidoM3: null, custoMateriaPrimaPorM3: null, custoIndustrialPorM3: null, custoComercialAdministrativoPorM3: null, coberturaMateriaPrimaPercentual: 0, motivoIndisponibilidade: "Lote negativo sem produção de origem." },
      ],
    });

    expect(resultado.situacaoCobertura).toBe("parcial");
    expect(resultado.custoTotal).toBeNull();
    expect(resultado.margem).toBeNull();
    expect(resultado.margemConhecida).toBe(1_200);
    expect(resultado.problemas).toContain("Lote negativo sem produção de origem.");
  });

  it("reconstitui o volume de peça pela quantidade líquida após estorno e preserva o volume direto de aproveitamento", () => {
    expect(calcularVolumeLiquidoVendido({
      tipo: "peca",
      quantidadeLiquida: 8,
      volumeLiquidoMovimentado: 0,
      volumeLote: 2.5,
      quantidadeProduzida: 10,
    })).toBe(2);
    expect(calcularVolumeLiquidoVendido({
      tipo: "aproveitamento",
      quantidadeLiquida: 0,
      volumeLiquidoMovimentado: 0.35,
      volumeLote: 0.35,
      quantidadeProduzida: 0,
    })).toBe(0.35);
    expect(calcularVolumeLiquidoVendido({
      tipo: "peca",
      quantidadeLiquida: 1,
      volumeLiquidoMovimentado: 0,
      volumeLote: 2.5,
      quantidadeProduzida: 0,
    })).toBeNull();
  });
});
