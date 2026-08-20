import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const state = vi.hoisted(() => ({ invalidar: vi.fn() }));

vi.mock("@/lib/trpc", () => ({
  trpc: (() => {
    const mutacao = { useMutation: () => ({ mutate: vi.fn(), isPending: false }) };
    const consulta = (dados: unknown) => ({ useQuery: () => ({ data: dados, isLoading: false, refetch: vi.fn() }) });
    const invalidar = { invalidate: state.invalidar };
    return {
    useUtils: () => ({ rh: { gestao: { painel: invalidar, relatorio: invalidar, configuracao: invalidar, custosEmpresa: invalidar, custosColaborador: invalidar }, colaboradores: { list: invalidar }, adiantamentos: { list: invalidar } } }),
    rh: {
      colaboradores: { list: consulta([]), create: mutacao, update: mutacao },
      departamentos: { list: consulta([]) },
      cargos: { list: consulta([]) },
      adiantamentos: { list: consulta([]), create: mutacao },
      gestao: {
        painel: consulta({
          configuracao: { fgtsPercentual: "8", provisaoDecimoTerceiroAtiva: true, provisaoFeriasAtiva: true, provisaoTercoFeriasAtiva: true },
          resumo: { colaboradoresAtivos: 1, salariosBrutos: 3000, fgtsEstimado: 240, provisaoDecimoTerceiro: 250, provisaoFerias: 250, provisaoTercoFerias: 83.33, custoMensalEstimado: 3823.33, custoAnualEstimado: 45879.96 },
          colaboradores: [{ id: 1, nome: "Ana da Silva", dataAdmissao: new Date(2025, 0, 1), tipoContrato: "clt", situacao: "ativo", salarioAtual: "3000", cargo: { nome: "Serrador" }, departamento: { nome: "Produção" }, custo: { salarioBruto: 3000, fgtsEstimado: 240, provisaoDecimoTerceiro: 250, provisaoFerias: 250, provisaoTercoFerias: 83.33, custoMensalEstimado: 3823.33 } }],
          porDepartamento: [{ nome: "Produção", colaboradores: 1, custoMensalEstimado: 3823.33 }],
        }),
        relatorio: consulta({ linhas: [{ id: 1, nome: "Ana da Silva", situacao: "ativo", departamento: { nome: "Produção" }, cargo: { nome: "Serrador" }, custo: { salarioBruto: 3000, fgtsEstimado: 240, provisaoDecimoTerceiro: 250, provisaoFerias: 250, provisaoTercoFerias: 83.33, custoMensalEstimado: 3823.33 } }], totais: { custoMensalEstimado: 3823.33, provisaoDecimoTerceiro: 250, provisaoFerias: 250, provisaoTercoFerias: 83.33 } }),
        configuracao: { get: consulta({ fgtsPercentual: "8", provisaoDecimoTerceiroAtiva: true, provisaoFeriasAtiva: true, provisaoTercoFeriasAtiva: true, observacoes: null }), save: mutacao },
        custosEmpresa: { list: consulta([]), create: mutacao, update: mutacao, remove: mutacao },
        custosColaborador: { list: consulta([]), create: mutacao, update: mutacao, remove: mutacao },
      },
    },
    };
  })(),
}));

import GestaoColaboradoresPage from "./GestaoColaboradoresPage";

describe("Gestão de Colaboradores", () => {
  afterEach(cleanup);

  it("deixa explícito o caráter estimado do painel e exibe provisões de custo", async () => {
    const user = userEvent.setup();
    render(<GestaoColaboradoresPage />);

    expect(screen.getByRole("heading", { name: "Gestão de Colaboradores" })).toBeTruthy();
    expect(screen.getByText(/Valores estimados para gestão/i)).toBeTruthy();
    expect(screen.getByText("Provisões mensais")).toBeTruthy();
    expect(screen.getByText("Custo por departamento")).toBeTruthy();

    await user.click(screen.getByRole("tab", { name: "Colaboradores" }));
    expect(screen.getByText("Colaboradores e custo estimado")).toBeTruthy();
    expect(screen.getByText("Ana da Silva")).toBeTruthy();

    await user.click(screen.getByRole("tab", { name: "Custos & benefícios" }));
    expect(screen.getByText("Custos e benefícios gerais")).toBeTruthy();
    expect(screen.getByText(/Cadastre benefícios, seguros ou outros custos gerais/i)).toBeTruthy();
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
