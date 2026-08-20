import { describe, expect, it } from "vitest";
import { calcularFolhaColaboradorRh, calcularImpostoProgressivoRh, competenciaRh, motivoBloqueioRemocaoColaboradorRh, podeEditarFolhaRh } from "./rh.logic";

const regras = {
  faixasInss: [
    { limiteInferior: 0, limiteSuperior: 1500, aliquota: 7.5, parcelaDeduzir: 0 },
    { limiteInferior: 1500.01, limiteSuperior: null, aliquota: 10, parcelaDeduzir: 37.5 },
  ],
  faixasIrrf: [
    { limiteInferior: 0, limiteSuperior: 2000, aliquota: 0, parcelaDeduzir: 0 },
    { limiteInferior: 2000.01, limiteSuperior: null, aliquota: 7.5, parcelaDeduzir: 150 },
  ],
  aliquotaFgts: 8,
  deducaoDependenteIrrf: 189.59,
};

describe("cálculo de folha de RH", () => {
  it("calcula proventos, descontos e custo da empresa a partir de regras configuráveis", () => {
    const resultado = calcularFolhaColaboradorRh({
      salarioBase: 3000,
      quantidadeDependentesIrrf: 1,
      adiantamentos: 400,
      regras,
      eventos: [
        { descricao: "Hora extra", tipo: "provento", valor: 200, incideInss: true, incideIrrf: true, incideFgts: true },
        { descricao: "Plano de saúde", tipo: "desconto", valor: 80 },
      ],
    });
    expect(resultado).toMatchObject({ totalProventos: 3200, inss: 282.5, irrf: 54.59, outrosDescontos: 80, totalDescontos: 817.09, salarioLiquido: 2382.91, fgts: 256, custoEmpresa: 3456 });
  });

  it("protege o imposto contra bases negativas e permite editar somente folhas abertas", () => {
    expect(calcularImpostoProgressivoRh(-10, regras.faixasInss)).toBe(0);
    expect(podeEditarFolhaRh("aberta")).toBe(true);
    expect(podeEditarFolhaRh("fechada")).toBe(false);
  });

  it("normaliza competências para o primeiro dia do mês", () => {
    expect(competenciaRh(new Date(2026, 7, 19, 9, 30)).toISOString()).toContain("2026-08-01");
  });

  it("permite remover cadastro com apenas histórico salarial inicial e bloqueia movimentações efetivas", () => {
    expect(motivoBloqueioRemocaoColaboradorRh({ dependentes: false, alteracoesSalariais: false, adiantamentos: false, itensFolha: false })).toBeNull();
    expect(motivoBloqueioRemocaoColaboradorRh({ dependentes: false, alteracoesSalariais: true, adiantamentos: false, itensFolha: true })).toMatch(/alterações salariais.*lançamentos de folha/i);
  });
});
