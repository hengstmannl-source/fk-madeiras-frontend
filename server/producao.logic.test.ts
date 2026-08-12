import { describe, expect, it } from "vitest";
import { alocarPecasParaEntrega, agruparEstoquePecas, calcularItemRomaneio, calcularValorTora, calcularVolumeToraCilindrica, normalizarCodigoPlaqueta, validarConfirmacaoRomaneio } from "./producao.logic";

describe("regras de produção", () => {
  it("calcula metros lineares e volume a partir de centímetros, metros e peças", () => {
    expect(calcularItemRomaneio({ madeiraNome: "Cedrinho", espessura: "2,5", largura: "15", comprimento: "3", quantidade: 10 })).toEqual({
      madeiraNome: "Cedrinho", espessura: 2.5, largura: 15, comprimento: 3, quantidade: 10, metrosLineares: 30, volume: 0.1125,
    });
  });

  it("aceita uma única plaqueta disponível e bloqueia produção acima do seu volume", () => {
    const confirmado = validarConfirmacaoRomaneio({
      plaqueta: { codigo: "PLQ-001", estado: "disponivel", volumeDisponivel: "1.000000" },
      tora: { madeiraNome: "Cedrinho", volume: "1.000000" },
      itens: [{ madeiraNome: "Cedrinho", espessura: 2.5, largura: 15, comprimento: 3, quantidade: 10 }],
    });
    expect(confirmado).toMatchObject({ totalPecas: 10, volumeProduzido: 0.1125, volumeRemanescente: 0.8875 });
    expect(() => validarConfirmacaoRomaneio({
      plaqueta: { codigo: "PLQ-001", estado: "disponivel", volumeDisponivel: "0.1" },
      tora: { madeiraNome: "Cedrinho", volume: "0.1" },
      itens: [{ madeiraNome: "Cedrinho", espessura: 2.5, largura: 15, comprimento: 3, quantidade: 10 }],
    })).toThrow(/excede o volume/i);
  });

  it("recusa plaquetas já consumidas e normaliza seu identificador", () => {
    expect(normalizarCodigoPlaqueta(" plq  001 ")).toBe("PLQ-001");
    expect(() => validarConfirmacaoRomaneio({
      plaqueta: { codigo: "PLQ-001", estado: "consumida", volumeDisponivel: "1" },
      tora: { madeiraNome: "Piqui", volume: "1" },
      itens: [{ madeiraNome: "Piqui", espessura: 3, largura: 20, comprimento: 2, quantidade: 1 }],
    })).toThrow(/não está disponível/i);
  });

  it("calcula o volume cilíndrico da tora pelo diâmetro em centímetros e comprimento em metros", () => {
    expect(calcularVolumeToraCilindrica("50", "4")).toBeCloseTo(Math.PI * 0.25 ** 2 * 4, 8);
    expect(() => calcularVolumeToraCilindrica("0", "4")).toThrow(/diâmetro/i);
  });

  it("calcula o valor da tora pelo volume apurado e preço por metro cúbico", () => {
    expect(calcularValorTora(0.491, 900)).toBe(441.9);
    expect(calcularValorTora("0,491", "900,00")).toBe(441.9);
  });

  it("calcula o aproveitamento usando o volume corrigido da tora no romaneio", () => {
    const resultado = validarConfirmacaoRomaneio({
      plaqueta: { codigo: "PLQ-001", estado: "disponivel", volumeDisponivel: "3.000000" },
      tora: { madeiraNome: "Cedrinho", espessura: "10", largura: "50", comprimento: "4", volume: "2.000000" },
      itens: [{ madeiraNome: "Cedrinho", espessura: "5", largura: "20", comprimento: "4", quantidade: 10 }],
    });
    expect(resultado).toMatchObject({ volumeTora: 2, volumeProduzido: 0.4, aproveitamento: 20 });
  });

  it("agrupa o saldo disponível por madeira e dimensões de venda", () => {
    expect(agruparEstoquePecas([
      { madeiraNome: "Cedrinho", espessura: "2.5", largura: "15", comprimento: "3", quantidadeDisponivel: 10, volume: "0.112500" },
      { madeiraNome: "Cedrinho", espessura: "2.5", largura: "15", comprimento: "3", quantidadeDisponivel: 5, volume: "0.056250" },
    ])).toEqual([{ madeiraNome: "Cedrinho", espessura: 2.5, largura: 15, comprimento: 3, quantidadeDisponivel: 15, volumeDisponivel: 0.16875 }]);
  });

  it("aloca peças FIFO entre lotes equivalentes e bloqueia a entrega sem saldo", () => {
    const lotes = [
      { id: 2, madeiraNome: "Cedrinho", espessura: "2.50", largura: "15", comprimento: "3", quantidadeDisponivel: 3, createdAt: new Date(2026, 7, 2) },
      { id: 1, madeiraNome: "Cedrinho", espessura: "2.50", largura: "15", comprimento: "3", quantidadeDisponivel: 2, createdAt: new Date(2026, 7, 1) },
    ];
    expect(alocarPecasParaEntrega([{ id: 9, madeiraNome: "cedrinho", espessura: 2.5, largura: 15, comprimento: 3, quantidade: 4 }], lotes)).toEqual([
      { itemVendaId: 9, loteId: 1, quantidade: 2 },
      { itemVendaId: 9, loteId: 2, quantidade: 2 },
    ]);
    expect(() => alocarPecasParaEntrega([{ id: 9, madeiraNome: "Cedrinho", espessura: 2.5, largura: 15, comprimento: 3, quantidade: 6 }], lotes)).toThrow(/Estoque insuficiente/);
  });
});
