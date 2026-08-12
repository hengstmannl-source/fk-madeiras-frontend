import React from "react";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  venda: {} as Record<string, unknown>,
  entregar: vi.fn(),
  estornar: vi.fn(),
  invalidar: vi.fn(),
}));

vi.mock("wouter", () => ({ useLocation: () => ["/vendas/aprovadas", vi.fn()] }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      orcamento: { list: { invalidate: state.invalidar }, get: { invalidate: state.invalidar } },
      producao: { estoque: { resumo: { invalidate: state.invalidar } } },
    }),
    cliente: { list: { useQuery: () => ({ data: [{ id: 1, nome: "Cliente de teste" }] }) } },
    orcamento: {
      list: { useQuery: () => ({ data: [state.venda], isLoading: false }) },
      registrarPagamento: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
      entregarFisicamente: { useMutation: () => ({ isPending: false, mutate: (input: { id: number }, callbacks: { onSuccess?: (resultado: { pecasEntregues: number; pecasSemEstoque?: number }) => void }) => { state.entregar(input); callbacks.onSuccess?.({ pecasEntregues: 4, pecasSemEstoque: 2 }); } }) },
      estornarEntrega: { useMutation: () => ({ isPending: false, mutate: (input: { id: number; motivo: string }, callbacks: { onSuccess?: (resultado: { pecasDevolvidas: number }) => void }) => { state.estornar(input); callbacks.onSuccess?.({ pecasDevolvidas: 4 }); } }) },
    },
  },
}));

import OrcamentosAprovadosPage from "./OrcamentosAprovadosPage";

describe("OrcamentosAprovadosPage — entrega física", () => {
  beforeEach(() => {
    state.entregar.mockReset();
    state.estornar.mockReset();
    state.invalidar.mockReset();
    state.venda = {
      id: 25,
      numero: "VND-000025",
      clienteId: 1,
      total: "320.00",
      pago: true,
      pagoEm: "2026-08-11T12:00:00.000Z",
      formaPagamento: "pix",
      entregue: false,
      entregueEm: null,
      createdAt: "2026-08-11T12:00:00.000Z",
    };
  });

  it("oferece a entrega somente para venda paga e confirma a baixa física do estoque", async () => {
    const user = userEvent.setup();
    render(<OrcamentosAprovadosPage />);

    expect(screen.getByText("Aguardando entrega")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Registrar entrega" }));
    expect(screen.getByRole("heading", { name: "Confirmar entrega física" })).toBeInTheDocument();
    expect(screen.getByText(/recebimento da venda já foi confirmado/i)).toBeInTheDocument();
    expect(screen.getByText(/saldo negativo para regularização/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirmar entrega e baixa" }));
    expect(state.entregar).toHaveBeenCalledWith({ id: 25 });
    expect(state.invalidar).toHaveBeenCalled();
  });
});
