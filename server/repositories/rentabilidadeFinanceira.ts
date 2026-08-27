import { and, eq, gte, inArray, isNotNull, isNull, lt, ne, sql } from "drizzle-orm";
import {
  abastecimentosDiesel,
  aproveitamentosRomaneioProducao,
  categoriasFinanceiras,
  centrosCustosGerenciais,
  clientes,
  itensRomaneioProducao,
  itensRomaneioToras,
  lotesPecasSerradas,
  movimentacoesEstoqueSerrado,
  orcamentos,
  plaquetas,
  romaneiosCargaToras,
  romaneiosProducao,
  taxasAdicionaisOrcamento,
  titulosFinanceiros,
} from "../../drizzle/schema";
import {
  calcularCusteioMateriaPrima,
  consolidarRentabilidadeFinanceira,
  type ComponenteRentabilidadeFinanceira,
} from "../rentabilidade-financeira.logic";
import { calcularVolumeLiquidoVendido, consolidarMargemVendaRastreavel, type LoteVendidoParaRentabilidade } from "../rentabilidade-vendas.logic";
import { getDb } from "./core";
import { getEmpresaUnica } from "./identidade";

const adicionarMes = (data: Date) => new Date(data.getFullYear(), data.getMonth() + 1, 1, 12, 0, 0, 0);
const inicioJanelaDozeMeses = (data: Date) => new Date(data.getFullYear(), data.getMonth() - 11, 1, 12, 0, 0, 0);
const numero = (valor: unknown) => {
  const convertido = Number(valor ?? 0);
  return Number.isFinite(convertido) ? convertido : 0;
};
const normalizarEssencia = (valor: string | null | undefined) => (valor ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleUpperCase("pt-BR");
const competenciaDaData = (data: Date) => new Date(data.getFullYear(), data.getMonth(), 1, 12, 0, 0, 0);
const chaveCompetencia = (data: Date) => `${data.getFullYear()}-${data.getMonth()}`;

type SaidaLiquidaLote = {
  vendaId: number;
  loteId: number;
  itemVendaId: number | null;
  quantidadeLiquida: number;
  volumeLiquido: number;
  lote: typeof lotesPecasSerradas.$inferSelect;
  producao: typeof romaneiosProducao.$inferSelect | null;
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

/**
 * Visão de margem da venda baseada em movimentações físicas líquidas. Não há
 * materialização: os lotes, romaneios, títulos e vendas originais continuam
 * sendo a fonte única. Frete e comissão reduzem a receita da madeira antes da
 * comparação com matéria-prima, industrial e comercial/administrativo.
 */
export async function obterRentabilidadeVendas(competencia: Date) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const empresaId = (await getEmpresaUnica()).id;
  const inicio = competenciaDaData(competencia);
  const fim = adicionarMes(inicio);
  const vendas = await db.select({ venda: orcamentos, cliente: clientes })
    .from(orcamentos)
    .innerJoin(clientes, and(eq(orcamentos.clienteId, clientes.id), eq(orcamentos.empresaId, clientes.empresaId)))
    .where(and(
      eq(orcamentos.empresaId, empresaId),
      eq(orcamentos.entregue, true),
      isNotNull(orcamentos.entregueEm),
      gte(orcamentos.entregueEm, inicio),
      lt(orcamentos.entregueEm, fim),
    ))
    .orderBy(orcamentos.entregueEm, orcamentos.id);
  if (!vendas.length) return { competencia: inicio, periodoFimExclusivo: fim, vendas: [] };

  const vendasIds = vendas.map((item) => item.venda.id);
  const [movimentos, taxas] = await Promise.all([
    db.select({ movimento: movimentacoesEstoqueSerrado, lote: lotesPecasSerradas, producao: romaneiosProducao })
      .from(movimentacoesEstoqueSerrado)
      .innerJoin(lotesPecasSerradas, and(
        eq(movimentacoesEstoqueSerrado.loteId, lotesPecasSerradas.id),
        eq(movimentacoesEstoqueSerrado.empresaId, lotesPecasSerradas.empresaId),
      ))
      .leftJoin(romaneiosProducao, and(
        eq(lotesPecasSerradas.romaneioId, romaneiosProducao.id),
        eq(lotesPecasSerradas.empresaId, romaneiosProducao.empresaId),
      ))
      .where(and(
        eq(movimentacoesEstoqueSerrado.empresaId, empresaId),
        inArray(movimentacoesEstoqueSerrado.orcamentoId, vendasIds),
        inArray(movimentacoesEstoqueSerrado.tipo, ["saida_entrega", "estorno_entrega"]),
      )),
    db.select().from(taxasAdicionaisOrcamento).where(and(
      eq(taxasAdicionaisOrcamento.empresaId, empresaId),
      inArray(taxasAdicionaisOrcamento.orcamentoId, vendasIds),
    )),
  ]);

  const saidasPorLote = new Map<string, SaidaLiquidaLote>();
  for (const item of movimentos) {
    const sinal = item.movimento.tipo === "estorno_entrega" ? -1 : 1;
    const chave = `${item.movimento.orcamentoId}:${item.movimento.loteId}:${item.movimento.itemVendaId ?? "sem-item"}`;
    const atual = saidasPorLote.get(chave) ?? {
      vendaId: item.movimento.orcamentoId!,
      loteId: item.movimento.loteId,
      itemVendaId: item.movimento.itemVendaId,
      quantidadeLiquida: 0,
      volumeLiquido: 0,
      lote: item.lote,
      producao: item.producao,
    };
    atual.quantidadeLiquida += sinal * numero(item.movimento.quantidade);
    atual.volumeLiquido += sinal * numero(item.movimento.volume);
    saidasPorLote.set(chave, atual);
  }

  const competenciasProducoes = Array.from(new Set(
    Array.from(saidasPorLote.values())
      .map((item) => item.producao?.dataProducao)
      .filter((data): data is Date => data instanceof Date)
      .map(chaveCompetencia),
  ));
  const resumosPorCompetencia = new Map<string, Awaited<ReturnType<typeof obterResumoRentabilidadeFinanceira>>>();
  await Promise.all(competenciasProducoes.map(async (chave) => {
    const [ano, mes] = chave.split("-").map(Number);
    resumosPorCompetencia.set(chave, await obterResumoRentabilidadeFinanceira(new Date(ano, mes, 1, 12, 0, 0, 0)));
  }));

  const taxasPorVenda = new Map<number, typeof taxas>();
  for (const taxa of taxas) {
    const atuais = taxasPorVenda.get(taxa.orcamentoId) ?? [];
    atuais.push(taxa);
    taxasPorVenda.set(taxa.orcamentoId, atuais);
  }
  const lotesPorVenda = new Map<number, LoteVendidoParaRentabilidade[]>();
  for (const saida of Array.from(saidasPorLote.values())) {
    if (saida.quantidadeLiquida <= 0 && saida.volumeLiquido <= 0) continue;
    const lote = saida.lote;
    const essencia = lote.tipo === "aproveitamento"
      ? lote.madeiraNome.replace(/^aproveitamento\s+de\s+/i, "").trim()
      : lote.madeiraNome;
    const producao = saida.producao;
    const resumoCompetencia = producao ? resumosPorCompetencia.get(chaveCompetencia(producao.dataProducao)) : null;
    const producaoComCusto = producao && resumoCompetencia?.materiaPrima.producoes.find((item) => item.id === producao.id);
    const essenciaComCusto = producaoComCusto?.porEssencia.find((item: { essencia: string }) => normalizarEssencia(item.essencia) === normalizarEssencia(essencia));
    const volumeVendidoM3 = calcularVolumeLiquidoVendido({
      tipo: lote.tipo,
      quantidadeLiquida: saida.quantidadeLiquida,
      volumeLiquidoMovimentado: saida.volumeLiquido,
      volumeLote: lote.volume,
      quantidadeProduzida: lote.quantidadeProduzida,
    });
    let motivoIndisponibilidade: string | null = null;
    if (lote.propriedade !== "proprio") motivoIndisponibilidade = "Lote de madeira de terceiro não compõe a margem da madeira própria.";
    else if (!lote.romaneioId || !producao) motivoIndisponibilidade = "Lote sem produção própria de origem rastreável.";
    else if (lote.tipo === "peca" && lote.quantidadeProduzida <= 0) motivoIndisponibilidade = "Lote de peça sem quantidade produzida positiva; o volume de saída não pode ser reconstituído.";
    else if (!essenciaComCusto) motivoIndisponibilidade = "Produção de origem sem custo de matéria-prima apurável para a essência do lote.";
    else if (lote.tipo === "aproveitamento" && essenciaComCusto.volumeElegivelM3 <= 0) motivoIndisponibilidade = "Aproveitamento fora do volume elegível da produção de origem.";
    const custoMateriaPrimaPorM3 = motivoIndisponibilidade ? null : essenciaComCusto?.custoPorM3 ?? null;
    const custoIndustrialPorM3 = producao && resumoCompetencia?.indicadores.custosIndustriaisPorM3 != null
      ? numero(resumoCompetencia.indicadores.custosIndustriaisPorM3)
      : null;
    const custoComercialAdministrativoPorM3 = producao && resumoCompetencia?.indicadores.custosComerciaisAdministrativosPorM3 != null
      ? numero(resumoCompetencia.indicadores.custosComerciaisAdministrativosPorM3)
      : null;
    const lotes = lotesPorVenda.get(saida.vendaId) ?? [];
    lotes.push({
      loteId: lote.id,
      itemVendaId: saida.itemVendaId,
      essencia,
      tipo: lote.tipo,
      quantidadeLiquida: saida.quantidadeLiquida,
      volumeVendidoM3: volumeVendidoM3 === null ? null : Number(volumeVendidoM3.toFixed(6)),
      custoMateriaPrimaPorM3,
      custoIndustrialPorM3,
      custoComercialAdministrativoPorM3,
      coberturaMateriaPrimaPercentual: essenciaComCusto?.coberturaComEstimativaPercentual ?? 0,
      motivoIndisponibilidade,
    });
    lotesPorVenda.set(saida.vendaId, lotes);
  }

  return {
    competencia: inicio,
    periodoFimExclusivo: fim,
    vendas: vendas.map(({ venda, cliente }) => {
      const margem = consolidarMargemVendaRastreavel({
        receitaBrutaMadeira: venda.subtotal,
        descontoComercial: venda.desconto,
        freteComercial: venda.abatimentoFrete,
        comissao: venda.comissaoCalculada,
        volumeNegociadoM3: venda.totalVolume,
        lotes: lotesPorVenda.get(venda.id) ?? [],
      });
      return {
        id: venda.id,
        numero: venda.numero ?? `Venda ${venda.id}`,
        cliente: cliente.nome,
        vendedor: venda.vendedor,
        entregueEm: venda.entregueEm!,
        taxasCobradasAoCliente: (taxasPorVenda.get(venda.id) ?? []).reduce((total, taxa) => total + numero(taxa.calculado), 0),
        margem,
      };
    }),
  };
}
