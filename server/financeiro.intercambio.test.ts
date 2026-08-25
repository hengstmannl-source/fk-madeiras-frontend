import { describe, expect, it } from "vitest";
import { criarModeloCsvLancamentos, exportarLancamentosCsv, prepararImportacaoLancamentos, validarCsvLancamentos } from "./financeiro.intercambio";
import { importarLancamentosFinanceirosCsv } from "./db";

describe("intercâmbio de lançamentos financeiros", () => {
  it("valida uma importação CSV em formato brasileiro e preserva campos entre aspas", () => {
    const csv = "referencia;tipo;descricao;categoria;valor;data_emissao;data_vencimento;competencia;contraparte;observacoes\nIMP-001;receber;\"Venda; madeira\";Receitas;1.250,50;2026-08-01;2026-08-15;2026-08-01;Cliente A;\"Pedido em aberto\"";
    expect(validarCsvLancamentos(csv)).toEqual({ linhas: [expect.objectContaining({ referencia: "IMP-001", tipo: "receber", descricao: "Venda; madeira", valor: "1250.50" })], erros: [] });
  });

  it("rejeita cabeçalhos inválidos, referências duplicadas e datas impossíveis", () => {
    expect(validarCsvLancamentos("tipo;descricao\nreceber;Teste").erros[0]).toMatch(/cabeçalhos/i);
    const csv = "referencia;tipo;descricao;categoria;valor;data_emissao;data_vencimento;competencia;contraparte;observacoes\nIMP-001;receber;Teste;Receitas;10;2026-02-30;2026-08-15;;;;\nIMP-001;pagar;Outro;Despesas;20;2026-08-01;2026-08-15;;;;";
    expect(validarCsvLancamentos(csv).erros).toEqual(expect.arrayContaining([expect.stringMatching(/data_emissao inválida/), expect.stringMatching(/referência duplicada/)]));
  });

  it("exporta CSV com BOM, referência estável e proteção contra fórmulas", () => {
    const csv = exportarLancamentosCsv([{ id: 8, tipo: "pagar", descricao: "=SOMA(A1:A2)", categoria: "Despesas", valor: "50", dataEmissao: "2026-08-01", dataVencimento: "2026-08-10" }]);
    expect(criarModeloCsvLancamentos()).toContain("referencia;tipo;descricao");
    expect(csv).toContain("FK-8;pagar;'=SOMA(A1:A2);Despesas;50,00");
  });

  it("recusa o arquivo inteiro quando a categoria não existe ou a referência já foi usada", () => {
    const csv = "referencia;tipo;descricao;categoria;valor;data_emissao;data_vencimento;competencia;contraparte;observacoes\nEXISTENTE;receber;Venda;Receitas;10;2026-08-01;2026-08-15;;;;\nNOVA;pagar;Compra;Inexistente;20;2026-08-01;2026-08-15;;;;";
    const resultado = prepararImportacaoLancamentos({
      conteudo: csv,
      categorias: [{ id: 1, nome: "Receitas", tipo: "receita" }],
      titulosExistentes: [{ id: 9, chaveImportacao: "EXISTENTE" }],
    });
    expect(resultado.linhas).toEqual([]);
    expect(resultado.erros).toEqual(expect.arrayContaining([expect.stringMatching(/já foi importada/i), expect.stringMatching(/não encontrada/i)]));
  });

  it("associa a categoria encontrada e produz um lote pronto para inserção atômica", () => {
    const csv = "referencia;tipo;descricao;categoria;valor;data_emissao;data_vencimento;competencia;contraparte;observacoes\nNOVA-1;pagar;Compra de insumos;Despesas;20;2026-08-01;2026-08-15;;;;";
    const resultado = prepararImportacaoLancamentos({ conteudo: csv, categorias: [{ id: 4, nome: "Despesas", tipo: "despesa" }], titulosExistentes: [] });
    expect(resultado).toEqual({ erros: [], linhas: [expect.objectContaining({ categoriaId: 4, referencia: "NOVA-1" })] });
  });

  it("não grava nenhuma linha quando o arquivo tem erro e insere um lote válido em transação", async () => {
    const lotes: unknown[] = [];
    let transacoes = 0;
    const database = {
      transaction: async (callback: (tx: any) => Promise<void>) => {
        transacoes += 1;
        await callback({ insert: () => ({ values: async (valores: unknown) => { lotes.push(valores); } }) });
      },
    };
    const categorias = [{ id: 7, nome: "Despesas", tipo: "despesa" as const }];
    const invalido = "referencia;tipo;descricao;categoria;valor;data_emissao;data_vencimento;competencia;contraparte;observacoes\nINV-1;pagar;Compra;Inexistente;10;2026-08-01;2026-08-10;;;;";
    await expect(importarLancamentosFinanceirosCsv(invalido, 2, 1, { database, categorias, titulosExistentes: [] })).resolves.toMatchObject({ importados: 0, erros: [expect.stringMatching(/não encontrada/i)] });
    expect(transacoes).toBe(0);
    expect(lotes).toEqual([]);

    const valido = "referencia;tipo;descricao;categoria;valor;data_emissao;data_vencimento;competencia;contraparte;observacoes\nIMP-10;pagar;Compra;Despesas;10;2026-08-01;2026-08-10;;;;";
    await expect(importarLancamentosFinanceirosCsv(valido, 2, 1, { database, categorias, titulosExistentes: [] })).resolves.toEqual({ importados: 1, erros: [] });
    expect(transacoes).toBe(1);
    expect(lotes).toEqual([expect.arrayContaining([expect.objectContaining({ chaveImportacao: "IMP-10", categoriaId: 7, criadoPor: 2 })])]);
  });
});
