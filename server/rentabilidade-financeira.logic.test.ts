import { describe, expect, it } from "vitest";
import { consolidarRentabilidadeFinanceira } from "./rentabilidade-financeira.logic";

describe("consolidarRentabilidadeFinanceira", () => {
  it("separa custos por tipo de centro, exclui o não apropriável e calcula custo por m³", () => {
    const resultado = consolidarRentabilidadeFinanceira({
      componentes: [
        { chave: "t:1", origem: "romaneio_carga", centroCustoId: 1, centroNome: "Serraria", centroTipo: "industrial", categoriaId: 10, categoriaNome: "Matéria-prima", descricao: "Carga 1", valor: "1200.50" },
        { chave: "d:2", origem: "abastecimento_diesel", centroCustoId: 1, centroNome: "Serraria", centroTipo: "industrial", categoriaId: null, categoriaNome: "Diesel operacional", descricao: "Abastecimento", valor: 300 },
        { chave: "t:3", origem: "manual", centroCustoId: 2, centroNome: "Administração", centroTipo: "comercial_administrativo", categoriaId: 11, categoriaNome: "Energia", descricao: "Energia", valor: 200 },
        { chave: "t:4", origem: "manual", centroCustoId: 3, centroNome: "Financeiro", centroTipo: "nao_apropriavel", categoriaId: 12, categoriaNome: "Empréstimos", descricao: "Banco", valor: 500 },
      ],
      volumeProprioM3: "10",
      titulosSemCentro: { quantidade: 2, valor: "45.5" },
      titulosSemCompetencia: { quantidade: 1, valor: "20" },
      titulosExcluidosPorOrigem: { quantidade: 1, valor: "64.7" },
    });

    expect(resultado.indicadores).toMatchObject({
      custosIndustriais: 1500.5,
      custosComerciaisAdministrativos: 200,
      custosMateriaPrima: 1200.5,
      custoTotalApropriado: 1700.5,
      custoIndustrialPorM3: 150.05,
      custoTotalPorM3: 170.05,
    });
    expect(resultado.porCentro).toHaveLength(2);
    expect(resultado.componentes).toHaveLength(3);
    expect(resultado.qualidadeDados.titulosSemCentro.valor).toBe(45.5);
  });

  it("não calcula custo unitário quando não há produção própria confirmada", () => {
    const resultado = consolidarRentabilidadeFinanceira({
      componentes: [], volumeProprioM3: 0,
      titulosSemCentro: { quantidade: 0, valor: 0 },
      titulosSemCompetencia: { quantidade: 0, valor: 0 },
      titulosExcluidosPorOrigem: { quantidade: 0, valor: 0 },
    });
    expect(resultado.indicadores.custoIndustrialPorM3).toBeNull();
    expect(resultado.indicadores.custoTotalPorM3).toBeNull();
  });
});
