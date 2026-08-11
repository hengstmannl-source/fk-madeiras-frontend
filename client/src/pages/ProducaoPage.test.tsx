import React from "react";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("wouter", () => ({ useSearch: () => "" }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/trpc", () => {
  const queryVazia = { useQuery: () => ({ data: [], isLoading: false }) };
  const mutationInerte = { useMutation: () => ({ mutate: vi.fn(), isPending: false }) };
  const invalidar = { invalidate: vi.fn() };
  return {
    trpc: {
      useUtils: () => ({ producao: { plaquetas: { list: invalidar }, romaneios: { list: invalidar }, estoque: { resumo: invalidar } } }),
      producao: {
        plaquetas: { list: queryVazia, create: mutationInerte },
        romaneios: { list: queryVazia, itens: queryVazia, confirmar: mutationInerte },
        estoque: { resumo: queryVazia },
      },
    },
  };
});

import ProducaoPage from "./ProducaoPage";

describe("ProducaoPage", () => {
  it("apresenta romaneios, plaquetas e estoque e abre o cadastro de matéria-prima", async () => {
    const user = userEvent.setup();
    render(<ProducaoPage />);

    expect(screen.getByRole("heading", { name: "Produção e estoque serrado" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Romaneios" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Plaquetas" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Estoque de peças" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Nova plaqueta" }));
    expect(screen.getByRole("heading", { name: "Nova plaqueta" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ex.: PLQ-0001")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ex.: Cedrinho")).toBeInTheDocument();
  });
});
