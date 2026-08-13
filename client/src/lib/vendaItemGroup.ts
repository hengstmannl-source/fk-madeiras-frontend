import {
  calculatePrecoLinear,
  calculateValorPeca,
  calculateValorTotal,
  centimetersToMillimeters,
  formatDimensionCm,
  parseDecimalInput,
} from "@/lib/utils";

export type LinhaComprimentoVenda = {
  id: number;
  comprimento: string;
  quantidade: string;
};

export type ItemVendaCalculado = {
  madeiraId: number | null;
  bitolaId: number | null;
  madeiraNome: string;
  bitolaDescricao: string;
  espessura: string;
  largura: string;
  comprimento: string;
  quantidade: number;
  precoM3: string;
  precoLinear: string;
  valorPeca: string;
  valorTotal: string;
};

export function criarLinhasComprimentoVazias(inicio = 1, quantidade = 4): LinhaComprimentoVenda[] {
  return Array.from({ length: quantidade }, (_, indice) => ({
    id: inicio + indice,
    comprimento: "",
    quantidade: "",
  }));
}

export function criarItensVendaPorMedida(input: {
  madeiraNome: string;
  precoM3: string;
  espessuraCm: string;
  larguraCm: string;
  linhas: LinhaComprimentoVenda[];
}): { itens: ItemVendaCalculado[]; erro?: string } {
  const madeiraNome = input.madeiraNome.trim();
  if (!madeiraNome) return { itens: [], erro: "Informe o nome da madeira" };

  const precoM3 = parseDecimalInput(input.precoM3);
  if (!Number.isFinite(precoM3) || precoM3 <= 0) return { itens: [], erro: "Informe um preço por m³ válido" };

  const espessuraCm = parseDecimalInput(input.espessuraCm);
  const larguraCm = parseDecimalInput(input.larguraCm);
  if (!Number.isFinite(espessuraCm) || espessuraCm <= 0 || !Number.isFinite(larguraCm) || larguraCm <= 0) {
    return { itens: [], erro: "Introduza bitola e largura válidas em centímetros" };
  }

  const linhasPreenchidas = input.linhas.filter((linha) => linha.comprimento.trim() || linha.quantidade.trim());
  if (!linhasPreenchidas.length) return { itens: [], erro: "Informe ao menos um comprimento e a respetiva quantidade" };

  const linhasInvalidas = linhasPreenchidas.some((linha) => {
    const comprimento = parseDecimalInput(linha.comprimento);
    const quantidade = Number.parseInt(linha.quantidade, 10);
    return !Number.isFinite(comprimento) || comprimento <= 0 || !Number.isInteger(quantidade) || quantidade <= 0;
  });
  if (linhasInvalidas) return { itens: [], erro: "Revise os comprimentos e as quantidades preenchidas" };

  // As vendas permanecem em milímetros para manter a compatibilidade com os registros e a entrega física existente.
  const espessura = centimetersToMillimeters(espessuraCm);
  const largura = centimetersToMillimeters(larguraCm);
  const precoLinear = calculatePrecoLinear(espessura, largura, precoM3);

  return {
    itens: linhasPreenchidas.map((linha) => {
      const comprimento = parseDecimalInput(linha.comprimento);
      const quantidade = Number.parseInt(linha.quantidade, 10);
      const valorPeca = calculateValorPeca(precoLinear, comprimento);
      const valorTotal = calculateValorTotal(valorPeca, quantidade);
      return {
        madeiraId: null,
        bitolaId: null,
        madeiraNome,
        bitolaDescricao: `${formatDimensionCm(espessura)}×${formatDimensionCm(largura)} cm`,
        espessura: String(espessura),
        largura: String(largura),
        comprimento: String(comprimento),
        quantidade,
        precoM3: String(precoM3),
        precoLinear: String(parseFloat(precoLinear.toFixed(4))),
        valorPeca: String(parseFloat(valorPeca.toFixed(2))),
        valorTotal: String(parseFloat(valorTotal.toFixed(2))),
      };
    }),
  };
}
