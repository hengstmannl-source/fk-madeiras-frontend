import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

const { importarMutate, excluirMutate, cargasListQuery, plaquetasListQuery, perfilAtual } = vi.hoisted(() => ({
  importarMutate: vi.fn(),
  excluirMutate: vi.fn(),
  perfilAtual: { role: "admin" },
  cargasListQuery: vi.fn(() => ({ data: [{ id: 1, numero: "CAR-000001", dataCarga: "2026-08-12T12:00:00.000Z", origem: "Fazenda Norte", responsavel: "João", totalPlaquetas: 2, volumeTotal: "1.200000", valorProdutos: "1080.00", fretePorMetroCubico: "100.00", frete: "120.00", valorTotal: "1200.00" }], isLoading: false })),
  plaquetasListQuery: vi.fn(() => ({ data: { itens: [{ id: 5, codigo: "TOR-0005", madeiraNome: "Cedrinho", diametro: "30.00", comprimento: "5.00", volumeDisponivel: "0.353000", valorMetroCubico: "900.00", valorTotal: "317.70", estado: "disponivel" }], total: 20, totalDisponiveis: 20, proximoDeslocamento: 10 }, isLoading: false })),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: perfilAtual }) }));
vi.mock("@/lib/trpc", () => {
  const invalidar = { invalidate: vi.fn() };
  const mutation = { useMutation: () => ({ mutate: vi.fn(), isPending: false }) };
  return {
    trpc: {
      useUtils: () => ({ producao: { cargas: { list: invalidar, get: invalidar }, plaquetas: { list: invalidar } } }),
      producao: {
        cargas: {
          list: { useQuery: cargasListQuery },
          get: { useQuery: () => ({ data: { carga: { id: 1, dataCarga: "2026-08-12T12:00:00.000Z", origem: "Fazenda Norte", responsavel: "João", observacoes: null, volumeTotal: "1.200000", fretePorMetroCubico: "100.00", frete: "120.00" }, plaquetas: [{ codigo: "TOR-0005", madeiraNome: "Cedrinho", diametro: "30.00", comprimento: "5.00", valorMetroCubico: "900.00", observacoes: null }] }, isLoading: false }) },
          modeloPlaquetasCsv: { useQuery: () => ({ refetch: vi.fn() }) },
          create: mutation,
          update: mutation,
          excluir: { useMutation: () => ({ mutate: excluirMutate, isPending: false }) },
          importarPlaquetasCsv: { useMutation: () => ({ mutate: importarMutate, isPending: false }) },
        },
        plaquetas: { list: { useQuery: plaquetasListQuery }, create: mutation },
        estoque: { resumo: { useQuery: () => ({ data: [{ madeiraNome: "Cedrinho", espessura: "2.50", largura: "15.00", comprimento: "3.00", quantidadeDisponivel: 20, volumeDisponivel: "0.225000" }], isLoading: false }) } },
      },
    },
  };
});

import EstoquePage from "./EstoquePage";

afterEach(() => {
  cleanup();
  importarMutate.mockReset();
  excluirMutate.mockReset();
  cargasListQuery.mockClear();
  plaquetasListQuery.mockClear();
  perfilAtual.role = "admin";
});

describe("EstoquePage", () => {
  it("mantém Toras e Serrado em categorias próprias e oferece ações administrativas", async () => {
    const user = userEvent.setup();
    render(<EstoquePage />);

    expect(screen.getByRole("heading", { name: "Estoque" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Toras" })).toBeInTheDocument();
    expect(screen.getByText("CAR-000001")).toBeInTheDocument();
    expect(screen.getByText("TOR-0005")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar CAR-000001" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerar PDF de CAR-000001" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excluir CAR-000001" })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Serrado" }));
    expect(screen.getByRole("heading", { name: "Estoque serrado" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "20" })).toBeInTheDocument();
  });

  it("calcula frete por metro cúbico, totaliza a carga e mantém valores contidos nos cartões", async () => {
    const user = userEvent.setup();
    render(<EstoquePage />);

    expect(screen.getAllByRole("button", { name: "Novo romaneio de carga" })).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Novo romaneio de carga" }));
    await user.type(screen.getByPlaceholderText("PLQ-001"), "TOR-0100");
    await user.type(screen.getByPlaceholderText("Ex.: Cedrinho"), "Piqui");
    await user.type(screen.getByRole("textbox", { name: "Diâmetro (cm)" }), "20");
    await user.type(screen.getByRole("textbox", { name: "Comprimento (m)" }), "10");
    await user.type(screen.getByPlaceholderText("900,00"), "900");
    const frete = screen.getByRole("textbox", { name: "Frete por m³ (R$)" });
    await user.clear(frete);
    await user.type(frete, "100");

    expect(screen.getAllByText(/0,314/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/282,74/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/31,42/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/314,16/).length).toBeGreaterThan(0);
    expect(screen.getByText("Valor das toras")).toBeInTheDocument();
    expect(screen.getByText(/Frete \(R\$\s?100,00\/m³\)/)).toBeInTheDocument();
    expect(screen.getByText("Valor total da carga")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Adicionar plaqueta" }));
    expect(screen.getAllByPlaceholderText("PLQ-001")).toHaveLength(2);
    expect(screen.getAllByPlaceholderText("Ex.: Cedrinho")[1]).toHaveValue("Piqui");
    expect(screen.getAllByPlaceholderText("900,00")[1]).toHaveValue("900");
  });

  it("oferece importação por planilha CSV com modelo e dados do romaneio", async () => {
    const user = userEvent.setup();
    render(<EstoquePage />);
    await user.click(screen.getByRole("button", { name: "Importar planilha" }));
    expect(screen.getByRole("heading", { name: "Importar toras por planilha" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Baixar modelo CSV" })).toBeInTheDocument();
    expect(screen.getByText(/todos os dados são validados/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Planilha CSV")).toHaveAttribute("accept", ".csv,text/csv");
    expect(screen.getByRole("button", { name: "Importar toras" })).toBeInTheDocument();
  });

  it("apresenta o fluxo de sucesso quando a importação validada é concluída", async () => {
    const user = userEvent.setup();
    importarMutate.mockImplementationOnce((_entrada, opcoes) => opcoes.onSuccess({ numero: "CARGA-IMPORT-0001", importados: 1, erros: [] }));
    render(<EstoquePage />);
    await user.click(screen.getByRole("button", { name: "Importar planilha" }));
    await user.upload(screen.getByLabelText("Planilha CSV"), new File(["codigo;essencia;diametro_cm;comprimento_m;preco_m3\nTOR-TESTE;Cumaru;40;7,5;900"], "toras.csv", { type: "text/csv" }));
    await user.click(screen.getByRole("button", { name: "Importar toras" }));
    expect(importarMutate).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalled();
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

  it("solicita confirmação e exclui o romaneio quando as toras estão disponíveis", async () => {
    const user = userEvent.setup();
    excluirMutate.mockImplementationOnce((_entrada, opcoes) => opcoes.onSuccess({ id: 1, numero: "CAR-000001", totalPlaquetas: 2 }));
    render(<EstoquePage />);
    await user.click(screen.getByRole("button", { name: "Excluir CAR-000001" }));
    expect(screen.getByRole("heading", { name: "Excluir romaneio de carga?" })).toBeInTheDocument();
    expect(screen.getByText(/toras já usadas na produção/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Excluir romaneio" }));
    expect(excluirMutate).toHaveBeenCalledWith({ id: 1 }, expect.any(Object));
    expect(toast.success).toHaveBeenCalled();
  });

  it("filtra romaneios por período e origem", async () => {
    render(<EstoquePage />);
    fireEvent.change(screen.getByLabelText("Período inicial"), { target: { value: "2026-08-01" } });
    fireEvent.change(screen.getByLabelText("Período final"), { target: { value: "2026-08-31" } });
    fireEvent.change(screen.getByLabelText("Filtrar por origem"), { target: { value: "Norte" } });
    expect(cargasListQuery).toHaveBeenLastCalledWith({ dataInicial: "2026-08-01", dataFinal: "2026-08-31", origem: "Norte" });
    expect(screen.getByRole("button", { name: "Limpar filtros" })).toBeEnabled();
  });

  it("pesquisa plaquetas e navega em blocos de dez itens", async () => {
    const user = userEvent.setup();
    render(<EstoquePage />);
    await user.type(screen.getByLabelText("Pesquisar plaqueta ou essência"), "Cedrinho");
    expect(plaquetasListQuery).toHaveBeenLastCalledWith({ busca: "Cedrinho", limite: 10, deslocamento: 0 });
    expect(screen.getByText("Exibindo 1–1 de 20 plaqueta(s).")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Próximas 10" }));
    expect(plaquetasListQuery).toHaveBeenLastCalledWith({ busca: "Cedrinho", limite: 10, deslocamento: 10 });
  });

  it("oculta a ação de exclusão para utilizadores sem perfil administrativo", () => {
    perfilAtual.role = "user";
    render(<EstoquePage />);
    expect(screen.queryByRole("button", { name: "Excluir CAR-000001" })).not.toBeInTheDocument();
  });
});
