import React from "react";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  search: "",
  titulos: [] as Array<Record<string, unknown>>,
  baixas: [] as Array<Record<string, unknown>>,
  cancelar: vi.fn(),
  estornar: vi.fn(),
  invalidar: vi.fn(),
  fluxo: {
    saldoAbertura: 100,
    entradas: 50,
    saidas: 20,
    saldoLiquido: 30,
    saldoFinal: 130,
    quantidadeMovimentos: 2,
    dias: [{ data: "2026-08-11", entradas: 50, saidas: 20, saldoLiquido: 30, saldoAcumulado: 130 }],
    movimentos: [{ id: 1, tipo: "receber", descricao: "Recebimento demonstrativo", valor: "50.00", dataBaixa: "2026-08-11T12:00:00.000Z", formaPagamento: "pix", contaNome: "Caixa geral" }],
  },
}));

vi.mock("wouter", () => ({ useSearch: () => state.search }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/lib/trpc", () => {
  const mutationInerte = { useMutation: () => ({ mutate: vi.fn(), isPending: false }) };
  const queryVazia = { useQuery: () => ({ data: [], isLoading: false }) };
  const invalidar = { invalidate: state.invalidar };

  return {
    trpc: {
      useUtils: () => ({
        financeiro: {
          titulos: { list: invalidar, baixas: invalidar },
          categorias: { list: invalidar },
          fornecedores: { list: invalidar },
          contas: { list: invalidar },
          recorrencias: { list: invalidar },
          alertas: { list: invalidar },
          relatorios: { fluxoCaixa: invalidar },
        },
      }),
      cliente: { list: queryVazia },
      financeiro: {
        titulos: {
          list: { useQuery: () => ({ data: state.titulos, isLoading: false }) },
          baixas: { useQuery: () => ({ data: state.baixas, isLoading: false, refetch: vi.fn() }) },
          createManual: mutationInerte,
          createParcelado: mutationInerte,
          baixar: mutationInerte,
          conciliarBaixa: mutationInerte,
          estornarBaixa: {
            useMutation: () => ({
              isPending: false,
              mutate: (input: { id: number; motivo: string }, callbacks: { onSuccess?: () => void }) => {
                state.estornar(input);
                state.baixas = state.baixas.map((baixa) => baixa.id === input.id ? {
                  ...baixa, estornada: true, estornadaEm: "2026-08-11T12:00:00.000Z", motivoEstorno: input.motivo,
                } : baixa);
                callbacks.onSuccess?.();
              },
            }),
          },
          cancelar: {
            useMutation: () => ({
              isPending: false,
              mutate: (input: { id: number }, callbacks: { onSuccess?: () => void }) => {
                state.cancelar(input);
                state.titulos = state.titulos.filter((titulo) => titulo.id !== input.id);
                callbacks.onSuccess?.();
              },
            }),
          },
        },
        categorias: { list: queryVazia, create: mutationInerte },
        fornecedores: { list: queryVazia, create: mutationInerte },
        contas: { list: queryVazia, create: mutationInerte },
        recorrencias: { list: queryVazia, create: mutationInerte },
        alertas: { list: queryVazia },
        relatorios: { fluxoCaixa: { useQuery: () => ({ data: state.fluxo, isLoading: false, isFetching: false, refetch: vi.fn() }) } },
      },
    },
  };
});

import FinanceiroPage, { abaFinanceiraDaUrl } from "./FinanceiroPage";

describe("FinanceiroPage — cancelamento manual", () => {
  beforeEach(() => {
    state.search = "";
    state.cancelar.mockReset();
    state.estornar.mockReset();
    state.invalidar.mockReset();
    state.baixas = [{
      id: 40,
      tituloId: 12,
      valor: "50.00",
      formaPagamento: "pix",
      contaNome: "Caixa geral",
      dataBaixa: "2026-08-11T12:00:00.000Z",
      conciliada: false,
      estornada: false,
    }];
    state.titulos = [
      {
        id: 10,
        descricao: "Recebimento para cancelar",
        tipo: "receber",
        estado: "aberto",
        valorOriginal: "540.00",
        valorBaixado: "0.00",
        desconto: "0.00",
        juros: "0.00",
        dataVencimento: "2026-08-11T00:00:00.000Z",
      },
      {
        id: 11,
        descricao: "Recebimento preservado",
        tipo: "receber",
        estado: "aberto",
        valorOriginal: "300.00",
        valorBaixado: "0.00",
        desconto: "0.00",
        juros: "0.00",
        dataVencimento: "2026-08-12T00:00:00.000Z",
      },
      {
        id: 12,
        descricao: "Recebimento com baixa",
        tipo: "receber",
        estado: "parcial",
        valorOriginal: "100.00",
        valorBaixado: "50.00",
        desconto: "0.00",
        juros: "0.00",
        dataVencimento: "2026-08-13T00:00:00.000Z",
      },
    ];
  });

  it("pede confirmação e remove o título cancelado da listagem ativa após confirmar", async () => {
    const user = userEvent.setup();
    render(<FinanceiroPage />);

    const linha = screen.getByText("Recebimento para cancelar").closest("tr");
    expect(linha).not.toBeNull();
    await user.click(within(linha!).getByRole("button", { name: "Cancelar" }));

    expect(screen.getByRole("heading", { name: "Cancelar conta a receber" })).toBeInTheDocument();
    expect(screen.getByText(/deixará de aparecer nas listas ativas/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));

    await waitFor(() => {
      expect(state.cancelar).toHaveBeenCalledWith({ id: 10 });
      expect(state.invalidar).toHaveBeenCalled();
      expect(screen.queryByText("Recebimento para cancelar")).not.toBeInTheDocument();
    });
    expect(screen.getAllByText("Recebimento preservado").length).toBeGreaterThan(0);
  });

  it("apresenta o fluxo de caixa com filtros de período e indicadores de saldo", async () => {
    const user = userEvent.setup();
    render(<FinanceiroPage />);

    await user.click(screen.getAllByRole("button", { name: "Fluxo de caixa" })[0]);

    expect(screen.getByRole("heading", { name: "Relatório de fluxo de caixa" })).toBeInTheDocument();
    expect(screen.getByLabelText("Data inicial do fluxo de caixa")).toHaveAttribute("type", "date");
    expect(screen.getByLabelText("Data final do fluxo de caixa")).toHaveAttribute("type", "date");
    expect(screen.getByText("Saldo final")).toBeInTheDocument();
    expect(screen.getByText("Recebimento demonstrativo")).toBeInTheDocument();
  });

  it("identifica a abertura direta do relatório pelo parâmetro de URL", () => {
    expect(abaFinanceiraDaUrl("?aba=fluxo")).toBe("fluxo");
    expect(abaFinanceiraDaUrl("?tipo=receber")).toBe("lancamentos");
  });

  it("confirma o estorno com motivo e sinaliza a baixa preservada como estornada", async () => {
    const user = userEvent.setup();
    render(<FinanceiroPage />);

    const linha = screen.getAllByText("Recebimento com baixa").map((elemento) => elemento.closest("tr")).find(Boolean);
    expect(linha).not.toBeNull();
    await user.click(within(linha!).getByRole("button", { name: "Baixas" }));
    await user.click(screen.getByRole("button", { name: "Estornar" }));

    expect(screen.getByRole("heading", { name: "Estornar baixa financeira" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Motivo do estorno *"), "Pagamento duplicado");
    await user.click(screen.getByRole("button", { name: "Confirmar estorno" }));

    await waitFor(() => {
      expect(state.estornar).toHaveBeenCalledWith({ id: 40, motivo: "Pagamento duplicado" });
      expect(screen.getByText("Estornada")).toBeInTheDocument();
      expect(screen.getByText(/Pagamento duplicado/)).toBeInTheDocument();
    });
  });
});
