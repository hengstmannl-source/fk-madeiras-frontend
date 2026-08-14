import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, CircleDollarSign, Clock3, ReceiptText } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type EstadoCheque = "todos" | "disponivel" | "utilizado" | "estornado";

const estadoCheque = {
  disponivel: { label: "Disponível", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  utilizado: { label: "Utilizado", className: "border-violet-200 bg-violet-50 text-violet-700" },
  estornado: { label: "Estornado", className: "border-slate-300 bg-slate-100 text-slate-600" },
} as const;

function formatarData(data: Date | string | null) {
  if (!data) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(data));
}

export default function CaixaChequePage() {
  const [, setLocation] = useLocation();
  const [estado, setEstado] = useState<EstadoCheque>("todos");
  const filtro = useMemo(() => estado === "todos" ? undefined : { estado }, [estado]);
  const resumo = trpc.financeiro.cheques.resumo.useQuery();
  const cheques = trpc.financeiro.cheques.list.useQuery(filtro);

  return (
    <main className="container py-6 sm:py-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-primary"><ReceiptText className="h-5 w-5" /><span className="text-sm font-semibold uppercase tracking-wide">Financeiro</span></div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Caixa Cheque</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Controle individual dos cheques recebidos e utilizados, preservando o vínculo com cada cliente e movimentação financeira.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setLocation("/financeiro?tipo=receber")}>Registrar recebimento</Button>
          <Button onClick={() => setLocation("/financeiro?tipo=pagar")}>Usar em pagamento</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-emerald-200 bg-emerald-50/40"><CardHeader className="pb-2"><CardDescription className="flex items-center gap-2 text-emerald-800"><CircleDollarSign className="h-4 w-4" />Saldo disponível</CardDescription><CardTitle className="text-2xl text-emerald-950">{formatCurrency(resumo.data?.totalDisponivel ?? 0)}</CardTitle></CardHeader><CardContent><p className="text-xs text-emerald-800">{resumo.data?.quantidadeDisponivel ?? 0} cheque(s) disponível(is) para pagamento.</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-violet-600" />Total utilizado</CardDescription><CardTitle className="text-2xl">{formatCurrency(resumo.data?.totalUtilizado ?? 0)}</CardTitle></CardHeader><CardContent><p className="text-xs text-muted-foreground">{resumo.data?.quantidadeUtilizada ?? 0} cheque(s) já vinculados a pagamentos.</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-amber-600" />Contas de cheque</CardDescription><CardTitle className="text-2xl">{resumo.data?.contas.length ?? 0}</CardTitle></CardHeader><CardContent><p className="text-xs text-muted-foreground">Cadastre uma conta do tipo Caixa Cheque no Financeiro para iniciar o controle.</p></CardContent></Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>Cheques individuais</CardTitle><CardDescription className="mt-1">Referência, cliente, entrada e eventual utilização em pagamento.</CardDescription></div><Select value={estado} onValueChange={(valor) => setEstado(valor as EstadoCheque)}><SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Filtrar situação" /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os cheques</SelectItem><SelectItem value="disponivel">Disponíveis</SelectItem><SelectItem value="utilizado">Utilizados</SelectItem><SelectItem value="estornado">Estornados</SelectItem></SelectContent></Select></CardHeader>
        <CardContent>
          {cheques.isLoading ? <div className="py-12 text-center text-sm text-muted-foreground">Carregando cheques...</div> : cheques.data?.length ? <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Referência</TableHead><TableHead>Cliente</TableHead><TableHead>Conta</TableHead><TableHead>Recebido em</TableHead><TableHead>Utilizado em</TableHead><TableHead>Situação</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader><TableBody>{cheques.data.map((cheque: any) => { const dadosEstado = estadoCheque[cheque.estado as keyof typeof estadoCheque]; return <TableRow key={cheque.id}><TableCell className="font-medium">{cheque.referencia}</TableCell><TableCell>{cheque.clienteNome}</TableCell><TableCell>{cheque.contaNome}</TableCell><TableCell>{formatarData(cheque.dataRecebimento)}</TableCell><TableCell>{formatarData(cheque.utilizadoEm)}</TableCell><TableCell><Badge variant="outline" className={dadosEstado.className}>{dadosEstado.label}</Badge></TableCell><TableCell className="text-right font-medium">{formatCurrency(cheque.valor)}</TableCell></TableRow>; })}</TableBody></Table></div> : <div className="rounded-lg border border-dashed py-14 text-center"><ReceiptText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="font-medium">Nenhum cheque encontrado</p><p className="mt-1 text-sm text-muted-foreground">Registre um recebimento com a conta Caixa Cheque para inserir o primeiro item.</p></div>}
        </CardContent>
      </Card>
    </main>
  );
}
