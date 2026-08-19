import { describe, expect, it } from "vitest";
import { importarClientesCsv } from "./db";
import { criarModeloCsvClientes, prepararImportacaoClientes, validarCsvClientes } from "./clientes.intercambio";

const cabecalho = "nome;contacto;email;nif;morada;observacoes";

describe("intercâmbio de clientes", () => {
  it("gera o modelo CSV e preserva campos delimitados por aspas", () => {
    const csv = `${cabecalho}\n\"Cliente; Norte\";(11) 99999-0000;cliente@norte.com;123.456.789-00;\"Rua A; 10\";Cliente prioritário`;
    expect(criarModeloCsvClientes()).toContain(cabecalho);
    expect(validarCsvClientes(csv)).toEqual({
      linhas: [expect.objectContaining({ nome: "Cliente; Norte", email: "cliente@norte.com", morada: "Rua A; 10" })],
      erros: [],
    });
  });

  it("rejeita cabeçalhos ausentes, dados obrigatórios e e-mails inválidos", () => {
    expect(validarCsvClientes("nome;email\nCliente A;cliente@a.com").erros[0]).toMatch(/cabeçalhos/i);
    const csv = `${cabecalho}\n;Contacto;email-invalido;;;`;
    expect(validarCsvClientes(csv).erros[0]).toMatch(/nome obrigatório.*e-mail inválido/i);
  });

  it("recusa toda a planilha para clientes já existentes ou duplicados dentro do arquivo", () => {
    const existente = `${cabecalho}\nCliente Existente;;contato@existente.com;111.111.111-11;;`;
    const resultadoExistente = prepararImportacaoClientes({
      conteudo: existente,
      clientesExistentes: [{ id: 1, nome: "Cliente Existente", email: "outro@email.com", nif: null }],
    });
    expect(resultadoExistente).toMatchObject({ linhas: [], erros: [expect.stringMatching(/já cadastrado/i)] });

    const duplicado = `${cabecalho}\nCliente Novo;;;222.222.222-22;;\nCliente Novo;Outro;;;;`;
    const resultadoDuplicado = prepararImportacaoClientes({ conteudo: duplicado, clientesExistentes: [] });
    expect(resultadoDuplicado).toMatchObject({ linhas: [], erros: [expect.stringMatching(/duplicado/i)] });
  });

  it("não inicia transação para arquivo inválido e grava um lote válido de clientes", async () => {
    const lotes: unknown[] = [];
    let transacoes = 0;
    const database = {
      transaction: async (callback: (tx: any) => Promise<void>) => {
        transacoes += 1;
        await callback({ insert: () => ({ values: async (valores: unknown) => { lotes.push(valores); } }) });
      },
    };
    const invalido = `${cabecalho}\n;Contacto;invalido;;;`;
    await expect(importarClientesCsv(invalido, 9, { database, clientesExistentes: [] })).resolves.toMatchObject({ importados: 0, erros: [expect.any(String)] });
    expect(transacoes).toBe(0);

    const valido = `${cabecalho}\nCliente Novo;(11) 99999-0000;novo@cliente.com;222.222.222-22;Rua A;Observação`;
    await expect(importarClientesCsv(valido, 9, { database, clientesExistentes: [] })).resolves.toEqual({ importados: 1, erros: [] });
    expect(transacoes).toBe(1);
    expect(lotes).toEqual([expect.arrayContaining([expect.objectContaining({ nome: "Cliente Novo", criadoPor: 9, ativo: true })])]);
  });
});
