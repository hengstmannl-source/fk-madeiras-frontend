import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ setLocation: vi.fn() }));

vi.mock("wouter", () => ({ useLocation: () => ["/financeiro/caixa-cheque", state.setLocation] }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    financeiro: {
      cheques: {
        resumo: { useQuery: () => ({ data: { totalDisponivel: 750, quantidadeDisponivel: 2, totalUtilizado: 250, quantidadeUtilizada: 1, contas: [{ id: 9, nome: "Caixa Cheque" }] }, isLoading: false }) },
        list: { useQuery: () => ({ data: [{ id: 3, referencia: "CHQ-001", clienteNome: "Madeireira Norte", contaNome: "Caixa Cheque", dataRecebimento: "2026-08-11T12:00:00.000Z", utilizadoEm: null, estado: "disponivel", valor: "750.00" }], isLoading: false }) },
      },
    },
  },
}));

import CaixaChequePage from "./CaixaChequePage";

describe("CaixaChequePage", () => {
  afterEach(() => {
    cleanup();
    state.setLocation.mockReset();
  });

  it("exibe o saldo, os totais e a rastreabilidade do cheque disponível", () => {
    render(<CaixaChequePage />);

    expect(screen.getByRole("heading", { name: "Caixa Cheque" })).toBeInTheDocument();
    expect(screen.getAllByText("R$ 750,00")).toHaveLength(2);
    expect(screen.getByText("R$ 250,00")).toBeInTheDocument();
    expect(screen.getByText("CHQ-001")).toBeInTheDocument();
    expect(screen.getByText("Madeireira Norte")).toBeInTheDocument();
    expect(screen.getByText("Disponível")).toBeInTheDocument();
  });

  it("leva aos fluxos financeiros de recebimento e pagamento", () => {
    render(<CaixaChequePage />);

    fireEvent.click(screen.getByRole("button", { name: "Registrar recebimento" }));
    fireEvent.click(screen.getByRole("button", { name: "Usar em pagamento" }));

    expect(state.setLocation).toHaveBeenNthCalledWith(1, "/financeiro?tipo=receber");
    expect(state.setLocation).toHaveBeenNthCalledWith(2, "/financeiro?tipo=pagar");
  });
});
