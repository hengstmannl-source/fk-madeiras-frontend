import { describe, expect, it } from "vitest";
import { dashboardMenuItems } from "../client/src/components/DashboardLayout";

describe("navegação principal", () => {
  it("não apresenta o cadastro de madeiras como aba lateral", () => {
    expect(dashboardMenuItems.map((item) => item.label)).not.toContain("Madeiras");
    expect(dashboardMenuItems.map((item) => item.path)).not.toContain("/madeiras");
  });
});
