import { describe, expect, it } from "vitest";
import { criarItensVendaPorMedida, criarLinhasComprimentoVazias } from "./vendaItemGroup";

describe("lançamento agrupado de itens de venda", () => {
  it("cria linhas vazias suficientes para iniciar um romaneio de comprimentos", () => {
    expect(criarLinhasComprimentoVazias(5, 3)).toEqual([
      { id: 5, comprimento: "", quantidade: "" },
      { id: 6, comprimento: "", quantidade: "" },
      { id: 7, comprimento: "", quantidade: "" },
    ]);
  });

  it("converte vários comprimentos da mesma bitola em itens individuais compatíveis com a venda", () => {
    const resultado = criarItensVendaPorMedida({
      madeiraNome: "Guarandi",
      precoM3: "2400,00",
      espessuraCm: "2",
      larguraCm: "5",
      linhas: [
        { id: 1, comprimento: "3", quantidade: "12" },
        { id: 2, comprimento: "4,5", quantidade: "8" },
        { id: 3, comprimento: "", quantidade: "" },
      ],
    });

    expect(resultado.erro).toBeUndefined();
    expect(resultado.itens).toHaveLength(2);
    expect(resultado.itens[0]).toMatchObject({
      madeiraNome: "Guarandi",
      bitolaDescricao: "2×5 cm",
      espessura: "20",
      largura: "50",
      comprimento: "3",
      quantidade: 12,
      precoM3: "2400",
    });
    expect(Number(resultado.itens[1].valorTotal)).toBeGreaterThan(0);
  });

  it("rejeita medidas incompletas e linhas parcialmente preenchidas", () => {
    expect(criarItensVendaPorMedida({
      madeiraNome: "Cedrinho",
      precoM3: "2000",
      espessuraCm: "",
      larguraCm: "5",
      linhas: [{ id: 1, comprimento: "3", quantidade: "10" }],
    })).toMatchObject({ itens: [], erro: expect.stringMatching(/bitola e largura/i) });

    expect(criarItensVendaPorMedida({
      madeiraNome: "Cedrinho",
      precoM3: "2000",
      espessuraCm: "2",
      larguraCm: "5",
      linhas: [{ id: 1, comprimento: "3", quantidade: "" }],
    })).toMatchObject({ itens: [], erro: expect.stringMatching(/comprimentos e as quantidades/i) });
  });
});
