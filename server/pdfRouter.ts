import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { getEmpresaConfiguracao, getOrcamentoWithItems, getRomaneioCargaComPlaquetas, getRomaneioProducaoComItens, listClientes } from "./db";
import { storageGetSignedUrl } from "./storage";
import { sdk } from "./_core/sdk";
import { etiquetaPlaqueta } from "../shared/plaquetas";
import { calcularAproveitamentoPorEssencia } from "../shared/aproveitamentoPorEssencia";

const A4: [number, number] = [595, 842];
const MARGEM_LATERAL = 48;
const LIMITE_INFERIOR_CONTEUDO = 66;
const COR_MARROM = rgb(0.22, 0.16, 0.08);
const COR_TEXTO_SECUNDARIO = rgb(0.35, 0.35, 0.35);
const COR_CINZA_CLARO = rgb(0.55, 0.55, 0.55);
const COR_LINHA = rgb(0.72, 0.67, 0.58);

function formatBRL(value: string | number | null | undefined): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0,00";
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
}

function formatDimensionCm(valueInMillimeters: string | number | null | undefined): string {
  const num = Number(valueInMillimeters);
  if (!Number.isFinite(num)) return "0";
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(num / 10);
}

function formatMeasurement(value: string | number | null | undefined): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0";
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 3 }).format(num);
}

function formatDate(value: Date | string | null | undefined, utc = false): string {
  if (!value) return "Não informada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Não informada";
  return date.toLocaleDateString("pt-BR", utc ? { timeZone: "UTC" } : undefined);
}

function formatFormaPagamento(formaPagamento?: string | null): string {
  const formas: Record<string, string> = {
    pix: "PIX",
    dinheiro: "Dinheiro",
    cartao_credito: "Cartão de crédito",
    cartao_debito: "Cartão de débito",
    transferencia: "Transferência bancária",
    boleto: "Boleto",
    outro: "Outro",
  };
  return formas[formaPagamento ?? ""] ?? "Não informada";
}

function normalizarTexto(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function larguraTexto(font: any, texto: string, tamanho: number): number {
  if (typeof font?.widthOfTextAtSize === "function") return font.widthOfTextAtSize(texto, tamanho);
  return texto.length * tamanho * 0.52;
}

/** Encurta conteúdo de célula antes de desenhá-lo, evitando invadir a coluna seguinte. */
function truncarTexto(font: any, texto: unknown, larguraMaxima: number, tamanho: number): string {
  const original = normalizarTexto(texto) || "—";
  if (larguraTexto(font, original, tamanho) <= larguraMaxima) return original;

  let resultado = original;
  while (resultado.length > 1 && larguraTexto(font, `${resultado}…`, tamanho) > larguraMaxima) resultado = resultado.slice(0, -1);
  return resultado.length ? `${resultado}…` : "…";
}

function quebrarTexto(font: any, texto: unknown, larguraMaxima: number, tamanho: number): string[] {
  const conteudo = normalizarTexto(texto);
  if (!conteudo) return [];
  const palavras = conteudo.split(" ");
  const linhas: string[] = [];
  let linha = "";

  const adicionarPalavraLonga = (palavra: string) => {
    let restante = palavra;
    while (restante && larguraTexto(font, restante, tamanho) > larguraMaxima) {
      let limite = restante.length - 1;
      while (limite > 1 && larguraTexto(font, `${restante.slice(0, limite)}-`, tamanho) > larguraMaxima) limite -= 1;
      linhas.push(`${restante.slice(0, limite)}-`);
      restante = restante.slice(limite);
    }
    return restante;
  };

  for (const palavraOriginal of palavras) {
    const palavra = adicionarPalavraLonga(palavraOriginal);
    const candidata = linha ? `${linha} ${palavra}` : palavra;
    if (linha && larguraTexto(font, candidata, tamanho) > larguraMaxima) {
      linhas.push(linha);
      linha = palavra;
    } else {
      linha = candidata;
    }
  }
  if (linha) linhas.push(linha);
  return linhas;
}

function desenharTextoAjustado(page: any, font: any, texto: unknown, x: number, y: number, larguraMaxima: number, tamanho: number, opcoes: Record<string, unknown> = {}) {
  page.drawText(truncarTexto(font, texto, larguraMaxima, tamanho), { x, y, size: tamanho, font, ...opcoes });
}

async function requirePdfAuthentication(req: any, res: any) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (user) return true;
  } catch {
    // O mesmo retorno é usado para sessão ausente ou inválida.
  }
  res.status(401).json({ error: "Autenticação necessária para aceder a este documento" });
  return false;
}

async function loadCompanyLogo(pdfDoc: PDFDocument, empresaId = 1) {
  const configuracao = await getEmpresaConfiguracao(empresaId);
  if (!configuracao?.logoKey || !configuracao.logoMimeType) return undefined;

  try {
    const signedUrl = await storageGetSignedUrl(configuracao.logoKey);
    const response = await fetch(signedUrl);
    if (!response.ok) throw new Error(`Falha ao obter logótipo (${response.status})`);
    const image = await response.arrayBuffer();
    return configuracao.logoMimeType === "image/png"
      ? await pdfDoc.embedPng(image)
      : await pdfDoc.embedJpg(image);
  } catch (error) {
    console.warn("[PDF] Não foi possível incluir o logótipo da empresa:", error);
    return undefined;
  }
}

type LayoutPdf = ReturnType<typeof criarLayoutPdf>;

/**
 * Mantém uma área de conteúdo segura: cada página recebe cabeçalho e rodapé
 * próprios, e nenhum bloco é desenhado dentro da área reservada do rodapé.
 */
function criarLayoutPdf(pdfDoc: any, font: any, boldFont: any, logo: any, tituloDocumento: string) {
  const largura = A4[0];
  const altura = A4[1];
  const logoDimensoes = logo?.scaleToFit?.(108, 50);
  let page: any;
  let y = 0;

  const rodape = () => {
    const numeroPagina = typeof pdfDoc.getPageCount === "function" ? pdfDoc.getPageCount() : 1;
    page.drawLine({
      start: { x: MARGEM_LATERAL, y: 50 },
      end: { x: largura - MARGEM_LATERAL, y: 50 },
      thickness: 0.45,
      color: rgb(0.86, 0.84, 0.79),
    });
    page.drawText("FK Madeiras — Documento gerado eletronicamente", { x: MARGEM_LATERAL, y: 35, size: 7.5, font, color: COR_CINZA_CLARO });
    const pagina = `Página ${numeroPagina}`;
    page.drawText(pagina, { x: largura - MARGEM_LATERAL - larguraTexto(font, pagina, 7.5), y: 35, size: 7.5, font, color: COR_CINZA_CLARO });
  };

  const cabecalho = (continuacao: boolean) => {
    if (logoDimensoes) {
      page.drawImage(logo, {
        x: MARGEM_LATERAL,
        y: altura - 50 - logoDimensoes.height,
        width: logoDimensoes.width,
        height: logoDimensoes.height,
      });
    }
    const xTitulo = logoDimensoes ? MARGEM_LATERAL + logoDimensoes.width + 14 : MARGEM_LATERAL;
    page.drawText("FK MADEIRAS", { x: xTitulo, y: altura - 55, size: 21, font: boldFont, color: COR_MARROM });
    desenharTextoAjustado(
      page,
      font,
      continuacao ? `${tituloDocumento} — continuação` : tituloDocumento,
      xTitulo,
      altura - 72,
      largura - xTitulo - MARGEM_LATERAL,
      9.5,
      { color: rgb(0.4, 0.4, 0.4) },
    );
  };

  const novaPagina = (continuacao = true) => {
    page = pdfDoc.addPage(A4);
    cabecalho(continuacao);
    rodape();
    y = altura - 110;
  };

  const garantirEspaco = (alturaNecessaria: number) => {
    if (y - alturaNecessaria < LIMITE_INFERIOR_CONTEUDO) novaPagina(true);
  };

  const escreverParagrafo = (texto: unknown, x: number, larguraMaxima: number, tamanho = 8.5, opcoes: Record<string, unknown> = {}, alturaLinha = tamanho + 4) => {
    const linhas = quebrarTexto(font, texto, larguraMaxima, tamanho);
    for (const linha of linhas) {
      garantirEspaco(alturaLinha);
      page.drawText(linha, { x, y, size: tamanho, font, ...opcoes });
      y -= alturaLinha;
    }
    return linhas.length;
  };

  novaPagina(false);
  return {
    get page() { return page; },
    get y() { return y; },
    get width() { return largura; },
    get height() { return altura; },
    get bottom() { return LIMITE_INFERIOR_CONTEUDO; },
    setY: (novoY: number) => { y = novoY; },
    mover: (distancia: number) => { y -= distancia; },
    garantirEspaco,
    temEspaco: (alturaNecessaria: number) => y - alturaNecessaria >= LIMITE_INFERIOR_CONTEUDO,
    novaPagina,
    escreverParagrafo,
  };
}

export async function registerPdfRoutes(app: any) {
  app.get("/api/pdf/orcamento/:id", async (req: any, res: any) => {
    try {
      if (!(await requirePdfAuthentication(req, res))) return;
      const id = parseInt(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ error: "ID inválido" });

      const data = await getOrcamentoWithItems(id);
      if (!data) return res.status(404).json({ error: "Orçamento não encontrado" });

      const clientes = await listClientes();
      const cliente = clientes.find((item: any) => item.id === data.orcamento.clienteId);
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const logo = await loadCompanyLogo(pdfDoc);
      const layout = criarLayoutPdf(pdfDoc, font, boldFont, logo, "Venda");
      const { width } = layout;

      layout.garantirEspaco(80);
      layout.page.drawRectangle({ x: MARGEM_LATERAL, y: layout.y - 50, width: width - (MARGEM_LATERAL * 2), height: 62, color: rgb(0.95, 0.93, 0.89) });
      layout.page.drawText(`VENDA ${data.orcamento.numero ?? "EM ANÁLISE"}`, { x: 62, y: layout.y - 7, size: 16, font: boldFont, color: COR_MARROM });
      layout.page.drawText(`Emissão: ${formatDate(data.orcamento.createdAt)}`, { x: 62, y: layout.y - 27, size: 9, font, color: COR_TEXTO_SECUNDARIO });
      const estado = `Estado: ${normalizarTexto(data.orcamento.estado) || "Não informado"}`;
      layout.page.drawText(estado, { x: width - 62 - larguraTexto(font, estado, 9), y: layout.y - 18, size: 9, font, color: COR_TEXTO_SECUNDARIO });
      layout.mover(78);

      if (cliente) {
        const camposCliente = [
          ["Nome", cliente.nome],
          ["Contacto", cliente.contacto],
          ["E-mail", cliente.email],
          ["Morada", cliente.morada],
          ["NIF", cliente.nif],
        ].filter(([, valor]) => Boolean(normalizarTexto(valor)));
        layout.garantirEspaco(28);
        layout.page.drawText("DADOS DO CLIENTE", { x: MARGEM_LATERAL, y: layout.y, size: 10, font: boldFont, color: COR_MARROM });
        layout.mover(17);
        for (const [rotulo, valor] of camposCliente) layout.escreverParagrafo(`${rotulo}: ${valor}`, MARGEM_LATERAL, width - (MARGEM_LATERAL * 2), 9, { color: COR_TEXTO_SECUNDARIO }, 13);
        layout.mover(10);
      }

      const colunas = [111, 100, 34, 66, 66, 66, 68];
      const labels = ["Madeira", "Dimensões", "Qtd.", "Preço/m³", "Preço/m.l.", "Valor/peça", "Total"];
      const desenharTabela = (continuacao = false) => {
        layout.garantirEspaco(42);
        layout.page.drawText(continuacao ? "ITENS DA VENDA — CONTINUAÇÃO" : "ITENS DA VENDA", { x: MARGEM_LATERAL, y: layout.y, size: 10, font: boldFont, color: COR_MARROM });
        layout.mover(17);
        let x = MARGEM_LATERAL;
        labels.forEach((label, indice) => {
          desenharTextoAjustado(layout.page, boldFont, label, x, layout.y, colunas[indice] - 4, 7.5, { color: rgb(0.42, 0.42, 0.42) });
          x += colunas[indice];
        });
        layout.mover(15);
      };
      desenharTabela();

      for (const item of data.itens ?? []) {
        if (!layout.temEspaco(16)) {
          layout.novaPagina(true);
          desenharTabela(true);
        }
        const valores = [
          item.madeiraNome,
          `${formatDimensionCm(item.espessura)} × ${formatDimensionCm(item.largura)} cm × ${formatMeasurement(item.comprimento)} m`,
          String(item.quantidade),
          `R$ ${formatBRL(item.precoM3)}`,
          `R$ ${formatBRL(item.precoLinear)}`,
          `R$ ${formatBRL(item.valorPeca)}`,
          `R$ ${formatBRL(item.valorTotal)}`,
        ];
        let x = MARGEM_LATERAL;
        valores.forEach((valor, indice) => {
          desenharTextoAjustado(layout.page, indice === valores.length - 1 ? boldFont : font, valor, x, layout.y, colunas[indice] - 4, 7.5);
          x += colunas[indice];
        });
        layout.mover(16);
      }

      layout.garantirEspaco(126);
      layout.page.drawLine({ start: { x: MARGEM_LATERAL, y: layout.y }, end: { x: width - MARGEM_LATERAL, y: layout.y }, thickness: 0.8, color: COR_LINHA });
      layout.mover(19);
      layout.page.drawText("RESUMO", { x: MARGEM_LATERAL, y: layout.y, size: 10, font: boldFont, color: COR_MARROM });
      layout.mover(18);
      const resumo = [
        [`Subtotal: R$ ${formatBRL(data.orcamento.subtotal)}`, font, undefined],
        [`Desconto: -R$ ${formatBRL(data.orcamento.desconto)}`, font, rgb(0.7, 0.2, 0.2)],
        [`Frete: +R$ ${formatBRL(data.orcamento.frete)}`, font, undefined],
        [`Total: R$ ${formatBRL(data.orcamento.total)}`, boldFont, COR_MARROM],
      ] as const;
      resumo.forEach(([texto, fonte, cor], indice) => {
        layout.page.drawText(texto, { x: MARGEM_LATERAL, y: layout.y, size: indice === 3 ? 13 : 9.5, font: fonte, ...(cor ? { color: cor } : {}) });
        layout.mover(indice === 3 ? 18 : 14);
      });
      layout.page.drawText(`Total de peças: ${data.orcamento.totalPecas}`, { x: MARGEM_LATERAL, y: layout.y, size: 8.5, font, color: COR_CINZA_CLARO });
      layout.mover(12);
      layout.page.drawText(`Total em metros lineares: ${formatMeasurement(data.orcamento.totalMetroLinear)} m`, { x: MARGEM_LATERAL, y: layout.y, size: 8.5, font, color: COR_CINZA_CLARO });
      layout.mover(12);
      layout.page.drawText(`Volume total: ${formatMeasurement(data.orcamento.totalVolume)} m³`, { x: MARGEM_LATERAL, y: layout.y, size: 8.5, font, color: COR_CINZA_CLARO });

      if (normalizarTexto(data.orcamento.observacoes)) {
        layout.mover(18);
        layout.garantirEspaco(26);
        layout.page.drawText("OBSERVAÇÕES", { x: MARGEM_LATERAL, y: layout.y, size: 9, font: boldFont, color: COR_MARROM });
        layout.mover(14);
        layout.escreverParagrafo(data.orcamento.observacoes, MARGEM_LATERAL, width - (MARGEM_LATERAL * 2), 8.5, { color: COR_TEXTO_SECUNDARIO }, 12);
      }

      const pdfBytes = await pdfDoc.save();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="venda-${data.orcamento.numero ?? data.orcamento.id}.pdf"`);
      res.send(Buffer.from(pdfBytes));
    } catch (err: any) {
      console.error("PDF generation error:", err);
      res.status(500).json({ error: "Erro ao gerar PDF" });
    }
  });

  app.get("/api/pdf/recibo/:id", async (req: any, res: any) => {
    try {
      if (!(await requirePdfAuthentication(req, res))) return;
      const id = parseInt(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ error: "ID inválido" });

      const data = await getOrcamentoWithItems(id);
      if (!data) return res.status(404).json({ error: "Venda não encontrada" });
      if (!data.orcamento.pago || !data.orcamento.pagoEm) return res.status(400).json({ error: "O recibo só está disponível para vendas quitadas" });

      const clientes = await listClientes();
      const cliente = clientes.find((item: any) => item.id === data.orcamento.clienteId);
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const logo = await loadCompanyLogo(pdfDoc);
      const layout = criarLayoutPdf(pdfDoc, font, boldFont, logo, "Comprovante de quitação");
      const { width } = layout;
      const numeroVenda = data.orcamento.numero ?? data.orcamento.id;

      layout.garantirEspaco(90);
      layout.page.drawRectangle({ x: MARGEM_LATERAL, y: layout.y - 54, width: width - (MARGEM_LATERAL * 2), height: 64, color: rgb(0.95, 0.93, 0.89) });
      layout.page.drawText("RECIBO DE PAGAMENTO", { x: 64, y: layout.y - 4, size: 16, font: boldFont, color: COR_MARROM });
      layout.page.drawText(`Referente à venda ${numeroVenda}`, { x: 64, y: layout.y - 24, size: 9.5, font, color: COR_TEXTO_SECUNDARIO });
      layout.page.drawText(`Recibo nº REC-${numeroVenda}`, { x: 64, y: layout.y - 42, size: 8.5, font, color: COR_CINZA_CLARO });
      layout.mover(92);

      const nomeCliente = normalizarTexto(cliente?.nome) || "Cliente";
      layout.page.drawText("DECLARAÇÃO DE QUITAÇÃO", { x: MARGEM_LATERAL, y: layout.y, size: 10, font: boldFont, color: COR_MARROM });
      layout.mover(20);
      layout.escreverParagrafo(`Recebemos de ${nomeCliente} o valor abaixo indicado, referente à venda mencionada.`, MARGEM_LATERAL, width - (MARGEM_LATERAL * 2), 10, {}, 15);
      layout.mover(24);
      layout.garantirEspaco(52);
      layout.page.drawText("VALOR RECEBIDO", { x: MARGEM_LATERAL, y: layout.y, size: 8.5, font: boldFont, color: COR_CINZA_CLARO });
      layout.mover(22);
      layout.page.drawText(`R$ ${formatBRL(data.orcamento.total)}`, { x: MARGEM_LATERAL, y: layout.y, size: 23, font: boldFont, color: rgb(0.15, 0.42, 0.26) });
      layout.mover(52);

      layout.garantirEspaco(126);
      layout.page.drawLine({ start: { x: MARGEM_LATERAL, y: layout.y }, end: { x: width - MARGEM_LATERAL, y: layout.y }, thickness: 0.7, color: rgb(0.82, 0.79, 0.73) });
      layout.mover(25);
      const dados = [
        ["Cliente", nomeCliente],
        ["Forma de pagamento", formatFormaPagamento(data.orcamento.formaPagamento)],
        ["Data de pagamento", formatDate(data.orcamento.pagoEm)],
      ];
      for (const [rotulo, valor] of dados) {
        layout.page.drawText(rotulo, { x: MARGEM_LATERAL, y: layout.y, size: 8.5, font: boldFont, color: COR_CINZA_CLARO });
        desenharTextoAjustado(layout.page, font, valor, 180, layout.y, width - 180 - MARGEM_LATERAL, 9.5);
        layout.mover(25);
      }
      layout.mover(28);
      layout.garantirEspaco(34);
      layout.page.drawLine({ start: { x: MARGEM_LATERAL, y: layout.y }, end: { x: 270, y: layout.y }, thickness: 0.7, color: rgb(0.5, 0.5, 0.5) });
      layout.mover(16);
      layout.page.drawText("FK Madeiras", { x: MARGEM_LATERAL, y: layout.y, size: 8.5, font, color: COR_CINZA_CLARO });

      const pdfBytes = await pdfDoc.save();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="recibo-${numeroVenda}.pdf"`);
      res.send(Buffer.from(pdfBytes));
    } catch (err: any) {
      console.error("Receipt PDF generation error:", err);
      res.status(500).json({ error: "Erro ao gerar recibo de pagamento" });
    }
  });

  app.get("/api/pdf/romaneio/:id", async (req: any, res: any) => {
    try {
      if (!(await requirePdfAuthentication(req, res))) return;
      const id = parseInt(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ error: "ID inválido" });
      const data = await getRomaneioProducaoComItens(id);
      if (!data) return res.status(404).json({ error: "Romaneio não encontrado" });

      const torasParaResumo = data.toras.length
        ? data.toras
        : [{ madeiraNome: data.romaneio.madeiraTora ?? "Não informada", volume: data.romaneio.volumeTora ?? "0" }];
      const aproveitamentosManuais = data.aproveitamentos ?? [];
      const volumeAproveitamento = Number(data.romaneio.volumeAproveitamento ?? aproveitamentosManuais.reduce((total: number, item: any) => total + Number(item.volume ?? 0), 0));
      const incluirAproveitamentoNoRendimento = Boolean(data.romaneio.incluirAproveitamentoNoRendimento);
      const resumoPorEssencia = calcularAproveitamentoPorEssencia(torasParaResumo, data.itens).map((resumo) => {
        const volumeAproveitamentoEssencia = aproveitamentosManuais
          .filter((item: any) => String(item.madeiraNome ?? "").localeCompare(resumo.essencia, "pt-BR", { sensitivity: "accent" }) === 0)
          .reduce((total: number, item: any) => total + Number(item.volume ?? 0), 0);
        const volumeParaRendimento = resumo.volumeProduzido + (incluirAproveitamentoNoRendimento ? volumeAproveitamentoEssencia : 0);
        const aproveitamento = resumo.volumeToras > 0 ? (volumeParaRendimento / resumo.volumeToras) * 100 : 0;
        return {
          ...resumo,
          volumeAproveitamento: Number(volumeAproveitamentoEssencia.toFixed(6)),
          aproveitamento: Number(aproveitamento.toFixed(2)),
          perdaVolume: Number((resumo.volumeToras - volumeParaRendimento).toFixed(6)),
          perdaPercentual: Number((100 - aproveitamento).toFixed(2)),
        };
      });

      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const logo = await loadCompanyLogo(pdfDoc);
      const layout = criarLayoutPdf(pdfDoc, font, boldFont, logo, "Romaneio de produção");
      const { width } = layout;
      const torasSerradas = data.toras.length
        ? data.toras
        : [{ codigo: data.romaneio.plaquetaCodigo ?? "Não informada", madeiraNome: data.romaneio.madeiraTora ?? "Não informada", diametro: null, comprimento: data.romaneio.comprimentoTora, volume: data.romaneio.volumeTora ?? "0" }];

      layout.garantirEspaco(80);
      layout.page.drawRectangle({ x: MARGEM_LATERAL, y: layout.y - 50, width: width - (MARGEM_LATERAL * 2), height: 62, color: rgb(0.95, 0.93, 0.89) });
      layout.page.drawText(normalizarTexto(data.romaneio.numero) || "ROMANEIO", { x: 62, y: layout.y - 7, size: 16, font: boldFont, color: COR_MARROM });
      layout.page.drawText(`Produção em ${formatDate(data.romaneio.dataProducao, true)}`, { x: 62, y: layout.y - 27, size: 9, font, color: COR_TEXTO_SECUNDARIO });
      const aproveitamentoTexto = `Aproveitamento: ${formatMeasurement(data.romaneio.aproveitamento)}%`;
      layout.page.drawText(aproveitamentoTexto, { x: width - 62 - larguraTexto(boldFont, aproveitamentoTexto, 10), y: layout.y - 16, size: 10, font: boldFont, color: rgb(0.12, 0.42, 0.25) });
      const regraRendimento = incluirAproveitamentoNoRendimento ? "Rendimento inclui aproveitamento" : "Rendimento considera apenas peças";
      layout.page.drawText(regraRendimento, { x: width - 62 - larguraTexto(font, regraRendimento, 7), y: layout.y - 30, size: 7, font, color: COR_TEXTO_SECUNDARIO });
      layout.mover(78);

      const desenharTituloToras = (continuacao = false) => {
        layout.garantirEspaco(32);
        layout.page.drawText(continuacao ? `TORAS SERRADAS (${torasSerradas.length}) — CONTINUAÇÃO` : `TORAS SERRADAS (${torasSerradas.length})`, { x: MARGEM_LATERAL, y: layout.y, size: 10, font: boldFont, color: COR_MARROM });
        layout.mover(18);
      };
      desenharTituloToras();
      for (const tora of torasSerradas) {
        const linhaIdentificacao = `Plaqueta: ${normalizarTexto(tora.codigo) || "Não informada"}   •   Essência: ${normalizarTexto(tora.madeiraNome) || "Não informada"}`;
        const linhaMedidas = `Diâmetro: ${formatMeasurement(tora.diametro)} cm   •   Comprimento: ${formatMeasurement(tora.comprimento)} m   •   Volume efetivo: ${formatMeasurement(tora.volume)} m³`;
        const alturaTora = (quebrarTexto(font, linhaIdentificacao, width - (MARGEM_LATERAL * 2), 8.5).length * 12) + (quebrarTexto(font, linhaMedidas, width - (MARGEM_LATERAL * 2), 8).length * 11) + 5;
        if (!layout.temEspaco(alturaTora)) {
          layout.novaPagina(true);
          desenharTituloToras(true);
        }
        layout.escreverParagrafo(linhaIdentificacao, MARGEM_LATERAL, width - (MARGEM_LATERAL * 2), 8.5, {}, 12);
        layout.escreverParagrafo(linhaMedidas, MARGEM_LATERAL, width - (MARGEM_LATERAL * 2), 8, { color: COR_TEXTO_SECUNDARIO }, 11);
        layout.mover(5);
      }

      layout.garantirEspaco(50);
      layout.page.drawLine({ start: { x: MARGEM_LATERAL, y: layout.y }, end: { x: width - MARGEM_LATERAL, y: layout.y }, thickness: 0.6, color: COR_LINHA });
      layout.mover(15);
      layout.escreverParagrafo(`Volume de toras: ${formatMeasurement(data.romaneio.volumeTora)} m³   •   Fita/Linha: ${normalizarTexto(data.romaneio.fita) || "Não informada"}   •   Responsável: ${normalizarTexto(data.romaneio.responsavel) || "Não informado"}`, MARGEM_LATERAL, width - (MARGEM_LATERAL * 2), 8.5, { color: COR_TEXTO_SECUNDARIO }, 12);
      layout.mover(12);

      const colunas = [135, 92, 54, 60, 75, 82];
      const labels = ["Essência", "Dimensões", "Comp.", "Peças", "M. linear", "Volume"];
      const desenharTabelaPecas = (continuacao = false) => {
        layout.garantirEspaco(42);
        layout.page.drawText(continuacao ? "PEÇAS PRODUZIDAS — CONTINUAÇÃO" : "PEÇAS PRODUZIDAS", { x: MARGEM_LATERAL, y: layout.y, size: 10, font: boldFont, color: COR_MARROM });
        layout.mover(17);
        let x = MARGEM_LATERAL;
        labels.forEach((label, indice) => {
          desenharTextoAjustado(layout.page, boldFont, label, x, layout.y, colunas[indice] - 4, 7.5, { color: rgb(0.42, 0.42, 0.42) });
          x += colunas[indice];
        });
        layout.mover(15);
      };
      desenharTabelaPecas();
      let totalPecas = 0;
      let totalMetros = 0;
      let totalVolume = 0;
      for (const item of data.itens ?? []) {
        if (!layout.temEspaco(16)) {
          layout.novaPagina(true);
          desenharTabelaPecas(true);
        }
        const valores = [
          item.madeiraNome,
          `${formatMeasurement(item.espessura)} × ${formatMeasurement(item.largura)} cm`,
          `${formatMeasurement(item.comprimento)} m`,
          String(item.quantidade),
          `${formatMeasurement(item.metrosLineares)} m`,
          `${formatMeasurement(item.volume)} m³`,
        ];
        let x = MARGEM_LATERAL;
        valores.forEach((valor, indice) => {
          desenharTextoAjustado(layout.page, indice === valores.length - 1 ? boldFont : font, valor, x, layout.y, colunas[indice] - 4, 7.5);
          x += colunas[indice];
        });
        totalPecas += Number(item.quantidade ?? 0);
        totalMetros += Number(item.metrosLineares ?? 0);
        totalVolume += Number(item.volume ?? 0);
        layout.mover(16);
      }

      layout.garantirEspaco(84);
      layout.page.drawLine({ start: { x: MARGEM_LATERAL, y: layout.y }, end: { x: width - MARGEM_LATERAL, y: layout.y }, thickness: 0.8, color: COR_LINHA });
      layout.mover(17);
      layout.page.drawText(`Total de peças: ${totalPecas}`, { x: MARGEM_LATERAL, y: layout.y, size: 9.5, font: boldFont });
      layout.page.drawText(`Metros lineares: ${formatMeasurement(totalMetros)} m`, { x: 210, y: layout.y, size: 9.5, font: boldFont });
      layout.page.drawText(`Peças romaneadas: ${formatMeasurement(totalVolume)} m³`, { x: 370, y: layout.y, size: 9.5, font: boldFont });
      layout.mover(16);
      layout.page.drawText(`Aproveitamento manual: ${formatMeasurement(volumeAproveitamento)} m³`, { x: MARGEM_LATERAL, y: layout.y, size: 8.5, font, color: rgb(0.55, 0.33, 0.05) });
      layout.page.drawText(`Produção total: ${formatMeasurement(totalVolume + volumeAproveitamento)} m³`, { x: 290, y: layout.y, size: 8.5, font: boldFont, color: rgb(0.12, 0.42, 0.25) });
      if (aproveitamentosManuais.length) {
        layout.mover(18);
        layout.escreverParagrafo(`Aproveitamento por essência: ${aproveitamentosManuais.map((item: any) => `${item.madeiraNome} ${formatMeasurement(item.volume)} m³`).join(" · ")}`, MARGEM_LATERAL, width - (MARGEM_LATERAL * 2), 8, { color: COR_TEXTO_SECUNDARIO }, 11);
      }

      const colunasResumo = [148, 70, 76, 80, 83];
      const labelsResumo = ["Essência", "Toras", "Produção", "Aproveit.", "Perda"];
      const desenharResumoEssencia = (continuacao = false) => {
        layout.garantirEspaco(42);
        layout.page.drawText(continuacao ? "APROVEITAMENTO POR ESSÊNCIA — CONTINUAÇÃO" : "APROVEITAMENTO POR ESSÊNCIA", { x: MARGEM_LATERAL, y: layout.y, size: 10, font: boldFont, color: COR_MARROM });
        layout.mover(17);
        let x = MARGEM_LATERAL;
        labelsResumo.forEach((label, indice) => {
          desenharTextoAjustado(layout.page, boldFont, label, x, layout.y, colunasResumo[indice] - 4, 7.5, { color: rgb(0.42, 0.42, 0.42) });
          x += colunasResumo[indice];
        });
        layout.mover(15);
      };
      if (resumoPorEssencia.length) {
        desenharResumoEssencia();
        for (const resumo of resumoPorEssencia) {
          if (!layout.temEspaco(16)) {
            layout.novaPagina(true);
            desenharResumoEssencia(true);
          }
          const valores = [
            resumo.essencia,
            `${formatMeasurement(resumo.volumeToras)} m³`,
            `${formatMeasurement(resumo.volumeProduzido)} m³`,
            `${formatMeasurement(resumo.aproveitamento)}%`,
            `${formatMeasurement(resumo.perdaVolume)} m³ (${formatMeasurement(resumo.perdaPercentual)}%)`,
          ];
          let x = MARGEM_LATERAL;
          valores.forEach((valor, indice) => {
            const cor = indice === 3 ? rgb(0.12, 0.42, 0.25) : indice === 4 ? rgb(0.66, 0.38, 0.04) : undefined;
            desenharTextoAjustado(layout.page, indice === 3 ? boldFont : font, valor, x, layout.y, colunasResumo[indice] - 4, 7.5, cor ? { color: cor } : {});
            x += colunasResumo[indice];
          });
          layout.mover(16);
        }
      }

      if (normalizarTexto(data.romaneio.observacoes)) {
        layout.mover(12);
        layout.garantirEspaco(26);
        layout.page.drawText("OBSERVAÇÕES", { x: MARGEM_LATERAL, y: layout.y, size: 9, font: boldFont, color: COR_MARROM });
        layout.mover(14);
        layout.escreverParagrafo(data.romaneio.observacoes, MARGEM_LATERAL, width - (MARGEM_LATERAL * 2), 8.5, { color: COR_TEXTO_SECUNDARIO }, 12);
      }

      const bytes = await pdfDoc.save();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="romaneio-${data.romaneio.numero}.pdf"`);
      res.send(Buffer.from(bytes));
    } catch (err) {
      console.error("Romaneio PDF generation error:", err);
      res.status(500).json({ error: "Erro ao gerar PDF do romaneio" });
    }
  });

  app.get("/api/pdf/romaneio-carga/:id", async (req: any, res: any) => {
    try {
      if (!(await requirePdfAuthentication(req, res))) return;
      const id = parseInt(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ error: "ID inválido" });
      const data = await getRomaneioCargaComPlaquetas(id);
      if (!data) return res.status(404).json({ error: "Romaneio de carga não encontrado" });

      const volumeCarga = Number(data.carga.volumeTotal ?? 0);
      const freteTotal = Number(data.carga.frete ?? 0);
      const fretePorMetroCubico = Number(data.carga.fretePorMetroCubico ?? 0) || (volumeCarga ? freteTotal / volumeCarga : 0);
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const logo = await loadCompanyLogo(pdfDoc);
      const layout = criarLayoutPdf(pdfDoc, font, boldFont, logo, "Romaneio de carga");
      const { width } = layout;

      layout.garantirEspaco(80);
      layout.page.drawRectangle({ x: MARGEM_LATERAL, y: layout.y - 50, width: width - (MARGEM_LATERAL * 2), height: 62, color: rgb(0.95, 0.93, 0.89) });
      layout.page.drawText(normalizarTexto(data.carga.numero) || "ROMANEIO", { x: 62, y: layout.y - 7, size: 16, font: boldFont, color: COR_MARROM });
      layout.page.drawText(`Recebimento em ${formatDate(data.carga.dataCarga, true)}`, { x: 62, y: layout.y - 27, size: 9, font, color: COR_TEXTO_SECUNDARIO });
      const volumeTexto = `Volume: ${formatMeasurement(data.carga.volumeTotal)} m³`;
      layout.page.drawText(volumeTexto, { x: width - 62 - larguraTexto(boldFont, volumeTexto, 9.5), y: layout.y - 15, size: 9.5, font: boldFont, color: rgb(0.12, 0.42, 0.25) });
      const freteTexto = `Frete: R$ ${formatBRL(fretePorMetroCubico)}/m³`;
      layout.page.drawText(freteTexto, { x: width - 62 - larguraTexto(font, freteTexto, 8), y: layout.y - 30, size: 8, font, color: COR_TEXTO_SECUNDARIO });
      layout.mover(78);
      layout.escreverParagrafo(`Origem: ${normalizarTexto(data.carga.origem) || "Não informada"}   •   Responsável: ${normalizarTexto(data.carga.responsavel) || "Não informado"}`, MARGEM_LATERAL, width - (MARGEM_LATERAL * 2), 8.5, { color: COR_TEXTO_SECUNDARIO }, 12);
      layout.mover(12);

      const colunas = [76, 92, 56, 61, 65, 73, 74];
      const labels = ["Código", "Essência", "Diâm.", "Comp.", "Volume", "R$/m³", "Valor"];
      const desenharTabelaCarga = (continuacao = false) => {
        layout.garantirEspaco(28);
        if (continuacao) {
          layout.page.drawText("PLAQUETAS — CONTINUAÇÃO", { x: MARGEM_LATERAL, y: layout.y, size: 9, font: boldFont, color: COR_MARROM });
          layout.mover(15);
        }
        let x = MARGEM_LATERAL;
        labels.forEach((label, indice) => {
          desenharTextoAjustado(layout.page, boldFont, label, x, layout.y, colunas[indice] - 4, 7.5, { color: rgb(0.42, 0.42, 0.42) });
          x += colunas[indice];
        });
        layout.mover(15);
      };
      layout.garantirEspaco(28);
      layout.page.drawText(`PLAQUETAS (${data.plaquetas.length})`, { x: MARGEM_LATERAL, y: layout.y, size: 10, font: boldFont, color: COR_MARROM });
      layout.mover(17);
      desenharTabelaCarga();

      for (const plaqueta of data.plaquetas ?? []) {
        if (!layout.temEspaco(16)) {
          layout.novaPagina(true);
          desenharTabelaCarga(true);
        }
        // A identificação interna pode ser longa quando a tora chegou sem plaqueta física.
        // Ela é truncada dentro da sua célula, preservando a leitura das demais medidas.
        const valores = [
          etiquetaPlaqueta(plaqueta),
          plaqueta.madeiraNome,
          `${formatMeasurement(plaqueta.diametro)} cm`,
          `${formatMeasurement(plaqueta.comprimento)} m`,
          `${formatMeasurement(plaqueta.volumeInicial)} m³`,
          `R$ ${formatBRL(plaqueta.valorMetroCubico)}`,
          `R$ ${formatBRL(plaqueta.valorTotal)}`,
        ];
        let x = MARGEM_LATERAL;
        valores.forEach((valor, indice) => {
          desenharTextoAjustado(layout.page, indice === valores.length - 1 ? boldFont : font, valor, x, layout.y, colunas[indice] - 4, 7.5);
          x += colunas[indice];
        });
        layout.mover(16);
      }

      layout.garantirEspaco(96);
      layout.page.drawLine({ start: { x: MARGEM_LATERAL, y: layout.y }, end: { x: width - MARGEM_LATERAL, y: layout.y }, thickness: 0.8, color: COR_LINHA });
      layout.mover(19);
      layout.page.drawText(`Plaquetas: ${data.carga.totalPlaquetas}`, { x: MARGEM_LATERAL, y: layout.y, size: 9.5, font: boldFont });
      layout.page.drawText(`Toras: R$ ${formatBRL(data.carga.valorProdutos)}`, { x: 190, y: layout.y, size: 9.5, font: boldFont });
      layout.page.drawText(`Frete/m³: R$ ${formatBRL(fretePorMetroCubico)}`, { x: 350, y: layout.y, size: 9.5, font: boldFont });
      layout.mover(18);
      layout.page.drawText(`Frete total: R$ ${formatBRL(freteTotal)}`, { x: 350, y: layout.y, size: 8.5, font });
      layout.mover(23);
      layout.page.drawText(`VALOR TOTAL DA CARGA: R$ ${formatBRL(data.carga.valorTotal)}`, { x: MARGEM_LATERAL, y: layout.y, size: 13, font: boldFont, color: rgb(0.12, 0.42, 0.25) });

      if (normalizarTexto(data.carga.observacoes)) {
        layout.mover(22);
        layout.garantirEspaco(26);
        layout.page.drawText("OBSERVAÇÕES", { x: MARGEM_LATERAL, y: layout.y, size: 9, font: boldFont, color: COR_MARROM });
        layout.mover(14);
        layout.escreverParagrafo(data.carga.observacoes, MARGEM_LATERAL, width - (MARGEM_LATERAL * 2), 8.5, { color: COR_TEXTO_SECUNDARIO }, 12);
      }

      const bytes = await pdfDoc.save();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="romaneio-carga-${data.carga.numero}.pdf"`);
      res.send(Buffer.from(bytes));
    } catch (err) {
      console.error("Carga PDF generation error:", err);
      res.status(500).json({ error: "Erro ao gerar PDF do romaneio de carga" });
    }
  });
}
