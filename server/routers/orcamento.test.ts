import { describe, expect, it } from "vitest";
import { AproveitamentoVendaSchema, ItemSchema, RegistroEntregaFisicaSchema } from "./orcamento";
import { historicoAlteracoes } from "../../drizzle/schema";
import { classificarCategoriaOperacionalVenda } from "../db";

describe("itens de orçamento livres", () => {
  it("aceita madeira digitada e preço por m³ sem madeira cadastrada", () => {
    const item = ItemSchema.parse({
      madeiraId: null,
      bitolaId: null,
      madeiraNome: "Garapeira aparelhada",
      bitolaDescricao: "2,5×15 cm",
      espessura: "25",
      largura: "150",
      comprimento: "3",
      quantidade: 4,
      precoM3: "2450.50",
      precoLinear: "91.89",
      valorPeca: "275.67",
      valorTotal: "1102.68",
    });

    expect(item.madeiraId).toBeNull();
    expect(item.madeiraNome).toBe("Garapeira aparelhada");
    expect(item.precoM3).toBe("2450.50");
  });
});

describe("aproveitamento selecionado no romaneio", () => {
  it("aceita a essência, o volume em m³ e o preço por m³ escolhidos na venda", () => {
    expect(AproveitamentoVendaSchema.parse({
      madeiraNome: "Cedrinho",
      volume: "0,350",
      precoM3: "620,00",
    })).toEqual({ madeiraNome: "Cedrinho", volume: "0.350", precoM3: "620.00" });
  });

  it("rejeita aproveitamento sem volume positivo", () => {
    expect(() => AproveitamentoVendaSchema.parse({ madeiraNome: "Cedrinho", volume: "0", precoM3: "620" }))
      .toThrow("Informe um volume de aproveitamento positivo");
  });
});

describe("histórico de alterações", () => {
  it("aceita registrar mudanças de estado de orçamento", () => {
    expect(historicoAlteracoes.tipo.enumValues).toContain("estado");
  });
});

describe("fluxos independentes de pagamento e entrega", () => {
  it("move a venda de aprovada para paga e então concluída quando a retirada ocorre após o pagamento", () => {
    const inicial = classificarCategoriaOperacionalVenda(false, false);
    const aposPagamento = classificarCategoriaOperacionalVenda(true, false);
    const aposEntrega = classificarCategoriaOperacionalVenda(true, true);

    expect(inicial).toBe("aprovadas");
    expect(aposPagamento).toBe("pagas");
    expect(aposEntrega).toBe("concluidas");
  });

  it("move a venda de aprovada para entregue e então concluída quando o pagamento é posterior", () => {
    const inicial = classificarCategoriaOperacionalVenda(false, false);
    const aposEntrega = classificarCategoriaOperacionalVenda(false, true);
    const aposPagamento = classificarCategoriaOperacionalVenda(true, true);

    expect(inicial).toBe("aprovadas");
    expect(aposEntrega).toBe("entregues");
    expect(aposPagamento).toBe("concluidas");
  });

  it("exige dados operacionais rastreáveis ao registrar a entrega", () => {
    expect(RegistroEntregaFisicaSchema.parse({
      id: 12,
      entregueEm: "2026-08-14",
      modalidadeEntrega: "entrega",
      responsavelEntrega: "João da Silva",
      observacoesEntrega: "Recebido no pátio do cliente.",
      aproveitamentos: [{ madeiraNome: "Cedrinho", volume: "0,250" }],
    })).toMatchObject({ modalidadeEntrega: "entrega", responsavelEntrega: "João da Silva", aproveitamentos: [{ madeiraNome: "Cedrinho", volume: "0.250" }] });

    expect(() => RegistroEntregaFisicaSchema.parse({
      id: 12,
      entregueEm: "2026-08-14",
      modalidadeEntrega: "retirada",
      responsavelEntrega: "J",
    })).toThrow("Informe o responsável pela entrega");

    expect(() => RegistroEntregaFisicaSchema.parse({
      id: 12,
      entregueEm: "2026-08-14",
      modalidadeEntrega: "retirada",
      responsavelEntrega: "João da Silva",
      aproveitamentos: [{ madeiraNome: "Cedrinho", volume: "0" }],
    })).toThrow("Informe um volume de aproveitamento positivo");
  });
});
