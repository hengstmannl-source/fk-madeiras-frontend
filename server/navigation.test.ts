import { describe, expect, it, vi } from "vitest";
import { dashboardMenuItems, dashboardNavigation, getFutureModuleMessage, getNavigationPresentation, handleNavigationItemClick } from "../client/src/components/DashboardLayout";

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
    expect(dashboardNavigation.futuros.map((item) => item.label)).toEqual(["Diesel"]);
  });

  it("informa que os módulos futuros ainda não estão disponíveis", () => {
    for (const item of dashboardNavigation.futuros) {
      expect(item.disabled).toBe(true);
      expect(getFutureModuleMessage(item.label)).toBe(`${item.label} será disponibilizado em uma próxima etapa.`);
    }
  });

  it("bloqueia a navegação e mostra feedback ao clicar em um módulo futuro", () => {
    const navigate = vi.fn();
    const notify = vi.fn();
    for (const item of dashboardNavigation.futuros) handleNavigationItemClick(item, navigate, notify);
    expect(navigate).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledTimes(dashboardNavigation.futuros.length);
    expect(notify).toHaveBeenNthCalledWith(1, getFutureModuleMessage("Diesel"));
  });

  it("mantém a barra lateral recolhível no desktop e ativa o cabeçalho de navegação no mobile", () => {
    expect(getNavigationPresentation(false)).toMatchObject({ collapsible: "icon", showMobileHeader: false });
    expect(getNavigationPresentation(true)).toMatchObject({ collapsible: "icon", showMobileHeader: true });
  });
});
