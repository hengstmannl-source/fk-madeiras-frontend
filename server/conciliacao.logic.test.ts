import { describe, expect, it } from "vitest";
import { sugerirConciliacoes } from "./conciliacao.logic";

describe("sugerirConciliacoes", () => {
  it("prioriza baixa com mesma natureza, valor, data próxima e descrição relacionada", () => {
    const sugestoes = sugerirConciliacoes({ tipo: "entrada", valor: "1250.00", dataMovimento: "2026-09-03", descricao: "PIX recebido Madeireira Norte" }, [
      { id: 4, tituloId: 8, tipoTitulo: "receber", valor: "1250.00", dataBaixa: "2026-09-02", descricaoTitulo: "Venda Madeireira Norte", contraparteNome: "Madeireira Norte" },
      { id: 5, tituloId: 9, tipoTitulo: "pagar", valor: "1250.00", dataBaixa: "2026-09-02", descricaoTitulo: "Frete", contraparteNome: "Transportadora" },
      { id: 6, tituloId: 10, tipoTitulo: "receber", valor: "1250.00", dataBaixa: "2026-08-01", descricaoTitulo: "Venda antiga", contraparteNome: null },
    ]);

    expect(sugestoes).toHaveLength(1);
    expect(sugestoes[0]).toMatchObject({ id: 4, pontuacao: 100 });
    expect(sugestoes[0].motivo).toContain("descrição relacionada");
  });
});
