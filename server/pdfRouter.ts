import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { getEmpresaConfiguracao, getOrcamentoWithItems, getRomaneioCargaComPlaquetas, getRomaneioProducaoComItens, listClientes } from "./db";
import { storageGetSignedUrl } from "./storage";
import { sdk } from "./_core/sdk";
import { etiquetaPlaqueta } from "../shared/plaquetas";

// Format number as BRL currency (pt-BR: 1.234,56)
function formatBRL(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return "0,00";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function formatDimensionCm(valueInMillimeters: string): string {
  const num = parseFloat(valueInMillimeters);
  if (isNaN(num)) return "0";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num / 10);
}

function formatMeasurement(value: string): string {
  const num = parseFloat(value);
  if (!Number.isFinite(num)) return "0";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(num);
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

async function loadCompanyLogo(pdfDoc: PDFDocument) {
  const configuracao = await getEmpresaConfiguracao();
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

export async function registerPdfRoutes(app: any) {
  app.get("/api/pdf/orcamento/:id", async (req: any, res: any) => {
    try {
      if (!(await requirePdfAuthentication(req, res))) return;
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

      const data = await getOrcamentoWithItems(id);
      if (!data) return res.status(404).json({ error: "Orçamento não encontrado" });

      const clientes = await listClientes();
      const cliente = clientes.find((c: any) => c.id === data.orcamento.clienteId);

      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595, 842]); // A4
      const { width, height } = page.getSize();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const logo = await loadCompanyLogo(pdfDoc);

      const logoDimensions = logo?.scaleToFit(118, 54);
      const headerX = logoDimensions ? 50 + logoDimensions.width + 16 : 50;
      if (logoDimensions) {
        page.drawImage(logo!, {
          x: 50,
          y: height - 50 - logoDimensions.height,
          width: logoDimensions.width,
          height: logoDimensions.height,
        });
      }

      let y = height - 55;

      // Header - Company name
      page.drawText("FK MADEIRAS", { x: headerX, y, size: 24, font: boldFont, color: rgb(0.3, 0.2, 0.1) });
      y -= 20;
      page.drawText("Sistema de Vendas", { x: headerX, y, size: 10, font, color: rgb(0.5, 0.5, 0.5) });

      // Número e data da venda
      y -= 48;
      page.drawText(`Venda: ${data.orcamento.numero ?? "Aguardando aprovação"}`, { x: 50, y, size: 14, font: boldFont, color: rgb(0.2, 0.15, 0.05) });
      y -= 18;
      page.drawText(`Data: ${new Date(data.orcamento.createdAt).toLocaleDateString("pt-BR")}`, { x: 50, y, size: 10, font, color: rgb(0.4, 0.4, 0.4) });

      // Estado
      page.drawText(`Estado: ${data.orcamento.estado}`, { x: width - 200, y, size: 10, font, color: rgb(0.4, 0.4, 0.4) });

      // Client info
      y -= 40;
      if (cliente) {
        page.drawText("DADOS DO CLIENTE", { x: 50, y, size: 11, font: boldFont, color: rgb(0.3, 0.2, 0.1) });
        y -= 16;
        page.drawText(`Nome: ${cliente.nome}`, { x: 50, y, size: 10, font });
        y -= 14;
        if (cliente.contacto) { page.drawText(`Contacto: ${cliente.contacto}`, { x: 50, y, size: 10, font }); y -= 14; }
        if (cliente.email) { page.drawText(`Email: ${cliente.email}`, { x: 50, y, size: 10, font }); y -= 14; }
        if (cliente.morada) { page.drawText(`Morada: ${cliente.morada}`, { x: 50, y, size: 10, font }); y -= 14; }
        if (cliente.nif) { page.drawText(`NIF: ${cliente.nif}`, { x: 50, y, size: 10, font }); y -= 14; }
      }

      // Items table
      y -= 30;
      page.drawText("ITENS DA VENDA", { x: 50, y, size: 11, font: boldFont, color: rgb(0.3, 0.2, 0.1) });
      y -= 20;

      // Table header
      const colWidths = [120, 100, 40, 70, 70, 70, 70];
      const colLabels = ["Madeira", "Dimensões", "Qtd", "Preço/m³", "Preço/m.l.", "Valor/peça", "Total"];
      let x = 50;
      for (let i = 0; i < colLabels.length; i++) {
        page.drawText(colLabels[i], { x, y, size: 8, font: boldFont, color: rgb(0.4, 0.4, 0.4) });
        x += colWidths[i];
      }

      // Espaçamento antes da primeira linha de item, sem regra horizontal.
      y -= 16;

      // Items
      for (const item of data.itens) {
        x = 50;
        page.drawText(item.madeiraNome, { x, y, size: 8, font }); x += colWidths[0];
        page.drawText(`${formatDimensionCm(item.espessura)}×${formatDimensionCm(item.largura)}cm×${item.comprimento}m`, { x, y, size: 8, font }); x += colWidths[1];
        page.drawText(String(item.quantidade), { x, y, size: 8, font }); x += colWidths[2];
        page.drawText(`R$ ${formatBRL(item.precoM3)}`, { x, y, size: 8, font }); x += colWidths[3];
        page.drawText(`R$ ${formatBRL(item.precoLinear)}`, { x, y, size: 8, font }); x += colWidths[4];
        page.drawText(`R$ ${formatBRL(item.valorPeca)}`, { x, y, size: 8, font }); x += colWidths[5];
        page.drawText(`R$ ${formatBRL(item.valorTotal)}`, { x, y, size: 8, font: boldFont });
        y -= 16;
        if (y < 100) { const newPage = pdfDoc.addPage([595, 842]); y = newPage.getSize().height - 50; }
      }

      // Summary
      y -= 30;
      page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1, color: rgb(0.3, 0.2, 0.1) });
      y -= 20;
      page.drawText("RESUMO", { x: 50, y, size: 11, font: boldFont, color: rgb(0.3, 0.2, 0.1) });
      y -= 18;
      page.drawText(`Subtotal: R$ ${formatBRL(data.orcamento.subtotal)}`, { x: 50, y, size: 10, font });
      y -= 14;
      page.drawText(`Desconto: -R$ ${formatBRL(data.orcamento.desconto || "0")}`, { x: 50, y, size: 10, font, color: rgb(0.7, 0.2, 0.2) });
      y -= 14;
      page.drawText(`Frete: +R$ ${formatBRL(data.orcamento.frete || "0")}`, { x: 50, y, size: 10, font });
      y -= 14;
      page.drawText(`Total: R$ ${formatBRL(data.orcamento.total)}`, { x: 50, y, size: 14, font: boldFont, color: rgb(0.3, 0.2, 0.1) });

      y -= 14;
      page.drawText(`Total de peças: ${data.orcamento.totalPecas}`, { x: 50, y, size: 9, font, color: rgb(0.5, 0.5, 0.5) });
      y -= 12;
      page.drawText(`Total metro linear: ${formatMeasurement(data.orcamento.totalMetroLinear)} m`, { x: 50, y, size: 9, font, color: rgb(0.5, 0.5, 0.5) });
      y -= 12;
      page.drawText(`Volume total: ${formatMeasurement(data.orcamento.totalVolume)} m³`, { x: 50, y, size: 9, font, color: rgb(0.5, 0.5, 0.5) });

      if (data.orcamento.observacoes) {
        y -= 20;
        page.drawText("Observações:", { x: 50, y, size: 10, font: boldFont });
        y -= 14;
        page.drawText(data.orcamento.observacoes, { x: 50, y, size: 9, font, color: rgb(0.4, 0.4, 0.4), maxWidth: width - 100 });
      }

      // Footer
      const footerY = 40;
      page.drawText("FK Madeiras — Sistema de Vendas", { x: 50, y: footerY, size: 8, font, color: rgb(0.7, 0.7, 0.7) });
      page.drawText(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`, { x: width - 250, y: footerY, size: 8, font, color: rgb(0.7, 0.7, 0.7) });

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
      if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

      const data = await getOrcamentoWithItems(id);
      if (!data) return res.status(404).json({ error: "Venda não encontrada" });
      if (!data.orcamento.pago || !data.orcamento.pagoEm) {
        return res.status(400).json({ error: "O recibo só está disponível para vendas quitadas" });
      }

      const clientes = await listClientes();
      const cliente = clientes.find((item: any) => item.id === data.orcamento.clienteId);
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595, 842]);
      const { width, height } = page.getSize();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const logo = await loadCompanyLogo(pdfDoc);
      const logoDimensions = logo?.scaleToFit(118, 54);
      const headerX = logoDimensions ? 50 + logoDimensions.width + 16 : 50;

      if (logoDimensions) {
        page.drawImage(logo!, { x: 50, y: height - 50 - logoDimensions.height, width: logoDimensions.width, height: logoDimensions.height });
      }

      let y = height - 55;
      page.drawText("FK MADEIRAS", { x: headerX, y, size: 24, font: boldFont, color: rgb(0.3, 0.2, 0.1) });
      y -= 20;
      page.drawText("Comprovante de quitação", { x: headerX, y, size: 10, font, color: rgb(0.5, 0.5, 0.5) });
      y -= 76;

      page.drawRectangle({ x: 50, y: y - 54, width: width - 100, height: 64, color: rgb(0.95, 0.93, 0.89) });
      page.drawText("RECIBO DE PAGAMENTO", { x: 66, y: y - 2, size: 17, font: boldFont, color: rgb(0.3, 0.2, 0.1) });
      page.drawText(`Referente à venda ${data.orcamento.numero ?? data.orcamento.id}`, { x: 66, y: y - 23, size: 10, font, color: rgb(0.35, 0.35, 0.35) });
      page.drawText(`Recibo nº REC-${data.orcamento.numero ?? data.orcamento.id}`, { x: 66, y: y - 41, size: 9, font, color: rgb(0.45, 0.45, 0.45) });
      y -= 96;

      page.drawText("DECLARAÇÃO DE QUITAÇÃO", { x: 50, y, size: 11, font: boldFont, color: rgb(0.3, 0.2, 0.1) });
      y -= 24;
      const nomeCliente = cliente?.nome ?? "Cliente";
      page.drawText(`Recebemos de ${nomeCliente} o valor abaixo indicado, referente à venda mencionada.`, { x: 50, y, size: 10, font, maxWidth: width - 100, lineHeight: 14 });
      y -= 62;

      page.drawText("VALOR RECEBIDO", { x: 50, y, size: 9, font: boldFont, color: rgb(0.45, 0.45, 0.45) });
      y -= 23;
      page.drawText(`R$ ${formatBRL(data.orcamento.total)}`, { x: 50, y, size: 24, font: boldFont, color: rgb(0.15, 0.42, 0.26) });
      y -= 54;

      const dataPagamento = new Date(data.orcamento.pagoEm).toLocaleDateString("pt-BR");
      page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 0.8, color: rgb(0.82, 0.79, 0.73) });
      y -= 28;
      page.drawText("Cliente", { x: 50, y, size: 9, font: boldFont, color: rgb(0.45, 0.45, 0.45) });
      page.drawText(nomeCliente, { x: 180, y, size: 10, font });
      y -= 25;
      page.drawText("Forma de pagamento", { x: 50, y, size: 9, font: boldFont, color: rgb(0.45, 0.45, 0.45) });
      page.drawText(formatFormaPagamento(data.orcamento.formaPagamento), { x: 180, y, size: 10, font });
      y -= 25;
      page.drawText("Data de pagamento", { x: 50, y, size: 9, font: boldFont, color: rgb(0.45, 0.45, 0.45) });
      page.drawText(dataPagamento, { x: 180, y, size: 10, font });
      y -= 68;

      page.drawLine({ start: { x: 50, y }, end: { x: 270, y }, thickness: 0.8, color: rgb(0.5, 0.5, 0.5) });
      page.drawText("FK Madeiras", { x: 50, y: y - 16, size: 9, font, color: rgb(0.45, 0.45, 0.45) });
      page.drawText("Documento gerado eletronicamente.", { x: 50, y: 40, size: 8, font, color: rgb(0.55, 0.55, 0.55) });
      page.drawText(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`, { x: width - 180, y: 40, size: 8, font, color: rgb(0.55, 0.55, 0.55) });

      const pdfBytes = await pdfDoc.save();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="recibo-${data.orcamento.numero ?? data.orcamento.id}.pdf"`);
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
      if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
      const data = await getRomaneioProducaoComItens(id);
      if (!data) return res.status(404).json({ error: "Romaneio não encontrado" });

      const pdfDoc = await PDFDocument.create();
      let page = pdfDoc.addPage([595, 842]);
      const { width, height } = page.getSize();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const logo = await loadCompanyLogo(pdfDoc);
      const logoDimensoes = logo?.scaleToFit(108, 50);
      if (logoDimensoes) page.drawImage(logo!, { x: 48, y: height - 50 - logoDimensoes.height, width: logoDimensoes.width, height: logoDimensoes.height });
      const cabecalhoX = logoDimensoes ? 48 + logoDimensoes.width + 14 : 48;
      let y = height - 55;
      page.drawText("FK MADEIRAS", { x: cabecalhoX, y, size: 22, font: bold, color: rgb(0.22, 0.16, 0.08) });
      y -= 17;
      page.drawText("Romaneio de produção", { x: cabecalhoX, y, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
      y -= 50;
      page.drawRectangle({ x: 48, y: y - 48, width: width - 96, height: 60, color: rgb(0.95, 0.93, 0.89) });
      page.drawText(data.romaneio.numero, { x: 62, y: y - 6, size: 17, font: bold, color: rgb(0.22, 0.16, 0.08) });
      page.drawText(`Produção em ${new Date(data.romaneio.dataProducao).toLocaleDateString("pt-BR", { timeZone: "UTC" })}`, { x: 62, y: y - 25, size: 10, font, color: rgb(0.35, 0.35, 0.35) });
      page.drawText(`Aproveitamento: ${formatMeasurement(data.romaneio.aproveitamento ?? "0")}%`, { x: width - 212, y: y - 17, size: 11, font: bold, color: rgb(0.12, 0.42, 0.25) });
      y -= 78;
      const torasSerradas = data.toras.length
        ? data.toras
        : [{
            codigo: data.romaneio.plaquetaCodigo ?? "Não informada",
            madeiraNome: data.romaneio.madeiraTora ?? "Não informada",
            diametro: null,
            comprimento: data.romaneio.comprimentoTora,
            volume: data.romaneio.volumeTora ?? "0",
          }];
      page.drawText(`TORAS SERRADAS (${torasSerradas.length})`, { x: 48, y, size: 10, font: bold, color: rgb(0.22, 0.16, 0.08) });
      y -= 18;
      for (const tora of torasSerradas) {
        page.drawText(`Plaqueta: ${tora.codigo}   •   Essência: ${tora.madeiraNome}`, { x: 48, y, size: 9, font });
        y -= 13;
        page.drawText(`Diâmetro: ${formatMeasurement(tora.diametro ?? "0")} cm   •   Comprimento: ${formatMeasurement(tora.comprimento ?? "0")} m   •   Volume efetivo: ${formatMeasurement(tora.volume)} m³`, { x: 48, y, size: 8, font, color: rgb(0.35, 0.35, 0.35) });
        y -= 16;
      }
      page.drawLine({ start: { x: 48, y }, end: { x: width - 48, y }, thickness: 0.6, color: rgb(0.72, 0.67, 0.58) });
      y -= 16;
      page.drawText(`Volume de toras: ${formatMeasurement(data.romaneio.volumeTora ?? "0")} m³   •   Fita/Linha: ${data.romaneio.fita ?? "Não informada"}   •   Responsável: ${data.romaneio.responsavel ?? "Não informado"}`, { x: 48, y, size: 9, font, color: rgb(0.35, 0.35, 0.35) });
      y -= 28;
      page.drawText("PEÇAS PRODUZIDAS", { x: 48, y, size: 10, font: bold, color: rgb(0.22, 0.16, 0.08) });
      y -= 18;
      const colunas = [145, 92, 54, 66, 66, 62];
      const titulos = ["Essência", "Dimensões", "Comp.", "Peças", "M. linear", "Volume"];
      let x = 48;
      titulos.forEach((titulo, indice) => { page.drawText(titulo, { x, y, size: 8, font: bold, color: rgb(0.42, 0.42, 0.42) }); x += colunas[indice]; });
      y -= 14;
      let totalPecas = 0;
      let totalMetros = 0;
      let totalVolume = 0;
      for (const item of data.itens) {
        x = 48;
        page.drawText(item.madeiraNome, { x, y, size: 8, font }); x += colunas[0];
        page.drawText(`${formatMeasurement(item.espessura)} × ${formatMeasurement(item.largura)} cm`, { x, y, size: 8, font }); x += colunas[1];
        page.drawText(`${formatMeasurement(item.comprimento)} m`, { x, y, size: 8, font }); x += colunas[2];
        page.drawText(String(item.quantidade), { x, y, size: 8, font }); x += colunas[3];
        page.drawText(`${formatMeasurement(item.metrosLineares)} m`, { x, y, size: 8, font }); x += colunas[4];
        page.drawText(`${formatMeasurement(item.volume)} m³`, { x, y, size: 8, font: bold });
        totalPecas += item.quantidade;
        totalMetros += Number(item.metrosLineares);
        totalVolume += Number(item.volume);
        y -= 16;
      }
      y -= 12;
      page.drawLine({ start: { x: 48, y }, end: { x: width - 48, y }, thickness: 0.8, color: rgb(0.72, 0.67, 0.58) });
      y -= 18;
      page.drawText(`Total de peças: ${totalPecas}`, { x: 48, y, size: 10, font: bold });
      page.drawText(`Metros lineares: ${formatMeasurement(String(totalMetros))} m`, { x: 210, y, size: 10, font: bold });
      page.drawText(`Madeira serrada: ${formatMeasurement(String(totalVolume))} m³`, { x: 385, y, size: 10, font: bold });
      if (data.romaneio.observacoes) { y -= 30; page.drawText("Observações", { x: 48, y, size: 9, font: bold }); y -= 14; page.drawText(data.romaneio.observacoes, { x: 48, y, size: 8, font, color: rgb(0.35, 0.35, 0.35), maxWidth: width - 96 }); }
      page.drawText("FK Madeiras — Romaneio gerado eletronicamente", { x: 48, y: 38, size: 8, font, color: rgb(0.55, 0.55, 0.55) });
      page.drawText(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`, { x: width - 155, y: 38, size: 8, font, color: rgb(0.55, 0.55, 0.55) });
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
      if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
      const data = await getRomaneioCargaComPlaquetas(id);
      if (!data) return res.status(404).json({ error: "Romaneio de carga não encontrado" });
      const volumeCarga = Number(data.carga.volumeTotal ?? 0);
      const freteTotal = Number(data.carga.frete ?? 0);
      const fretePorMetroCubico = Number(data.carga.fretePorMetroCubico ?? 0) || (volumeCarga ? freteTotal / volumeCarga : 0);

      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const logo = await loadCompanyLogo(pdfDoc);
      const adicionarPagina = () => pdfDoc.addPage([595, 842]);
      let page = adicionarPagina();
      const { width, height } = page.getSize();
      const logoDimensoes = logo?.scaleToFit(108, 50);
      const desenharCabecalho = (continuacao = false) => {
        if (logoDimensoes) page.drawImage(logo!, { x: 48, y: height - 50 - logoDimensoes.height, width: logoDimensoes.width, height: logoDimensoes.height });
        const cabecalhoX = logoDimensoes ? 48 + logoDimensoes.width + 14 : 48;
        page.drawText("FK MADEIRAS", { x: cabecalhoX, y: height - 55, size: 22, font: bold, color: rgb(0.22, 0.16, 0.08) });
        page.drawText(continuacao ? `Romaneio de carga ${data.carga.numero} — continuação` : "Romaneio de carga", { x: cabecalhoX, y: height - 72, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
      };
      desenharCabecalho();
      let y = height - 125;
      page.drawRectangle({ x: 48, y: y - 48, width: width - 96, height: 60, color: rgb(0.95, 0.93, 0.89) });
      page.drawText(data.carga.numero, { x: 62, y: y - 6, size: 17, font: bold, color: rgb(0.22, 0.16, 0.08) });
      page.drawText(`Recebimento em ${new Date(data.carga.dataCarga).toLocaleDateString("pt-BR", { timeZone: "UTC" })}`, { x: 62, y: y - 25, size: 10, font, color: rgb(0.35, 0.35, 0.35) });
      page.drawText(`Volume: ${formatMeasurement(data.carga.volumeTotal)} m³`, { x: width - 190, y: y - 15, size: 10, font: bold, color: rgb(0.12, 0.42, 0.25) });
      page.drawText(`Frete: R$ ${formatBRL(String(fretePorMetroCubico))}/m³`, { x: width - 190, y: y - 30, size: 8, font, color: rgb(0.35, 0.35, 0.35) });
      y -= 78;
      page.drawText(`Origem: ${data.carga.origem ?? "Não informada"}   •   Responsável: ${data.carga.responsavel ?? "Não informado"}`, { x: 48, y, size: 9, font, color: rgb(0.35, 0.35, 0.35) });
      y -= 30;

      const colunas = [76, 92, 56, 61, 65, 73, 74];
      const titulos = ["Código", "Essência", "Diâm.", "Comp.", "Volume", "R$/m³", "Valor"];
      const desenharCabecalhoTabela = () => {
        let x = 48;
        titulos.forEach((titulo, indice) => { page.drawText(titulo, { x, y, size: 8, font: bold, color: rgb(0.42, 0.42, 0.42) }); x += colunas[indice]; });
        y -= 15;
      };
      desenharCabecalhoTabela();
      for (const plaqueta of data.plaquetas) {
        if (y < 80) {
          page = adicionarPagina();
          desenharCabecalho(true);
          y = height - 108;
          desenharCabecalhoTabela();
        }
        let x = 48;
        page.drawText(etiquetaPlaqueta(plaqueta), { x, y, size: 8, font }); x += colunas[0];
        page.drawText(plaqueta.madeiraNome, { x, y, size: 8, font, maxWidth: colunas[1] - 5 }); x += colunas[1];
        page.drawText(`${formatMeasurement(plaqueta.diametro ?? "0")} cm`, { x, y, size: 8, font }); x += colunas[2];
        page.drawText(`${formatMeasurement(plaqueta.comprimento ?? "0")} m`, { x, y, size: 8, font }); x += colunas[3];
        page.drawText(`${formatMeasurement(plaqueta.volumeInicial)} m³`, { x, y, size: 8, font }); x += colunas[4];
        page.drawText(`R$ ${formatBRL(plaqueta.valorMetroCubico)}`, { x, y, size: 8, font }); x += colunas[5];
        page.drawText(`R$ ${formatBRL(plaqueta.valorTotal)}`, { x, y, size: 8, font: bold });
        y -= 16;
      }
      if (y < 135) { page = adicionarPagina(); desenharCabecalho(true); y = height - 110; }
      page.drawLine({ start: { x: 48, y }, end: { x: width - 48, y }, thickness: 0.8, color: rgb(0.72, 0.67, 0.58) });
      y -= 22;
      page.drawText(`Plaquetas: ${data.carga.totalPlaquetas}`, { x: 48, y, size: 10, font: bold });
      page.drawText(`Toras: R$ ${formatBRL(data.carga.valorProdutos ?? "0")}`, { x: 190, y, size: 10, font: bold });
      page.drawText(`Frete/m³: R$ ${formatBRL(String(fretePorMetroCubico))}`, { x: 350, y, size: 10, font: bold });
      y -= 18;
      page.drawText(`Frete total: R$ ${formatBRL(String(freteTotal))}`, { x: 350, y, size: 9, font });
      y -= 23;
      page.drawText(`VALOR TOTAL DA CARGA: R$ ${formatBRL(data.carga.valorTotal)}`, { x: 48, y, size: 14, font: bold, color: rgb(0.12, 0.42, 0.25) });
      if (data.carga.observacoes) { y -= 30; page.drawText("Observações", { x: 48, y, size: 9, font: bold }); y -= 14; page.drawText(data.carga.observacoes, { x: 48, y, size: 8, font, color: rgb(0.35, 0.35, 0.35), maxWidth: width - 96 }); }
      page.drawText("FK Madeiras — Romaneio de carga gerado eletronicamente", { x: 48, y: 38, size: 8, font, color: rgb(0.55, 0.55, 0.55) });
      page.drawText(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`, { x: width - 155, y: 38, size: 8, font, color: rgb(0.55, 0.55, 0.55) });
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
