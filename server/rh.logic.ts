export type TipoEventoFolhaRh = "provento" | "desconto" | "informativo";

export type FaixaTributariaRhCalculo = {
  limiteInferior: number;
  limiteSuperior: number | null;
  aliquota: number;
  parcelaDeduzir: number;
};

export type EventoCalculoFolhaRh = {
  descricao: string;
  tipo: TipoEventoFolhaRh;
  valor: number;
  incideInss?: boolean;
  incideIrrf?: boolean;
  incideFgts?: boolean;
  eventoId?: number;
};

export type RegrasCalculoFolhaRh = {
  faixasInss: FaixaTributariaRhCalculo[];
  faixasIrrf: FaixaTributariaRhCalculo[];
  aliquotaFgts: number;
  deducaoDependenteIrrf: number;
};

export type EntradaCalculoFolhaRh = {
  salarioBase: number;
  quantidadeDependentesIrrf: number;
  adiantamentos: number;
  eventos: EventoCalculoFolhaRh[];
  regras: RegrasCalculoFolhaRh;
};

export function arredondarDinheiroRh(valor: number) {
  return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
}

export function calcularImpostoProgressivoRh(base: number, faixas: FaixaTributariaRhCalculo[]) {
  if (!Number.isFinite(base) || base <= 0) return 0;
  const faixa = [...faixas]
    .sort((a, b) => a.limiteInferior - b.limiteInferior)
    .find((item) => base >= item.limiteInferior && (item.limiteSuperior === null || base <= item.limiteSuperior));
  if (!faixa) return 0;
  return arredondarDinheiroRh(Math.max(0, base * (faixa.aliquota / 100) - faixa.parcelaDeduzir));
}

export function validarRegrasFolhaRh(regras: RegrasCalculoFolhaRh) {
  if (!Number.isFinite(regras.aliquotaFgts) || regras.aliquotaFgts < 0) {
    throw new Error("A alíquota de FGTS deve ser um valor não negativo");
  }
  if (!Number.isFinite(regras.deducaoDependenteIrrf) || regras.deducaoDependenteIrrf < 0) {
    throw new Error("A dedução por dependente deve ser um valor não negativo");
  }
  for (const grupo of [regras.faixasInss, regras.faixasIrrf]) {
    for (const faixa of grupo) {
      if (faixa.limiteInferior < 0 || faixa.aliquota < 0 || faixa.parcelaDeduzir < 0) {
        throw new Error("As faixas tributárias devem possuir valores não negativos");
      }
      if (faixa.limiteSuperior !== null && faixa.limiteSuperior < faixa.limiteInferior) {
        throw new Error("O limite superior da faixa não pode ser menor que o limite inferior");
      }
    }
  }
}

export function calcularFolhaColaboradorRh(entrada: EntradaCalculoFolhaRh) {
  if (!Number.isFinite(entrada.salarioBase) || entrada.salarioBase < 0) {
    throw new Error("O salário-base deve ser um valor não negativo");
  }
  if (!Number.isFinite(entrada.adiantamentos) || entrada.adiantamentos < 0) {
    throw new Error("Os adiantamentos devem ser um valor não negativo");
  }
  validarRegrasFolhaRh(entrada.regras);

  const eventos = entrada.eventos.map((evento) => {
    if (!evento.descricao.trim()) throw new Error("Todo evento da folha deve ter descrição");
    if (!Number.isFinite(evento.valor) || evento.valor < 0) throw new Error("O valor de cada evento deve ser não negativo");
    return { ...evento, valor: arredondarDinheiroRh(evento.valor) };
  });
  const proventosExtras = eventos.filter((evento) => evento.tipo === "provento").reduce((soma, evento) => soma + evento.valor, 0);
  const descontosEventos = eventos.filter((evento) => evento.tipo === "desconto").reduce((soma, evento) => soma + evento.valor, 0);
  const baseInss = entrada.salarioBase + eventos.filter((evento) => evento.tipo === "provento" && evento.incideInss).reduce((soma, evento) => soma + evento.valor, 0);
  const inss = calcularImpostoProgressivoRh(baseInss, entrada.regras.faixasInss);
  const baseIrrfBruta = entrada.salarioBase + eventos.filter((evento) => evento.tipo === "provento" && evento.incideIrrf).reduce((soma, evento) => soma + evento.valor, 0);
  const deducaoDependentes = Math.max(0, entrada.quantidadeDependentesIrrf) * entrada.regras.deducaoDependenteIrrf;
  const baseIrrf = Math.max(0, baseIrrfBruta - inss - deducaoDependentes);
  const irrf = calcularImpostoProgressivoRh(baseIrrf, entrada.regras.faixasIrrf);
  const baseFgts = entrada.salarioBase + eventos.filter((evento) => evento.tipo === "provento" && evento.incideFgts).reduce((soma, evento) => soma + evento.valor, 0);
  const fgts = arredondarDinheiroRh(baseFgts * (entrada.regras.aliquotaFgts / 100));
  const totalProventos = arredondarDinheiroRh(entrada.salarioBase + proventosExtras);
  const totalDescontos = arredondarDinheiroRh(inss + irrf + entrada.adiantamentos + descontosEventos);
  const salarioLiquido = arredondarDinheiroRh(Math.max(0, totalProventos - totalDescontos));

  return {
    salarioBase: arredondarDinheiroRh(entrada.salarioBase),
    totalProventos,
    baseInss: arredondarDinheiroRh(baseInss),
    inss,
    baseIrrf: arredondarDinheiroRh(baseIrrf),
    irrf,
    adiantamentos: arredondarDinheiroRh(entrada.adiantamentos),
    outrosDescontos: arredondarDinheiroRh(descontosEventos),
    totalDescontos,
    salarioLiquido,
    fgts,
    custoEmpresa: arredondarDinheiroRh(totalProventos + fgts),
    eventos,
  };
}

export function podeEditarFolhaRh(estado: "aberta" | "fechada") {
  return estado === "aberta";
}

export function competenciaRh(data: Date) {
  return new Date(data.getFullYear(), data.getMonth(), 1, 12, 0, 0, 0);
}

export type VinculosRemocaoColaboradorRh = {
  dependentes: boolean;
  alteracoesSalariais: boolean;
  adiantamentos: boolean;
  itensFolha: boolean;
};

export function motivoBloqueioRemocaoColaboradorRh(vinculos: VinculosRemocaoColaboradorRh) {
  const encontrados = [
    vinculos.dependentes ? "dependentes" : null,
    vinculos.alteracoesSalariais ? "alterações salariais" : null,
    vinculos.adiantamentos ? "adiantamentos" : null,
    vinculos.itensFolha ? "lançamentos de folha" : null,
  ].filter((item): item is string => Boolean(item));

  return encontrados.length
    ? `Este colaborador não pode ser removido porque possui ${encontrados.join(", ")}. Preserve o histórico ou registre o desligamento.`
    : null;
}
