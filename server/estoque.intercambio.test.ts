import { describe, expect, it } from "vitest";
import { criarModeloCsvPlaquetasCarga, prepararImportacaoPlaquetasCarga, validarCsvPlaquetasCarga } from "./estoque.intercambio";

describe("intercâmbio de toras por CSV", () => {
  it("fornece um modelo CSV compatível com planilhas", () => {
    expect(criarModeloCsvPlaquetasCarga()).toContain("codigo;essencia;diametro_cm;comprimento_m;preco_m3;observacoes");
  });

  it("valida uma tora e normaliza vírgulas e códigos", () => {
    const resultado = validarCsvPlaquetasCarga("codigo;essencia;diametro_cm;comprimento_m;preco_m3;observacoes\n plq 001 ;Cumaru;48,5;7,500;900,00;Conferida");
    expect(resultado.erros).toEqual([]);
    expect(resultado.linhas).toEqual([expect.objectContaining({ codigo: "PLQ-001", diametro: "48.5", comprimento: "7.5", valorMetroCubico: "900" })]);
  });

  it("recusa arquivo inteiro quando existem medidas inválidas ou plaquetas duplicadas", () => {
    const resultado = validarCsvPlaquetasCarga("codigo;essencia;diametro_cm;comprimento_m;preco_m3\nPLQ-1;Cumaru;0;7;900\nPLQ-1;Cumaru;48;7;900");
    expect(resultado.linhas).toEqual([]);
    expect(resultado.erros.join(" ")).toContain("diâmetro");
    expect(resultado.erros.join(" ")).toContain("duplicado");
  });

  it("bloqueia a importação quando a plaqueta já existe no estoque", () => {
    const resultado = prepararImportacaoPlaquetasCarga({ conteudo: "codigo;essencia;diametro_cm;comprimento_m;preco_m3\nplq 001;Cumaru;48;7;900", codigosExistentes: [{ codigo: "PLQ-001" }] });
    expect(resultado.linhas).toEqual([]);
    expect(resultado.erros[0]).toContain("já está cadastrada");
  });
});
