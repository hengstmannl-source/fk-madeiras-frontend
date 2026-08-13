import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("wouter", () => ({ useSearch: () => "" }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));
vi.mock("@/lib/trpc", () => {
  const queryVazia = { useQuery: () => ({ data: [], isLoading: false }) };
  const plaquetas = [
    { id: 8, codigo: "TOR-0008", madeiraNome: "Cedrinho", diametro: "30.00", comprimento: "4.20", volumeInicial: "0.380000", volumeDisponivel: "0.380000", dataEntrada: "2026-08-12T12:00:00.000Z", estado: "disponivel" },
    { id: 9, codigo: "INT-009", codigoFisico: "TOR-DUP", situacaoIdentificacao: "duplicada", madeiraNome: "Piqui", diametro: "45.00", comprimento: "5.00", volumeInicial: "0.795000", volumeDisponivel: "0.795000", dataEntrada: "2026-08-12T12:00:00.000Z", estado: "disponivel" },
  ];
  const romaneios = [{ id: 14, numero: "ROM-000014", dataProducao: "2026-08-12T12:00:00.000Z", plaquetaCodigo: "TOR-0008", madeiraTora: "Cedrinho", volumeTora: "0.380000", totalPecas: 12, volumeProduzido: "0.210000", aproveitamento: "55.26", fita: "Fita 1" }];
  const detalheRomaneio = { romaneio: { dataProducao: "2026-08-12T12:00:00.000Z", fita: "Fita 1", responsavel: "João", observacoes: "Ajuste de produção" }, toras: [{ plaquetaId: 8, codigo: "TOR-0008", madeiraNome: "Cedrinho", diametro: "30", comprimento: "4.2", volume: "0.38" }], itens: [{ madeiraNome: "Cedrinho", espessura: "3", largura: "5", comprimento: "2", quantidade: 11 }] };
  const mutationInerte = { useMutation: () => ({ mutate: vi.fn(), isPending: false }) };
  const invalidar = { invalidate: vi.fn() };
  return {
    trpc: {
      useUtils: () => ({ producao: { plaquetas: { list: invalidar }, romaneios: { list: invalidar, detalhe: { fetch: vi.fn().mockResolvedValue(detalheRomaneio) } }, estoque: { resumo: invalidar } } }),
      producao: {
        plaquetas: { list: { useQuery: () => ({ data: { itens: plaquetas, total: 1, totalDisponiveis: 1, proximoDeslocamento: null }, isLoading: false }) }, create: mutationInerte },
        romaneios: { list: { useQuery: () => ({ data: romaneios, isLoading: false }) }, itens: queryVazia, confirmar: mutationInerte, update: mutationInerte, modeloTorasCsv: { useQuery: () => ({ data: undefined, isLoading: false, refetch: vi.fn() }) }, importarTorasCsv: mutationInerte, modeloPecasCsv: { useQuery: () => ({ data: undefined, isLoading: false, refetch: vi.fn() }) }, importarPecasCsv: mutationInerte },
        estoque: { resumo: queryVazia },
      },
    },
  };
});

import ProducaoPage from "./ProducaoPage";

Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", { configurable: true, value: () => false });
Object.defineProperty(HTMLElement.prototype, "setPointerCapture", { configurable: true, value: () => undefined });
Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", { configurable: true, value: () => undefined });
Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: () => undefined });

afterEach(() => cleanup());

describe("ProducaoPage", () => {
  it("apresenta somente a produção diária e orienta o uso prévio do Estoque", () => {
    render(<ProducaoPage />);

    expect(screen.getByRole("heading", { name: "Produção diária" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nova produção diária" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Nova produção/i })).toHaveLength(1);
    expect(screen.queryByRole("tab", { name: "Estoque de toras" })).not.toBeInTheDocument();
    expect(screen.getByText(/Registre todas as plaquetas serradas no dia/i)).toBeInTheDocument();
  });

  it("adiciona a tora por digitação da plaqueta, permite conferir o resultado consolidado e disponibiliza o PDF", async () => {
    const user = userEvent.setup();
    const abrirJanela = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<ProducaoPage />);

    await user.click(screen.getByRole("button", { name: "Nova produção diária" }));
    await user.type(screen.getByLabelText("Código da plaqueta"), "TOR-0008");
    await user.keyboard("{Enter}");

    expect(screen.getByDisplayValue("Cedrinho")).toBeInTheDocument();
    expect(screen.getByDisplayValue("30.00")).toBeInTheDocument();
    expect(screen.getByDisplayValue("0.380000")).toBeInTheDocument();
    expect(screen.getByText("Resultado das toras serradas")).toBeInTheDocument();
    expect(screen.getByText(/0,38 m³ de Cedrinho/)).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await user.click(screen.getAllByRole("button", { name: "PDF" })[0]);
    expect(abrirJanela).toHaveBeenCalledWith("/api/pdf/romaneio/14", "_blank", "noopener,noreferrer");
    abrirJanela.mockRestore();
  });

  it("abre um romaneio confirmado para editar as peças e os dados operacionais", async () => {
    const user = userEvent.setup();
    render(<ProducaoPage />);

    await user.click(screen.getAllByRole("button", { name: "Editar" })[0]);

    expect(await screen.findByDisplayValue("Ajuste de produção")).toBeInTheDocument();
    expect(screen.getByText(/Cedrinho · 3 × 5 cm · 2 m/)).toBeInTheDocument();
    expect(screen.getByLabelText("Essência da bitola")).toHaveValue("Cedrinho");
  });

  it("permite preparar uma nova plaqueta digitada para entrada e consumo imediato", async () => {
    const user = userEvent.setup();
    render(<ProducaoPage />);

    await user.click(screen.getByRole("button", { name: "Nova produção diária" }));
    await user.type(screen.getByLabelText("Código da plaqueta"), "AVU-001");
    await user.keyboard("{Enter}");

    expect(screen.getByText("AVU-001")).toBeInTheDocument();
    expect(screen.getAllByText(/Ajuste as medidas/i)).not.toHaveLength(0);
    expect(screen.getByRole("button", { name: "Continuar para peças" })).toBeDisabled();
  });

  it("não preenche automaticamente as medidas quando a plaqueta física está duplicada", async () => {
    const user = userEvent.setup();
    render(<ProducaoPage />);

    await user.click(screen.getByRole("button", { name: "Nova produção diária" }));
    await user.type(screen.getByLabelText("Código da plaqueta"), "TOR-DUP");
    await user.keyboard("{Enter}");

    expect(screen.getByText("TOR-DUP")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Piqui")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar para peças" })).toBeDisabled();
  });

  it("oferece a importação de plaquetas por planilha dentro do romaneio", async () => {
    const user = userEvent.setup();
    render(<ProducaoPage />);

    await user.click(screen.getByRole("button", { name: "Nova produção diária" }));
    await user.click(screen.getByRole("button", { name: "Importar planilha" }));

    expect(screen.getByRole("heading", { name: "Importar plaquetas para produção" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Baixar modelo CSV" })).toBeInTheDocument();
    expect(screen.getByLabelText("Planilha CSV de produção")).toBeInTheDocument();
  });

  it("adiciona bitolas por uma ficha única e mantém a última medida para o próximo lançamento", async () => {
    const user = userEvent.setup();
    render(<ProducaoPage />);

    await user.click(screen.getByRole("button", { name: "Nova produção diária" }));
    await user.type(screen.getByLabelText("Código da plaqueta"), "TOR-0008");
    await user.keyboard("{Enter}");
    await user.click(screen.getByRole("button", { name: "Continuar para peças" }));

    expect(screen.getByText(/Nenhuma bitola adicionada/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Essência da bitola")).toHaveValue("Cedrinho");

    await user.type(screen.getByLabelText("Espessura da bitola"), "3");
    await user.type(screen.getByLabelText("Largura da bitola"), "5");
    await user.type(screen.getByLabelText("Comprimento da bitola"), "2");
    await user.type(screen.getByLabelText("Quantidade da bitola"), "11");
    await user.click(screen.getByRole("button", { name: "Adicionar bitola" }));

    expect(screen.getByText(/Cedrinho · 3 × 5 cm · 2 m/)).toBeInTheDocument();
    expect(screen.getByText(/11 peças/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Essência da bitola")).toHaveValue("Cedrinho");
    expect(screen.getByLabelText("Espessura da bitola")).toHaveValue("3");
    expect(screen.getByLabelText("Largura da bitola")).toHaveValue("5");
  });

  it("oferece a importação de peças serradas por planilha na etapa de bitolas", async () => {
    const user = userEvent.setup();
    render(<ProducaoPage />);

    await user.click(screen.getByRole("button", { name: "Nova produção diária" }));
    await user.type(screen.getByLabelText("Código da plaqueta"), "TOR-0008");
    await user.keyboard("{Enter}");
    await user.click(screen.getByRole("button", { name: "Continuar para peças" }));
    await user.click(screen.getByRole("button", { name: "Importar planilha" }));

    expect(screen.getByRole("heading", { name: "Importar peças serradas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Baixar modelo CSV" })).toBeInTheDocument();
    expect(screen.getByLabelText("Planilha CSV de peças")).toBeInTheDocument();
  });
});
