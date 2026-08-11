import { beforeEach, describe, expect, it, vi } from "vitest";
import * as db from "./db";
import { registerPdfRoutes } from "./pdfRouter";
import { sdk } from "./_core/sdk";

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
    await registerPdfRoutes({ get: (path: string, handler: Handler) => { routes[path] = handler; } });
  });

  it("rejeita recibo quando não há utilizador autenticado", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue(null);
    const res = createResponse();

    await routes["/api/pdf/recibo/:id"]!({ params: { id: "1" } }, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining("Autenticação") }));
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
