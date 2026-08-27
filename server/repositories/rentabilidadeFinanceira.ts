import { and, eq, gte, isNotNull, isNull, lt, ne, sql } from "drizzle-orm";
import {
  abastecimentosDiesel,
  categoriasFinanceiras,
  centrosCustosGerenciais,
  itensRomaneioProducao,
  romaneiosProducao,
  titulosFinanceiros,
} from "../../drizzle/schema";
import { consolidarRentabilidadeFinanceira, type ComponenteRentabilidadeFinanceira } from "../rentabilidade-financeira.logic";
import { getDb } from "./core";
import { getEmpresaUnica } from "./identidade";

const adicionarMes = (data: Date) => new Date(data.getFullYear(), data.getMonth() + 1, 1, 12, 0, 0, 0);
const numero = (valor: unknown) => {
  const convertido = Number(valor ?? 0);
  return Number.isFinite(convertido) ? convertido : 0;
};

export async function obterResumoRentabilidadeFinanceira(competencia: Date) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const empresaId = (await getEmpresaUnica()).id;
  const inicio = new Date(competencia.getFullYear(), competencia.getMonth(), 1, 12, 0, 0, 0);
  const fim = adicionarMes(inicio);

  const [titulos, abastecimentos, volumes, semCentro, semCompetencia, excluidos] = await Promise.all([
    db.select({ titulo: titulosFinanceiros, centro: centrosCustosGerenciais, categoria: categoriasFinanceiras })
      .from(titulosFinanceiros)
      .innerJoin(centrosCustosGerenciais, eq(titulosFinanceiros.centroCustoId, centrosCustosGerenciais.id))
      .innerJoin(categoriasFinanceiras, eq(titulosFinanceiros.categoriaId, categoriasFinanceiras.id))
      .where(and(
        eq(titulosFinanceiros.empresaId, empresaId),
        eq(titulosFinanceiros.tipo, "pagar"),
        ne(titulosFinanceiros.estado, "cancelado"),
        gte(titulosFinanceiros.competencia, inicio),
        lt(titulosFinanceiros.competencia, fim),
      )),
    db.select({ abastecimento: abastecimentosDiesel, centro: centrosCustosGerenciais })
      .from(abastecimentosDiesel)
      .innerJoin(centrosCustosGerenciais, eq(abastecimentosDiesel.centroCustoId, centrosCustosGerenciais.id))
      .where(and(
        eq(abastecimentosDiesel.empresaId, empresaId),
        gte(abastecimentosDiesel.dataAbastecimento, inicio),
        lt(abastecimentosDiesel.dataAbastecimento, fim),
      )),
    db.select({ volume: itensRomaneioProducao.volume, romaneioId: romaneiosProducao.id })
      .from(itensRomaneioProducao)
      .innerJoin(romaneiosProducao, eq(itensRomaneioProducao.romaneioId, romaneiosProducao.id))
      .where(and(
        eq(romaneiosProducao.empresaId, empresaId),
        eq(romaneiosProducao.estado, "confirmado"),
        gte(romaneiosProducao.dataProducao, inicio),
        lt(romaneiosProducao.dataProducao, fim),
      )),
    db.select({ quantidade: sql<number>`count(*)`, valor: sql<string>`coalesce(sum(${titulosFinanceiros.valorOriginal}), 0)` })
      .from(titulosFinanceiros).where(and(eq(titulosFinanceiros.empresaId, empresaId), eq(titulosFinanceiros.tipo, "pagar"), ne(titulosFinanceiros.estado, "cancelado"), isNull(titulosFinanceiros.centroCustoId), gte(titulosFinanceiros.competencia, inicio), lt(titulosFinanceiros.competencia, fim))),
    db.select({ quantidade: sql<number>`count(*)`, valor: sql<string>`coalesce(sum(${titulosFinanceiros.valorOriginal}), 0)` })
      .from(titulosFinanceiros).where(and(eq(titulosFinanceiros.empresaId, empresaId), eq(titulosFinanceiros.tipo, "pagar"), ne(titulosFinanceiros.estado, "cancelado"), isNull(titulosFinanceiros.competencia))),
    db.select({ quantidade: sql<number>`count(*)`, valor: sql<string>`coalesce(sum(${titulosFinanceiros.valorOriginal}), 0)` })
      .from(titulosFinanceiros).where(and(eq(titulosFinanceiros.empresaId, empresaId), eq(titulosFinanceiros.tipo, "pagar"), ne(titulosFinanceiros.estado, "cancelado"), isNotNull(titulosFinanceiros.centroCustoId), gte(titulosFinanceiros.competencia, inicio), lt(titulosFinanceiros.competencia, fim), eq(titulosFinanceiros.origem, "nota_diesel"))),
  ]);

  const componentes: ComponenteRentabilidadeFinanceira[] = [];
  for (const item of titulos) {
    if (item.titulo.origem === "nota_diesel") continue;
    componentes.push({
      chave: `titulo:${item.titulo.id}`,
      origem: item.titulo.origem,
      centroCustoId: item.centro.id,
      centroNome: item.centro.nome,
      centroTipo: item.centro.tipo,
      categoriaId: item.categoria.id,
      categoriaNome: item.categoria.nome,
      descricao: item.titulo.descricao,
      valor: item.titulo.valorOriginal,
    });
  }
  for (const item of abastecimentos) {
    componentes.push({
      chave: `abastecimento:${item.abastecimento.id}`,
      origem: "abastecimento_diesel",
      centroCustoId: item.centro.id,
      centroNome: item.centro.nome,
      centroTipo: item.centro.tipo,
      categoriaId: null,
      categoriaNome: "Diesel operacional",
      descricao: item.abastecimento.destino,
      valor: item.abastecimento.custoTotal,
    });
  }

  const resumo = consolidarRentabilidadeFinanceira({
    componentes,
    volumeProprioM3: volumes.reduce((total, item) => total + numero(item.volume), 0),
    titulosSemCentro: semCentro[0] ?? { quantidade: 0, valor: 0 },
    titulosSemCompetencia: semCompetencia[0] ?? { quantidade: 0, valor: 0 },
    titulosExcluidosPorOrigem: excluidos[0] ?? { quantidade: 0, valor: 0 },
  });
  return { competencia: inicio, periodoFimExclusivo: fim, totalRomaneiosProducao: new Set(volumes.map((item) => item.romaneioId)).size, ...resumo };
}
