import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BadgeCheck, CheckCircle2, CircleDollarSign, Eye, FileText, Loader2, LockKeyhole } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function OrcamentosAprovadosPage() {
  const [, setLocation] = useLocation();
  const aprovados = trpc.orcamento.list.useQuery({ estado: "aprovado" });
  const clientes = trpc.cliente.list.useQuery();
  const registrarPagamento = trpc.orcamento.registrarPagamento.useMutation();
  const utils = trpc.useUtils();
  const clienteMap = new Map(clientes.data?.map((cliente) => [cliente.id, cliente.nome]) ?? []);

  const handleRegistrarPagamento = (id: number, numero: string) => {
    if (!confirm(`Registrar o pagamento do orçamento ${numero}? Após essa ação, ele ficará bloqueado para alterações e exclusão.`)) return;
    registrarPagamento.mutate({ id }, {
      onSuccess: () => {
        toast.success("Pagamento registrado. O orçamento foi bloqueado.");
        utils.orcamento.list.invalidate();
      },
      onError: (erro) => toast.error(erro.message),
    });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary mb-2"><BadgeCheck className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-wider">Financeiro</span></div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Orçamentos Aprovados</h1>
          <p className="text-sm text-muted-foreground mt-1">Registre pagamentos e acompanhe documentos já quitados.</p>
        </div>
        <Card className="border-emerald-200 bg-emerald-50 shadow-none">
          <CardContent className="flex items-center gap-2 p-3 text-xs text-emerald-800"><LockKeyhole className="h-4 w-4 shrink-0" />Pagamentos bloqueiam alterações e exclusões.</CardContent>
        </Card>
      </div>

      <div className="rounded-xl border border-border/50 bg-white shadow-sm overflow-hidden">
        {aprovados.isLoading ? <div className="p-10 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />A carregar...</div>
        : aprovados.data && aprovados.data.length > 0 ? (
          <Table>
            <TableHeader><TableRow className="bg-muted/50"><TableHead>Orçamento</TableHead><TableHead>Cliente</TableHead><TableHead>Total</TableHead><TableHead>Pagamento</TableHead><TableHead>Data</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
            <TableBody>{aprovados.data.map((orcamento) => (
              <TableRow key={orcamento.id} className="hover:bg-muted/30">
                <TableCell className="font-medium text-primary">{orcamento.numero}</TableCell>
                <TableCell>{clienteMap.get(orcamento.clienteId) ?? "—"}</TableCell>
                <TableCell className="font-semibold">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(orcamento.total))}</TableCell>
                <TableCell>{orcamento.pago ? <div className="flex items-center gap-2"><Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-200">Pago</Badge>{orcamento.pagoEm && <span className="text-xs text-muted-foreground">{new Date(orcamento.pagoEm).toLocaleDateString("pt-BR")}</span>}</div> : <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Pendente</Badge>}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{new Date(orcamento.createdAt).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell className="text-right"><div className="flex items-center justify-end gap-1"><Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Ver orçamento" onClick={() => setLocation(`/orcamentos/${orcamento.id}`)}><Eye className="h-4 w-4" /></Button>{!orcamento.pago && <Button size="sm" className="h-8 bg-emerald-700 hover:bg-emerald-800 text-white" disabled={registrarPagamento.isPending} onClick={() => handleRegistrarPagamento(orcamento.id, orcamento.numero)}><CircleDollarSign className="h-4 w-4 mr-1.5" />Registrar pagamento</Button>}{orcamento.pago && <CheckCircle2 className="h-4 w-4 text-emerald-600 mx-2" />}</div></TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        ) : <div className="p-14 text-center text-muted-foreground"><FileText className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">Nenhum orçamento aprovado encontrado.</p></div>}
      </div>
    </div>
  );
}
