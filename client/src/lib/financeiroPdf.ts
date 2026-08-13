import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatCurrency } from "@/lib/utils";

export type TituloFinanceiroParaPdf = {
  descricao: string;
  contraparteNome?: string | null;
  dataVencimento: Date | string;
  valorOriginal: string | number;
  desconto?: string | number | null;
  juros?: string | number | null;
  estado: string;
};

export type FiltrosFinanceirosParaPdf = {
  descricao: string;
  valorMinimo: string;
  valorMaximo: string;
  dataInicio: string;
  dataFim: string;
};

const estadoPdf: Record<string, string> = {
  aberto: "Aberto",
  parcial: "Parcial",
  quitado: "Quitado",
  vencido: "Vencido",
  cancelado: "Cancelado",
};

function valorTotal(titulo: TituloFinanceiroParaPdf): number {
  return Number(titulo.valorOriginal || 0) - Number(titulo.desconto || 0) + Number(titulo.juros || 0);
}

function formatarData(data: Date | string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(data));
}

function resumirFiltros(filtros: FiltrosFinanceirosParaPdf): string[] {
  const itens: string[] = [];
  if (filtros.descricao.trim()) itens.push(`Pesquisa: ${filtros.descricao.trim()}`);
  if (filtros.valorMinimo) itens.push(`Valor mínimo: R$ ${filtros.valorMinimo}`);
  if (filtros.valorMaximo) itens.push(`Valor máximo: R$ ${filtros.valorMaximo}`);
  if (filtros.dataInicio) itens.push(`A partir de: ${formatarData(filtros.dataInicio)}`);
  if (filtros.dataFim) itens.push(`Até: ${formatarData(filtros.dataFim)}`);
  return itens.length ? itens : ["Sem filtros adicionais"];
}

export function prepararRelatorioFinanceiroPdf(input: {
  titulo: string;
  filtros: FiltrosFinanceirosParaPdf;
  titulos: TituloFinanceiroParaPdf[];
}) {
  return {
    titulo: input.titulo,
    filtros: resumirFiltros(input.filtros),
    total: input.titulos.reduce((total, titulo) => total + valorTotal(titulo), 0),
    linhas: input.titulos.map((titulo) => ({
      descricao: titulo.descricao,
      contraparte: titulo.contraparteNome || "—",
      vencimento: formatarData(titulo.dataVencimento),
      valor: formatCurrency(valorTotal(titulo)),
      estado: estadoPdf[titulo.estado] ?? titulo.estado,
    })),
  };
}

/** Gera e descarrega a relação exatamente como filtrada na tela financeira. */
export async function exportarListaFinanceiraPdf(input: {
  titulo: string;
  filtros: FiltrosFinanceirosParaPdf;
  titulos: TituloFinanceiroParaPdf[];
}) {
  const relatorio = prepararRelatorioFinanceiroPdf(input);
  const documento = await PDFDocument.create();
  const fonte = await documento.embedFont(StandardFonts.Helvetica);
  const fonteNegrito = await documento.embedFont(StandardFonts.HelveticaBold);
  let pagina = documento.addPage([842, 595]);
  const margem = 36;
  const larguraUtil = pagina.getWidth() - (margem * 2);
  const colunas = [250, 150, 105, 115, 100];
  let y = pagina.getHeight() - 42;

  const escrever = (texto: string, x: number, linhaY: number, tamanho = 8, negrito = false, cor = rgb(0.12, 0.16, 0.2)) => {
    pagina.drawText(texto, { x, y: linhaY, size: tamanho, font: negrito ? fonteNegrito : fonte, color: cor });
  };
  const truncar = (texto: string, limite: number, tamanho = 8) => {
    if (fonte.widthOfTextAtSize(texto, tamanho) <= limite) return texto;
    let resultado = texto;
    while (resultado.length > 1 && fonte.widthOfTextAtSize(`${resultado}…`, tamanho) > limite) resultado = resultado.slice(0, -1);
    return `${resultado}…`;
  };
  const novaPagina = () => {
    pagina = documento.addPage([842, 595]);
    y = pagina.getHeight() - 42;
  };

  escrever("FK MADEIRAS", margem, y, 16, true, rgb(0.08, 0.28, 0.2));
  escrever(relatorio.titulo, margem, y - 22, 11, true);
  escrever(`Emitido em ${new Intl.DateTimeFormat("pt-BR").format(new Date())}`, margem, y - 36, 8, false, rgb(0.35, 0.4, 0.45));
  y -= 56;
  escrever(`Filtros: ${relatorio.filtros.join(" · ")}`, margem, y, 8, false, rgb(0.35, 0.4, 0.45));
  y -= 18;

  const desenharCabecalho = () => {
    pagina.drawRectangle({ x: margem, y: y - 14, width: larguraUtil, height: 19, color: rgb(0.08, 0.28, 0.2) });
    ["Descrição", "Contraparte", "Vencimento", "Valor", "Estado"].forEach((cabecalho, indice) => {
      const x = margem + colunas.slice(0, indice).reduce((soma, largura) => soma + largura, 0) + 5;
      escrever(cabecalho, x, y - 7, 8, true, rgb(1, 1, 1));
    });
    y -= 24;
  };
  desenharCabecalho();

  for (let indice = 0; indice < relatorio.linhas.length; indice += 1) {
    const linha = relatorio.linhas[indice];
    if (y < 58) {
      novaPagina();
      desenharCabecalho();
    }
    if (indice % 2 === 0) pagina.drawRectangle({ x: margem, y: y - 11, width: larguraUtil, height: 17, color: rgb(0.96, 0.97, 0.96) });
    const valores = [linha.descricao, linha.contraparte, linha.vencimento, linha.valor, linha.estado];
    valores.forEach((valor, coluna) => {
      const x = margem + colunas.slice(0, coluna).reduce((soma, largura) => soma + largura, 0) + 5;
      escrever(truncar(valor, colunas[coluna] - 10), x, y - 1);
    });
    y -= 17;
  }

  if (y < 54) novaPagina();
  pagina.drawLine({ start: { x: margem, y: y - 2 }, end: { x: margem + larguraUtil, y: y - 2 }, thickness: 0.6, color: rgb(0.7, 0.74, 0.72) });
  escrever(`Total de ${relatorio.linhas.length} título(s)`, margem, y - 16, 9, true);
  const total = `Total: ${formatCurrency(relatorio.total)}`;
  escrever(total, margem + larguraUtil - fonteNegrito.widthOfTextAtSize(total, 10), y - 16, 10, true, rgb(0.08, 0.28, 0.2));

  const bytes = await documento.save();
  const dadosPdf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const url = URL.createObjectURL(new Blob([dadosPdf], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${input.titulo.toLocaleLowerCase("pt-BR").replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/(^-|-$)/g, "")}-${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
