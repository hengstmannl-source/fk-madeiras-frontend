const CABECALHOS_CSV_CLIENTES = ["nome", "contacto", "email", "nif", "morada", "observacoes"] as const;

export type LinhaImportacaoCliente = {
  numeroLinha: number;
  nome: string;
  contacto: string | null;
  email: string | null;
  nif: string | null;
  morada: string | null;
  observacoes: string | null;
};

export type ClienteExistenteParaImportacao = {
  id: number;
  nome: string;
  email?: string | null;
  nif?: string | null;
};

function lerLinhasCsv(conteudo: string): string[][] {
  const linhas: string[][] = [];
  let linha: string[] = [];
  let celula = "";
  let entreAspas = false;
  for (let indice = 0; indice < conteudo.length; indice += 1) {
    const caractere = conteudo[indice];
    if (entreAspas) {
      if (caractere === '"' && conteudo[indice + 1] === '"') { celula += '"'; indice += 1; }
      else if (caractere === '"') entreAspas = false;
      else celula += caractere;
      continue;
    }
    if (caractere === '"') { entreAspas = true; continue; }
    if (caractere === ";") { linha.push(celula); celula = ""; continue; }
    if (caractere === "\n") { linha.push(celula); linhas.push(linha); linha = []; celula = ""; continue; }
    if (caractere !== "\r") celula += caractere;
  }
  if (entreAspas) throw new Error("O arquivo CSV possui aspas sem fechamento");
  if (celula || linha.length) { linha.push(celula); linhas.push(linha); }
  return linhas;
}

function normalizarTexto(valor: string): string {
  return valor.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
}

function normalizarNif(valor: string): string {
  return valor.replace(/\D/g, "");
}

function chavesCliente(cliente: { nome: string; email?: string | null; nif?: string | null }): string[] {
  const chaves = [`nome:${normalizarTexto(cliente.nome)}`];
  if (cliente.email) chaves.push(`email:${cliente.email.trim().toLocaleLowerCase("pt-BR")}`);
  const nif = cliente.nif ? normalizarNif(cliente.nif) : "";
  if (nif) chaves.push(`nif:${nif}`);
  return chaves;
}

export function criarModeloCsvClientes(): string {
  return `\uFEFF${CABECALHOS_CSV_CLIENTES.join(";")}\nCliente Exemplo;(00) 00000-0000;cliente@exemplo.com;000.000.000-00;Rua das Madeiras, 100;Preencha esta linha apenas como exemplo`;
}

export function validarCsvClientes(conteudo: string, maximoLinhas = 1000): { linhas: LinhaImportacaoCliente[]; erros: string[] } {
  if (conteudo.length > 1_000_000) return { linhas: [], erros: ["O arquivo CSV excede o limite de 1 MB"] };
  let tabela: string[][];
  try { tabela = lerLinhasCsv(conteudo); } catch (erro) { return { linhas: [], erros: [erro instanceof Error ? erro.message : "Não foi possível ler o CSV"] }; }
  const cabecalho = (tabela.shift() ?? []).map((campo) => campo.replace(/^\uFEFF/, "").trim().toLocaleLowerCase("pt-BR"));
  const indices = CABECALHOS_CSV_CLIENTES.map((campo) => cabecalho.indexOf(campo));
  if (indices.some((indice) => indice < 0)) return { linhas: [], erros: [`Use o modelo CSV com os cabeçalhos: ${CABECALHOS_CSV_CLIENTES.join(", ")}`] };
  const dados = tabela.filter((linha) => linha.some((campo) => campo.trim()));
  if (!dados.length) return { linhas: [], erros: ["O arquivo CSV não possui clientes para importar"] };
  if (dados.length > maximoLinhas) return { linhas: [], erros: [`O limite por importação é de ${maximoLinhas} clientes`] };

  const linhas: LinhaImportacaoCliente[] = [];
  const erros: string[] = [];
  dados.forEach((colunas, indiceLinha) => {
    const numeroLinha = indiceLinha + 2;
    const valor = (campo: typeof CABECALHOS_CSV_CLIENTES[number]) => (colunas[indices[CABECALHOS_CSV_CLIENTES.indexOf(campo)]] ?? "").trim();
    const nome = valor("nome");
    const contacto = valor("contacto");
    const email = valor("email");
    const nif = valor("nif");
    const morada = valor("morada");
    const observacoes = valor("observacoes");
    const problemas: string[] = [];
    if (nome.length < 2 || nome.length > 300) problemas.push("nome obrigatório entre 2 e 300 caracteres");
    if (contacto.length > 100) problemas.push("contacto excede 100 caracteres");
    if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 300)) problemas.push("e-mail inválido ou superior a 300 caracteres");
    if (nif.length > 20) problemas.push("NIF excede 20 caracteres");
    if (morada.length > 4000) problemas.push("morada excede 4000 caracteres");
    if (observacoes.length > 4000) problemas.push("observações excedem 4000 caracteres");
    if (problemas.length) { erros.push(`Linha ${numeroLinha}: ${problemas.join("; ")}`); return; }
    linhas.push({ numeroLinha, nome, contacto: contacto || null, email: email || null, nif: nif || null, morada: morada || null, observacoes: observacoes || null });
  });
  return { linhas, erros };
}

export function prepararImportacaoClientes(input: { conteudo: string; clientesExistentes: ClienteExistenteParaImportacao[] }) {
  const validacao = validarCsvClientes(input.conteudo);
  if (validacao.erros.length) return { linhas: [], erros: validacao.erros };
  const chavesExistentes = new Set(input.clientesExistentes.flatMap(chavesCliente));
  const chavesDoArquivo = new Set<string>();
  const erros: string[] = [];
  const linhas = validacao.linhas.filter((linha) => {
    const chaves = chavesCliente(linha);
    if (chaves.some((chave) => chavesExistentes.has(chave))) {
      erros.push(`Linha ${linha.numeroLinha}: cliente já cadastrado com o mesmo nome, e-mail ou NIF`);
      return false;
    }
    if (chaves.some((chave) => chavesDoArquivo.has(chave))) {
      erros.push(`Linha ${linha.numeroLinha}: cliente duplicado dentro da própria planilha`);
      return false;
    }
    chaves.forEach((chave) => chavesDoArquivo.add(chave));
    return true;
  });
  return { linhas: erros.length ? [] : linhas, erros };
}
