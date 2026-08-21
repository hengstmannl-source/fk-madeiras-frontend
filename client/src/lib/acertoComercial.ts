export type TipoAjusteComercial = "percentual" | "fixo";

function numero(valor: string) {
  return Number(valor.replace(",", ".")) || 0;
}

export function calcularAcertoComercial(input: {
  subtotal: number;
  desconto: string;
  fretePorTonelada: string;
  pesoCargaToneladas: string;
  comissaoTipo: TipoAjusteComercial;
  comissaoValor: string;
  taxaTipo: TipoAjusteComercial;
  taxaValor: string;
}) {
  const desconto = numero(input.desconto);
  const fretePorTonelada = numero(input.fretePorTonelada);
  const pesoCargaToneladas = numero(input.pesoCargaToneladas);
  const abatimentoFrete = fretePorTonelada * pesoCargaToneladas;
  const baseAposFrete = Math.max(0, input.subtotal - desconto - abatimentoFrete);
  const comissaoInformada = numero(input.comissaoValor);
  const taxaInformada = numero(input.taxaValor);
  const comissaoCalculada = input.comissaoTipo === "percentual" ? baseAposFrete * comissaoInformada / 100 : comissaoInformada;
  const taxaCalculada = input.taxaTipo === "percentual" ? baseAposFrete * taxaInformada / 100 : taxaInformada;
  return {
    abatimentoFrete,
    baseAposFrete,
    comissaoCalculada,
    taxaCalculada,
    total: Math.max(0, baseAposFrete - comissaoCalculada - taxaCalculada),
  };
}
