import { describe, expect, it } from "vitest";
import { podeAlterarOrcamentoPago } from "./db";

describe("bloqueio de orçamento pago", () => {
  it("permite alterações em um orçamento ainda não pago", () => {
    expect(podeAlterarOrcamentoPago(false, false)).toBe(true);
  });

  it("exige confirmação dupla antes de alterar ou excluir um orçamento pago", () => {
    expect(podeAlterarOrcamentoPago(true, false)).toBe(false);
    expect(podeAlterarOrcamentoPago(true, true)).toBe(true);
  });
});

