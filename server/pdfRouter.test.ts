import { beforeEach, describe, expect, it, vi } from "vitest";
import * as db from "./db";
import { registerPdfRoutes } from "./pdfRouter";
import { sdk } from "./_core/sdk";

const pdfCanvas = vi.hoisted(() => ({ drawText: vi.fn() }));

vi.mock("pdf-lib", async (importOriginal) => {
  const original = await importOriginal<typeof import("pdf-lib")>();
  const page = () => ({
    getSize: () => ({ width: 595, height: 842 }),
    drawText: (texto: string) => pdfCanvas.drawText(texto),
    drawRectangle: vi.fn(),
    drawLine: vi.fn(),
    drawImage: vi.fn(),
  });
  return {
    ...original,
    PDFDocument: {
      create: vi.fn(async () => ({
        addPage: vi.fn(page),
        embedFont: vi.fn(async () => ({})),
        save: vi.fn(async () => new Uint8Array([37, 80, 68, 70])),
      })),
    },
  };
});

type Handler = (req: Record<string, unknown>, res: ReturnType<typeof createResponse>) => Promise<void>;

function createResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
    setHeader: vi.fn(),
    send: vi.fn(),
  };
}

describe("rotas de PDF protegidas", () => {
  const routes: Record<string, Handler> = {};

  beforeEach(async () => {
    Object.keys(routes).forEach((key) => delete routes[key]);
    vi.restoreAllMocks();
    pdfCanvas.drawText.mockClear();
    await registerPdfRoutes({ get: (path: string, handler: Handler) => { routes[path] = handler; } });
  });

  it("rejeita recibo quando não há utilizador autenticado", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue(null);
    const res = createResponse();

    await routes["/api/pdf/recibo/:id"]!({ params: { id: "1" } }, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining("Autenticação") }));
  });

  it("rejeita PDF de romaneio quando não há utilizador autenticado", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue(null);
    const res = createResponse();

    await routes["/api/pdf/romaneio/:id"]!({ params: { id: "1" } }, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining("Autenticação") }));
  });

  it("rejeita PDF de romaneio de carga quando não há utilizador autenticado", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue(null);
    const res = createResponse();

    await routes["/api/pdf/romaneio-carga/:id"]!({ params: { id: "1" } }, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining("Autenticação") }));
  });

  it("gera PDF autenticado de carga com toras, frete e total", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue({ id: 1 } as any);
    vi.spyOn(db, "getEmpresaConfiguracao").mockResolvedValue(undefined);
    vi.spyOn(db, "getRomaneioCargaComPlaquetas").mockResolvedValue({
      carga: { numero: "CARGA-000007", dataCarga: new Date("2026-08-12T12:00:00.000Z"), origem: "Fazenda Norte", responsavel: "João", volumeTotal: "1.500000", totalPlaquetas: 2, valorProdutos: "1350.00", frete: "150.00", valorTotal: "1500.00", observacoes: "Carga conferida" },
      plaquetas: [{ codigo: "TOR-0100", madeiraNome: "Cedrinho", diametro: "30.00", comprimento: "5.00", volumeInicial: "0.353000", valorMetroCubico: "900.00", valorTotal: "317.70" }],
    } as any);
    const res = createResponse();

    await routes["/api/pdf/romaneio-carga/:id"]!({ params: { id: "7" } }, res);

    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
    expect(res.setHeader).toHaveBeenCalledWith("Content-Disposition", expect.stringContaining("romaneio-carga-CARGA-000007.pdf"));
    expect(res.send).toHaveBeenCalledWith(expect.any(Buffer));
    const textos = pdfCanvas.drawText.mock.calls.map(([texto]) => texto).join(" ");
    expect(textos).toContain("CARGA-000007");
    expect(textos).toContain("Toras: R$ 1.350,00");
    expect(textos).toContain("Frete: R$ 150,00");
    expect(textos).toContain("VALOR TOTAL DA CARGA: R$ 1.500,00");
  });

  it("rejeita recibo de venda ainda não quitada", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue({ id: 1 } as any);
    vi.spyOn(db, "getOrcamentoWithItems").mockResolvedValue({
      orcamento: { pago: false, pagoEm: null },
      itens: [],
    } as any);
    const res = createResponse();

    await routes["/api/pdf/recibo/:id"]!({ params: { id: "1" } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining("quitadas") }));
  });
});
