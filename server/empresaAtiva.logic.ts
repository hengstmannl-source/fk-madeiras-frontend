export type EmpresaDisponivel = {
  empresa: { id: number };
};

/**
 * Escolhe uma empresa somente dentro dos vínculos já filtrados como ativos.
 * Sem preferência persistida, mantém a ordem determinística fornecida pelo banco.
 */
export function resolverEmpresaAtiva<T extends EmpresaDisponivel>(
  empresasDisponiveis: readonly T[],
  empresaAtivaId?: number | null,
) {
  if (empresaAtivaId) {
    const preferida = empresasDisponiveis.find(({ empresa }) => empresa.id === empresaAtivaId);
    if (preferida) return preferida;
  }
  return empresasDisponiveis[0];
}

/** Nunca aceita uma empresa solicitada que não pertença aos vínculos ativos do usuário. */
export function podeSelecionarEmpresa<T extends EmpresaDisponivel>(
  empresasDisponiveis: readonly T[],
  empresaId: number,
) {
  return empresasDisponiveis.some(({ empresa }) => empresa.id === empresaId);
}
