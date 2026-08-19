export const REQUISITOS_SENHA = [
  { id: "comprimento", descricao: "Pelo menos 8 caracteres" },
  { id: "maiuscula", descricao: "Uma letra maiúscula" },
  { id: "numero", descricao: "Um número" },
] as const;

export type RequisitoSenhaId = (typeof REQUISITOS_SENHA)[number]["id"];

export function requisitosSenha(senha: string): Record<RequisitoSenhaId, boolean> {
  return {
    comprimento: senha.length >= 8,
    maiuscula: /[A-Z]/.test(senha),
    numero: /[0-9]/.test(senha),
  };
}

export function mensagemSenhaInvalida(senha: string) {
  const requisitos = requisitosSenha(senha);
  if (!requisitos.comprimento) return "A senha precisa ter pelo menos 8 caracteres.";
  if (!requisitos.maiuscula) return "A senha precisa incluir pelo menos uma letra maiúscula.";
  if (!requisitos.numero) return "A senha precisa incluir pelo menos um número.";
  return null;
}
