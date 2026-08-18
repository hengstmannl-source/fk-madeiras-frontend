import { describe, expect, it } from "vitest";
import { criarItemVendaComercial, criarItensVendaPorMedida, criarLinhasComprimentoVazias } from "./vendaItemGroup";

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
      tipoComercializacao: "metro_cubico",
      unidadesPorComercializacao: 1,
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

  it("calcula o total de um produto vendido por unidade sem exigir medida em m³", () => {
    const resultado = criarItemVendaComercial({ madeiraNome: "Portal", tipoComercializacao: "unidade", quantidade: "3", precoComercial: "180,50" });

    expect(resultado.erro).toBeUndefined();
    expect(resultado.item).toMatchObject({
      madeiraNome: "Portal",
      tipoComercializacao: "unidade",
      quantidade: 3,
      unidadesPorComercializacao: 1,
      valorPeca: "180.5",
      valorTotal: "541.5",
    });
  });

  it("calcula o total de um pacote e rejeita quantidade comercial inválida", () => {
    expect(criarItemVendaComercial({ madeiraNome: "Pacote de cedrinho", tipoComercializacao: "pacote", quantidade: "2", precoComercial: "750", componentesPacote: [{ descricao: "Tábua de cedrinho", quantidade: 6 }] }).item)
      .toMatchObject({ tipoComercializacao: "pacote", quantidade: 2, valorTotal: "1500" });
    expect(criarItemVendaComercial({ madeiraNome: "Pacote sem composição", tipoComercializacao: "pacote", quantidade: "1", precoComercial: "750" }))
      .toMatchObject({ erro: expect.stringMatching(/composição/i) });
    expect(criarItemVendaComercial({ madeiraNome: "Pacote", tipoComercializacao: "pacote", quantidade: "0", precoComercial: "750" }))
      .toMatchObject({ erro: expect.stringMatching(/quantidade/i) });
  });
});
