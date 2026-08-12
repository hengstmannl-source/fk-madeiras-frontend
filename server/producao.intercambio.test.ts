import { describe, expect, it } from "vitest";
import { criarModeloCsvTorasProducao, prepararImportacaoTorasProducao, validarCsvTorasProducao } from "./producao.intercambio";

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
});
