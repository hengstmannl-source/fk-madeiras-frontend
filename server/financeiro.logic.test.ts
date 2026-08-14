import { describe, expect, it } from "vitest";
import {
  calcularEstadoTitulo,
  calcularPrevisaoSemanal,
  calcularRelatorioFluxoCaixa,
  calcularParcelas,
  classificarAlertaVencimento,
  planejarAtualizacaoAlertas,
  podeCancelarTituloFinanceiro,
  podeEstornarBaixa,
  proximoVencimento,
  saldoAbertoTitulo,
  tipoAlertaAtualDoTitulo,
  validarValorDosCheques,
} from "./financeiro.logic";

describe("regras financeiras", () => {
  it("calcula os estados aberto, parcial, quitado e vencido", () => {
    const hoje = new Date(2026, 7, 11);
    expect(calcularEstadoTitulo({ valorOriginal: "100", dataVencimento: hoje, agora: hoje })).toBe("aberto");
    expect(calcularEstadoTitulo({ valorOriginal: "100", valorBaixado: "30", dataVencimento: hoje, agora: hoje })).toBe("parcial");
    expect(calcularEstadoTitulo({ valorOriginal: "100", valorBaixado: "100", dataVencimento: hoje, agora: hoje })).toBe("quitado");
    expect(calcularEstadoTitulo({ valorOriginal: "100", dataVencimento: new Date(2026, 7, 10), agora: hoje })).toBe("vencido");
  });

  it("distribui o valor das parcelas sem perder centavos", () => {
    expect(calcularParcelas("100", 3)).toEqual(["33.34", "33.33", "33.33"]);
    expect(calcularParcelas("10.01", 2)).toEqual(["5.01", "5.00"]);
  });

  it("avança o vencimento de uma recorrência conforme sua frequência", () => {
    expect(proximoVencimento(new Date(2026, 0, 15), "mensal")).toEqual(new Date(2026, 1, 15));
    expect(proximoVencimento(new Date(2026, 0, 15), "trimestral")).toEqual(new Date(2026, 3, 15));
  });

  it("calcula o saldo em aberto considerando descontos e juros", () => {
    expect(saldoAbertoTitulo("100", "10", "5", "30")).toBe(65);
  });

  it("permite cancelar somente títulos sem baixas financeiras", () => {
    expect(podeCancelarTituloFinanceiro("0")).toBe(true);
    expect(podeCancelarTituloFinanceiro("0.004")).toBe(true);
    expect(podeCancelarTituloFinanceiro("0.01")).toBe(false);
    expect(podeCancelarTituloFinanceiro("25")).toBe(false);
  });

  it("permite estornar uma baixa somente uma vez", () => {
    expect(podeEstornarBaixa(false)).toBe(true);
    expect(podeEstornarBaixa(0)).toBe(true);
    expect(podeEstornarBaixa(true)).toBe(false);
    expect(podeEstornarBaixa(1)).toBe(false);
  });

  it("confere a soma dos cheques com precisão de centavos", () => {
    expect(validarValorDosCheques("250,00", ["100,15", "149,85"])).toBe(250);
    expect(() => validarValorDosCheques("250,00", ["100,15", "149,84"])).toThrow("A soma dos cheques deve ser exatamente igual ao valor da baixa");
    expect(() => validarValorDosCheques("0", ["0"])).toThrow("O valor da baixa deve ser maior que zero");
  });

  it("apura entradas, saídas e saldo acumulado somente para o período informado", () => {
    const relatorio = calcularRelatorioFluxoCaixa({
      dataInicio: new Date(2026, 7, 1, 12),
      dataFim: new Date(2026, 7, 3, 12),
      saldoInicialContas: "100.00",
      movimentos: [
        { id: 1, tipo: "receber", valor: "20.00", dataBaixa: new Date(2026, 6, 31, 12) },
        { id: 2, tipo: "receber", valor: "50.00", dataBaixa: new Date(2026, 7, 1, 12) },
        { id: 3, tipo: "pagar", valor: "10.00", dataBaixa: new Date(2026, 7, 1, 12) },
        { id: 4, tipo: "pagar", valor: "30.00", dataBaixa: new Date(2026, 7, 3, 12) },
        { id: 5, tipo: "receber", valor: "999.00", dataBaixa: new Date(2026, 7, 2, 12), estornada: true },
      ],
    });

    expect(relatorio).toMatchObject({
      saldoAbertura: 120,
      entradas: 50,
      saidas: 40,
      saldoLiquido: 10,
      saldoFinal: 130,
      quantidadeMovimentos: 3,
    });
    expect(relatorio.dias).toEqual([
      { data: "2026-08-01", entradas: 50, saidas: 10, saldoLiquido: 40, saldoAcumulado: 160 },
      { data: "2026-08-02", entradas: 0, saidas: 0, saldoLiquido: 0, saldoAcumulado: 160 },
      { data: "2026-08-03", entradas: 0, saidas: 30, saldoLiquido: -30, saldoAcumulado: 130 },
    ]);
  });

  it("projeta o saldo por semana com títulos abertos, parciais e vencidos", () => {
    const previsao = calcularPrevisaoSemanal({
      saldoAtual: "100.00",
      semanas: 2,
      agora: new Date(2026, 7, 12, 12),
      titulos: [
        { tipo: "receber", valorOriginal: "200", valorBaixado: "0", dataVencimento: new Date(2026, 7, 13, 12), estado: "aberto" },
        { tipo: "pagar", valorOriginal: "80", valorBaixado: "20", dataVencimento: new Date(2026, 7, 14, 12), estado: "parcial" },
        { tipo: "pagar", valorOriginal: "50", valorBaixado: "0", dataVencimento: new Date(2026, 7, 1, 12), estado: "vencido" },
        { tipo: "receber", valorOriginal: "300", valorBaixado: "0", dataVencimento: new Date(2026, 7, 18, 12), estado: "aberto" },
        { tipo: "receber", valorOriginal: "999", valorBaixado: "0", dataVencimento: new Date(2026, 7, 14, 12), estado: "quitado" },
      ],
    });

    expect(previsao).toHaveLength(2);
    expect(previsao[0]).toMatchObject({
      inicioSemana: "2026-08-10",
      fimSemana: "2026-08-16",
      entradas: 200,
      saidas: 110,
      saldoLiquido: 90,
      saldoProjetado: 190,
      quantidadeTitulos: 3,
    });
    expect(previsao[1]).toMatchObject({
      entradas: 300,
      saidas: 0,
      saldoProjetado: 490,
    });
  });

  it("classifica alertas de vencimento sem alertar títulos quitados", () => {
    const hoje = new Date(2026, 7, 11);
    expect(classificarAlertaVencimento({ estado: "vencido", dataVencimento: new Date(2026, 7, 10), diasAntecedencia: 7, agora: hoje })).toBe("vencido");
    expect(classificarAlertaVencimento({ estado: "aberto", dataVencimento: new Date(2026, 7, 16), diasAntecedencia: 7, agora: hoje })).toBe("vence_em_breve");
    expect(classificarAlertaVencimento({ estado: "aberto", dataVencimento: new Date(2026, 7, 20), diasAntecedencia: 7, agora: hoje })).toBeNull();
    expect(classificarAlertaVencimento({ estado: "quitado", dataVencimento: new Date(2026, 7, 11), diasAntecedencia: 7, agora: hoje })).toBeNull();
  });

  it("não mantém alerta vencido após reagendamento para uma data fora da antecedência", () => {
    const hoje = new Date(2026, 7, 13, 12);
    expect(tipoAlertaAtualDoTitulo({
      valorOriginal: "750.00",
      valorBaixado: "0",
      dataVencimento: new Date(2026, 6, 28, 12),
      estadoPersistido: "aberto",
      diasAntecedencia: 7,
      agora: hoje,
    })).toBe("vencido");
    expect(tipoAlertaAtualDoTitulo({
      valorOriginal: "750.00",
      valorBaixado: "0",
      dataVencimento: new Date(2026, 8, 1, 12),
      estadoPersistido: "aberto",
      diasAntecedencia: 7,
      agora: hoje,
    })).toBeNull();
  });

  it("planeja alertas idempotentes e resolve alertas que deixaram de valer", () => {
    expect(planejarAtualizacaoAlertas("vence_em_breve", [])).toEqual({ criar: "vence_em_breve", resolver: [] });
    expect(planejarAtualizacaoAlertas("vence_em_breve", ["vence_em_breve"])).toEqual({ criar: null, resolver: [] });
    expect(planejarAtualizacaoAlertas("vencido", ["vence_em_breve"])).toEqual({ criar: "vencido", resolver: ["vence_em_breve"] });
    expect(planejarAtualizacaoAlertas(null, ["vence_em_breve", "vencido"])).toEqual({ criar: null, resolver: ["vence_em_breve", "vencido"] });
  });
});
