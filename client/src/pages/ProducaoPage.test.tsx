import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.stubGlobal("ResizeObserver", class {
  observe() {}
  unobserve() {}
  disconnect() {}
});

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
  const serragens = [{ id: 31, numero: "SER-000031", clienteNome: "Marcenaria Silva", dataProducao: "2026-08-14T12:00:00.000Z", volumeToras: "0.750000", volumeProduzido: "0.390000", valorServico: "450.00" }];
  const detalheSerragem = { lotes: [{ id: 71, madeiraNome: "Cedrinho", espessura: "3", largura: "5", comprimento: "2", quantidadeDisponivel: 12 }] };
  const mutationInerte = { useMutation: () => ({ mutate: vi.fn(), isPending: false }) };
  const invalidar = { invalidate: vi.fn() };
  return {
    trpc: {
      useUtils: () => ({ producao: { plaquetas: { list: invalidar }, romaneios: { list: invalidar, detalhe: { fetch: vi.fn().mockResolvedValue(detalheRomaneio) } }, estoque: { resumo: invalidar }, serragemTerceiros: { list: invalidar, detalhe: { fetch: vi.fn().mockResolvedValue(detalheSerragem) } } }, cliente: { list: invalidar } }),
      producao: {
        plaquetas: { list: { useQuery: () => ({ data: { itens: plaquetas, total: 1, totalDisponiveis: 1, proximoDeslocamento: null }, isLoading: false }) }, create: mutationInerte },
        romaneios: { list: { useQuery: () => ({ data: romaneios, isLoading: false }) }, itens: queryVazia, confirmar: mutationInerte, update: mutationInerte, excluir: mutationInerte, modeloTorasCsv: { useQuery: () => ({ data: undefined, isLoading: false, refetch: vi.fn() }) }, importarTorasCsv: mutationInerte, modeloPecasCsv: { useQuery: () => ({ data: undefined, isLoading: false, refetch: vi.fn() }) }, importarPecasCsv: mutationInerte },
        estoque: { resumo: queryVazia },
        serragemTerceiros: { list: { useQuery: () => ({ data: serragens, isLoading: false }) }, criar: mutationInerte, registrarRetirada: mutationInerte },
      },
      cliente: { list: { useQuery: () => ({ data: [{ id: 1, nome: "Marcenaria Silva", telefone: "(67) 99999-0000" }], isLoading: false }) }, create: mutationInerte },
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

  it("oferece o serviço de serragem de terceiros sem exigir entrada das toras no estoque próprio", async () => {
    const user = userEvent.setup();
    render(<ProducaoPage />);

    expect(screen.getByText(/Toras recebidas de clientes não entram no estoque próprio/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Serragem de terceiros" }));

    expect(screen.getByRole("dialog")).toHaveTextContent(/Registre toras pertencentes ao cliente/i);
    expect(screen.getByText("Toras serradas do cliente")).toBeInTheDocument();
    expect(screen.getByText("Produção serrada")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar serviço" })).toBeInTheDocument();
  });

  it("calcula o volume das toras de terceiros, mostra a cobrança por m³ e repete a última essência", async () => {
    const user = userEvent.setup();
    render(<ProducaoPage />);

    await user.click(screen.getByRole("button", { name: "Serragem de terceiros" }));
    await user.type(screen.getByLabelText("Referência"), "CLI-02");
    await user.type(screen.getAllByLabelText("Essência")[0], "Cedrinho");
    await user.type(screen.getByLabelText("Diâmetro (cm)"), "50");
    await user.type(screen.getAllByLabelText("Comprimento (m)")[0], "4");
    await user.type(screen.getByLabelText("Tarifa por m³ (R$/m³) *"), "50");

    expect(screen.getByDisplayValue("0.785398")).toBeInTheDocument();
    expect(screen.getByText(/R\$ 50,00 × 0,785 m³ =/)).toHaveTextContent("R$ 39,27");

    await user.click(screen.getByRole("button", { name: "Adicionar tora" }));
    expect(screen.getAllByDisplayValue("Cedrinho")).toHaveLength(2);
  });

  it("permite criar um cliente diretamente no seletor de serragem", async () => {
    const user = userEvent.setup();
    render(<ProducaoPage />);

    await user.click(screen.getByRole("button", { name: "Serragem de terceiros" }));
    await user.click(screen.getByRole("combobox", { name: "Cliente proprietário" }));
    await user.click(screen.getByRole("option", { name: "Criar novo cliente" }));

    expect(screen.getByRole("heading", { name: "Novo cliente" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Nome do cliente")).toBeInTheDocument();
  });

  it("abre a retirada das peças de terceiros com o saldo disponível", async () => {
    const user = userEvent.setup();
    render(<ProducaoPage />);

    await user.click(screen.getByRole("button", { name: "Registrar retirada" }));

    expect(await screen.findByRole("heading", { name: "Registrar retirada de peças" })).toBeInTheDocument();
    expect(screen.getByText(/Disponível para retirada/i)).toHaveTextContent("12 peça(s)");
    expect(screen.getByLabelText("Retirar agora — Cedrinho")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar retirada" })).toBeInTheDocument();
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
    expect(screen.getByLabelText("Essência da medida")).toHaveValue("Cedrinho");
    expect(screen.getByLabelText("Comprimento da linha 1")).toHaveValue("");
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

  it("adiciona múltiplos comprimentos em uma grade e mantém a medida para o próximo lançamento", async () => {
    const user = userEvent.setup();
    render(<ProducaoPage />);

    await user.click(screen.getByRole("button", { name: "Nova produção diária" }));
    await user.type(screen.getByLabelText("Código da plaqueta"), "TOR-0008");
    await user.keyboard("{Enter}");
    await user.click(screen.getByRole("button", { name: "Continuar para peças" }));

    expect(screen.getByText(/Nenhum comprimento adicionado/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Essência da medida")).toHaveValue("Cedrinho");

    await user.type(screen.getByLabelText("Espessura da medida"), "3");
    await user.type(screen.getByLabelText("Largura da medida"), "5");
    await user.type(screen.getByLabelText("Comprimento da linha 1"), "2");
    await user.type(screen.getByLabelText("Quantidade da linha 1"), "11");
    await user.type(screen.getByLabelText("Comprimento da linha 2"), "3");
    await user.type(screen.getByLabelText("Quantidade da linha 2"), "7");
    await user.click(screen.getByRole("button", { name: "Adicionar comprimentos ao romaneio" }));

    expect(screen.getByText(/Cedrinho · 3 × 5 cm · 2 m/)).toBeInTheDocument();
    expect(screen.getByText(/11 peças/i)).toBeInTheDocument();
    expect(screen.getByText(/Cedrinho · 3 × 5 cm · 3 m/)).toBeInTheDocument();
    expect(screen.getByText(/7 peças/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Essência da medida")).toHaveValue("Cedrinho");
    expect(screen.getByLabelText("Espessura da medida")).toHaveValue("3");
    expect(screen.getByLabelText("Largura da medida")).toHaveValue("5");
    expect(screen.getByLabelText("Comprimento da linha 1")).toHaveValue("");
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

  it("pede confirmação antes de remover uma produção e explica a proteção do estoque", async () => {
    const user = userEvent.setup();
    render(<ProducaoPage />);

    await user.click(screen.getAllByRole("button", { name: "Excluir" })[0]);

    expect(screen.getByRole("heading", { name: "Remover produção diária?" })).toBeInTheDocument();
    expect(screen.getByText(/devolve as plaquetas ao estoque/i)).toBeInTheDocument();
    expect(screen.getByText(/já tiver sido entregue, inventariada ou ajustada/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remover produção" })).toBeInTheDocument();
  });
});
