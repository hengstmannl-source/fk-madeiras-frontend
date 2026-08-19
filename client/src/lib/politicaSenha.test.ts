import { describe, expect, it } from "vitest";
import { mensagemSenhaInvalida, requisitosSenha } from "@shared/politicaSenha";

describe("política de senha", () => {
  it("identifica cada requisito de senha de forma independente", () => {
    expect(requisitosSenha("madeira")).toEqual({ comprimento: false, maiuscula: false, numero: false });
    expect(requisitosSenha("Madeira8")).toEqual({ comprimento: true, maiuscula: true, numero: true });
  });

  it("retorna uma orientação compreensível para cada requisito pendente", () => {
    expect(mensagemSenhaInvalida("Ab1")).toBe("A senha precisa ter pelo menos 8 caracteres.");
    expect(mensagemSenhaInvalida("madeira8")).toBe("A senha precisa incluir pelo menos uma letra maiúscula.");
    expect(mensagemSenhaInvalida("MadeiraX")).toBe("A senha precisa incluir pelo menos um número.");
    expect(mensagemSenhaInvalida("Madeira8")).toBeNull();
  });
});
