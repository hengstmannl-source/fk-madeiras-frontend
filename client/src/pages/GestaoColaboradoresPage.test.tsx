import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const state = vi.hoisted(() => ({ invalidar: vi.fn(), removerColaborador: vi.fn(), alterarSituacao: vi.fn(), colaboradores: [] as any[], adiantamentos: [] as any[] }));

vi.mock("@/lib/trpc", () => ({
  trpc: (() => {
    const mutacao = { useMutation: () => ({ mutate: vi.fn(), isPending: false }) };
    const consulta = (dados: unknown) => ({ useQuery: () => ({ data: dados, isLoading: false, refetch: vi.fn() }) });
    const invalidar = { invalidate: state.invalidar };
    return {
    useUtils: () => ({ rh: { gestao: { painel: invalidar, relatorio: invalidar, configuracao: invalidar, custosEmpresa: invalidar, custosColaborador: invalidar }, colaboradores: { list: invalidar }, adiantamentos: { list: invalidar }, fichas: { painel: invalidar, lancamentos: invalidar, ficha: invalidar, competencias: invalidar, categorias: invalidar, encargos: invalidar } } }),
    rh: {
      colaboradores: { list: { useQuery: () => ({ data: state.colaboradores, isLoading: false }) }, create: mutacao, update: mutacao, alterarSituacao: { useMutation: () => ({ mutate: state.alterarSituacao, isPending: false }) }, remove: { useMutation: () => ({ mutate: state.removerColaborador, isPending: false }) } },
      departamentos: { list: consulta([]) },
      cargos: { list: consulta([]) },
      adiantamentos: { list: { useQuery: () => ({ data: state.adiantamentos, isLoading: false }) }, create: mutacao },
      fichas: {
        painel: consulta({ resumo: { creditos: 0, debitos: 0, pagamentos: 0, saldo: 0 }, colaboradoresComSaldo: [] }),
        categorias: { list: consulta([]), create: mutacao },
        lancamentos: { list: consulta({ itens: [], resumo: { creditos: 0, debitos: 0, pagamentos: 0, saldo: 0 } }), criar: mutacao, cancelar: mutacao },
        ficha: { detalhe: consulta({ colaborador: { nome: "Ana da Silva" }, itens: [], resumo: { creditos: 0, debitos: 0, pagamentos: 0, saldo: 0 } }) },
        competencias: { list: consulta([]), abrir: mutacao, fechar: mutacao, reabrir: mutacao, gerarSalarios: mutacao, salarios: consulta({ linhas: [], totais: {} }) },
        encargos: { list: consulta([]), create: mutacao },
        migracao: { importarSaldosAdiantamentos: mutacao },
      },
      gestao: {
        painel: consulta({
          configuracao: { fgtsPercentual: "8", descontoInssEstimadoAtivo: false, provisaoDecimoTerceiroAtiva: true, provisaoFeriasAtiva: true, provisaoTercoFeriasAtiva: true },
          resumo: { colaboradoresAtivos: 1, salariosBrutos: 3000, inssEstimado: 0, salariosLiquidosEstimados: 3000, fgtsEstimado: 240, provisaoDecimoTerceiro: 250, provisaoFerias: 250, provisaoTercoFerias: 83.33, custoMensalEstimado: 3823.33, custoAnualEstimado: 45879.96 },
          colaboradores: [{ id: 1, nome: "Ana da Silva", dataAdmissao: new Date(2025, 0, 1), tipoContrato: "clt", situacao: "ativo", salarioAtual: "3000", cargo: { nome: "Serrador" }, departamento: { nome: "Produção" }, custo: { salarioBruto: 3000, inssEstimado: 0, salarioLiquidoEstimado: 3000, fgtsEstimado: 240, provisaoDecimoTerceiro: 250, provisaoFerias: 250, provisaoTercoFerias: 83.33, custoMensalEstimado: 3823.33 } }],
          porDepartamento: [{ nome: "Produção", colaboradores: 1, custoMensalEstimado: 3823.33 }],
        }),
        relatorio: consulta({ linhas: [{ id: 1, nome: "Ana da Silva", situacao: "ativo", departamento: { nome: "Produção" }, cargo: { nome: "Serrador" }, custo: { salarioBruto: 3000, inssEstimado: 0, salarioLiquidoEstimado: 3000, fgtsEstimado: 240, provisaoDecimoTerceiro: 250, provisaoFerias: 250, provisaoTercoFerias: 83.33, custoMensalEstimado: 3823.33 } }], totais: { custoMensalEstimado: 3823.33, provisaoDecimoTerceiro: 250, provisaoFerias: 250, provisaoTercoFerias: 83.33 } }),
        configuracao: { get: consulta({ fgtsPercentual: "8", descontoInssEstimadoAtivo: false, provisaoDecimoTerceiroAtiva: true, provisaoFeriasAtiva: true, provisaoTercoFeriasAtiva: true, observacoes: null }), save: mutacao },
        custosEmpresa: { list: consulta([]), create: mutacao, update: mutacao, remove: mutacao },
        custosColaborador: { list: consulta([]), create: mutacao, update: mutacao, remove: mutacao },
      },
    },
    };
  })(),
}));

import GestaoColaboradoresPage from "./GestaoColaboradoresPage";

describe("Gestão de Colaboradores", () => {
  afterEach(() => { cleanup(); state.colaboradores = []; state.adiantamentos = []; state.removerColaborador.mockClear(); state.alterarSituacao.mockClear(); });

  it("deixa explícito o caráter estimado do painel e exibe provisões de custo", async () => {
    const user = userEvent.setup();
    render(<GestaoColaboradoresPage />);

    expect(screen.getByRole("heading", { name: "RH e Fichas Financeiras" })).toBeTruthy();
    expect(screen.getByText(/Valores estimados para gestão/i)).toBeTruthy();
    expect(screen.getByText("RH Financeiro")).toBeTruthy();
    expect(screen.getByText("A pagar aos colaboradores")).toBeTruthy();

    await user.click(screen.getByRole("tab", { name: "Custos estimados" }));
    expect(screen.getByText("Provisões mensais")).toBeTruthy();
    expect(screen.getByText("Custo por departamento")).toBeTruthy();

    await user.click(screen.getByRole("tab", { name: "Colaboradores" }));
    expect(screen.getByText("Colaboradores e custo estimado")).toBeTruthy();
    expect(screen.getByText("Ana da Silva")).toBeTruthy();

    await user.click(screen.getByRole("tab", { name: "Custos & benefícios" }));
    expect(screen.getByText("Custos e benefícios gerais")).toBeTruthy();
    expect(screen.getByText(/Cadastre benefícios, seguros ou outros custos gerais/i)).toBeTruthy();
  });

  it("oferece ações rápidas de salário, adiantamento, desconto, provento e pagamento na ficha financeira", () => {
    render(<GestaoColaboradoresPage />);

    expect(screen.getByRole("button", { name: /Lançar salário/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Registrar adiantamento/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Registrar desconto/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Registrar provento/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Registrar pagamento/i })).toBeTruthy();
  });

  it("permite filtrar a ficha financeira por tipo, situação e categoria", async () => {
    const user = userEvent.setup();
    state.colaboradores = [{ id: 1, nome: "Ana da Silva", departamentoNome: "Produção", cargoNome: "Serrador", dataAdmissao: new Date(2025, 0, 1), tipoContrato: "clt", situacao: "ativo", salarioAtual: "3000" }];
    render(<GestaoColaboradoresPage />);

    await user.click(screen.getByRole("button", { name: "Ver ficha" }));
    expect(screen.getByLabelText("Filtrar tipo na ficha")).toBeTruthy();
    expect(screen.getByLabelText("Filtrar situação na ficha")).toBeTruthy();
    expect(screen.getByLabelText("Filtrar categoria na ficha")).toBeTruthy();
  });

  it("exibe plano, parcelas pendentes e próxima competência do adiantamento parcelado", async () => {
    const user = userEvent.setup();
    state.adiantamentos = [{
      id: 9,
      colaboradorNome: "Ana da Silva",
      dataAdiantamento: new Date(2026, 7, 20),
      valor: "900.00",
      estado: "aberto",
      observacoes: "Compra de ferramentas",
      quantidadeParcelas: 3,
      parcelasPendentes: 2,
      proximaCompetencia: new Date(2026, 8, 1),
      parcelas: [],
    }];
    render(<GestaoColaboradoresPage />);

    await user.click(screen.getByRole("tab", { name: "Adiantamentos" }));
    expect(screen.getByText("3 parcelas")).toBeTruthy();
    expect(screen.getByText("2 de 3")).toBeTruthy();
    expect(screen.getByText("09/2026")).toBeTruthy();
  });

  it("mantém a criação de conta a pagar desmarcada ao abrir um adiantamento", async () => {
    const user = userEvent.setup();
    render(<GestaoColaboradoresPage />);

    await user.click(screen.getByRole("button", { name: "Novo adiantamento" }));

    const integracaoFinanceira = screen.getByRole("checkbox", { name: /Criar conta a pagar no Financeiro/i });
    expect(integracaoFinanceira).toBeTruthy();
    expect((integracaoFinanceira as HTMLInputElement).checked).toBe(false);

    await user.click(integracaoFinanceira);
    expect((integracaoFinanceira as HTMLInputElement).checked).toBe(true);
  });

  it("permite cadastrar um benefício recorrente por colaborador com categoria", async () => {
    const user = userEvent.setup();
    render(<GestaoColaboradoresPage />);

    await user.click(screen.getByRole("tab", { name: "Colaboradores" }));
    await user.click(screen.getByRole("button", { name: "Benefícios" }));

    expect(screen.getByText(/Benefícios recorrentes · Ana da Silva/i)).toBeTruthy();
    expect(screen.getByText("Tipo de benefício")).toBeTruthy();
    expect(screen.getByRole("option", { name: "Plano de saúde" })).toBeTruthy();

    const [categoria] = screen.getAllByRole("combobox");
    await user.selectOptions(categoria, "plano_saude");
    expect((categoria as HTMLSelectElement).value).toBe("plano_saude");
    expect(screen.getByRole("button", { name: "Salvar benefício" })).toBeTruthy();
  });

  it("permite marcar um benefício para desconto no líquido previsto", async () => {
    const user = userEvent.setup();
    render(<GestaoColaboradoresPage />);

    await user.click(screen.getByRole("tab", { name: "Colaboradores" }));
    await user.click(screen.getByRole("button", { name: "Benefícios" }));

    const desconto = screen.getByRole("checkbox", { name: "Descontar benefício do líquido previsto", hidden: true }) as HTMLInputElement;
    expect(desconto.checked).toBe(false);
    desconto.click();
    expect(desconto.checked).toBe(true);
  });

  it("pede confirmação e remove um colaborador sem vínculos", async () => {
    const user = userEvent.setup();
    render(<GestaoColaboradoresPage />);

    await user.click(screen.getByRole("tab", { name: "Colaboradores" }));
    await user.click(screen.getByTitle("Remover colaborador"));

    expect(screen.getByRole("heading", { name: "Remover colaborador?" })).toBeTruthy();
    expect(screen.getByText(/Sem movimentações vinculadas/i)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Remover colaborador" }));
    expect(state.removerColaborador).toHaveBeenCalledWith({ id: 1 });
  });

  it("mostra o vínculo e bloqueia a remoção quando há movimentação", async () => {
    const user = userEvent.setup();
    state.colaboradores = [{ id: 1, situacao: "ativo", vinculos: { dependentes: false, alteracoesSalariais: false, adiantamentos: true, itensFolha: false }, podeRemover: false, bloqueioRemocao: "A exclusão está bloqueada por adiantamentos." }];
    render(<GestaoColaboradoresPage />);

    await user.click(screen.getByRole("tab", { name: "Colaboradores" }));
    expect(screen.getByText(/A exclusão está bloqueada por adiantamentos/i)).toBeTruthy();
    await user.click(screen.getByTitle("Remover colaborador"));

    expect(screen.getAllByText(/A exclusão está bloqueada por adiantamentos/i).length).toBeGreaterThan(0);
    expect((screen.getByRole("button", { name: "Remover colaborador" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("mantém a lista de colaboradores ativos por padrão e permite consultar inativos", async () => {
    const user = userEvent.setup();
    state.colaboradores = [{ id: 2, nome: "Bruno Inativo", dataAdmissao: new Date(2024, 0, 1), tipoContrato: "clt", situacao: "desligado", salarioAtual: "2200", vinculos: {} }];
    render(<GestaoColaboradoresPage />);

    await user.click(screen.getByRole("tab", { name: "Colaboradores" }));
    expect(screen.getByText("Ana da Silva")).toBeTruthy();
    expect(screen.queryByText("Bruno Inativo")).toBeNull();

    await user.selectOptions(screen.getByLabelText("Situação da lista"), "desligado");
    expect(screen.getByText("Bruno Inativo")).toBeTruthy();
    expect(screen.getByText("Inativo")).toBeTruthy();
  });

  it("confirma a inativação preservando o histórico", async () => {
    const user = userEvent.setup();
    render(<GestaoColaboradoresPage />);

    await user.click(screen.getByRole("tab", { name: "Colaboradores" }));
    await user.click(screen.getByTitle("Inativar colaborador"));
    expect(screen.getByRole("heading", { name: "Inativar colaborador?" })).toBeTruthy();
    expect(screen.getByText(/todo o histórico será preservado/i)).toBeTruthy();
    await user.type(screen.getByLabelText("Motivo (opcional)"), "Encerramento do vínculo");
    await user.click(screen.getByRole("button", { name: "Inativar e preservar histórico" }));
    expect(state.alterarSituacao).toHaveBeenCalledWith({ id: 1, situacao: "desligado", motivo: "Encerramento do vínculo" });
  });

  it("permite reativar um colaborador inativo", async () => {
    const user = userEvent.setup();
    state.colaboradores = [{ id: 1, nome: "Ana da Silva", dataAdmissao: new Date(2025, 0, 1), tipoContrato: "clt", situacao: "desligado", salarioAtual: "3000", vinculos: {} }];
    render(<GestaoColaboradoresPage />);

    await user.click(screen.getByRole("tab", { name: "Colaboradores" }));
    await user.selectOptions(screen.getByLabelText("Situação da lista"), "desligado");
    await user.click(screen.getByTitle("Reativar colaborador"));
    expect(screen.getByRole("heading", { name: "Reativar colaborador?" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Reativar colaborador" }));
    expect(state.alterarSituacao).toHaveBeenCalledWith({ id: 1, situacao: "ativo", motivo: null });
  });

  it("permite reativar um colaborador afastado", async () => {
    const user = userEvent.setup();
    state.colaboradores = [{ id: 1, nome: "Ana da Silva", dataAdmissao: new Date(2025, 0, 1), tipoContrato: "clt", situacao: "afastado", salarioAtual: "3000", vinculos: {} }];
    render(<GestaoColaboradoresPage />);

    await user.click(screen.getByRole("tab", { name: "Colaboradores" }));
    await user.selectOptions(screen.getByLabelText("Situação da lista"), "afastado");
    await user.click(screen.getByTitle("Reativar colaborador"));
    await user.click(screen.getByRole("button", { name: "Reativar colaborador" }));
    expect(state.alterarSituacao).toHaveBeenCalledWith({ id: 1, situacao: "ativo", motivo: null });
  });

  it("permite remover colaborador inativo sem movimentações financeiras mesmo com histórico não financeiro", async () => {
    const user = userEvent.setup();
    state.colaboradores = [{ id: 1, nome: "Ana da Silva", dataAdmissao: new Date(2025, 0, 1), tipoContrato: "clt", situacao: "desligado", salarioAtual: "3000", vinculos: { dependentes: true, alteracoesSalariais: true, adiantamentos: false, itensFolha: false }, podeRemover: true, bloqueioRemocao: null }];
    render(<GestaoColaboradoresPage />);

    await user.click(screen.getByRole("tab", { name: "Colaboradores" }));
    await user.selectOptions(screen.getByLabelText("Situação da lista"), "desligado");
    await user.click(screen.getByTitle("Remover colaborador"));
    expect(screen.getByText(/sem movimentações financeiras/i)).toBeTruthy();
    const remover = screen.getByRole("button", { name: "Remover colaborador" }) as HTMLButtonElement;
    expect(remover.disabled).toBe(false);
    await user.click(remover);
    expect(state.removerColaborador).toHaveBeenCalledWith({ id: 1 });
  });

  it("oferece a ativação do desconto estimado de INSS nos parâmetros gerenciais", async () => {
    const user = userEvent.setup();
    render(<GestaoColaboradoresPage />);

    await user.click(screen.getByRole("button", { name: "Parâmetros" }));
    const opcaoInss = screen.getByRole("checkbox", { name: /Contabilizar desconto estimado de INSS/i }) as HTMLInputElement;
    expect(opcaoInss.checked).toBe(false);
    await user.click(opcaoInss);
    expect(opcaoInss.checked).toBe(true);
  });

  it("exibe a previsão de salário líquido com detalhamento do INSS estimado", async () => {
    const user = userEvent.setup();
    render(<GestaoColaboradoresPage />);

    await user.click(screen.getByRole("tab", { name: "Salários líquidos" }));

    expect(screen.getByRole("heading", { name: "Previsão de salário líquido" })).toBeTruthy();
    expect(screen.getByText("Total líquido previsto")).toBeTruthy();
    expect(screen.getByText(/Esta previsão considera o salário bruto menos o INSS estimado/i)).toBeTruthy();
    expect(screen.getByText("Ana da Silva")).toBeTruthy();
    expect(screen.getByText("Líquido previsto")).toBeTruthy();
  });

  it("permite consultar o relatório de custo com filtros gerenciais", async () => {
    const user = userEvent.setup();
    render(<GestaoColaboradoresPage />);

    await user.click(screen.getByRole("tab", { name: "Relatórios" }));

    expect(screen.getByRole("heading", { name: "Relatório de custo de colaboradores" })).toBeTruthy();
    expect(screen.getByText("Custo mensal filtrado")).toBeTruthy();
    expect(screen.getByText("Ana da Silva")).toBeTruthy();
    expect(screen.getByRole("option", { name: "Ativos" })).toBeTruthy();
  });
});
