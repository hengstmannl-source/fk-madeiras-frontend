import { describe, expect, it } from "vitest";
import { ItemSchema } from "./orcamento";

describe("itens de orçamento livres", () => {
  it("aceita madeira digitada e preço por m³ sem madeira cadastrada", () => {
    const item = ItemSchema.parse({
      madeiraId: null,
      bitolaId: null,
      madeiraNome: "Garapeira aparelhada",
      bitolaDescricao: "2,5×15 cm",
      espessura: "25",
      largura: "150",
      comprimento: "3",
      quantidade: 4,
      precoM3: "2450.50",
      precoLinear: "91.89",
      valorPeca: "275.67",
      valorTotal: "1102.68",
    });

    expect(item.madeiraId).toBeNull();
    expect(item.madeiraNome).toBe("Garapeira aparelhada");
    expect(item.precoM3).toBe("2450.50");
  });
});

