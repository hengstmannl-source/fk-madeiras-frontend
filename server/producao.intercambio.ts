import { normalizarCodigoPlaqueta } from "./producao.logic";

export const CABECALHOS_CSV_TORAS_PRODUCAO = ["plaqueta", "essencia", "diametro_cm", "comprimento_m", "volume_m3"] as const;
export const CABECALHOS_CSV_PECAS_PRODUCAO = ["essencia", "espessura_cm", "largura_cm", "comprimento_m", "quantidade"] as const;

export type LinhaImportacaoToraProducao = {
  codigo: string;
  madeiraNome?: string;
  diametro?: string;
  comprimento?: string;
  volume?: string;
};

export type LinhaImportacaoPecaProducao = {
  madeiraNome: string;
  espessura: string;
  largura: string;
  comprimento: string;
  quantidade: number;
};

type PlaquetaDisponivel = {
  id: number;
  codigo: string;
  estado: "disponivel" | "consumida" | "cancelada";
  madeiraNome: string;
  diametro?: string | number | null;
  comprimento?: string | number | null;
  volumeDisponivel: string | number;
};

export type ToraPreparadaImportacao = {
  plaquetaId?: number;
  novaPlaqueta?: { codigo: string };
  codigo: string;
  madeiraNome: string;
  diametro: string;
  comprimento: string;
  volume: string;
  origem: "estoque" | "entrada_imediata";
};

function lerLinhasCsv(conteudo: string): string[][] {
  const linhas: string[][] = [];
  let linha: string[] = [];
  let celula = "";
  let entreAspas = false;
  for (let indice = 0; indice < conteudo.length; indice += 1) {
    const caractere = conteudo[indice];
    if (caractere === '"') {
      if (entreAspas && conteudo[indice + 1] === '"') { celula += '"'; indice += 1; }
      else entreAspas = !entreAspas;
    } else if (caractere === ";" && !entreAspas) { linha.push(celula); celula = ""; }
    else if (caractere === "\n" && !entreAspas) { linha.push(celula); linhas.push(linha); linha = []; celula = ""; }
    else if (caractere !== "\r") celula += caractere;
  }
  if (entreAspas) throw new Error("O arquivo CSV possui aspas sem fechamento");
  if (celula || linha.length) { linha.push(celula); linhas.push(linha); }
  return linhas;
}

function decimalOpcional(valor: string, campo: string, linha: number): string | undefined {
  const texto = valor.trim();
  if (!texto) return undefined;
  const normalizado = texto.includes(",") ? texto.replace(/\./g, "").replace(",", ".") : texto;
  const numero = Number(normalizado);
  if (!Number.isFinite(numero) || numero <= 0) throw new Error(`Linha ${linha}: informe ${campo} como número positivo`);
  return String(numero);
}

export function criarModeloCsvTorasProducao(): string {
  return `\uFEFF${CABECALHOS_CSV_TORAS_PRODUCAO.join(";")}\nTOR-0001;;;;`;
}

export function criarModeloCsvPecasProducao(): string {
  return `\uFEFF${CABECALHOS_CSV_PECAS_PRODUCAO.join(";")}\nCedrinho;3;5;2;11`;
}

export function validarCsvTorasProducao(conteudo: string, maximoLinhas = 200): { linhas: LinhaImportacaoToraProducao[]; erros: string[] } {
  if (conteudo.length > 1_000_000) return { linhas: [], erros: ["O arquivo CSV excede o limite de 1 MB"] };
  let tabela: string[][];
  try { tabela = lerLinhasCsv(conteudo); } catch (erro) { return { linhas: [], erros: [erro instanceof Error ? erro.message : "Não foi possível ler o CSV"] }; }
  const cabecalho = (tabela.shift() ?? []).map((campo) => campo.replace(/^\uFEFF/, "").trim().toLowerCase());
  const indices = CABECALHOS_CSV_TORAS_PRODUCAO.map((campo) => cabecalho.indexOf(campo));
  if (indices.some((indice) => indice < 0)) return { linhas: [], erros: [`Use o modelo CSV com os cabeçalhos: ${CABECALHOS_CSV_TORAS_PRODUCAO.join(", ")}`] };
  const dados = tabela.filter((linha) => linha.some((campo) => campo.trim()));
  if (!dados.length) return { linhas: [], erros: ["O arquivo CSV não possui plaquetas para importar"] };
  if (dados.length > maximoLinhas) return { linhas: [], erros: [`O limite por importação é de ${maximoLinhas} plaquetas`] };
  const codigos = new Set<string>();
  const linhas: LinhaImportacaoToraProducao[] = [];
  const erros: string[] = [];
  dados.forEach((colunas, indice) => {
    const numeroLinha = indice + 2;
    const valor = (campo: typeof CABECALHOS_CSV_TORAS_PRODUCAO[number]) => (colunas[indices[CABECALHOS_CSV_TORAS_PRODUCAO.indexOf(campo)]] ?? "").trim();
    const codigo = normalizarCodigoPlaqueta(valor("plaqueta"));
    if (codigo.length < 2) { erros.push(`Linha ${numeroLinha}: informe a plaqueta`); return; }
    if (codigos.has(codigo)) { erros.push(`Linha ${numeroLinha}: a plaqueta ${codigo} está repetida na planilha`); return; }
    codigos.add(codigo);
    try {
      linhas.push({
        codigo,
        madeiraNome: valor("essencia") || undefined,
        diametro: decimalOpcional(valor("diametro_cm"), "o diâmetro", numeroLinha),
        comprimento: decimalOpcional(valor("comprimento_m"), "o comprimento", numeroLinha),
        volume: decimalOpcional(valor("volume_m3"), "o volume", numeroLinha),
      });
    } catch (erro) { erros.push(erro instanceof Error ? erro.message : `Linha ${numeroLinha}: dados inválidos`); }
  });
  return erros.length ? { linhas: [], erros } : { linhas, erros: [] };
}

export function validarCsvPecasProducao(conteudo: string, maximoLinhas = 1000): { itens: LinhaImportacaoPecaProducao[]; erros: string[] } {
  if (conteudo.length > 1_000_000) return { itens: [], erros: ["O arquivo CSV excede o limite de 1 MB"] };
  let tabela: string[][];
  try { tabela = lerLinhasCsv(conteudo); } catch (erro) { return { itens: [], erros: [erro instanceof Error ? erro.message : "Não foi possível ler o CSV"] }; }
  const cabecalho = (tabela.shift() ?? []).map((campo) => campo.replace(/^\uFEFF/, "").trim().toLowerCase());
  const indices = CABECALHOS_CSV_PECAS_PRODUCAO.map((campo) => cabecalho.indexOf(campo));
  if (indices.some((indice) => indice < 0)) return { itens: [], erros: [`Use o modelo CSV com os cabeçalhos: ${CABECALHOS_CSV_PECAS_PRODUCAO.join(", ")}`] };
  const dados = tabela.filter((linha) => linha.some((campo) => campo.trim()));
  if (!dados.length) return { itens: [], erros: ["O arquivo CSV não possui peças para importar"] };
  if (dados.length > maximoLinhas) return { itens: [], erros: [`O limite por importação é de ${maximoLinhas} peças`] };
  const itens: LinhaImportacaoPecaProducao[] = [];
  const erros: string[] = [];
  dados.forEach((colunas, indice) => {
    const numeroLinha = indice + 2;
    const valor = (campo: typeof CABECALHOS_CSV_PECAS_PRODUCAO[number]) => (colunas[indices[CABECALHOS_CSV_PECAS_PRODUCAO.indexOf(campo)]] ?? "").trim();
    const madeiraNome = valor("essencia");
    if (madeiraNome.length < 2) { erros.push(`Linha ${numeroLinha}: informe a essência`); return; }
    try {
      const espessura = decimalOpcional(valor("espessura_cm"), "a espessura", numeroLinha);
      const largura = decimalOpcional(valor("largura_cm"), "a largura", numeroLinha);
      const comprimento = decimalOpcional(valor("comprimento_m"), "o comprimento", numeroLinha);
      const quantidade = Number(valor("quantidade").replace(",", "."));
      if (!espessura || !largura || !comprimento) throw new Error(`Linha ${numeroLinha}: informe todas as medidas da peça`);
      if (!Number.isInteger(quantidade) || quantidade <= 0) throw new Error(`Linha ${numeroLinha}: informe a quantidade como número inteiro positivo`);
      itens.push({ madeiraNome, espessura, largura, comprimento, quantidade });
    } catch (erro) { erros.push(erro instanceof Error ? erro.message : `Linha ${numeroLinha}: dados inválidos`); }
  });
  return erros.length ? { itens: [], erros } : { itens, erros: [] };
}

export function prepararImportacaoTorasProducao(input: { conteudo: string; plaquetas: PlaquetaDisponivel[] }) {
  const validacao = validarCsvTorasProducao(input.conteudo);
  if (validacao.erros.length) return { toras: [] as ToraPreparadaImportacao[], erros: validacao.erros };
  const porCodigo = new Map(input.plaquetas.map((plaqueta) => [normalizarCodigoPlaqueta(plaqueta.codigo), plaqueta]));
  const erros: string[] = [];
  const toras: ToraPreparadaImportacao[] = validacao.linhas.flatMap((linha): ToraPreparadaImportacao[] => {
    const plaqueta = porCodigo.get(linha.codigo);
    if (!plaqueta) {
      if (!linha.madeiraNome || !linha.volume) {
        erros.push(`Linha da plaqueta ${linha.codigo}: informe essência e volume para registrar uma nova entrada na Produção`);
        return [];
      }
      return [{
        novaPlaqueta: { codigo: linha.codigo },
        codigo: linha.codigo,
        madeiraNome: linha.madeiraNome,
        diametro: linha.diametro ?? "",
        comprimento: linha.comprimento ?? "",
        volume: linha.volume,
        origem: "entrada_imediata" as const,
      }];
    }
    if (plaqueta.estado !== "disponivel") { erros.push(`A plaqueta ${linha.codigo} não está disponível para produção`); return []; }
    const volume = linha.volume ?? String(plaqueta.volumeDisponivel ?? "");
    if (Number(volume) <= 0) { erros.push(`A plaqueta ${linha.codigo} não possui volume disponível válido`); return []; }
    return [{
      plaquetaId: plaqueta.id,
      codigo: plaqueta.codigo,
      madeiraNome: linha.madeiraNome ?? plaqueta.madeiraNome,
      diametro: linha.diametro ?? String(plaqueta.diametro ?? ""),
      comprimento: linha.comprimento ?? String(plaqueta.comprimento ?? ""),
      volume,
      origem: "estoque" as const,
    }];
  });
  return erros.length ? { toras: [] as typeof toras, erros } : { toras, erros: [] as string[] };
}
