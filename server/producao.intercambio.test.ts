import { describe, expect, it } from "vitest";
import { criarModeloCsvPecasProducao, criarModeloCsvTorasProducao, prepararImportacaoTorasProducao, validarCsvPecasProducao, validarCsvTorasProducao } from "./producao.intercambio";

describe("intercâmbio de plaquetas para produção", () => {
  it("fornece um modelo compatível e preserva os campos opcionais de correção", () => {
    expect(criarModeloCsvTorasProducao()).toContain("plaqueta;essencia;diametro_cm;comprimento_m;volume_m3");
    expect(validarCsvTorasProducao("plaqueta;essencia;diametro_cm;comprimento_m;volume_m3\n TOR 001 ;Cedrinho;30,5;4,2;0,380")).toEqual({
      linhas: [expect.objectContaining({ codigo: "TOR-001", madeiraNome: "Cedrinho", diametro: "30.5", comprimento: "4.2", volume: "0.38" })],
      erros: [],
    });
  });

  it("preenche os dados do estoque, mas recusa plaquetas repetidas ou indisponíveis", () => {
    const estoque = [{ id: 8, codigo: "TOR-0008", estado: "disponivel" as const, madeiraNome: "Cedrinho", diametro: "30", comprimento: "4.2", volumeDisponivel: "0.38" }];
    const valido = prepararImportacaoTorasProducao({ conteudo: "plaqueta;essencia;diametro_cm;comprimento_m;volume_m3\nTOR-0008;;;;", plaquetas: estoque });
    expect(valido).toEqual({ erros: [], toras: [expect.objectContaining({ plaquetaId: 8, madeiraNome: "Cedrinho", volume: "0.38" })] });
    const repetido = prepararImportacaoTorasProducao({ conteudo: "plaqueta;essencia;diametro_cm;comprimento_m;volume_m3\nTOR-0008;;;;\nTOR-0008;;;;", plaquetas: estoque });
    expect(repetido.erros.join(" ")).toMatch(/repetida/i);
  });

  it("prepara uma plaqueta nova com entrada imediata quando a planilha traz essência e volume", () => {
    const resultado = prepararImportacaoTorasProducao({
      conteudo: "plaqueta;essencia;diametro_cm;comprimento_m;volume_m3\nAVU-001;Cedrinho;32;4,5;0,362",
      plaquetas: [],
    });

    expect(resultado).toEqual({
      erros: [],
      toras: [expect.objectContaining({ novaPlaqueta: { codigo: "AVU-001" }, origem: "entrada_imediata", madeiraNome: "Cedrinho", volume: "0.362" })],
    });
  });

  it("fornece modelo e importa peças serradas com medidas brasileiras", () => {
    expect(criarModeloCsvPecasProducao()).toContain("essencia;espessura_cm;largura_cm;comprimento_m;quantidade");
    expect(validarCsvPecasProducao("essencia;espessura_cm;largura_cm;comprimento_m;quantidade\nCedrinho;3;5;2,5;11")).toEqual({
      itens: [expect.objectContaining({ madeiraNome: "Cedrinho", espessura: "3", largura: "5", comprimento: "2.5", quantidade: 11 })],
      erros: [],
    });
  });

  it("recusa peças com quantidade fracionária ou medidas ausentes", () => {
    const resultado = validarCsvPecasProducao("essencia;espessura_cm;largura_cm;comprimento_m;quantidade\nCedrinho;3;5;2;11,5\nPinho;;5;2;2");
    expect(resultado.itens).toEqual([]);
    expect(resultado.erros.join(" ")).toMatch(/quantidade.*inteiro.*medidas da peça/i);
  });
});
