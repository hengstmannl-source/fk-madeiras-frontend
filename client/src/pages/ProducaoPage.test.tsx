import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("wouter", () => ({ useSearch: () => "" }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/trpc", () => {
  const queryVazia = { useQuery: () => ({ data: [], isLoading: false }) };
  const plaquetas = [{ id: 8, codigo: "TOR-0008", madeiraNome: "Cedrinho", espessura: "24.00", largura: "38.00", comprimento: "4.20", volumeInicial: "0.380000", volumeDisponivel: "0.380000", dataEntrada: "2026-08-12T12:00:00.000Z", estado: "disponivel" }];
  const romaneios = [{ id: 14, numero: "ROM-000014", dataProducao: "2026-08-12T12:00:00.000Z", plaquetaCodigo: "TOR-0008", madeiraTora: "Cedrinho", volumeTora: "0.380000", totalPecas: 12, volumeProduzido: "0.210000", aproveitamento: "55.26", fita: "Fita 1" }];
  const mutationInerte = { useMutation: () => ({ mutate: vi.fn(), isPending: false }) };
  const invalidar = { invalidate: vi.fn() };
  return {
    trpc: {
      useUtils: () => ({ producao: { plaquetas: { list: invalidar }, romaneios: { list: invalidar }, estoque: { resumo: invalidar } } }),
      producao: {
        plaquetas: { list: { useQuery: () => ({ data: plaquetas, isLoading: false }) }, create: mutationInerte },
        romaneios: { list: { useQuery: () => ({ data: romaneios, isLoading: false }) }, itens: queryVazia, confirmar: mutationInerte },
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
    expect(screen.queryByRole("tab", { name: "Estoque de toras" })).not.toBeInTheDocument();
    expect(screen.getByText(/Selecione uma tora já recebida no Estoque/i)).toBeInTheDocument();
  });

  it("preenche a tora selecionada no romaneio e disponibiliza o PDF do documento confirmado", async () => {
    const user = userEvent.setup();
    const abrirJanela = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<ProducaoPage />);

    await user.click(screen.getByRole("button", { name: "Nova produção" }));
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("TOR-0008 · Cedrinho"));

    expect(screen.getByDisplayValue("Cedrinho")).toBeInTheDocument();
    expect(screen.getByDisplayValue("24.00")).toBeInTheDocument();
    expect(screen.getByDisplayValue("0.380000")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "PDF" }));
    expect(abrirJanela).toHaveBeenCalledWith("/api/pdf/romaneio/14", "_blank", "noopener,noreferrer");
    abrirJanela.mockRestore();
  });
});
