import { describe, expect, it, vi } from "vitest";
import { dashboardMenuItems, dashboardNavigation, getNavigationPresentation, handleNavigationItemClick } from "../client/src/components/DashboardLayout";

describe("navegação principal", () => {
  it("não apresenta o cadastro de madeiras como aba lateral", () => {
    expect(dashboardMenuItems.map((item) => item.label)).not.toContain("Madeiras");
    expect(dashboardMenuItems.map((item) => item.path)).not.toContain("/madeiras");
  });

  it("organiza financeiro e vendas com as opções prioritárias", () => {
    expect(dashboardNavigation.financeiro.map((item) => item.label)).toEqual(["Financeiro", "Contas a pagar", "Contas a receber"]);
    expect(dashboardNavigation.vendas.map((item) => item.label)).toEqual(["Vendas", "Aprovados"]);
    expect(dashboardNavigation.producao.map((item) => item.label)).toEqual(["Produção", "Estoque", "Inventário"]);
    expect(dashboardNavigation.producao.every((item) => !item.disabled)).toBe(true);
    expect(dashboardNavigation.combustivel.map((item) => item.label)).toEqual(["Diesel"]);
    expect(dashboardNavigation.combustivel.every((item) => !item.disabled)).toBe(true);
  });

  it("navega diretamente para o módulo Diesel disponível", () => {
    const navigate = vi.fn();
    const notify = vi.fn();
    for (const item of dashboardNavigation.combustivel) handleNavigationItemClick(item, navigate, notify);
    expect(navigate).toHaveBeenCalledWith("/diesel");
    expect(notify).not.toHaveBeenCalled();
  });

  it("mantém a barra lateral recolhível no desktop e ativa o cabeçalho de navegação no mobile", () => {
    expect(getNavigationPresentation(false)).toMatchObject({ collapsible: "icon", showMobileHeader: false });
    expect(getNavigationPresentation(true)).toMatchObject({ collapsible: "icon", showMobileHeader: true });
  });
});
