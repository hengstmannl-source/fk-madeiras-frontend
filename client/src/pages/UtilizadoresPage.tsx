import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { trpc } from "@/lib/trpc";
import { Clipboard, Link2, Mail, RefreshCw, ShieldCheck, Trash2, UserCheck, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Redirect } from "wouter";

const nomesPapel: Record<string, string> = {
  proprietario: "Proprietário",
  administrador: "Administrador",
  financeiro: "Financeiro",
  vendas: "Vendas",
  producao: "Produção e Estoque",
  consulta: "Consulta",
};

function formatarData(data: Date | string | null | undefined, vazio = "Não informado") {
  if (!data) return vazio;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(data));
}

export default function UtilizadoresPage() {
  const { loading: autenticando, user } = useAuth();
  const utils = trpc.useUtils();
  const contexto = trpc.auth.contexto.useQuery(undefined, {
    enabled: Boolean(user),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const papel = contexto.data?.membro.papel;
  const podeAdministrar = user?.role === "admin" || papel === "proprietario" || papel === "administrador";
  const membros = trpc.equipe.listar.useQuery(undefined, { enabled: podeAdministrar, retry: false });
  const convites = trpc.equipe.listarConvitesPendentes.useQuery(undefined, { enabled: podeAdministrar, retry: false });
  const [conviteRenovado, setConviteRenovado] = useState<string | null>(null);
  const [membroParaRemover, setMembroParaRemover] = useState<{ id: number; nome: string; email: string } | null>(null);

  const membrosAtivos = useMemo(
    () => (membros.data ?? []).filter(({ membro }) => membro.ativo),
    [membros.data],
  );

  const reenviarConvite = trpc.equipe.reenviarConvite.useMutation({
    onSuccess: async (resultado) => {
      setConviteRenovado(resultado.conviteUrl);
      await utils.equipe.listarConvitesPendentes.invalidate();
      toast.success("Convite renovado com validade de 7 dias.");
    },
    onError: (error) => toast.error(error.message),
  });

  const removerMembro = trpc.equipe.remover.useMutation({
    onSuccess: async () => {
      setMembroParaRemover(null);
      await Promise.all([
        utils.equipe.listar.invalidate(),
        utils.equipe.listarConvitesPendentes.invalidate(),
      ]);
      toast.success("Acesso do utilizador removido. Para restaurá-lo, envie um novo convite.");
    },
    onError: (error) => toast.error(error.message),
  });

  const copiarConvite = async () => {
    if (!conviteRenovado) return;
    try {
      await navigator.clipboard.writeText(conviteRenovado);
      toast.success("Link de convite copiado.");
    } catch {
      toast.error("Não foi possível copiar o link. Copie-o manualmente.");
    }
  };

  if (autenticando || contexto.isLoading) {
    return <div className="container py-7"><Card><CardContent className="p-6 text-sm text-muted-foreground">A carregar permissões administrativas…</CardContent></Card></div>;
  }

  if (!podeAdministrar) return <Redirect to="/" />;

  return <div className="container space-y-7 py-7">
    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
      <div>
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">Acesso administrativo</p>
        <h1 className="text-3xl font-semibold tracking-tight">Gestão de utilizadores</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">Acompanhe os acessos ativos da empresa e renove, quando necessário, os convites que ainda aguardam o primeiro acesso.</p>
      </div>
      <Badge variant="outline" className="w-fit gap-2 border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-800">
        <ShieldCheck className="h-4 w-4" />Apenas administradores e proprietários
      </Badge>
    </div>

    <div className="grid gap-4 sm:grid-cols-2">
      <Card className="border-emerald-100 bg-emerald-50/40"><CardContent className="flex items-center gap-4 p-5"><div className="rounded-xl bg-emerald-100 p-3 text-emerald-800"><UserCheck className="h-5 w-5" /></div><div><p className="text-2xl font-semibold text-emerald-950">{membrosAtivos.length}</p><p className="text-sm text-emerald-800">Utilizadores com acesso ativo</p></div></CardContent></Card>
      <Card className="border-amber-100 bg-amber-50/40"><CardContent className="flex items-center gap-4 p-5"><div className="rounded-xl bg-amber-100 p-3 text-amber-800"><Mail className="h-5 w-5" /></div><div><p className="text-2xl font-semibold text-amber-950">{convites.data?.length ?? 0}</p><p className="text-sm text-amber-800">Convites pendentes de aceite</p></div></CardContent></Card>
    </div>

    <Card>
      <CardHeader className="border-b"><CardTitle className="flex items-center gap-2"><UsersRound className="h-5 w-5 text-amber-700" />Utilizadores ativos</CardTitle><p className="text-sm text-muted-foreground">Funcionários que já concluíram o acesso à empresa.</p></CardHeader>
      <CardContent className="p-0">
        {membros.isLoading ? <p className="p-6 text-sm text-muted-foreground">A carregar utilizadores…</p> : membrosAtivos.length ? <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm"><thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-6 py-3 font-medium">Utilizador</th><th className="px-6 py-3 font-medium">Perfil</th><th className="px-6 py-3 font-medium">Estado</th><th className="px-6 py-3 font-medium">Último acesso</th><th className="px-6 py-3 text-right font-medium">Ações</th></tr></thead><tbody className="divide-y">{membrosAtivos.map(({ membro, usuario }) => {
          const nome = usuario.name || "Utilizador sem nome";
          const email = usuario.email || "E-mail não informado";
          const protegido = membro.papel === "proprietario" || membro.id === contexto.data?.membro.id;
          return <tr key={membro.id}><td className="px-6 py-4"><p className="font-medium text-foreground">{nome}</p><p className="mt-1 text-muted-foreground">{email}</p></td><td className="px-6 py-4"><Badge variant={membro.papel === "proprietario" ? "default" : "secondary"}>{nomesPapel[membro.papel] ?? membro.papel}</Badge></td><td className="px-6 py-4"><Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">Ativo</Badge></td><td className="px-6 py-4 text-muted-foreground">{formatarData(usuario.lastSignedIn, "Ainda não registado")}</td><td className="px-6 py-4 text-right">{protegido ? <Badge variant="outline" className="text-muted-foreground">Protegido</Badge> : <Button variant="outline" size="sm" className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => setMembroParaRemover({ id: membro.id, nome, email })}><Trash2 className="mr-2 h-4 w-4" />Remover</Button>}</td></tr>;
        })}</tbody></table></div> : <p className="p-6 text-sm text-muted-foreground">Ainda não há utilizadores ativos nesta empresa.</p>}
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="border-b"><CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-amber-700" />Convites pendentes</CardTitle><p className="text-sm text-muted-foreground">Reenviar cria um novo link e invalida imediatamente o link anterior, protegendo o primeiro acesso.</p></CardHeader>
      <CardContent className="space-y-5 p-0">
        {convites.isLoading ? <p className="p-6 text-sm text-muted-foreground">A carregar convites…</p> : convites.data?.length ? <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-6 py-3 font-medium">E-mail</th><th className="px-6 py-3 font-medium">Perfil</th><th className="px-6 py-3 font-medium">Expira em</th><th className="px-6 py-3 text-right font-medium">Ação</th></tr></thead><tbody className="divide-y">{convites.data.map(({ convite }) => <tr key={convite.id}><td className="px-6 py-4 font-medium text-foreground">{convite.emailNormalizado}</td><td className="px-6 py-4"><Badge variant="secondary">{nomesPapel[convite.papel] ?? convite.papel}</Badge></td><td className="px-6 py-4 text-muted-foreground">{formatarData(convite.expiraEm)}</td><td className="px-6 py-4 text-right"><Button variant="outline" size="sm" disabled={reenviarConvite.isPending} onClick={() => reenviarConvite.mutate({ conviteId: convite.id })}><RefreshCw className={`mr-2 h-4 w-4 ${reenviarConvite.isPending ? "animate-spin" : ""}`} />{reenviarConvite.isPending ? "A renovar…" : "Reenviar"}</Button></td></tr>)}</tbody></table></div> : <p className="p-6 text-sm text-muted-foreground">Não há convites pendentes com validade ativa.</p>}
        {conviteRenovado && <div className="mx-6 mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="flex items-center gap-2 text-sm font-semibold text-amber-950"><Link2 className="h-4 w-4" />Novo link de primeiro acesso</p><p className="mt-2 break-all text-xs text-amber-900">{conviteRenovado}</p><Button className="mt-3" variant="outline" size="sm" onClick={copiarConvite}><Clipboard className="mr-2 h-4 w-4" />Copiar link</Button></div>}
      </CardContent>
    </Card>

    <AlertDialog open={Boolean(membroParaRemover)} onOpenChange={(aberto) => { if (!aberto && !removerMembro.isPending) setMembroParaRemover(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover acesso de {membroParaRemover?.nome}?</AlertDialogTitle>
          <AlertDialogDescription>Este utilizador perderá o acesso à empresa e as credenciais locais serão revogadas. Para voltar a aceder, deverá receber e aceitar um novo convite.</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{membroParaRemover?.email}</div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={removerMembro.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction className="bg-red-700 hover:bg-red-800" disabled={removerMembro.isPending} onClick={(event) => { event.preventDefault(); if (membroParaRemover) removerMembro.mutate({ membroId: membroParaRemover.id }); }}>{removerMembro.isPending ? "A remover…" : "Remover acesso"}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
