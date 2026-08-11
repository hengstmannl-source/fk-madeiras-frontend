export type EstadoTituloFinanceiro = "aberto" | "parcial" | "quitado" | "vencido" | "cancelado";
export type FrequenciaFinanceira = "semanal" | "mensal" | "trimestral" | "semestral" | "anual";
export type TipoAlertaFinanceiro = "vence_em_breve" | "vencido";

const CENTAVOS_EPSILON = 0.005;

export function decimalParaNumero(valor: string | number | null | undefined): number {
  const numero = typeof valor === "number" ? valor : Number.parseFloat(valor ?? "0");
  return Number.isFinite(numero) ? numero : 0;
}

export function valorLiquidoTitulo(valorOriginal: string | number, desconto: string | number = 0, juros: string | number = 0): number {
  return Math.max(0, decimalParaNumero(valorOriginal) - decimalParaNumero(desconto) + decimalParaNumero(juros));
}

export function calcularEstadoTitulo(input: {
  valorOriginal: string | number;
  desconto?: string | number;
  juros?: string | number;
  valorBaixado?: string | number;
  dataVencimento: Date;
  cancelado?: boolean;
  agora?: Date;
}): EstadoTituloFinanceiro {
  if (input.cancelado) return "cancelado";

  const valorLiquido = valorLiquidoTitulo(input.valorOriginal, input.desconto, input.juros);
  const valorBaixado = decimalParaNumero(input.valorBaixado);
  if (valorBaixado >= valorLiquido - CENTAVOS_EPSILON) return "quitado";
  if (valorBaixado > CENTAVOS_EPSILON) return "parcial";

  const agora = input.agora ?? new Date();
  const inicioDoDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const vencimento = new Date(
    input.dataVencimento.getFullYear(),
    input.dataVencimento.getMonth(),
    input.dataVencimento.getDate(),
  );
  return vencimento < inicioDoDia ? "vencido" : "aberto";
}

export function calcularParcelas(valorTotal: string | number, quantidadeParcelas: number): string[] {
  if (!Number.isInteger(quantidadeParcelas) || quantidadeParcelas < 1) {
    throw new Error("A quantidade de parcelas deve ser maior que zero");
  }
  const totalEmCentavos = Math.round(decimalParaNumero(valorTotal) * 100);
  if (totalEmCentavos <= 0) throw new Error("O valor total deve ser maior que zero");

  const valorBase = Math.floor(totalEmCentavos / quantidadeParcelas);
  const resto = totalEmCentavos % quantidadeParcelas;
  return Array.from({ length: quantidadeParcelas }, (_, indice) => (
    ((valorBase + (indice < resto ? 1 : 0)) / 100).toFixed(2)
  ));
}

export function proximoVencimento(data: Date, frequencia: FrequenciaFinanceira): Date {
  const proxima = new Date(data);
  if (frequencia === "semanal") proxima.setDate(proxima.getDate() + 7);
  if (frequencia === "mensal") proxima.setMonth(proxima.getMonth() + 1);
  if (frequencia === "trimestral") proxima.setMonth(proxima.getMonth() + 3);
  if (frequencia === "semestral") proxima.setMonth(proxima.getMonth() + 6);
  if (frequencia === "anual") proxima.setFullYear(proxima.getFullYear() + 1);
  return proxima;
}

export function saldoAbertoTitulo(valorOriginal: string | number, desconto: string | number, juros: string | number, valorBaixado: string | number): number {
  return Math.max(0, valorLiquidoTitulo(valorOriginal, desconto, juros) - decimalParaNumero(valorBaixado));
}

export function podeCancelarTituloFinanceiro(valorBaixado: string | number | null | undefined): boolean {
  return decimalParaNumero(valorBaixado) <= CENTAVOS_EPSILON;
}

export function classificarAlertaVencimento(input: {
  estado: EstadoTituloFinanceiro;
  dataVencimento: Date;
  diasAntecedencia: number;
  agora?: Date;
}): TipoAlertaFinanceiro | null {
  if (input.estado === "vencido") return "vencido";
  if (!["aberto", "parcial"].includes(input.estado)) return null;

  const agora = input.agora ?? new Date();
  const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const inicioVencimento = new Date(
    input.dataVencimento.getFullYear(),
    input.dataVencimento.getMonth(),
    input.dataVencimento.getDate(),
  );
  const diasRestantes = Math.round((inicioVencimento.getTime() - inicioHoje.getTime()) / 86_400_000);
  return diasRestantes >= 0 && diasRestantes <= input.diasAntecedencia ? "vence_em_breve" : null;
}

export function planejarAtualizacaoAlertas(tipoAtual: TipoAlertaFinanceiro | null, alertasAtivos: TipoAlertaFinanceiro[]) {
  return {
    criar: tipoAtual !== null && !alertasAtivos.includes(tipoAtual) ? tipoAtual : null,
    resolver: alertasAtivos.filter((tipo) => tipo !== tipoAtual),
  };
}
