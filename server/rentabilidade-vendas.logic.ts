export type SituacaoCoberturaRentabilidadeVenda = "completa" | "parcial" | "indisponivel";

export type LoteVendidoParaRentabilidade = {
  loteId: number;
  itemVendaId: number | null;
  essencia: string;
  tipo: "peca" | "aproveitamento";
  quantidadeLiquida: number;
  volumeVendidoM3: number | null;
  custoMateriaPrimaPorM3: number | null;
  custoIndustrialPorM3: number | null;
  custoComercialAdministrativoPorM3: number | null;
  coberturaMateriaPrimaPercentual: number;
  motivoIndisponibilidade: string | null;
};

const arredondar = (valor: number) => Math.round((valor + Number.EPSILON) * 100) / 100;
const numeroSeguro = (valor: number | string | null | undefined) => {
  const numero = Number(valor ?? 0);
  return Number.isFinite(numero) ? numero : 0;
};

/**
 * Reconstrói o volume vendido de peças a partir da saída líquida e do lote de
 * origem. Movimentos antigos de peça podem ter volume zero, portanto eles não
 * são usados como base. Aproveitamento já movimenta volume diretamente.
 */
export function calcularVolumeLiquidoVendido(input: {
  tipo: "peca" | "aproveitamento";
  quantidadeLiquida: number | string | null | undefined;
  volumeLiquidoMovimentado: number | string | null | undefined;
  volumeLote: number | string | null | undefined;
  quantidadeProduzida: number | string | null | undefined;
}) {
  const quantidadeLiquida = numeroSeguro(input.quantidadeLiquida);
  const volumeLiquidoMovimentado = numeroSeguro(input.volumeLiquidoMovimentado);
  if (input.tipo === "aproveitamento") return volumeLiquidoMovimentado > 0 ? volumeLiquidoMovimentado : null;
  const quantidadeProduzida = numeroSeguro(input.quantidadeProduzida);
  if (quantidadeLiquida <= 0 || quantidadeProduzida <= 0) return null;
  return (quantidadeLiquida * numeroSeguro(input.volumeLote)) / quantidadeProduzida;
}

/**
 * Consolida apenas custos que possuem volume físico e origem suficientes para
 * a respectiva camada. Frete e comissão não compõem o custo: já reduziram a
 * receita líquida da madeira no cálculo comercial da venda.
 */
export function consolidarMargemVendaRastreavel(input: {
  receitaBrutaMadeira: number | string | null | undefined;
  descontoComercial: number | string | null | undefined;
  freteComercial: number | string | null | undefined;
  comissao: number | string | null | undefined;
  volumeNegociadoM3: number | string | null | undefined;
  lotes: LoteVendidoParaRentabilidade[];
}) {
  const receitaBrutaMadeira = numeroSeguro(input.receitaBrutaMadeira);
  const descontoComercial = numeroSeguro(input.descontoComercial);
  const freteComercial = numeroSeguro(input.freteComercial);
  const comissao = numeroSeguro(input.comissao);
  const deducoesComerciais = descontoComercial + freteComercial + comissao;
  const receitaLiquidaMadeira = receitaBrutaMadeira - deducoesComerciais;
  const volumeNegociadoM3 = numeroSeguro(input.volumeNegociadoM3);
  let volumeVendidoM3 = 0;
  let volumeComCustoMateriaPrimaM3 = 0;
  let volumeComCustoIndustrialM3 = 0;
  let custoMateriaPrima = 0;
  let custoIndustrial = 0;
  let custoComercialAdministrativo = 0;
  const problemas = new Set<string>();

  const lotes = input.lotes.map((lote) => {
    const volumeLoteM3 = lote.volumeVendidoM3;
    if (volumeLoteM3 === null || volumeLoteM3 <= 0) {
      problemas.add(lote.motivoIndisponibilidade ?? "Volume físico da saída indisponível para o lote.");
      return {
        ...lote,
        custoMateriaPrima: null,
        custoIndustrial: null,
        custoComercialAdministrativo: null,
        custoTotal: null,
        situacaoCobertura: "indisponivel" as const,
      };
    }

    volumeVendidoM3 += volumeLoteM3;
    const custoMateria = lote.custoMateriaPrimaPorM3 === null ? null : volumeLoteM3 * lote.custoMateriaPrimaPorM3;
    const custoIndustrialLote = lote.custoIndustrialPorM3 === null ? null : volumeLoteM3 * lote.custoIndustrialPorM3;
    const custoComercial = lote.custoComercialAdministrativoPorM3 === null ? null : volumeLoteM3 * lote.custoComercialAdministrativoPorM3;
    if (custoMateria === null) problemas.add(lote.motivoIndisponibilidade ?? "Custo de matéria-prima indisponível para o lote.");
    if (custoIndustrialLote === null) problemas.add("Taxa industrial da competência de produção indisponível.");
    if (custoComercial === null) problemas.add("Taxa comercial/administrativa da competência de produção indisponível.");
    if (custoMateria !== null) {
      volumeComCustoMateriaPrimaM3 += volumeLoteM3;
      custoMateriaPrima += custoMateria;
    }
    if (custoIndustrialLote !== null) {
      volumeComCustoIndustrialM3 += volumeLoteM3;
      custoIndustrial += custoIndustrialLote;
    }
    if (custoComercial !== null) custoComercialAdministrativo += custoComercial;
    const custosConhecidos = [custoMateria, custoIndustrialLote, custoComercial].filter((valor): valor is number => valor !== null);
    const completo = custosConhecidos.length === 3 && lote.coberturaMateriaPrimaPercentual >= 100;
    const custoTotal = completo ? custosConhecidos.reduce((soma, valor) => soma + valor, 0) : null;
    return {
      ...lote,
      custoMateriaPrima: custoMateria === null ? null : arredondar(custoMateria),
      custoIndustrial: custoIndustrialLote === null ? null : arredondar(custoIndustrialLote),
      custoComercialAdministrativo: custoComercial === null ? null : arredondar(custoComercial),
      custoTotal: custoTotal === null ? null : arredondar(custoTotal),
      situacaoCobertura: completo ? "completa" as const : "parcial" as const,
    };
  });

  const custoTotalConhecido = custoMateriaPrima + custoIndustrial + custoComercialAdministrativo;
  const existemLotesComVolume = lotes.some((lote) => lote.volumeVendidoM3 !== null && lote.volumeVendidoM3 > 0);
  const coberturaCompleta = lotes.length > 0 && lotes.every((lote) => lote.situacaoCobertura === "completa");
  const situacaoCobertura: SituacaoCoberturaRentabilidadeVenda = !existemLotesComVolume
    ? "indisponivel"
    : coberturaCompleta
      ? "completa"
      : "parcial";
  const custoTotal = situacaoCobertura === "completa" ? custoTotalConhecido : null;
  const volumeBasePrecoM3 = volumeNegociadoM3 > 0 ? volumeNegociadoM3 : volumeVendidoM3;

  return {
    receitaBrutaMadeira: arredondar(receitaBrutaMadeira),
    descontoComercial: arredondar(descontoComercial),
    freteComercial: arredondar(freteComercial),
    comissao: arredondar(comissao),
    deducoesComerciais: arredondar(deducoesComerciais),
    receitaLiquidaMadeira: arredondar(receitaLiquidaMadeira),
    volumeNegociadoM3: arredondar(volumeNegociadoM3),
    volumeVendidoM3: arredondar(volumeVendidoM3),
    precoLiquidoPorM3: volumeBasePrecoM3 > 0 ? arredondar(receitaLiquidaMadeira / volumeBasePrecoM3) : null,
    custoMateriaPrima: arredondar(custoMateriaPrima),
    custoIndustrial: arredondar(custoIndustrial),
    custoComercialAdministrativo: arredondar(custoComercialAdministrativo),
    custoTotalConhecido: arredondar(custoTotalConhecido),
    custoTotal,
    custoConhecidoPorM3: volumeVendidoM3 > 0 ? arredondar(custoTotalConhecido / volumeVendidoM3) : null,
    custoTotalPorM3: custoTotal !== null && volumeVendidoM3 > 0 ? arredondar(custoTotal / volumeVendidoM3) : null,
    margemConhecida: arredondar(receitaLiquidaMadeira - custoTotalConhecido),
    margem: custoTotal === null ? null : arredondar(receitaLiquidaMadeira - custoTotal),
    margemPorM3: custoTotal !== null && volumeVendidoM3 > 0 ? arredondar((receitaLiquidaMadeira - custoTotal) / volumeVendidoM3) : null,
    situacaoCobertura,
    problemas: Array.from(problemas),
    coberturaMateriaPrimaPercentual: volumeVendidoM3 > 0 ? arredondar((volumeComCustoMateriaPrimaM3 / volumeVendidoM3) * 100) : 0,
    coberturaIndustrialPercentual: volumeVendidoM3 > 0 ? arredondar((volumeComCustoIndustrialM3 / volumeVendidoM3) * 100) : 0,
    lotes,
  };
}
