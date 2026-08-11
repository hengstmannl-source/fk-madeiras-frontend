import { describe, expect, it } from "vitest";
import { alertasFinanceiros, configuracoesFinanceiras, titulosFinanceiros } from "../drizzle/schema";
import { processarAlertasFinanceiros, processarRecorrenciasFinanceiras } from "./db";

function criarBancoFinanceiroFalso(titulo: any, alertas: any[]) {
  let proximoId = 1;
  return {
    select: () => ({
      from: (tabela: unknown) => {
        if (tabela === titulosFinanceiros) return Promise.resolve([titulo]);
        return {
          where: () => {
            if (tabela === configuracoesFinanceiras) return { limit: () => Promise.resolve([{ id: 1, alertaDiasAntecedencia: 7 }]) };
            if (tabela === alertasFinanceiros) return Promise.resolve(alertas.filter((alerta) => alerta.estado === "ativo"));
            return Promise.resolve([]);
          },
        };
      },
    }),
    update: (tabela: unknown) => ({
      set: (dados: Record<string, unknown>) => ({
        where: async () => {
          if (tabela === titulosFinanceiros) Object.assign(titulo, dados);
          if (tabela === alertasFinanceiros && dados.estado === "resolvido") {
            alertas.filter((alerta) => alerta.estado === "ativo").forEach((alerta) => Object.assign(alerta, dados));
          }
        },
      }),
    }),
    insert: () => ({
      values: async (dados: Record<string, unknown>) => {
        alertas.push({ id: proximoId++, ...dados });
      },
    }),
  };
}

describe("processarAlertasFinanceiros", () => {
  it("persiste alerta próximo, faz transição para vencido e resolve após quitação", async () => {
    const agora = new Date(2026, 7, 11, 12);
    const titulo: any = {
      id: 10,
      descricao: "Compra de insumos",
      valorOriginal: "100.00",
      desconto: "0",
      juros: "0",
      valorBaixado: "0",
      dataVencimento: new Date(2026, 7, 15, 12),
      estado: "aberto",
    };
    const alertas: any[] = [];
    const banco = criarBancoFinanceiroFalso(titulo, alertas);

    await expect(processarAlertasFinanceiros(agora, banco)).resolves.toMatchObject({ alertasCriados: 1, alertasResolvidos: 0 });
    expect(alertas).toMatchObject([{ tipo: "vence_em_breve", estado: "ativo", tituloId: 10 }]);

    titulo.dataVencimento = new Date(2026, 7, 10, 12);
    await expect(processarAlertasFinanceiros(agora, banco)).resolves.toMatchObject({ alertasCriados: 1, alertasResolvidos: 1 });
    expect(alertas.filter((alerta) => alerta.estado === "ativo")).toMatchObject([{ tipo: "vencido" }]);

    titulo.valorBaixado = "100.00";
    await expect(processarAlertasFinanceiros(agora, banco)).resolves.toMatchObject({ alertasCriados: 0, alertasResolvidos: 1 });
    expect(alertas.every((alerta) => alerta.estado === "resolvido")).toBe(true);
  });

  it("é acionado pelo processamento diário de recorrências", async () => {
    const agora = new Date(2026, 7, 11, 12);
    const titulo: any = {
      id: 11,
      descricao: "Pagamento de frete",
      valorOriginal: "80.00",
      desconto: "0",
      juros: "0",
      valorBaixado: "0",
      dataVencimento: new Date(2026, 7, 14, 12),
      estado: "aberto",
    };
    const alertas: any[] = [];
    const resultado = await processarRecorrenciasFinanceiras(agora, criarBancoFinanceiroFalso(titulo, alertas));

    expect(resultado).toMatchObject({ recorrenciasAnalisadas: 0, titulosGerados: 0, alertasCriados: 1, alertasResolvidos: 0 });
    expect(alertas).toMatchObject([{ tituloId: 11, tipo: "vence_em_breve", estado: "ativo" }]);
  });
});
