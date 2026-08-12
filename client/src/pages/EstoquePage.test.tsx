import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/trpc", () => {
  const invalidar = { invalidate: vi.fn() };
  const mutation = { useMutation: () => ({ mutate: vi.fn(), isPending: false }) };
  return {
    trpc: {
      useUtils: () => ({ producao: { cargas: { list: invalidar, get: invalidar }, plaquetas: { list: invalidar } } }),
      producao: {
        cargas: { list: { useQuery: () => ({ data: [{ id: 1, numero: "CAR-000001", dataCarga: "2026-08-12T12:00:00.000Z", origem: "Fazenda Norte", responsavel: "João", totalPlaquetas: 2, volumeTotal: "1.200000", valorProdutos: "1080.00", frete: "120.00", valorTotal: "1200.00" }], isLoading: false }) }, get: { useQuery: () => ({ data: { carga: { id: 1, dataCarga: "2026-08-12T12:00:00.000Z", origem: "Fazenda Norte", responsavel: "João", observacoes: null, frete: "120.00" }, plaquetas: [{ codigo: "TOR-0005", madeiraNome: "Cedrinho", diametro: "30.00", comprimento: "5.00", valorMetroCubico: "900.00", observacoes: null }] }, isLoading: false }) }, create: mutation, update: mutation },
        plaquetas: { list: { useQuery: () => ({ data: [{ id: 5, codigo: "TOR-0005", madeiraNome: "Cedrinho", diametro: "30.00", comprimento: "5.00", volumeDisponivel: "0.353000", valorMetroCubico: "900.00", valorTotal: "317.70", estado: "disponivel" }], isLoading: false }) }, create: mutation },
        estoque: { resumo: { useQuery: () => ({ data: [{ madeiraNome: "Cedrinho", espessura: "2.50", largura: "15.00", comprimento: "3.00", quantidadeDisponivel: 20, volumeDisponivel: "0.225000" }], isLoading: false }) } },
      },
    },
  };
});

import EstoquePage from "./EstoquePage";

afterEach(() => cleanup());

describe("EstoquePage", () => {
  it("mantém Toras e Serrado em categorias próprias", async () => {
    const user = userEvent.setup();
    render(<EstoquePage />);

    expect(screen.getByRole("heading", { name: "Estoque" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Toras" })).toBeInTheDocument();
    expect(screen.getByText("CAR-000001")).toBeInTheDocument();
    expect(screen.getByText("TOR-0005")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar CAR-000001" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerar PDF de CAR-000001" })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Serrado" }));
    expect(screen.getByRole("heading", { name: "Estoque serrado" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "20" })).toBeInTheDocument();
  });

  it("monta uma lista responsiva de plaquetas e soma frete e valor automaticamente", async () => {
    const user = userEvent.setup();
    render(<EstoquePage />);

    expect(screen.getAllByRole("button", { name: "Novo romaneio de carga" })).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Novo romaneio de carga" }));
    await user.type(screen.getByPlaceholderText("PLQ-001"), "TOR-0100");
    await user.type(screen.getByPlaceholderText("Ex.: Cedrinho"), "Piqui");
    const camposDecimais = screen.getAllByPlaceholderText("0,00");
    await user.type(camposDecimais[1], "20");
    await user.type(camposDecimais[2], "10");
    await user.type(screen.getByPlaceholderText("900,00"), "900");
    const frete = camposDecimais[0];
    await user.clear(frete);
    await user.type(frete, "100");

    expect(screen.getAllByText(/0,314/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/282,74/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/382,74/).length).toBeGreaterThan(0);
    expect(screen.getByText("Valor das toras")).toBeInTheDocument();
    expect(screen.getByText("Valor total da carga")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Adicionar plaqueta" }));
    expect(screen.getAllByPlaceholderText("PLQ-001")).toHaveLength(2);
    expect(screen.getAllByPlaceholderText("Ex.: Cedrinho")[1]).toHaveValue("Piqui");
    expect(screen.getAllByPlaceholderText("900,00")[1]).toHaveValue("900");
  });

  it("carrega os dados do romaneio no formulário de edição", async () => {
    const user = userEvent.setup();
    render(<EstoquePage />);

    await user.click(screen.getByRole("button", { name: "Editar CAR-000001" }));

    expect(await screen.findByRole("heading", { name: "Editar romaneio de carga" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Fazenda Norte")).toBeInTheDocument();
    expect(screen.getByDisplayValue("TOR-0005")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar alterações" })).toBeInTheDocument();
  });
});
