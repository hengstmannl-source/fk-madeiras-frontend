import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConvitePage } from "./AcessoPage";

const state = vi.hoisted(() => ({
  aceitarConvite: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("wouter", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="#">{children}</a>,
  useLocation: () => ["/convite/token", vi.fn()],
  useRoute: () => [true, { token: "token-de-convite-valido-com-mais-de-vinte-caracteres" }],
}));

vi.mock("sonner", () => ({ toast: { error: state.toastError } }));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ auth: { me: { invalidate: vi.fn() } } }),
    equipe: {
      consultarConvite: {
        useQuery: () => ({
          data: { empresa: { nome: "FK Madeiras", nomeFantasia: "" }, email: "colaborador@fk.com", papel: "vendas" },
          isLoading: false,
          error: null,
        }),
      },
      aceitarConvite: {
        useMutation: () => ({ mutate: state.aceitarConvite, isPending: false }),
      },
    },
  },
}));

describe("ConvitePage", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    state.aceitarConvite.mockReset();
    state.toastError.mockReset();
  });

  it("mostra os requisitos de senha antes do envio", () => {
    render(<ConvitePage />);

    expect(screen.getByText("A sua senha precisa ter:")).toBeInTheDocument();
    expect(screen.getByText("Pelo menos 8 caracteres")).toBeInTheDocument();
    expect(screen.getByText("Uma letra maiúscula")).toBeInTheDocument();
    expect(screen.getByText("Um número")).toBeInTheDocument();
  });

  it("impede o envio de senha curta com uma orientação compreensível", () => {
    render(<ConvitePage />);
    fireEvent.change(screen.getByLabelText("Nome completo"), { target: { value: "João Silva" } });
    fireEvent.change(screen.getByLabelText("Crie a sua senha"), { target: { value: "Ab1" } });
    fireEvent.click(screen.getByRole("button", { name: "Ativar o meu acesso" }));

    expect(state.toastError).toHaveBeenCalledWith("A senha precisa ter pelo menos 8 caracteres.");
    expect(state.aceitarConvite).not.toHaveBeenCalled();
  });

  it("envia a senha que cumpre todos os requisitos", () => {
    render(<ConvitePage />);
    fireEvent.change(screen.getByLabelText("Nome completo"), { target: { value: "João Silva" } });
    fireEvent.change(screen.getByLabelText("Crie a sua senha"), { target: { value: "Madeira8" } });
    fireEvent.click(screen.getByRole("button", { name: "Ativar o meu acesso" }));

    expect(state.aceitarConvite).toHaveBeenCalledWith({
      token: "token-de-convite-valido-com-mais-de-vinte-caracteres",
      nome: "João Silva",
      senha: "Madeira8",
    });
  });
});
