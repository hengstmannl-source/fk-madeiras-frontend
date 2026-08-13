export type MovimentoParaSugestao = {
  tipo: "entrada" | "saida";
  valor: string | number;
  dataMovimento: Date | string;
  descricao: string;
};

export type BaixaParaSugestao = {
  id: number;
  tituloId: number;
  tipoTitulo: "receber" | "pagar";
  valor: string | number;
  dataBaixa: Date | string;
  descricaoTitulo: string;
  contraparteNome?: string | null;
};

export type SugestaoConciliacao = BaixaParaSugestao & { pontuacao: number; motivo: string };

function normalizar(valor: string): string[] {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").split(/[^a-z0-9]+/).filter((palavra) => palavra.length >= 3);
}

function diasEntre(dataA: Date | string, dataB: Date | string): number {
  return Math.round(Math.abs(new Date(dataA).getTime() - new Date(dataB).getTime()) / 86_400_000);
}

export function sugerirConciliacoes(movimento: MovimentoParaSugestao, baixas: BaixaParaSugestao[]): SugestaoConciliacao[] {
  const tipoEsperado = movimento.tipo === "entrada" ? "receber" : "pagar";
  const valorMovimento = Math.abs(Number(movimento.valor));
  const palavrasMovimento = new Set(normalizar(movimento.descricao));
  return baixas.flatMap((baixa) => {
    if (baixa.tipoTitulo !== tipoEsperado || Math.abs(Math.abs(Number(baixa.valor)) - valorMovimento) > 0.01) return [];
    const dias = diasEntre(movimento.dataMovimento, baixa.dataBaixa);
    if (dias > 15) return [];
    const palavrasBaixa = normalizar(`${baixa.descricaoTitulo} ${baixa.contraparteNome ?? ""}`);
    const coincidencias = palavrasBaixa.filter((palavra) => palavrasMovimento.has(palavra)).length;
    const pontuacao = 60 + (dias <= 2 ? 25 : dias <= 7 ? 15 : 5) + Math.min(15, coincidencias * 5);
    const motivo = [`valor igual`, `${dias} dia(s) de diferença`];
    if (coincidencias) motivo.push("descrição relacionada");
    return [{ ...baixa, pontuacao, motivo: motivo.join(" · ") }];
  }).sort((a, b) => b.pontuacao - a.pontuacao || new Date(b.dataBaixa).getTime() - new Date(a.dataBaixa).getTime());
}
