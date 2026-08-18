import React from "react";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  search: "",
  titulos: [] as Array<Record<string, unknown>>,
  baixas: [] as Array<Record<string, unknown>>,
  anexos: [] as Array<Record<string, unknown>>,
  cancelar: vi.fn(),
  atualizar: vi.fn(),
  atualizarAgendamento: vi.fn(),
  estornar: vi.fn(),
  importar: vi.fn(),
  invalidar: vi.fn(),
  exportarPdf: vi.fn().mockResolvedValue({ url: "blob:relatorio-financeiro", nomeArquivo: "contas-a-pagar-2026-08-18.pdf" }),
  fluxo: {
    saldoAbertura: 100,
    entradas: 50,
    saidas: 20,
    saldoLiquido: 30,
    saldoFinal: 130,
    quantidadeMovimentos: 2,
    dias: [{ data: "2026-08-11", entradas: 50, saidas: 20, saldoLiquido: 30, saldoAcumulado: 130 }],
    movimentos: [{ id: 1, tipo: "receber", origem: "manual", descricao: "Recebimento demonstrativo", valor: "50.00", dataBaixa: "2026-08-11T12:00:00.000Z", formaPagamento: "pix", contaNome: "Caixa geral" }],
  },
  previsao: [{ inicioSemana: "2026-08-10", fimSemana: "2026-08-16", entradas: 300, saidas: 120, saldoLiquido: 180, saldoProjetado: -20, quantidadeTitulos: 2 }],
}));

vi.mock("wouter", () => ({ useSearch: () => state.search }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/financeiroPdf", () => ({ exportarListaFinanceiraPdf: state.exportarPdf }));

vi.mock("@/lib/trpc", () => {
  const mutationInerte = { useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }) };
  const queryVazia = { useQuery: () => ({ data: [], isLoading: false }) };
  const invalidar = { invalidate: state.invalidar };

  return {
    trpc: {
      useUtils: () => ({
        financeiro: {
          titulos: { list: invalidar, baixas: invalidar },
          categorias: { list: invalidar },
          fornecedores: { list: invalidar, modeloCsv: invalidar },
          contas: { list: invalidar },
          cheques: { list: invalidar, resumo: invalidar },
          recorrencias: { list: invalidar },
          alertas: { list: invalidar },
          anexos: { list: invalidar },
          relatorios: { fluxoCaixa: invalidar, previsaoSemanal: invalidar },
          intercambios: { modeloLancamentosCsv: invalidar, exportarLancamentosCsv: invalidar },
        },
      }),
      cliente: { list: queryVazia, create: mutationInerte },
      financeiro: {
        titulos: {
          list: { useQuery: () => ({ data: state.titulos, isLoading: false }) },
          baixas: { useQuery: () => ({ data: state.baixas, isLoading: false, refetch: vi.fn() }) },
          createManual: mutationInerte,
          createParcelado: mutationInerte,
          update: {
            useMutation: () => ({
              isPending: false,
              mutate: (input: Record<string, unknown>, callbacks: { onSuccess?: () => void }) => {
                state.atualizar(input);
                callbacks.onSuccess?.();
              },
            }),
          },
          updateAgendamento: {
            useMutation: () => ({
              isPending: false,
              mutate: (input: { id: number; dataVencimento: string }, callbacks: { onSuccess?: () => void }) => {
                state.atualizarAgendamento(input);
                callbacks.onSuccess?.();
              },
            }),
          },
          baixar: mutationInerte,
          conciliarBaixa: mutationInerte,
          estornarBaixa: {
            useMutation: () => ({
              isPending: false,
              mutate: (input: { id: number; motivo: string }, callbacks: { onSuccess?: () => void }) => {
                state.estornar(input);
                state.baixas = state.baixas.map((baixa) => baixa.id === input.id ? {
                  ...baixa, estornada: true, estornadaEm: "2026-08-11T12:00:00.000Z", motivoEstorno: input.motivo,
                } : baixa);
                callbacks.onSuccess?.();
              },
            }),
          },
          delete: {
            useMutation: () => ({
              isPending: false,
              mutate: (input: { id: number }, callbacks: { onSuccess?: () => void }) => {
                state.cancelar(input);
                state.titulos = state.titulos.filter((titulo) => titulo.id !== input.id);
                callbacks.onSuccess?.();
              },
            }),
          },
        },
        categorias: { list: queryVazia, create: mutationInerte },
        fornecedores: { list: queryVazia, create: mutationInerte, update: mutationInerte, modeloCsv: { useQuery: () => ({ isFetching: false, refetch: vi.fn().mockResolvedValue({ data: "nome;contacto;email;documento;endereco;observacoes" }) }) }, prepararImportacaoCsv: mutationInerte, importarCsv: mutationInerte },
        anexos: {
          upload: mutationInerte,
          atualizarBoleto: mutationInerte,
          list: { useQuery: () => ({ data: state.anexos, isLoading: false, refetch: vi.fn() }) },
          remove: mutationInerte,
        },
        contas: { list: queryVazia, create: mutationInerte, delete: mutationInerte },
        cheques: { list: queryVazia, resumo: { useQuery: () => ({ data: { totalDisponivel: 0, quantidadeDisponivel: 0, totalUtilizado: 0, quantidadeUtilizada: 0, contas: [] }, isLoading: false }) } },
        recorrencias: { list: queryVazia, create: mutationInerte },
        alertas: { list: queryVazia },
        relatorios: {
          fluxoCaixa: { useQuery: () => ({ data: state.fluxo, isLoading: false, isFetching: false, refetch: vi.fn() }) },
          previsaoSemanal: { useQuery: () => ({ data: state.previsao, isLoading: false }) },
        },
        intercambios: {
          modeloLancamentosCsv: { useQuery: () => ({ isFetching: false, refetch: vi.fn().mockResolvedValue({ data: "referencia;tipo" }) }) },
          exportarLancamentosCsv: { useQuery: () => ({ isFetching: false, refetch: vi.fn().mockResolvedValue({ data: "referencia;tipo" }) }) },
          importarLancamentosCsv: { useMutation: () => ({ isPending: false, mutate: (input: { conteudo: string }, callbacks: { onSuccess?: (resultado: { importados: number; erros: string[] }) => void }) => { state.importar(input); callbacks.onSuccess?.({ importados: 0, erros: ["Linha 2: categoria não encontrada"] }); } }) },
        },
      },
    },
  };
});

import FinanceiroPage, { abaFinanceiraDaUrl } from "./FinanceiroPage";

describe("FinanceiroPage — cancelamento manual", () => {
  beforeEach(() => {
    state.search = "";
    state.cancelar.mockReset();
    state.atualizarAgendamento.mockReset();
    state.estornar.mockReset();
    state.importar.mockReset();
    state.invalidar.mockReset();
    state.exportarPdf.mockReset();
    state.exportarPdf.mockResolvedValue({ url: "blob:relatorio-financeiro", nomeArquivo: "contas-a-pagar-2026-08-18.pdf" });
    state.anexos = [{
      id: 91,
      tituloId: 13,
      nomeArquivo: "boleto-agosto.pdf",
      mimeType: "application/pdf",
      tamanhoBytes: 1024,
      url: "https://documentos.exemplo/boleto-agosto.pdf",
    }];
    state.baixas = [{
      id: 40,
      tituloId: 12,
      valor: "50.00",
      formaPagamento: "pix",
      contaNome: "Caixa geral",
      dataBaixa: "2026-08-11T12:00:00.000Z",
      conciliada: false,
      estornada: false,
    }];
    state.titulos = [
      {
        id: 10,
        descricao: "Recebimento para cancelar",
        tipo: "receber",
        estado: "aberto",
        valorOriginal: "540.00",
        valorBaixado: "0.00",
        desconto: "0.00",
        juros: "0.00",
        dataVencimento: "2026-08-11T00:00:00.000Z",
      },
      {
        id: 11,
        descricao: "Recebimento preservado",
        tipo: "receber",
        estado: "aberto",
        valorOriginal: "300.00",
        valorBaixado: "0.00",
        desconto: "0.00",
        juros: "0.00",
        dataVencimento: "2026-08-12T00:00:00.000Z",
      },
      {
        id: 12,
        descricao: "Recebimento com baixa",
        tipo: "receber",
        estado: "parcial",
        valorOriginal: "100.00",
        valorBaixado: "50.00",
        desconto: "0.00",
        juros: "0.00",
        dataVencimento: "2026-08-13T00:00:00.000Z",
      },
      {
        id: 13,
        descricao: "Carga de toras RC-001",
        origem: "romaneio_carga",
        tipo: "pagar",
        estado: "aberto",
        valorOriginal: "1200.00",
        valorBaixado: "0.00",
        categoriaId: 1,
        desconto: "0.00",
        juros: "0.00",
        dataEmissao: "2026-08-01T00:00:00.000Z",
        dataVencimento: "2026-08-12T00:00:00.000Z",
        linhaDigitavelBoleto: "00190500954014481606906809350314337370000000100",
      },
    ];
  });

  it("pede confirmação e remove o título da listagem após confirmar a exclusão", async () => {
    const user = userEvent.setup();
    render(<FinanceiroPage />);

    await user.click(screen.getAllByRole("button", { name: /contas a receber/i }).at(-1)!);

    const linha = screen.getByText("Recebimento para cancelar").closest("tr");
    expect(linha).not.toBeNull();
    await user.click(within(linha!).getByRole("button", { name: "Excluir" }));

    expect(screen.getByRole("heading", { name: "Excluir lançamento financeiro" })).toBeInTheDocument();
    expect(screen.getByText(/desconcilie o movimento bancário correspondente/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirmar exclusão" }));

    await waitFor(() => {
      expect(state.cancelar).toHaveBeenCalledWith({ id: 10 });
      expect(state.invalidar).toHaveBeenCalled();
      expect(screen.queryByText("Recebimento para cancelar")).not.toBeInTheDocument();
    });
    expect(screen.getAllByText("Recebimento preservado").length).toBeGreaterThan(0);
  });

  it("apresenta o fluxo de caixa com filtros de período e indicadores de saldo", async () => {
    const user = userEvent.setup();
    render(<FinanceiroPage />);

    await user.click(screen.getAllByRole("button", { name: "Fluxo de caixa" })[0]);

    expect(screen.getByRole("heading", { name: "Relatório de fluxo de caixa" })).toBeInTheDocument();
    expect(screen.getByLabelText("Data inicial do fluxo de caixa")).toHaveAttribute("type", "date");
    expect(screen.getByLabelText("Data final do fluxo de caixa")).toHaveAttribute("type", "date");
    expect(screen.getByText("Saldo final")).toBeInTheDocument();
    expect(screen.getByText("Recebimento demonstrativo")).toBeInTheDocument();
    expect(screen.getByText("Previsão semanal de caixa")).toBeInTheDocument();
    expect(screen.getByText("Títulos projetados")).toBeInTheDocument();
    expect(screen.getByText("Previsão semanal de caixa").closest("section")).toHaveTextContent(/-R\$\s*20,00/);
  });

  it("distingue a compra de diesel para o tanque do custo de abastecimento", async () => {
    const user = userEvent.setup();
    state.fluxo = {
      saldoAbertura: -64700,
      entradas: 0,
      saidas: 64700,
      saldoLiquido: -64700,
      saldoFinal: -64700,
      quantidadeMovimentos: 1,
      dias: [{ data: "2026-07-20", entradas: 0, saidas: 64700, saldoLiquido: -64700, saldoAcumulado: -64700 }],
      movimentos: [{ id: 90, tipo: "pagar", origem: "nota_diesel", descricao: "Pagamento de diesel — Nota 0001", valor: "64700.00", dataBaixa: "2026-07-20T12:00:00.000Z", formaPagamento: "outro", contaNome: "Numerário em trânsito" }],
    };
    const { container } = render(<FinanceiroPage />);
    const tela = within(container);

    await user.click(tela.getByRole("button", { name: "Fluxo de caixa" }));

    expect(tela.getByText(/saldo de abertura incorpora o saldo inicial/i)).toBeInTheDocument();
    expect(tela.getByText(/Antes do período, com histórico anterior/i)).toBeInTheDocument();
    expect(tela.getByText(/Compra para estoque do tanque/i)).toHaveTextContent(/custo é apropriado nos abastecimentos/i);
  });

  it("identifica a abertura direta do relatório pelo parâmetro de URL", () => {
    expect(abaFinanceiraDaUrl("?aba=fluxo")).toBe("fluxo");
    expect(abaFinanceiraDaUrl("?tipo=receber")).toBe("lancamentos");
    expect(abaFinanceiraDaUrl("?tipo=pagas")).toBe("lancamentos");
    expect(abaFinanceiraDaUrl("?tipo=recebidas")).toBe("lancamentos");
  });

  it("abre a lista solicitada pela lateral sem repetir o resumo financeiro", () => {
    state.search = "?tipo=receber";
    const { container } = render(<FinanceiroPage />);
    const tela = within(container);

    expect(tela.getByText("Gestão de títulos")).toBeInTheDocument();
    expect(tela.getAllByText("Contas a receber").length).toBeGreaterThan(1);
    expect(tela.queryByText("Títulos vencidos")).not.toBeInTheDocument();
    expect(tela.queryByText("Próximos 30 dias")).not.toBeInTheDocument();
  });

  it("abre os históricos financeiros diretamente pelos novos atalhos laterais", () => {
    state.search = "?tipo=pagas";
    const { container } = render(<FinanceiroPage />);
    const tela = within(container);

    expect(tela.getAllByText("Contas pagas").length).toBeGreaterThan(1);
    expect(tela.queryByText("Títulos vencidos")).not.toBeInTheDocument();
  });

  it("separa as quatro listas financeiras, filtra títulos e destaca os compromissos do dia", async () => {
    const user = userEvent.setup();
    const hoje = new Date().toISOString();
    state.titulos.push(
      { id: 14, descricao: "Fornecedor vence hoje", tipo: "pagar", estado: "aberto", valorOriginal: "850.00", valorBaixado: "0.00", desconto: "0.00", juros: "0.00", dataVencimento: hoje },
      { id: 15, descricao: "Conta paga arquivada", tipo: "pagar", estado: "quitado", valorOriginal: "200.00", valorBaixado: "200.00", desconto: "0.00", juros: "0.00", dataVencimento: hoje },
      { id: 16, descricao: "Receita recebida arquivada", tipo: "receber", estado: "quitado", valorOriginal: "300.00", valorBaixado: "300.00", desconto: "0.00", juros: "0.00", dataVencimento: hoje },
    );
    render(<FinanceiroPage />);

    expect(screen.getByText("Fornecedor vence hoje")).toBeInTheDocument();
    expect(screen.getByText(/1 vencem hoje/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Descrição ou contraparte")).toBeInTheDocument();
    expect(screen.getByLabelText("Valor mínimo")).toHaveAttribute("inputmode", "decimal");
    expect(screen.getAllByLabelText("Data inicial")[0]).toHaveAttribute("type", "date");
    expect(screen.getAllByLabelText("Data final")[0]).toHaveAttribute("type", "date");

    await user.type(screen.getByLabelText("Descrição ou contraparte"), "fornecedor vence");
    expect(screen.getAllByText("Fornecedor vence hoje").length).toBeGreaterThan(0);
    const tabelaPagar = screen.getAllByRole("table").find((tabela) => within(tabela).queryByText("Fornecedor vence hoje"));
    expect(tabelaPagar).toBeDefined();
    expect(within(tabelaPagar!).queryByText("Carga de toras RC-001")).not.toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Limpar filtros" })[0]);

    await user.click(screen.getAllByRole("button", { name: "Visão financeira: Contas pagas" }).at(-1)!);
    expect(screen.getByText("Conta paga arquivada")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Visão financeira: Contas recebidas" }).at(-1)!);
    expect(screen.getByText("Receita recebida arquivada")).toBeInTheDocument();
  });

  it("permite reagendar o vencimento de uma conta vinculada ao romaneio de carga", async () => {
    const user = userEvent.setup();
    render(<FinanceiroPage />);

    const linha = screen.getAllByText("Carga de toras RC-001").map((elemento) => elemento.closest("tr")).find(Boolean);
    expect(linha).not.toBeNull();
    await user.click(within(linha!).getByRole("button", { name: "Editar" }));

    expect(screen.getByRole("heading", { name: "Editar lançamento" })).toBeInTheDocument();
    expect(screen.getByText(/alterações de vencimento também atualizam o romaneio de carga vinculado/i)).toBeInTheDocument();
    const dialogoEdicao = screen.getByRole("dialog");
    const vencimento = within(dialogoEdicao).getByLabelText("Vencimento *");
    await user.clear(vencimento);
    await user.type(vencimento, "2026-09-11");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => {
      expect(state.atualizar).toHaveBeenCalledWith(expect.objectContaining({ id: 13, dataVencimento: "2026-09-11" }));
      expect(state.invalidar).toHaveBeenCalled();
    });
  });

  it("confirma o estorno com motivo e sinaliza a baixa preservada como estornada", async () => {
    const user = userEvent.setup();
    render(<FinanceiroPage />);

    await user.click(screen.getAllByRole("button", { name: "Visão financeira: Contas a receber" }).at(-1)!);

    const linha = screen.getAllByText("Recebimento com baixa").map((elemento) => elemento.closest("tr")).find(Boolean);
    expect(linha).not.toBeNull();
    await user.click(within(linha!).getByRole("button", { name: "Baixas" }));
    await user.click(screen.getByRole("button", { name: "Estornar" }));

    expect(screen.getByRole("heading", { name: "Estornar baixa financeira" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Motivo do estorno *"), "Pagamento duplicado");
    await user.click(screen.getByRole("button", { name: "Confirmar estorno" }));

    await waitFor(() => {
      expect(state.estornar).toHaveBeenCalledWith({ id: 40, motivo: "Pagamento duplicado" });
      expect(screen.getByText("Estornada")).toBeInTheDocument();
      expect(screen.getByText(/Pagamento duplicado/)).toBeInTheDocument();
    });
  }, 10_000);

  it("oferece modelo, exportação e importação CSV com orientação de validação", async () => {
    render(<FinanceiroPage />);

    expect(screen.getAllByRole("button", { name: "Modelo CSV" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Exportar CSV" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Exportar PDF" }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: "Importar CSV" }).at(-1)!);
    expect(screen.getByRole("heading", { name: "Importar lançamentos financeiros" })).toBeInTheDocument();
    expect(screen.getByText(/se houver alguma linha inválida/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Arquivo CSV para importação")).toHaveAttribute("accept", ".csv,text/csv");
  });

  it("permite preparar documentos e conferir a linha digitável em um lançamento a pagar", async () => {
    const user = userEvent.setup();
    render(<FinanceiroPage />);

    fireEvent.click(screen.getByRole("button", { name: /novo lançamento avulso/i }));

    expect(screen.getByText("Documentos do lançamento")).toBeInTheDocument();
    const seletorTipo = screen.getByText("Conta a receber", { exact: true }).closest('[role="combobox"]');
    fireEvent.click(seletorTipo!);
    fireEvent.click(screen.getByRole("option", { name: "Conta a pagar" }));
    const anexo = screen.getByLabelText("Anexar documentos do lançamento");
    expect(anexo).toHaveAttribute("accept", "application/pdf,image/jpeg,image/png,image/webp");
    fireEvent.change(anexo, { target: { files: [new File(["boleto"], "boleto-agosto.pdf", { type: "application/pdf" })] } });
    expect(screen.getAllByText("boleto-agosto.pdf").length).toBeGreaterThan(0);

    const codigo = screen.getByLabelText("Código de barras ou linha digitável");
    await user.type(codigo, "00190500954014481606906809350314337370000000100");
    expect(codigo).toHaveValue("00190500954014481606906809350314337370000000100");
  });

  it("copia o código do boleto e pré-visualiza o PDF anexado ao agendamento", async () => {
    const copiar = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: copiar } });
    render(<FinanceiroPage />);

    const tabelaPagar = screen.getAllByRole("table").find((tabela) => within(tabela).queryByText("Carga de toras RC-001"));
    expect(tabelaPagar).toBeDefined();
    fireEvent.click(within(tabelaPagar!).getByRole("button", { name: "Editar" }));

    const dialogo = await screen.findByRole("dialog");
    await user.click(within(dialogo).getByRole("button", { name: "Copiar" }));
    await waitFor(() => expect(copiar).toHaveBeenCalledWith("00190500954014481606906809350314337370000000100"));

    await user.click(within(dialogo).getByRole("button", { name: "Visualizar boleto-agosto.pdf" }));
    expect(screen.getByTitle("Pré-visualização de boleto-agosto.pdf")).toHaveAttribute("src", "https://documentos.exemplo/boleto-agosto.pdf");
  });

  it("exporta somente os títulos visíveis após aplicar os filtros", async () => {
    const user = userEvent.setup();
    render(<FinanceiroPage />);

    fireEvent.change(screen.getAllByLabelText("Descrição ou contraparte").at(-1)!, { target: { value: "carga de toras" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Exportar PDF" }).at(-1)!);

    await waitFor(() => {
      expect(state.exportarPdf).toHaveBeenCalledWith(expect.objectContaining({
        titulo: "Contas a pagar",
        titulos: [expect.objectContaining({ descricao: "Carga de toras RC-001" })],
      }));
    });
    expect(await screen.findByLabelText("Pré-visualização: Relatório financeiro")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar download" })).toBeInTheDocument();
  });
});
