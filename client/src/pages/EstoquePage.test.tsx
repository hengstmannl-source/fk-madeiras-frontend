import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

vi.stubGlobal("ResizeObserver", class {
  observe() {}
  unobserve() {}
  disconnect() {}
});
Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });

const { criarCargaMutate, criarFornecedorMutate, importarMutate, excluirMutate, cargasListQuery, plaquetasListQuery, estoqueResumoQuery, perfilAtual } = vi.hoisted(() => ({
  criarCargaMutate: vi.fn(),
  criarFornecedorMutate: vi.fn(),
  importarMutate: vi.fn(),
  excluirMutate: vi.fn(),
  perfilAtual: { role: "admin" },
  cargasListQuery: vi.fn(() => ({ data: [{ id: 1, numero: "CAR-000001", dataCarga: "2026-08-12T12:00:00.000Z", dataVencimento: "2026-08-20T12:00:00.000Z", origem: "Fazenda Norte", fornecedorId: 7, responsavel: "João", totalPlaquetas: 2, volumeTotal: "1.200000", valorProdutos: "1080.00", fretePorMetroCubico: "100.00", frete: "120.00", valorTotal: "1200.00" }], isLoading: false })),
  plaquetasListQuery: vi.fn(() => ({ data: { itens: [{ id: 5, codigo: "TOR-0005", madeiraNome: "Cedrinho", diametro: "30.00", comprimento: "5.00", volumeDisponivel: "0.353000", valorMetroCubico: "900.00", valorTotal: "317.70", estado: "disponivel" }], total: 20, totalDisponiveis: 20, proximoDeslocamento: 10 }, isLoading: false })),
  estoqueResumoQuery: vi.fn(() => ({ data: [
    { madeiraNome: "Cedrinho", espessura: "2.50", largura: "15.00", comprimento: "3.00", quantidadeDisponivel: 20, volumeDisponivel: "0.225000" },
    { madeiraNome: "Cedrinho", espessura: "2.50", largura: "15.00", comprimento: "4.00", quantidadeDisponivel: 4, volumeDisponivel: "0.060000" },
  ], isLoading: false })),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: perfilAtual }) }));
vi.mock("@/lib/trpc", () => {
  const invalidar = { invalidate: vi.fn() };
  const mutation = { useMutation: () => ({ mutate: vi.fn(), isPending: false }) };
  return {
    trpc: {
      useUtils: () => ({ producao: { cargas: { list: invalidar, get: invalidar }, plaquetas: { list: invalidar } }, financeiro: { fornecedores: { list: invalidar } } }),
      producao: {
        cargas: {
          list: { useQuery: cargasListQuery },
          get: { useQuery: () => ({ data: { carga: { id: 1, dataCarga: "2026-08-12T12:00:00.000Z", dataVencimento: "2026-08-20T12:00:00.000Z", origem: "Fazenda Norte", fornecedorId: 7, responsavel: "João", observacoes: null, volumeTotal: "1.200000", fretePorMetroCubico: "100.00", frete: "120.00" }, plaquetas: [{ codigo: "TOR-0005", madeiraNome: "Cedrinho", diametro: "30.00", comprimento: "5.00", valorMetroCubico: "900.00", observacoes: null }] }, isLoading: false }) },
          modeloPlaquetasCsv: { useQuery: () => ({ refetch: vi.fn() }) },
          create: { useMutation: () => ({ mutate: criarCargaMutate, isPending: false }) },
          update: mutation,
          excluir: { useMutation: () => ({ mutate: excluirMutate, isPending: false }) },
          importarPlaquetasCsv: { useMutation: () => ({ mutate: importarMutate, isPending: false }) },
        },
        plaquetas: { list: { useQuery: plaquetasListQuery }, create: mutation },
        estoque: { resumo: { useQuery: estoqueResumoQuery } },
      },
      financeiro: { fornecedores: { list: { useQuery: () => ({ data: [{ id: 7, nome: "Madeiras Norte" }], isLoading: false }) }, create: { useMutation: () => ({ mutate: criarFornecedorMutate, isPending: false }) } } },
    },
  };
});

import EstoquePage from "./EstoquePage";

afterEach(() => {
  cleanup();
  criarCargaMutate.mockReset();
  criarFornecedorMutate.mockReset();
  importarMutate.mockReset();
  excluirMutate.mockReset();
  cargasListQuery.mockClear();
  plaquetasListQuery.mockClear();
  estoqueResumoQuery.mockReset();
  estoqueResumoQuery.mockImplementation(() => ({ data: [
    { madeiraNome: "Cedrinho", espessura: "2.50", largura: "15.00", comprimento: "3.00", quantidadeDisponivel: 20, volumeDisponivel: "0.225000" },
    { madeiraNome: "Cedrinho", espessura: "2.50", largura: "15.00", comprimento: "4.00", quantidadeDisponivel: 4, volumeDisponivel: "0.060000" },
  ], isLoading: false }));
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
    expect(screen.getByRole("button", { name: "Exibir comprimentos de Cedrinho 2,5 × 15 cm" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("total-filtrado-serrado")).toHaveTextContent("24 peças · 0,285 m³");
  });

  it("filtra o estoque serrado por essência, espessura, largura e comprimento", async () => {
    const user = userEvent.setup();
    render(<EstoquePage />);
    await user.click(screen.getByRole("tab", { name: "Serrado" }));

    await user.type(screen.getByLabelText("Filtrar essência serrada"), "Itaúba");
    expect(screen.getByText("Nenhuma peça encontrada para os filtros informados.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Limpar filtros" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));
    await user.type(screen.getByLabelText("Filtrar espessura serrada"), "2,5");
    await user.type(screen.getByLabelText("Filtrar largura serrada"), "15");
    await user.type(screen.getByLabelText("Filtrar comprimento serrado"), "3");
    expect(screen.getByRole("button", { name: "Exibir comprimentos de Cedrinho 2,5 × 15 cm" })).toBeInTheDocument();
    expect(screen.getByTestId("total-filtrado-serrado")).toHaveTextContent("20 peças · 0,225 m³");
  });

  it("expande uma medida para mostrar os saldos de cada comprimento", async () => {
    const user = userEvent.setup();
    render(<EstoquePage />);
    await user.click(screen.getByRole("tab", { name: "Serrado" }));

    const grupo = screen.getByRole("button", { name: "Exibir comprimentos de Cedrinho 2,5 × 15 cm" });
    await user.click(grupo);

    expect(grupo).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("3 m")).toBeInTheDocument();
    expect(screen.getByText("4 m")).toBeInTheDocument();
  });

  it("destaca o saldo negativo criado por uma entrega sem disponibilidade", async () => {
    const user = userEvent.setup();
    estoqueResumoQuery.mockImplementation(() => ({ data: [
      { madeiraNome: "Itaúba", espessura: "3.00", largura: "5.00", comprimento: "2.00", quantidadeDisponivel: -2, volumeDisponivel: "-0.003000" },
    ], isLoading: false }));
    render(<EstoquePage />);
    await user.click(screen.getByRole("tab", { name: "Serrado" }));

    expect(screen.getByTestId("total-filtrado-serrado")).toHaveTextContent("-2 peças · -0,003 m³");
    expect(screen.getByRole("cell", { name: "-2" })).toHaveClass("text-destructive");
    expect(screen.getByRole("button", { name: "Exibir comprimentos de Itaúba 3 × 5 cm" })).toBeInTheDocument();
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
    expect(screen.getByLabelText("Vencimento da conta a pagar")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Fornecedor da carga" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Adicionar plaqueta" }));
    expect(screen.getAllByPlaceholderText("PLQ-001")).toHaveLength(2);
    expect(screen.getAllByPlaceholderText("Ex.: Cedrinho")[1]).toHaveValue("Piqui");
    expect(screen.getAllByPlaceholderText("900,00")[1]).toHaveValue("900");
  });

  it("envia fornecedor e vencimento para a conta a pagar automática da carga", async () => {
    const user = userEvent.setup();
    criarCargaMutate.mockImplementationOnce((_entrada, opcoes) => opcoes.onSuccess({ numero: "CARGA-000100", totalPlaquetas: 1 }));
    render(<EstoquePage />);
    await user.click(screen.getByRole("button", { name: "Novo romaneio de carga" }));
    await user.clear(screen.getByLabelText("Vencimento da conta a pagar"));
    await user.type(screen.getByLabelText("Vencimento da conta a pagar"), "2026-09-10");
    await user.click(screen.getByRole("combobox", { name: "Fornecedor da carga" }));
    await user.click(screen.getByText("Madeiras Norte"));
    await user.type(screen.getByPlaceholderText("PLQ-001"), "TOR-0200");
    await user.type(screen.getByPlaceholderText("Ex.: Cedrinho"), "Cumaru");
    await user.type(screen.getByRole("textbox", { name: "Diâmetro (cm)" }), "25");
    await user.type(screen.getByRole("textbox", { name: "Comprimento (m)" }), "6");
    await user.type(screen.getByPlaceholderText("900,00"), "900");
    await user.click(screen.getByRole("button", { name: "Confirmar entrada" }));
    expect(criarCargaMutate).toHaveBeenCalledWith(expect.objectContaining({ dataVencimento: "2026-09-10", fornecedorId: 7 }), expect.any(Object));
  });

  it("permite criar um fornecedor diretamente no seletor da carga", async () => {
    const user = userEvent.setup();
    criarFornecedorMutate.mockImplementationOnce((_entrada, opcoes) => opcoes.onSuccess({ id: 12, nome: "Serraria Campo" }));
    render(<EstoquePage />);
    await user.click(screen.getByRole("button", { name: "Novo romaneio de carga" }));
    await user.click(screen.getByRole("combobox", { name: "Fornecedor da carga" }));
    await user.click(screen.getByText("Criar novo fornecedor"));
    await user.type(screen.getByPlaceholderText("Ex.: Fazenda Boa Vista"), "Serraria Campo");
    await user.click(screen.getByRole("button", { name: "Criar e selecionar" }));
    expect(criarFornecedorMutate).toHaveBeenCalledWith({ nome: "Serraria Campo" }, expect.any(Object));
    expect(toast.success).toHaveBeenCalledWith("Fornecedor criado e selecionado.");
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
