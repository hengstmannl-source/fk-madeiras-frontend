import React from "react";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  titulos: [] as Array<Record<string, unknown>>,
  cancelar: vi.fn(),
  invalidar: vi.fn(),
}));

vi.mock("wouter", () => ({ useSearch: () => "" }));
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
        },
      }),
      cliente: { list: queryVazia },
      financeiro: {
        titulos: {
          list: { useQuery: () => ({ data: state.titulos, isLoading: false }) },
          baixas: { useQuery: () => ({ data: [], isLoading: false, refetch: vi.fn() }) },
          createManual: mutationInerte,
          createParcelado: mutationInerte,
          baixar: mutationInerte,
          conciliarBaixa: mutationInerte,
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
      },
    },
  };
});

import FinanceiroPage from "./FinanceiroPage";

describe("FinanceiroPage — cancelamento manual", () => {
  beforeEach(() => {
    state.cancelar.mockReset();
    state.invalidar.mockReset();
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
});
