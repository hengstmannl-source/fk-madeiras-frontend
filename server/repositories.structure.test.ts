import { describe, expect, it } from "vitest";
import * as db from "./db";
import { listMadeiras } from "./repositories/catalogo";
import { getDb } from "./repositories/core";
import { formatarNumeroDocumentoPadronizado } from "./repositories/documentos";
import { listTitulosFinanceiros } from "./repositories/financeiro";
import { getEmpresaAtivaDoUsuario } from "./repositories/identidade";
import { getResumoEstoqueSerrado } from "./repositories/producao";
import { getOrcamentoById } from "./repositories/vendas";

describe("fachada server/db", () => {
  it("mantém os exports públicos encaminhados aos repositories de domínio", () => {
    expect(db.getDb).toBe(getDb);
    expect(db.listMadeiras).toBe(listMadeiras);
    expect(db.formatarNumeroDocumentoPadronizado).toBe(formatarNumeroDocumentoPadronizado);
    expect(db.listTitulosFinanceiros).toBe(listTitulosFinanceiros);
    expect(db.getEmpresaAtivaDoUsuario).toBe(getEmpresaAtivaDoUsuario);
    expect(db.getResumoEstoqueSerrado).toBe(getResumoEstoqueSerrado);
    expect(db.getOrcamentoById).toBe(getOrcamentoById);
  });
});
