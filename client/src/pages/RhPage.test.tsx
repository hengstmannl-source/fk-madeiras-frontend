import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  atualizarCargo: vi.fn(),
  removerCargo: vi.fn(),
  salvarRegra: vi.fn(),
  invalidar: vi.fn(),
  colaboradores: [{
    id: 1,
    nome: "Ana da Silva",
    cpf: "123.456.789-00",
    email: null,
    departamentoNome: "Serraria",
    cargoNome: "Operador de serra",
    tipoContrato: "clt",
    salarioAtual: "2500.00",
    situacao: "ativo",
    vinculos: { dependentes: true, alteracoesSalariais: true, adiantamentos: true, itensFolha: true },
  }],
  departamentos: [{ id: 10, nome: "Serraria", descricao: "Área produtiva", ativo: true }],
  cargos: [{ id: 11, nome: "Operador de serra", cbo: "7721-10", descricao: "Corte", ativo: true }],
  eventos: [{ id: 12, codigo: "HORAEX", nome: "Hora extra", tipo: "provento", incideInss: true, incideIrrf: true, incideFgts: true, ativo: true }],
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/RhTutorialDialog", () => ({ RhTutorialDialog: () => null }));
vi.mock("@/lib/trpc", () => {
  const inerte = { useMutation: () => ({ mutate: vi.fn(), isPending: false }) };
  const consulta = (dados: unknown[] = []) => ({ useQuery: () => ({ data: dados, isLoading: false, refetch: vi.fn() }) });
  const invalidar = { invalidate: state.invalidar };

  return {
    trpc: {
      useUtils: () => ({ rh: { resumo: invalidar, colaboradores: { list: invalidar }, folha: { list: invalidar }, adiantamentos: { list: invalidar }, auditoria: invalidar, departamentos: { list: invalidar }, cargos: { list: invalidar }, eventos: { list: invalidar }, tributos: { list: invalidar } } }),
      rh: {
        resumo: { useQuery: () => ({ data: { colaboradoresAtivos: 1, totalLiquido: "0", custoEmpresa: "0", totalFgts: "0", folha: null } }) },
        departamentos: { list: consulta(state.departamentos), create: inerte, update: inerte, remove: inerte },
        cargos: {
          list: consulta(state.cargos),
          create: inerte,
          update: { useMutation: (opcoes?: { onSuccess?: () => void }) => ({ isPending: false, mutate: (input: unknown) => { state.atualizarCargo(input); opcoes?.onSuccess?.(); } }) },
          remove: { useMutation: (opcoes?: { onSuccess?: () => void }) => ({ isPending: false, mutate: (input: unknown) => { state.removerCargo(input); opcoes?.onSuccess?.(); } }) },
        },
        colaboradores: { list: consulta(state.colaboradores), create: inerte, remove: inerte, historicoSalarial: consulta() },
        eventos: { list: consulta(state.eventos), create: inerte, update: inerte, remove: inerte },
        adiantamentos: { list: consulta(), create: inerte },
        tributos: { list: consulta(), salvar: { useMutation: (opcoes?: { onSuccess?: () => void }) => ({ isPending: false, mutate: (input: unknown) => { state.salvarRegra(input); opcoes?.onSuccess?.(); } }) } },
        folha: { list: consulta(), detalhe: consulta(), abrir: inerte, recalcular: inerte, fechar: inerte, reabrir: inerte, salvarEventos: inerte },
        auditoria: consulta(),
        dependentes: { list: consulta(), create: inerte },
      },
    },
  };
});

import RhPage from "./RhPage";

describe("página de RH — vínculos e cadastros auxiliares", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("mostra na tabela todos os vínculos que bloqueiam a exclusão de um colaborador", async () => {
    const user = userEvent.setup();
    render(<RhPage />);

    await user.click(screen.getByRole("tab", { name: "Colaboradores" }));

    expect(screen.getByText("Vínculos de exclusão")).toBeInTheDocument();
    expect(screen.getByText("dependentes")).toBeInTheDocument();
    expect(screen.getByText("alterações salariais")).toBeInTheDocument();
    expect(screen.getByText("adiantamentos")).toBeInTheDocument();
    expect(screen.getByText("lançamentos de folha")).toBeInTheDocument();
  });

  it("permite editar e solicitar a remoção segura dos cadastros auxiliares", async () => {
    const user = userEvent.setup();
    render(<RhPage />);

    await user.click(screen.getByRole("tab", { name: "Cadastros" }));
    await user.click(screen.getByRole("button", { name: "Editar Operador de serra" }));

    expect(screen.getByRole("heading", { name: "Editar cargo" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Operador de serra")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(state.atualizarCargo).toHaveBeenCalledWith(expect.objectContaining({ id: 11, nome: "Operador de serra", cbo: "7721-10" }));

    await user.click(screen.getByRole("button", { name: "Remover Operador de serra" }));
    expect(screen.getByText(/remoção é permitida apenas quando o cadastro não estiver vinculado/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remover cadastro" }));
    expect(state.removerCargo).toHaveBeenCalledWith({ id: 11 });
  });

  it("permite configurar desconto simplificado e regras de redução do IRRF por vigência", async () => {
    const user = userEvent.setup();
    render(<RhPage />);

    await user.click(screen.getByRole("tab", { name: "Regras tributárias" }));
    await user.selectOptions(screen.getByRole("combobox"), "irrf");
    expect(screen.getByText("Deduções e reduções do IRRF")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("607,20")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/zera_imposto\|0\|5000/i)).toBeInTheDocument();
    expect(screen.getByText(/O motor compara deduções legais e desconto simplificado/i)).toBeInTheDocument();
  });
});
