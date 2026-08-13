import { describe, expect, it } from "vitest";
import { prepararImportacaoCsvExtrato, prepararImportacaoOfxExtrato } from "./conciliacao.intercambio";

describe("prepararImportacaoCsvExtrato", () => {
  it("interpreta valores brasileiros, tipos e identificadores do modelo CSV", () => {
    const resultado = prepararImportacaoCsvExtrato("data;descricao;valor;tipo;identificador\n01/09/2026;PIX Cliente;1.250,50;entrada;PIX-001\n2026-09-02;Pagamento fornecedor;-850,00;;PAG-002");

    expect(resultado.erros).toEqual([]);
    expect(resultado.linhas).toEqual(expect.arrayContaining([
      expect.objectContaining({ dataMovimento: "2026-09-01", tipo: "entrada", valor: "1250.50", identificadorExterno: "PIX-001" }),
      expect.objectContaining({ dataMovimento: "2026-09-02", tipo: "saida", valor: "850.00", identificadorExterno: "PAG-002" }),
    ]));
  });

  it("rejeita movimentos duplicados e cabeçalhos insuficientes", () => {
    const duplicado = prepararImportacaoCsvExtrato("data;descricao;valor;tipo\n2026-09-01;PIX Cliente;100,00;entrada\n2026-09-01;PIX Cliente;100,00;entrada");
    const semCabecalho = prepararImportacaoCsvExtrato("data;descricao\n2026-09-01;PIX Cliente");

    expect(duplicado.erros[0]).toContain("duplicado");
    expect(semCabecalho.erros[0]).toContain("data, descricao e valor");
  });
});

describe("prepararImportacaoOfxExtrato", () => {
  it("interpreta movimentos OFX com entrada e saída", () => {
    const resultado = prepararImportacaoOfxExtrato(`<OFX><BANKTRANLIST>
      <STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260901120000<TRNAMT>1500.00<FITID>OFX-1<MEMO>Recebimento cliente
      <STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260902120000<TRNAMT>-220.25<FITID>OFX-2<NAME>Tarifa bancária
    </BANKTRANLIST></OFX>`);

    expect(resultado.erros).toEqual([]);
    expect(resultado.linhas).toEqual(expect.arrayContaining([
      expect.objectContaining({ dataMovimento: "2026-09-01", tipo: "entrada", valor: "1500.00", identificadorExterno: "OFX-1" }),
      expect.objectContaining({ dataMovimento: "2026-09-02", tipo: "saida", valor: "220.25", identificadorExterno: "OFX-2" }),
    ]));
  });
});
