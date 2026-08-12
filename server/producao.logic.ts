export type ItemProducaoEntrada = {
  madeiraNome: string;
  espessura: string | number;
  largura: string | number;
  comprimento: string | number;
  quantidade: number;
};

export type PlaquetaParaConfirmacao = {
  id?: number;
  codigo: string;
  estado: "disponivel" | "consumida" | "cancelada";
  volumeDisponivel: string | number;
  madeiraNome?: string;
  diametro?: string | number | null;
  comprimento?: string | number | null;
};

export type ToraParaRomaneio = {
  madeiraNome: string;
  diametro?: string | number | null;
  espessura?: string | number | null;
  largura?: string | number | null;
  comprimento?: string | number | null;
  volume: string | number;
};

function numero(valor: string | number): number {
  const convertido = typeof valor === "string" ? Number(valor.replace(",", ".")) : valor;
  return Number.isFinite(convertido) ? convertido : 0;
}

export function calcularVolumeToraCilindrica(diametroCm: string | number, comprimentoM: string | number): number {
  const diametro = numero(diametroCm);
  const comprimento = numero(comprimentoM);
  if (diametro <= 0 || comprimento <= 0) {
    throw new Error("Informe diâmetro e comprimento positivos para a tora");
  }
  const raioEmMetros = (diametro / 100) / 2;
  return Math.PI * raioEmMetros ** 2 * comprimento;
}

export function calcularValorTora(volume: string | number, valorMetroCubico: string | number): number {
  const volumeNumerico = numero(volume);
  const preco = numero(valorMetroCubico);
  if (volumeNumerico < 0 || preco < 0) throw new Error("Volume e valor por m³ não podem ser negativos");
  return Number((volumeNumerico * preco).toFixed(2));
}

export function normalizarCodigoPlaqueta(codigo: string): string {
  return codigo.trim().toLocaleUpperCase("pt-BR").replace(/\s+/g, "-");
}

export function calcularItemRomaneio(item: ItemProducaoEntrada) {
  const espessura = numero(item.espessura);
  const largura = numero(item.largura);
  const comprimento = numero(item.comprimento);
  const quantidade = Number(item.quantidade);
  if (!item.madeiraNome.trim()) throw new Error("Informe a madeira produzida");
  if (espessura <= 0 || largura <= 0 || comprimento <= 0 || !Number.isInteger(quantidade) || quantidade <= 0) {
    throw new Error("Informe dimensões positivas e uma quantidade inteira para cada item produzido");
  }
  const metrosLineares = comprimento * quantidade;
  const volume = (espessura * largura * metrosLineares) / 10_000;
  return {
    madeiraNome: item.madeiraNome.trim(),
    espessura,
    largura,
    comprimento,
    quantidade,
    metrosLineares: Number(metrosLineares.toFixed(4)),
    volume: Number(volume.toFixed(6)),
  };
}

export function validarConfirmacaoRomaneio(input: {
  plaqueta?: PlaquetaParaConfirmacao | null | undefined;
  tora?: ToraParaRomaneio;
  toras?: Array<{ plaqueta: PlaquetaParaConfirmacao | null | undefined; tora: ToraParaRomaneio }>;
  itens: ItemProducaoEntrada[];
  permitirPlaquetasConsumidas?: boolean;
}) {
  const entradasToras = input.toras ?? (input.plaqueta && input.tora ? [{ plaqueta: input.plaqueta, tora: input.tora }] : []);
  if (!entradasToras.length) throw new Error("Selecione ao menos uma plaqueta para o romaneio");
  if (!input.itens.length) throw new Error("Adicione ao menos uma peça produzida ao romaneio");
  const codigos = new Set<string>();
  const toras = entradasToras.map(({ plaqueta, tora }) => {
    if (!plaqueta) throw new Error("Selecione uma plaqueta para o romaneio");
    if (!input.permitirPlaquetasConsumidas && plaqueta.estado !== "disponivel") throw new Error(`A plaqueta ${plaqueta.codigo} não está disponível para produção`);
    const codigo = normalizarCodigoPlaqueta(plaqueta.codigo);
    if (codigos.has(codigo)) throw new Error(`A plaqueta ${plaqueta.codigo} foi selecionada mais de uma vez`);
    codigos.add(codigo);
    const volume = numero(tora.volume);
    const volumeDisponivel = numero(plaqueta.volumeDisponivel);
    if (!tora.madeiraNome?.trim() || volume <= 0) throw new Error("Informe a essência e o volume válido de cada tora para o romaneio");
    if (!input.permitirPlaquetasConsumidas && volume > volumeDisponivel + 0.000001) {
      throw new Error(`O volume informado para a plaqueta ${plaqueta.codigo} excede o volume disponível em estoque`);
    }
    return { plaqueta, tora, volume: Number(volume.toFixed(6)) };
  });
  const itens = input.itens.map(calcularItemRomaneio);
  const volumeProduzido = itens.reduce((total, item) => total + item.volume, 0);
  const volumeTora = toras.reduce((total, entrada) => total + entrada.volume, 0);
  if (volumeProduzido > volumeTora + 0.000001) {
    throw new Error(`O volume produzido (${volumeProduzido.toFixed(6)} m³) excede o volume total das toras (${volumeTora.toFixed(6)} m³)`);
  }
  return {
    toras,
    totalToras: toras.length,
    itens,
    totalPecas: itens.reduce((total, item) => total + item.quantidade, 0),
    metrosLineares: Number(itens.reduce((total, item) => total + item.metrosLineares, 0).toFixed(4)),
    volumeProduzido: Number(volumeProduzido.toFixed(6)),
    volumeTora: Number(volumeTora.toFixed(6)),
    volumeRemanescente: Number((volumeTora - volumeProduzido).toFixed(6)),
    aproveitamento: Number(((volumeProduzido / volumeTora) * 100).toFixed(2)),
  };
}

export function agruparEstoquePecas(lotes: Array<{
  madeiraNome: string;
  espessura: string | number;
  largura: string | number;
  comprimento: string | number;
  quantidadeDisponivel: number;
  volume: string | number;
}>) {
  const grupos = new Map<string, { madeiraNome: string; espessura: number; largura: number; comprimento: number; quantidadeDisponivel: number; volumeDisponivel: number }>();
  lotes.forEach((lote) => {
    const espessura = numero(lote.espessura);
    const largura = numero(lote.largura);
    const comprimento = numero(lote.comprimento);
    const chave = [lote.madeiraNome.trim().toLocaleUpperCase("pt-BR"), espessura, largura, comprimento].join("|");
    const existente = grupos.get(chave) ?? { madeiraNome: lote.madeiraNome, espessura, largura, comprimento, quantidadeDisponivel: 0, volumeDisponivel: 0 };
    existente.quantidadeDisponivel += lote.quantidadeDisponivel;
    const volumeUnitario = numero(lote.volume) / Math.max(lote.quantidadeDisponivel, 1);
    existente.volumeDisponivel += volumeUnitario * lote.quantidadeDisponivel;
    grupos.set(chave, existente);
  });
  return Array.from(grupos.values()).map((grupo) => ({ ...grupo, volumeDisponivel: Number(grupo.volumeDisponivel.toFixed(6)) }));
}

export type ItemVendaParaEntrega = {
  id: number;
  madeiraNome: string;
  espessura: string | number;
  largura: string | number;
  comprimento: string | number;
  quantidade: number;
};

export type LoteParaEntrega = {
  id: number;
  madeiraNome: string;
  espessura: string | number;
  largura: string | number;
  comprimento: string | number;
  quantidadeDisponivel: number;
  createdAt?: Date;
};

function chaveDimensao(item: Pick<ItemVendaParaEntrega, "madeiraNome" | "espessura" | "largura" | "comprimento">): string {
  return [
    item.madeiraNome.trim().toLocaleUpperCase("pt-BR"),
    numero(item.espessura).toFixed(2),
    numero(item.largura).toFixed(2),
    numero(item.comprimento).toFixed(2),
  ].join("|");
}

export function alocarPecasParaEntrega(itens: ItemVendaParaEntrega[], lotes: LoteParaEntrega[]) {
  const lotesPorDimensao = new Map<string, LoteParaEntrega[]>();
  [...lotes]
    .filter((lote) => lote.quantidadeDisponivel > 0)
    .sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0) || a.id - b.id)
    .forEach((lote) => {
      const chave = chaveDimensao(lote);
      const disponiveis = lotesPorDimensao.get(chave) ?? [];
      disponiveis.push(lote);
      lotesPorDimensao.set(chave, disponiveis);
    });

  const consumoLocal = new Map<number, number>();
  const alocacoes: Array<{ itemVendaId: number; loteId: number; quantidade: number }> = [];
  for (const item of itens) {
    if (!Number.isInteger(item.quantidade) || item.quantidade <= 0) throw new Error("A quantidade do item de venda precisa ser um número inteiro positivo");
    let restante = item.quantidade;
    const disponiveis = lotesPorDimensao.get(chaveDimensao(item)) ?? [];
    for (const lote of disponiveis) {
      const jaConsumido = consumoLocal.get(lote.id) ?? 0;
      const saldo = Math.max(0, lote.quantidadeDisponivel - jaConsumido);
      if (!saldo) continue;
      const quantidade = Math.min(restante, saldo);
      alocacoes.push({ itemVendaId: item.id, loteId: lote.id, quantidade });
      consumoLocal.set(lote.id, jaConsumido + quantidade);
      restante -= quantidade;
      if (!restante) break;
    }
    if (restante) {
      const descricao = `${item.madeiraNome} ${numero(item.espessura)}×${numero(item.largura)}×${numero(item.comprimento)} m`;
      throw new Error(`Estoque insuficiente para entregar ${item.quantidade} peça(s) de ${descricao}`);
    }
  }
  return alocacoes;
}
