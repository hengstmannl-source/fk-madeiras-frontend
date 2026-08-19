import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RH_TUTORIAL_STEPS, RhTutorialDialog } from "./RhTutorialDialog";

describe("RhTutorialDialog", () => {
  it("guia o utilizador pelas etapas e abre a seção correspondente", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onNavigate = vi.fn();
    render(<RhTutorialDialog open onOpenChange={onOpenChange} onNavigate={onNavigate} />);

    expect(screen.getByText("Prepare os cadastros-base")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Próxima" }));
    expect(screen.getByText("Cadastre os colaboradores")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Abrir colaboradores" }));

    expect(onNavigate).toHaveBeenCalledWith("colaboradores");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("mantém uma rota para cada etapa do tutorial", () => {
    expect(RH_TUTORIAL_STEPS).toHaveLength(7);
    expect(RH_TUTORIAL_STEPS.map((etapa) => etapa.aba)).toEqual(["cadastros", "colaboradores", "regras", "visao", "folha", "folha", "relatorios"]);
  });
});
