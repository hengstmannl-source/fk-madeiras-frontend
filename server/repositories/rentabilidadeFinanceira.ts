import { and, eq, gte, isNotNull, isNull, lt, ne, sql } from "drizzle-orm";
import {
  abastecimentosDiesel,
  aproveitamentosRomaneioProducao,
  categoriasFinanceiras,
  centrosCustosGerenciais,
  itensRomaneioProducao,
  itensRomaneioToras,
  plaquetas,
  romaneiosCargaToras,
  romaneiosProducao,
  titulosFinanceiros,
} from "../../drizzle/schema";
import {
  calcularCusteioMateriaPrima,
  consolidarRentabilidadeFinanceira,
  type ComponenteRentabilidadeFinanceira,
} from "../rentabilidade-financeira.logic";
import { getDb } from "./core";
import { getEmpresaUnica } from "./identidade";

const adicionarMes = (data: Date) => new Date(data.getFullYear(), data.getMonth() + 1, 1, 12, 0, 0, 0);
const inicioJanelaDozeMeses = (data: Date) => new Date(data.getFullYear(), data.getMonth() - 11, 1, 12, 0, 0, 0);
const numero = (valor: unknown) => {
  const convertido = Number(valor ?? 0);
  return Number.isFinite(convertido) ? convertido : 0;
};

/**
 * Leitura mensal da rentabilidade. A matéria-prima vem exclusivamente das
 * toras efetivamente consumidas na produção própria; títulos de romaneio
 * permanecem no Financeiro, mas são excluídos desta composição para não
 * representar o mesmo evento econômico duas vezes.
 */
export async function obterResumoRentabilidadeFinanceira(competencia: Date) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const empresaId = (await getEmpresaUnica()).id;
  const inicio = new Date(competencia.getFullYear(), competencia.getMonth(), 1, 12, 0, 0, 0);
  const fim = adicionarMes(inicio);
  const inicioReferencia = inicioJanelaDozeMeses(inicio);

  const [titulos, abastecimentos, producoes, volumesPecasPorEssencia, aproveitamentosPorEssencia, torasConsumidas, referenciasPreco, semCentro, semCompetencia, notasDieselExcluidas, titulosRomaneioExcluidos] = await Promise.all([
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
    db.select({
      producao: romaneiosProducao,
      volumePecas: sql<string>`coalesce(sum(${itensRomaneioProducao.volume}), 0)`,
    })
      .from(romaneiosProducao)
      .leftJoin(itensRomaneioProducao, and(
        eq(itensRomaneioProducao.romaneioId, romaneiosProducao.id),
        eq(itensRomaneioProducao.empresaId, romaneiosProducao.empresaId),
      ))
      .where(and(
        eq(romaneiosProducao.empresaId, empresaId),
        eq(romaneiosProducao.estado, "confirmado"),
        gte(romaneiosProducao.dataProducao, inicio),
        lt(romaneiosProducao.dataProducao, fim),
      ))
      .groupBy(romaneiosProducao.id),
    db.select({
      producaoId: itensRomaneioProducao.romaneioId,
      essencia: itensRomaneioProducao.madeiraNome,
      volumePecas: sql<string>`coalesce(sum(${itensRomaneioProducao.volume}), 0)`,
    })
      .from(itensRomaneioProducao)
      .innerJoin(romaneiosProducao, and(
        eq(itensRomaneioProducao.romaneioId, romaneiosProducao.id),
        eq(itensRomaneioProducao.empresaId, romaneiosProducao.empresaId),
      ))
      .where(and(
        eq(itensRomaneioProducao.empresaId, empresaId),
        eq(romaneiosProducao.estado, "confirmado"),
        gte(romaneiosProducao.dataProducao, inicio),
        lt(romaneiosProducao.dataProducao, fim),
      ))
      .groupBy(itensRomaneioProducao.romaneioId, itensRomaneioProducao.madeiraNome),
    db.select({
      producaoId: aproveitamentosRomaneioProducao.romaneioId,
      essencia: aproveitamentosRomaneioProducao.madeiraNome,
      volumeAproveitamento: sql<string>`coalesce(sum(${aproveitamentosRomaneioProducao.volume}), 0)`,
      incluirAproveitamento: romaneiosProducao.incluirAproveitamentoNoRendimento,
    })
      .from(aproveitamentosRomaneioProducao)
      .innerJoin(romaneiosProducao, and(
        eq(aproveitamentosRomaneioProducao.romaneioId, romaneiosProducao.id),
        eq(aproveitamentosRomaneioProducao.empresaId, romaneiosProducao.empresaId),
      ))
      .where(and(
        eq(aproveitamentosRomaneioProducao.empresaId, empresaId),
        eq(romaneiosProducao.estado, "confirmado"),
        gte(romaneiosProducao.dataProducao, inicio),
        lt(romaneiosProducao.dataProducao, fim),
      ))
      .groupBy(aproveitamentosRomaneioProducao.romaneioId, aproveitamentosRomaneioProducao.madeiraNome, romaneiosProducao.incluirAproveitamentoNoRendimento),
    db.select({
      producaoId: itensRomaneioToras.romaneioId,
      plaquetaId: plaquetas.id,
      plaquetaCodigo: plaquetas.codigo,
      essencia: itensRomaneioToras.madeiraNome,
      volume: itensRomaneioToras.volume,
      romaneioCargaId: plaquetas.romaneioCargaId,
      valorMetroCubico: plaquetas.valorMetroCubico,
      fretePorMetroCubico: romaneiosCargaToras.fretePorMetroCubico,
      numeroRomaneioCarga: romaneiosCargaToras.numero,
    })
      .from(itensRomaneioToras)
      .innerJoin(romaneiosProducao, and(
        eq(itensRomaneioToras.romaneioId, romaneiosProducao.id),
        eq(itensRomaneioToras.empresaId, romaneiosProducao.empresaId),
      ))
      .innerJoin(plaquetas, and(
        eq(itensRomaneioToras.plaquetaId, plaquetas.id),
        eq(itensRomaneioToras.empresaId, plaquetas.empresaId),
      ))
      .leftJoin(romaneiosCargaToras, and(
        eq(plaquetas.romaneioCargaId, romaneiosCargaToras.id),
        eq(plaquetas.empresaId, romaneiosCargaToras.empresaId),
      ))
      .where(and(
        eq(itensRomaneioToras.empresaId, empresaId),
        eq(romaneiosProducao.estado, "confirmado"),
        gte(romaneiosProducao.dataProducao, inicio),
        lt(romaneiosProducao.dataProducao, fim),
      )),
    db.select({
      essencia: plaquetas.madeiraNome,
      volumeBase: plaquetas.volumeInicial,
      valorMetroCubico: plaquetas.valorMetroCubico,
      fretePorMetroCubico: romaneiosCargaToras.fretePorMetroCubico,
    })
      .from(plaquetas)
      .innerJoin(romaneiosCargaToras, and(
        eq(plaquetas.romaneioCargaId, romaneiosCargaToras.id),
        eq(plaquetas.empresaId, romaneiosCargaToras.empresaId),
      ))
      .where(and(
        eq(plaquetas.empresaId, empresaId),
        isNotNull(plaquetas.romaneioCargaId),
        gte(romaneiosCargaToras.dataCarga, inicioReferencia),
        lt(romaneiosCargaToras.dataCarga, fim),
      )),
    db.select({ quantidade: sql<number>`count(*)`, valor: sql<string>`coalesce(sum(${titulosFinanceiros.valorOriginal}), 0)` })
      .from(titulosFinanceiros)
      .where(and(eq(titulosFinanceiros.empresaId, empresaId), eq(titulosFinanceiros.tipo, "pagar"), ne(titulosFinanceiros.estado, "cancelado"), isNull(titulosFinanceiros.centroCustoId), gte(titulosFinanceiros.competencia, inicio), lt(titulosFinanceiros.competencia, fim))),
    db.select({ quantidade: sql<number>`count(*)`, valor: sql<string>`coalesce(sum(${titulosFinanceiros.valorOriginal}), 0)` })
      .from(titulosFinanceiros)
      .where(and(eq(titulosFinanceiros.empresaId, empresaId), eq(titulosFinanceiros.tipo, "pagar"), ne(titulosFinanceiros.estado, "cancelado"), isNull(titulosFinanceiros.competencia))),
    db.select({ quantidade: sql<number>`count(*)`, valor: sql<string>`coalesce(sum(${titulosFinanceiros.valorOriginal}), 0)` })
      .from(titulosFinanceiros)
      .where(and(eq(titulosFinanceiros.empresaId, empresaId), eq(titulosFinanceiros.tipo, "pagar"), ne(titulosFinanceiros.estado, "cancelado"), gte(titulosFinanceiros.competencia, inicio), lt(titulosFinanceiros.competencia, fim), eq(titulosFinanceiros.origem, "nota_diesel"))),
    db.select({ quantidade: sql<number>`count(*)`, valor: sql<string>`coalesce(sum(${titulosFinanceiros.valorOriginal}), 0)` })
      .from(titulosFinanceiros)
      .where(and(eq(titulosFinanceiros.empresaId, empresaId), eq(titulosFinanceiros.tipo, "pagar"), ne(titulosFinanceiros.estado, "cancelado"), gte(titulosFinanceiros.competencia, inicio), lt(titulosFinanceiros.competencia, fim), eq(titulosFinanceiros.origem, "romaneio_carga"))),
  ]);

  const materiaPrima = calcularCusteioMateriaPrima({
    producoes: producoes.map((item) => ({
      id: item.producao.id,
      numero: item.producao.numero,
      dataProducao: item.producao.dataProducao,
      volumePecas: item.volumePecas,
      volumeAproveitamento: item.producao.volumeAproveitamento,
      incluirAproveitamento: item.producao.incluirAproveitamentoNoRendimento,
    })),
    torasConsumidas: torasConsumidas.map((item) => ({
      ...item,
      plaquetaCodigo: item.plaquetaCodigo ?? `Plaqueta ${item.plaquetaId}`,
      essencia: item.essencia,
      romaneioCargaId: item.romaneioCargaId ?? null,
      valorMetroCubico: item.valorMetroCubico ?? null,
      fretePorMetroCubico: item.fretePorMetroCubico ?? null,
      numeroRomaneioCarga: item.numeroRomaneioCarga ?? null,
    })),
    referenciasPrecoPorEssencia: referenciasPreco,
    volumesProduzidosPorEssencia: [
      ...volumesPecasPorEssencia.map((item) => ({
        producaoId: item.producaoId,
        essencia: item.essencia,
        volumePecas: item.volumePecas,
      })),
      ...aproveitamentosPorEssencia
        .filter((item) => item.incluirAproveitamento)
        .map((item) => ({
          producaoId: item.producaoId,
          essencia: item.essencia,
          volumePecas: 0,
          volumeAproveitamento: item.volumeAproveitamento,
        })),
    ],
    periodoReferencia: { inicio: inicioReferencia, fimExclusivo: fim },
  });

  const componentes: ComponenteRentabilidadeFinanceira[] = [];
  for (const item of titulos) {
    if (item.titulo.origem === "nota_diesel" || item.titulo.origem === "romaneio_carga") continue;
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
    volumeProprioM3: materiaPrima.producoes.reduce((total, item) => total + numero(item.volumeElegivelM3), 0),
    materiaPrima,
    titulosSemCentro: semCentro[0] ?? { quantidade: 0, valor: 0 },
    titulosSemCompetencia: semCompetencia[0] ?? { quantidade: 0, valor: 0 },
    titulosExcluidosPorOrigem: notasDieselExcluidas[0] ?? { quantidade: 0, valor: 0 },
    titulosRomaneioCargaExcluidos: titulosRomaneioExcluidos[0] ?? { quantidade: 0, valor: 0 },
  });
  return { competencia: inicio, periodoFimExclusivo: fim, totalRomaneiosProducao: producoes.length, ...resumo };
}
