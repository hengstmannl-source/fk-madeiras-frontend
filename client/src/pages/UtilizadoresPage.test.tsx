import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { perfilAtual, contextoAtual, membrosQuery, convitesQuery, reenviarMutate, removerMutate, invalidarConvites, invalidarMembros } = vi.hoisted(() => ({
  perfilAtual: { role: "user" },
  contextoAtual: { membro: { papel: "administrador" } },
  membrosQuery: vi.fn(() => ({
    data: [
      { membro: { id: 1, ativo: true, papel: "administrador" }, usuario: { name: "Maria Silva", email: "maria@fkmadeiras.com.br", lastSignedIn: new Date("2026-08-18T15:30:00Z") } },
      { membro: { id: 2, ativo: false, papel: "vendas" }, usuario: { name: "Acesso suspenso", email: "suspenso@fkmadeiras.com.br", lastSignedIn: null } },
    ],
    isLoading: false,
  })),
  convitesQuery: vi.fn(() => ({
    data: [{ convite: { id: 9, emailNormalizado: "novo@fkmadeiras.com.br", papel: "financeiro", expiraEm: new Date("2026-08-25T15:30:00Z") } }],
    isLoading: false,
  })),
  reenviarMutate: vi.fn(),
  removerMutate: vi.fn(),
  invalidarConvites: vi.fn(),
  invalidarMembros: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: perfilAtual, loading: false }) }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ equipe: { listar: { invalidate: invalidarMembros }, listarConvitesPendentes: { invalidate: invalidarConvites } } }),
    auth: { contexto: { useQuery: () => ({ data: contextoAtual, isLoading: false }) } },
    equipe: {
      listar: { useQuery: membrosQuery },
      listarConvitesPendentes: { useQuery: convitesQuery },
      reenviarConvite: { useMutation: () => ({ mutate: reenviarMutate, isPending: false }) },
      remover: { useMutation: () => ({ mutate: removerMutate, isPending: false }) },
    },
  },
}));

import UtilizadoresPage from "./UtilizadoresPage";

afterEach(() => {
  cleanup();
  perfilAtual.role = "user";
  contextoAtual.membro.papel = "administrador";
  membrosQuery.mockClear();
  convitesQuery.mockClear();
  reenviarMutate.mockReset();
  removerMutate.mockReset();
  invalidarConvites.mockReset();
  invalidarMembros.mockReset();
});

describe("UtilizadoresPage", () => {
  it("exibe colaboradores ativos, perfil, último acesso e convites pendentes", () => {
    render(<UtilizadoresPage />);

    expect(screen.getByRole("heading", { name: "Gestão de utilizadores" })).toBeTruthy();
    expect(screen.getByText("Maria Silva")).toBeTruthy();
    expect(screen.getByText("Administrador")).toBeTruthy();
    expect(screen.getByText("novo@fkmadeiras.com.br")).toBeTruthy();
    expect(screen.getByText("Financeiro")).toBeTruthy();
    expect(screen.queryByText("Acesso suspenso")).toBeNull();
  });

  it("solicita a renovação usando o identificador do convite pendente", async () => {
    const user = userEvent.setup();
    render(<UtilizadoresPage />);

    await user.click(screen.getByRole("button", { name: "Reenviar" }));

    expect(reenviarMutate).toHaveBeenCalledWith({ conviteId: 9 });
  });

  it("pede confirmação antes de remover o acesso de um utilizador", async () => {
    const user = userEvent.setup();
    render(<UtilizadoresPage />);

    await user.click(screen.getByRole("button", { name: "Remover" }));
    expect(screen.getByRole("heading", { name: "Remover acesso de Maria Silva?" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Remover acesso" }));
    expect(removerMutate).toHaveBeenCalledWith({ membroId: 1 });
  });
});
