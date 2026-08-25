import { describe, expect, it } from "vitest";
import { podeSelecionarEmpresa, resolverEmpresaAtiva } from "./empresaAtiva.logic";

const empresas = [
  { empresa: { id: 2 } },
  { empresa: { id: 7 } },
] as const;

describe("empresa ativa", () => {
  it("mantém a empresa preferida quando ela é um vínculo ativo", () => {
    expect(resolverEmpresaAtiva(empresas, 7)?.empresa.id).toBe(7);
  });

  it("usa a primeira empresa disponível de forma determinística no primeiro acesso", () => {
    expect(resolverEmpresaAtiva(empresas, null)?.empresa.id).toBe(2);
  });

  it("descarta uma empresa salva sem vínculo e ativa a primeira empresa acessível", () => {
    expect(resolverEmpresaAtiva(empresas, 99)?.empresa.id).toBe(2);
  });

  it("não inventa uma empresa ativa quando o usuário não possui vínculo", () => {
    expect(resolverEmpresaAtiva([], null)).toBeUndefined();
  });

  it("não permite selecionar uma empresa sem vínculo ativo", () => {
    expect(podeSelecionarEmpresa(empresas, 99)).toBe(false);
    expect(podeSelecionarEmpresa(empresas, 2)).toBe(true);
  });
});
