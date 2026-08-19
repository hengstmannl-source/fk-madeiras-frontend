import { describe, expect, it, vi } from "vitest";
import { atribuirNumeroVendaAprovada, atualizarDatasOrcamento, cancelarRecebivelDeVendaExcluida, listTitulosFinanceiros, updateOrcamentoEstado } from "./db";
import { formatReceivableSaleReference } from "../client/src/lib/utils";

function criarBancoDeOrcamentoFalso() {
  const historicos: any[] = [];
  const db = {
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({ limit: async () => [{ id: 150001, pago: false }] }),
      }),
    })),
    update: vi.fn(() => ({
      set: () => ({ where: async () => undefined }),
    })),
    insert: vi.fn(() => ({
      values: async (valor: any) => {
        historicos.push(valor);
        return [{ insertId: 1 }];
      },
    })),
  };
  return { db, historicos };
}

describe("mudança de estado de orçamento", () => {
  it("envia o orçamento e grava o histórico de estado", async () => {
    const { db, historicos } = criarBancoDeOrcamentoFalso();

    await updateOrcamentoEstado(150001, "enviado", 1, false, { database: db });

    expect(historicos).toEqual([{
      orcamentoId: 150001,
      usuarioId: 1,
      tipo: "estado",
      detalhes: JSON.stringify({ novoEstado: "enviado" }),
    }]);
  });

  it("aprova o orçamento, grava o histórico e cria o recebível", async () => {
    const { db, historicos } = criarBancoDeOrcamentoFalso();
    const criarTituloReceber = vi.fn().mockResolvedValue({ id: 101 });
    const atribuirNumero = vi.fn().mockResolvedValue("VND-000123");

    await updateOrcamentoEstado(150001, "aprovado", 1, false, { database: db, criarTituloReceber, atribuirNumero });

    expect(historicos[0]).toMatchObject({
      orcamentoId: 150001,
      usuarioId: 1,
      tipo: "estado",
      detalhes: JSON.stringify({ novoEstado: "aprovado", numero: "VND-000123" }),
    });
    expect(atribuirNumero).toHaveBeenCalledWith(150001);
    expect(criarTituloReceber).toHaveBeenCalledWith(150001, 1);
  });

  it("apresenta o número definitivo da venda no recebível listado após a aprovação", async () => {
    const { db } = criarBancoDeOrcamentoFalso();
    const tituloAprovado = {
      id: 101,
      origem: "orcamento",
      descricao: "Venda VND-000123",
      tipo: "receber",
      estado: "aberto",
      dataVencimento: new Date(2030, 0, 15),
    };
    const criarTituloReceber = vi.fn().mockResolvedValue(tituloAprovado);

    await updateOrcamentoEstado(150001, "aprovado", 1, false, {
      database: db,
      criarTituloReceber,
      atribuirNumero: vi.fn().mockResolvedValue("VND-000123"),
    });

    const bancoFinanceiro = {
      select: vi.fn(() => ({
        from: () => ({
          where: () => ({ orderBy: async () => [tituloAprovado] }),
        }),
      })),
    };
    const recebiveis = await listTitulosFinanceiros({ tipo: "receber" }, { database: bancoFinanceiro, atualizarEstado: async (titulo) => titulo });

    expect(criarTituloReceber).toHaveBeenCalledWith(150001, 1);
    expect(recebiveis).toHaveLength(1);
    expect(formatReceivableSaleReference(recebiveis[0].origem, recebiveis[0].descricao)).toBe("Venda vinculada · VND-000123");
  });

  it("reserva uma numeração sequencial única ao aprovar a venda", async () => {
    const atualizacoes: any[] = [];
    const reservas: any[] = [];
    const db = {
      select: vi.fn(() => ({ from: () => ({ where: () => ({ limit: async () => [{ id: 150001, empresaId: 31, numero: null }] }) }) })),
      insert: vi.fn(() => ({ values: async (dados: any) => { reservas.push(dados); return [{ insertId: 42 }]; } })),
      update: vi.fn(() => ({ set: (dados: any) => { atualizacoes.push(dados); return { where: async () => undefined }; } })),
    };
    await expect(atribuirNumeroVendaAprovada(150001, db)).resolves.toBe("VND-000042");
    expect(reservas).toEqual([{ empresaId: 31, orcamentoId: 150001, numero: "PENDENTE-150001" }]);
    expect(atualizacoes).toEqual([{ numero: "VND-000042" }, { numero: "VND-000042" }]);
  });

  it("cancela o recebível sem baixa antes de excluir uma venda aprovada", async () => {
    const atualizacoes: any[] = [];
    const db = {
      select: vi.fn(() => ({ from: () => ({ where: () => ({ limit: async () => [{ id: 101, valorBaixado: "0" }] }) }) })),
      update: vi.fn(() => ({ set: (dados: any) => { atualizacoes.push(dados); return { where: async () => undefined }; } })),
    };
    await expect(cancelarRecebivelDeVendaExcluida(150001, 1, db)).resolves.toMatchObject({ cancelado: true, tituloId: 101 });
    expect(atualizacoes[0]).toMatchObject({ estado: "cancelado", canceladoPor: 1 });
    expect(atualizacoes[1]).toHaveProperty("resolvidoEm");
  });

  it("atualiza vencimento e competência da venda e do recebível vinculado", async () => {
    const atualizacoes: any[] = [];
    const venda = { id: 150001, pago: false };
    const titulo = {
      id: 101,
      valorOriginal: "1500.00",
      desconto: "0",
      juros: "0",
      valorBaixado: "0",
      estado: "aberto",
    };
    const db = {
      select: vi.fn()
        .mockImplementationOnce(() => ({ from: () => ({ where: () => ({ limit: async () => [venda] }) }) }))
        .mockImplementationOnce(() => ({ from: () => ({ where: () => ({ limit: async () => [titulo] }) }) })),
      update: vi.fn(() => ({
        set: (dados: any) => {
          atualizacoes.push(dados);
          return { where: async () => undefined };
        },
      })),
    };
    const dataVencimento = new Date(2030, 4, 15, 12);
    const competencia = new Date(2030, 4, 1, 12);

    const resultado = await atualizarDatasOrcamento(150001, { dataVencimento, competencia }, false, db);

    expect(resultado).toEqual({ success: true, tituloAtualizado: true });
    expect(atualizacoes[0]).toEqual({ dataVencimento, competencia });
    expect(atualizacoes[1]).toMatchObject({ dataVencimento, competencia, estado: "aberto" });
  });
});
