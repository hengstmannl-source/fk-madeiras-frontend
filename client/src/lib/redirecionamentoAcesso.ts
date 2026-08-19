export function deveRedirecionarParaLoginLocal(caminho: string) {
  return !(
    caminho === "/login" ||
    caminho === "/cadastro" ||
    caminho.startsWith("/convite/")
  );
}
