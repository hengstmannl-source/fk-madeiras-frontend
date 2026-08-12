import userEvent from "@testing-library/user-event";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { criarNotaMutate, registrarAbastecimentoMutate, resumoQuery } = vi.hoisted(() => ({
  criarNotaMutate: vi.fn(),
  registrarAbastecimentoMutate: vi.fn(),
  resumoQuery: vi.fn(() => ({
    data: {
      saldoLitros: 400,
      custoMedioLitro: 6.5,
      valorEstoque: 2600,
      custoApropriado: 325,
      notas: [{ id: 1, numeroNota: "1001", fornecedorNome: "Posto Central", litros: "500", valorTotal: "3250", dataVencimento: "2026-08-20T12:00:00.000Z", titulo: { estado: "aberto" } }],
      abastecimentos: [{ id: 2, destino: "Carregadeira", responsavel: "João", litros: "50", custoUnitario: "6.5", custoTotal: "325", dataAbastecimento: "2026-08-12T12:00:00.000Z" }],
    },
    isLoading: false,
  })),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/trpc", () => {
  const invalidar = { invalidate: vi.fn() };
  return {
    trpc: {
      useUtils: () => ({ diesel: { resumo: invalidar } }),
      diesel: {
        resumo: { useQuery: resumoQuery },
        criarNota: { useMutation: () => ({ mutate: criarNotaMutate, isPending: false }) },
        registrarAbastecimento: { useMutation: () => ({ mutate: registrarAbastecimentoMutate, isPending: false }) },
      },
      financeiro: { fornecedores: { list: { useQuery: () => ({ data: [{ id: 7, nome: "Posto Central" }], isLoading: false }) } } },
    },
  };
});

import DieselPage from "./DieselPage";

afterEach(() => {
  cleanup();
  criarNotaMutate.mockReset();
  registrarAbastecimentoMutate.mockReset();
  resumoQuery.mockClear();
});

describe("DieselPage", () => {
  it("separa o pagamento da nota do custo real apropriado por abastecimento", () => {
    render(<DieselPage />);

    expect(screen.getByRole("heading", { name: "Diesel, notas e abastecimentos" })).toBeTruthy();
    expect(screen.getByText("400 L")).toBeTruthy();
    expect(screen.getAllByText(/6,50/).length).toBeGreaterThan(0);
    expect(screen.getByText("Nota 1001")).toBeTruthy();
    expect(screen.getByText("Agendado")).toBeTruthy();
    expect(screen.getByText("Carregadeira")).toBeTruthy();
    expect(screen.getAllByText(/325,00/).length).toBeGreaterThan(0);
  });

  it("agenda a nota no financeiro antes de permitir a apropriação por abastecimento", async () => {
    const user = userEvent.setup();
    render(<DieselPage />);

    await user.click(screen.getByRole("button", { name: "Nova nota de diesel" }));
    await user.selectOptions(screen.getByLabelText("Fornecedor da nota de diesel"), "7");
    await user.type(screen.getByPlaceholderText("Ex.: 1.000"), "1000");
    await user.type(screen.getByPlaceholderText("Ex.: 6.500,00"), "6500,00");
    await user.click(screen.getByRole("button", { name: "Agendar pagamento e adicionar ao tanque" }));

    expect(criarNotaMutate).toHaveBeenCalledWith(expect.objectContaining({ fornecedorId: 7, litros: "1000", valorTotal: "6500,00" }), expect.any(Object));
  });

  it("regista um abastecimento com destino, sem criar uma nova conta a pagar", async () => {
    const user = userEvent.setup();
    render(<DieselPage />);

    await user.click(screen.getByRole("button", { name: "Registrar abastecimento" }));
    await user.type(screen.getByPlaceholderText("Ex.: Carregadeira"), "Empilhadeira");
    await user.type(screen.getByPlaceholderText("Disponível: 400 L"), "25");
    await user.click(screen.getByRole("button", { name: "Confirmar abastecimento" }));

    expect(registrarAbastecimentoMutate).toHaveBeenCalledWith(expect.objectContaining({ destino: "Empilhadeira", litros: "25" }), expect.any(Object));
    expect(criarNotaMutate).not.toHaveBeenCalled();
  });
});
