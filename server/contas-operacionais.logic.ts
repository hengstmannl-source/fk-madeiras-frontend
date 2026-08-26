import { decimalParaNumero, saldoAbertoTitulo } from "./financeiro.logic";

export type TipoContaOperacional = "receber" | "pagar";
export type EstadoContaOperacional = "aberto" | "parcial" | "quitado" | "vencido" | "cancelado";
export type PrioridadeContaOperacional = "vencido" | "vence_hoje" | "vence_em_breve" | "normal" | "encerrado";
export type FaixaAgingContaOperacional = "a_vencer" | "vence_hoje" | "1_7" | "8_30" | "31_60" | "61_90" | "mais_90" | "encerrado";

export type TituloContaOperacional = {
  id: number;
  tipo: TipoContaOperacional;
  estado: EstadoContaOperacional;
  dataVencimento: Date;
  valorOriginal: string | number;
  desconto?: string | number | null;
  juros?: string | number | null;
  valorBaixado: string | number;
};

export type ContaOperacionalCalculada = TituloContaOperacional & {
  saldoAberto: number;
  diasParaVencimento: number;
  prioridade: PrioridadeContaOperacional;
  faixaAging: FaixaAgingContaOperacional;
};

function inicioDoDia(data: Date) {
  const resultado = new Date(data);
  resultado.setHours(0, 0, 0, 0);
  return resultado;
}

export function calcularDiasParaVencimento(dataVencimento: Date, agora = new Date()) {
  return Math.round((inicioDoDia(dataVencimento).getTime() - inicioDoDia(agora).getTime()) / 86_400_000);
}

export function classificarPrioridadeContaOperacional(input: {
  estado: EstadoContaOperacional;
  saldoAberto: string | number;
  dataVencimento: Date;
  agora?: Date;
  diasAntecedencia?: number;
}): PrioridadeContaOperacional {
  if (input.estado === "cancelado" || input.estado === "quitado" || decimalParaNumero(input.saldoAberto) <= 0.005) return "encerrado";
  const dias = calcularDiasParaVencimento(input.dataVencimento, input.agora);
  if (dias < 0) return "vencido";
  if (dias === 0) return "vence_hoje";
  return dias <= (input.diasAntecedencia ?? 7) ? "vence_em_breve" : "normal";
}

export function classificarAgingContaOperacional(input: {
  estado: EstadoContaOperacional;
  saldoAberto: string | number;
  dataVencimento: Date;
  agora?: Date;
}): FaixaAgingContaOperacional {
  if (input.estado === "cancelado" || input.estado === "quitado" || decimalParaNumero(input.saldoAberto) <= 0.005) return "encerrado";
  const dias = calcularDiasParaVencimento(input.dataVencimento, input.agora);
  if (dias > 0) return "a_vencer";
  if (dias === 0) return "vence_hoje";
  const atraso = Math.abs(dias);
  if (atraso <= 7) return "1_7";
  if (atraso <= 30) return "8_30";
  if (atraso <= 60) return "31_60";
  if (atraso <= 90) return "61_90";
  return "mais_90";
}

export function calcularContaOperacional(titulo: TituloContaOperacional, agora = new Date()): ContaOperacionalCalculada {
  const saldoAberto = saldoAbertoTitulo(titulo.valorOriginal, titulo.desconto ?? 0, titulo.juros ?? 0, titulo.valorBaixado);
  return {
    ...titulo,
    saldoAberto,
    diasParaVencimento: calcularDiasParaVencimento(titulo.dataVencimento, agora),
    prioridade: classificarPrioridadeContaOperacional({
      estado: titulo.estado,
      saldoAberto,
      dataVencimento: titulo.dataVencimento,
      agora,
    }),
    faixaAging: classificarAgingContaOperacional({
      estado: titulo.estado,
      saldoAberto,
      dataVencimento: titulo.dataVencimento,
      agora,
    }),
  };
}

const ordemPrioridade: Record<PrioridadeContaOperacional, number> = {
  vencido: 0,
  vence_hoje: 1,
  vence_em_breve: 2,
  normal: 3,
  encerrado: 4,
};

/** Ordena filas operacionais por urgência, vencimento e identificador estável. */
export function ordenarContasOperacionais<T extends ContaOperacionalCalculada>(contas: T[]): T[] {
  return [...contas].sort((a, b) => (
    ordemPrioridade[a.prioridade] - ordemPrioridade[b.prioridade]
    || a.dataVencimento.getTime() - b.dataVencimento.getTime()
    || a.id - b.id
  ));
}

export function resumirAgingContasOperacionais(contas: ContaOperacionalCalculada[]) {
  const faixas: Record<FaixaAgingContaOperacional, number> = {
    a_vencer: 0,
    vence_hoje: 0,
    "1_7": 0,
    "8_30": 0,
    "31_60": 0,
    "61_90": 0,
    mais_90: 0,
    encerrado: 0,
  };
  contas.forEach((conta) => {
    faixas[conta.faixaAging] += conta.saldoAberto;
  });
  return faixas;
}

export function resumirContasOperacionais(contas: ContaOperacionalCalculada[]) {
  return {
    quantidade: contas.length,
    saldoAberto: contas.reduce((total, conta) => total + conta.saldoAberto, 0),
    vencido: contas.filter((conta) => conta.prioridade === "vencido").reduce((total, conta) => total + conta.saldoAberto, 0),
    venceHoje: contas.filter((conta) => conta.prioridade === "vence_hoje").reduce((total, conta) => total + conta.saldoAberto, 0),
    proximosSeteDias: contas.filter((conta) => conta.prioridade === "vence_em_breve").reduce((total, conta) => total + conta.saldoAberto, 0),
    aging: resumirAgingContasOperacionais(contas),
  };
}
