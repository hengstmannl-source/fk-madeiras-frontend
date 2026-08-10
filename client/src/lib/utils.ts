import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: string | number | null | undefined): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num || 0)) return "0,00 €";
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(num || 0);
}

export function formatNumber(value: string | number | null | undefined): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num || 0)) return "0";
  return new Intl.NumberFormat("pt-PT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num || 0);
}

export function calculatePrecoLinear(espessura: number, largura: number, precoM3: number): number {
  return (espessura / 1000) * (largura / 1000) * precoM3;
}

export function calculateValorPeca(precoLinear: number, comprimento: number): number {
  return precoLinear * comprimento;
}

export function calculateValorTotal(valorPeca: number, quantidade: number): number {
  return valorPeca * quantidade;
}

export function calculateVolume(espessura: number, largura: number, comprimento: number, quantidade: number): number {
  return (espessura / 1000) * (largura / 1000) * comprimento * quantidade;
}

export function calculateMetroLinear(comprimento: number, quantidade: number): number {
  return comprimento * quantidade;
}
