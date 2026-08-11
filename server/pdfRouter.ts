import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { getEmpresaConfiguracao, getOrcamentoWithItems, listClientes } from "./db";
import { storageGetSignedUrl } from "./storage";
import { sdk } from "./_core/sdk";

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
      page.drawText("Sistema de Orçamentos", { x: headerX, y, size: 10, font, color: rgb(0.5, 0.5, 0.5) });

      // Orçamento number and date
      y -= 48;
      page.drawText(`Orçamento: ${data.orcamento.numero}`, { x: 50, y, size: 14, font: boldFont, color: rgb(0.2, 0.15, 0.05) });
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
      page.drawText("ITENS DO ORÇAMENTO", { x: 50, y, size: 11, font: boldFont, color: rgb(0.3, 0.2, 0.1) });
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
      page.drawText(`Total metro linear: ${data.orcamento.totalMetroLinear}m`, { x: 50, y, size: 9, font, color: rgb(0.5, 0.5, 0.5) });
      y -= 12;
      page.drawText(`Volume total: ${data.orcamento.totalVolume}m³`, { x: 50, y, size: 9, font, color: rgb(0.5, 0.5, 0.5) });

      if (data.orcamento.observacoes) {
        y -= 20;
        page.drawText("Observações:", { x: 50, y, size: 10, font: boldFont });
        y -= 14;
        page.drawText(data.orcamento.observacoes, { x: 50, y, size: 9, font, color: rgb(0.4, 0.4, 0.4), maxWidth: width - 100 });
      }

      // Footer
      const footerY = 40;
      page.drawText("FK Madeiras — Sistema de Orçamentos", { x: 50, y: footerY, size: 8, font, color: rgb(0.7, 0.7, 0.7) });
      page.drawText(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`, { x: width - 250, y: footerY, size: 8, font, color: rgb(0.7, 0.7, 0.7) });

      const pdfBytes = await pdfDoc.save();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="orcamento-${data.orcamento.numero}.pdf"`);
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
      if (!data) return res.status(404).json({ error: "Orçamento não encontrado" });
      if (!data.orcamento.pago || !data.orcamento.pagoEm) {
        return res.status(400).json({ error: "O recibo só está disponível para orçamentos quitados" });
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
      page.drawText(`Referente ao orçamento ${data.orcamento.numero}`, { x: 66, y: y - 23, size: 10, font, color: rgb(0.35, 0.35, 0.35) });
      page.drawText(`Recibo nº REC-${data.orcamento.numero}`, { x: 66, y: y - 41, size: 9, font, color: rgb(0.45, 0.45, 0.45) });
      y -= 96;

      page.drawText("DECLARAÇÃO DE QUITAÇÃO", { x: 50, y, size: 11, font: boldFont, color: rgb(0.3, 0.2, 0.1) });
      y -= 24;
      const nomeCliente = cliente?.nome ?? "Cliente";
      page.drawText(`Recebemos de ${nomeCliente} o valor abaixo indicado, referente ao orçamento mencionado.`, { x: 50, y, size: 10, font, maxWidth: width - 100, lineHeight: 14 });
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
      res.setHeader("Content-Disposition", `attachment; filename="recibo-${data.orcamento.numero}.pdf"`);
      res.send(Buffer.from(pdfBytes));
    } catch (err: any) {
      console.error("Receipt PDF generation error:", err);
      res.status(500).json({ error: "Erro ao gerar recibo de pagamento" });
    }
  });
}
