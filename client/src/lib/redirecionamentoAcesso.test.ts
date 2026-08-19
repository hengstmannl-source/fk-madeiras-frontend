import { describe, expect, it } from "vitest";
import { deveRedirecionarParaLoginLocal } from "./redirecionamentoAcesso";

describe("deveRedirecionarParaLoginLocal", () => {
  it("envia rotas protegidas para o login por e-mail e senha", () => {
    expect(deveRedirecionarParaLoginLocal("/")).toBe(true);
    expect(deveRedirecionarParaLoginLocal("/financeiro")).toBe(true);
  });

  it("preserva as páginas públicas de login, cadastro e convite", () => {
    expect(deveRedirecionarParaLoginLocal("/login")).toBe(false);
    expect(deveRedirecionarParaLoginLocal("/cadastro")).toBe(false);
    expect(deveRedirecionarParaLoginLocal("/convite/token-seguro")).toBe(false);
  });
});
