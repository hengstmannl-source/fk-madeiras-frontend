export type TipoCentroRentabilidade = "industrial" | "comercial_administrativo" | "nao_apropriavel";

export type ComponenteRentabilidadeFinanceira = {
  chave: string;
  origem: string;
  centroCustoId: number;
  centroNome: string;
  centroTipo: TipoCentroRentabilidade;
  categoriaId: number | null;
  categoriaNome: string;
  descricao: string;
  valor: number | string;
};

const numero = (valor: number | string | null | undefined) => {
  const convertido = Number(valor ?? 0);
  return Number.isFinite(convertido) ? convertido : 0;
};

export function consolidarRentabilidadeFinanceira(input: {
  componentes: ComponenteRentabilidadeFinanceira[];
  volumeProprioM3: number | string;
  titulosSemCentro: { quantidade: number; valor: number | string };
  titulosSemCompetencia: { quantidade: number; valor: number | string };
  titulosExcluidosPorOrigem: { quantidade: number; valor: number | string };
}) {
  const componentes = input.componentes.filter((item) => item.centroTipo !== "nao_apropriavel").map((item) => ({ ...item, valor: numero(item.valor) }));
  const porCentro = new Map<number, { id: number; nome: string; tipo: TipoCentroRentabilidade; total: number; quantidade: number }>();
  const porCategoria = new Map<string, { chave: string; centroNome: string; centroTipo: TipoCentroRentabilidade; categoriaNome: string; total: number; quantidade: number }>();

  for (const componente of componentes) {
    const centro = porCentro.get(componente.centroCustoId) ?? {
      id: componente.centroCustoId,
      nome: componente.centroNome,
      tipo: componente.centroTipo,
      total: 0,
      quantidade: 0,
    };
    centro.total += componente.valor;
    centro.quantidade += 1;
    porCentro.set(componente.centroCustoId, centro);

    const chave = `${componente.centroCustoId}:${componente.categoriaId ?? "sem_categoria"}`;
    const categoria = porCategoria.get(chave) ?? {
      chave,
      centroNome: componente.centroNome,
      centroTipo: componente.centroTipo,
      categoriaNome: componente.categoriaNome,
      total: 0,
      quantidade: 0,
    };
    categoria.total += componente.valor;
    categoria.quantidade += 1;
    porCategoria.set(chave, categoria);
  }

  const industrial = componentes.filter((item) => item.centroTipo === "industrial").reduce((total, item) => total + item.valor, 0);
  const comercialAdministrativo = componentes.filter((item) => item.centroTipo === "comercial_administrativo").reduce((total, item) => total + item.valor, 0);
  const materiaPrima = componentes.filter((item) => item.origem === "romaneio_carga").reduce((total, item) => total + item.valor, 0);
  const volumeProprioM3 = numero(input.volumeProprioM3);

  return {
    indicadores: {
      custosIndustriais: industrial,
      custosComerciaisAdministrativos: comercialAdministrativo,
      custosMateriaPrima: materiaPrima,
      custoTotalApropriado: industrial + comercialAdministrativo,
      volumeProprioM3,
      custoIndustrialPorM3: volumeProprioM3 > 0 ? industrial / volumeProprioM3 : null,
      custoTotalPorM3: volumeProprioM3 > 0 ? (industrial + comercialAdministrativo) / volumeProprioM3 : null,
    },
    porCentro: Array.from(porCentro.values()).sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome)),
    porCategoria: Array.from(porCategoria.values()).sort((a, b) => b.total - a.total || a.categoriaNome.localeCompare(b.categoriaNome)),
    componentes: componentes.sort((a, b) => b.valor - a.valor || a.descricao.localeCompare(b.descricao)),
    qualidadeDados: {
      titulosSemCentro: { quantidade: input.titulosSemCentro.quantidade, valor: numero(input.titulosSemCentro.valor) },
      titulosSemCompetencia: { quantidade: input.titulosSemCompetencia.quantidade, valor: numero(input.titulosSemCompetencia.valor) },
      titulosExcluidosPorOrigem: { quantidade: input.titulosExcluidosPorOrigem.quantidade, valor: numero(input.titulosExcluidosPorOrigem.valor) },
    },
  };
}
