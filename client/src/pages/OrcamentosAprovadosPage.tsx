import { trpc } from "@/lib/trpc";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BadgeCheck, CalendarDays, CheckCircle2, CircleDollarSign, Download, Eye, FileText, Loader2, LockKeyhole, RotateCcw, Search, Truck } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const FORMAS_PAGAMENTO = [
  ["pix", "PIX"],
  ["dinheiro", "Dinheiro"],
  ["cartao_credito", "Cartão de crédito"],
  ["cartao_debito", "Cartão de débito"],
  ["transferencia", "Transferência bancária"],
  ["boleto", "Boleto"],
  ["outro", "Outro"],
] as const;

type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number][0];

function dataLocalDeHoje() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
}

function descricaoFormaPagamento(forma?: string | null) {
  return FORMAS_PAGAMENTO.find(([valor]) => valor === forma)?.[1] ?? "Não informada";
}

export default function OrcamentosAprovadosPage() {
  const [, setLocation] = useLocation();
  const aprovados = trpc.orcamento.list.useQuery({ estado: "aprovado" });
  const clientes = trpc.cliente.list.useQuery();
  const registrarPagamento = trpc.orcamento.registrarPagamento.useMutation();
  const entregarFisicamente = trpc.orcamento.entregarFisicamente.useMutation();
  const estornarEntrega = trpc.orcamento.estornarEntrega.useMutation();
  const utils = trpc.useUtils();
  const [buscaCliente, setBuscaCliente] = useState("");
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [pagamentoAlvo, setPagamentoAlvo] = useState<{ id: number; numero: string } | null>(null);
  const [entregaAlvo, setEntregaAlvo] = useState<{ id: number; numero: string } | null>(null);
  const [estornoEntregaAlvo, setEstornoEntregaAlvo] = useState<{ id: number; numero: string } | null>(null);
  const [motivoEstornoEntrega, setMotivoEstornoEntrega] = useState("");
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>("pix");
  const [dataPagamento, setDataPagamento] = useState(dataLocalDeHoje);
  const clienteMap = new Map(clientes.data?.map((cliente) => [cliente.id, cliente.nome]) ?? []);

  const orcamentosFiltrados = useMemo(() => {
    const termo = buscaCliente.trim().toLocaleLowerCase("pt-BR");
    const inicio = dataInicial ? new Date(`${dataInicial}T00:00:00`) : undefined;
    const fim = dataFinal ? new Date(`${dataFinal}T23:59:59.999`) : undefined;

    return (aprovados.data ?? []).filter((orcamento) => {
      const nomeCliente = clienteMap.get(orcamento.clienteId) ?? "";
      const dataOrcamento = new Date(orcamento.createdAt);
      return (!termo || nomeCliente.toLocaleLowerCase("pt-BR").includes(termo))
        && (!inicio || dataOrcamento >= inicio)
        && (!fim || dataOrcamento <= fim);
    });
  }, [aprovados.data, buscaCliente, clienteMap, dataFinal, dataInicial]);

  const handleLimparFiltros = () => {
    setBuscaCliente("");
    setDataInicial("");
    setDataFinal("");
  };

  const handleConfirmarPagamento = () => {
    if (!pagamentoAlvo) return;
    registrarPagamento.mutate({ id: pagamentoAlvo.id, formaPagamento, pagoEm: dataPagamento }, {
      onSuccess: () => {
        toast.success("Recebimento confirmado. Registre a entrega física para baixar o estoque.");
        setPagamentoAlvo(null);
        utils.orcamento.list.invalidate();
      },
      onError: (erro) => toast.error(erro.message),
    });
  };

  const invalidarEntrega = () => {
    utils.orcamento.list.invalidate();
    utils.orcamento.get.invalidate();
    utils.producao.estoque.resumo.invalidate();
  };

  const confirmarEntrega = () => {
    if (!entregaAlvo) return;
    entregarFisicamente.mutate({ id: entregaAlvo.id }, {
      onSuccess: (resultado) => {
        toast.success(`Entrega registrada: ${resultado.pecasEntregues} peça(s) baixada(s) do estoque.`);
        setEntregaAlvo(null);
        invalidarEntrega();
      },
      onError: (erro) => toast.error(erro.message),
    });
  };

  const confirmarEstornoEntrega = () => {
    if (!estornoEntregaAlvo || motivoEstornoEntrega.trim().length < 3) { toast.error("Informe o motivo do estorno da entrega"); return; }
    estornarEntrega.mutate({ id: estornoEntregaAlvo.id, motivo: motivoEstornoEntrega.trim() }, {
      onSuccess: (resultado) => {
        toast.success(`Entrega estornada: ${resultado.pecasDevolvidas} peça(s) devolvida(s) ao estoque.`);
        setEstornoEntregaAlvo(null);
        setMotivoEstornoEntrega("");
        invalidarEntrega();
      },
      onError: (erro) => toast.error(erro.message),
    });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary mb-2"><BadgeCheck className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-wider">Financeiro</span></div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Vendas Aprovadas</h1>
          <p className="text-sm text-muted-foreground mt-1">Registre pagamentos e acompanhe documentos já quitados.</p>
        </div>
        <Card className="border-emerald-200 bg-emerald-50 shadow-none">
          <CardContent className="flex items-center gap-2 p-3 text-xs text-emerald-800"><LockKeyhole className="h-4 w-4 shrink-0" />Pagamentos bloqueiam alterações e exclusões.</CardContent>
        </Card>
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4"><Search className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold">Filtros de busca</h2></div>
          <div className="grid gap-4 md:grid-cols-[1.5fr_1fr_1fr_auto] md:items-end">
            <div className="space-y-2"><Label htmlFor="cliente-aprovado">Nome do cliente</Label><Input id="cliente-aprovado" value={buscaCliente} onChange={(event) => setBuscaCliente(event.target.value)} placeholder="Pesquisar por cliente" /></div>
            <div className="space-y-2"><Label htmlFor="data-inicial">Data inicial</Label><Input id="data-inicial" type="date" value={dataInicial} onChange={(event) => setDataInicial(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="data-final">Data final</Label><Input id="data-final" type="date" value={dataFinal} onChange={(event) => setDataFinal(event.target.value)} /></div>
            <Button variant="outline" className="w-full md:w-auto" onClick={handleLimparFiltros}><RotateCcw className="h-4 w-4 mr-2" />Limpar</Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground"><CalendarDays className="inline h-3.5 w-3.5 mr-1" />O período considera a data de criação da venda.</p>
        </CardContent>
      </Card>

      <div className="rounded-xl border border-border/50 bg-white shadow-sm overflow-hidden">
        {aprovados.isLoading ? <div className="p-10 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />A carregar...</div>
        : orcamentosFiltrados.length > 0 ? (
          <Table>
            <TableHeader><TableRow className="bg-muted/50"><TableHead>Venda</TableHead><TableHead>Cliente</TableHead><TableHead>Total</TableHead><TableHead>Pagamento</TableHead><TableHead>Entrega</TableHead><TableHead>Data</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
            <TableBody>{orcamentosFiltrados.map((orcamento) => (
              <TableRow key={orcamento.id} className="hover:bg-muted/30">
                <TableCell className="font-medium text-primary">{orcamento.numero ?? "Venda sem número"}</TableCell>
                <TableCell>{clienteMap.get(orcamento.clienteId) ?? "—"}</TableCell>
                <TableCell className="font-semibold">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(orcamento.total))}</TableCell>
                <TableCell>{orcamento.pago ? <div className="space-y-1"><div className="flex items-center gap-2"><Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-200">Pago</Badge>{orcamento.pagoEm && <span className="text-xs text-muted-foreground">{new Date(orcamento.pagoEm).toLocaleDateString("pt-BR")}</span>}</div><p className="text-xs text-muted-foreground">{descricaoFormaPagamento(orcamento.formaPagamento)}</p></div> : <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Pendente</Badge>}</TableCell>
                <TableCell>{orcamento.entregue ? <div className="space-y-1"><Badge variant="outline" className="bg-sky-100 text-sky-800 border-sky-200">Entregue</Badge>{orcamento.entregueEm && <p className="text-xs text-muted-foreground">{new Date(orcamento.entregueEm).toLocaleDateString("pt-BR")}</p>}</div> : <Badge variant="outline" className={orcamento.pago ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-muted text-muted-foreground"}>{orcamento.pago ? "Aguardando entrega" : "Aguardando pagamento"}</Badge>}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{new Date(orcamento.createdAt).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell className="text-right"><div className="flex items-center justify-end gap-1"><Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Ver venda" onClick={() => setLocation(`/orcamentos/${orcamento.id}`)}><Eye className="h-4 w-4" /></Button>{!orcamento.pago && <Button size="sm" className="h-8 bg-emerald-700 hover:bg-emerald-800 text-white" disabled={registrarPagamento.isPending} onClick={() => setPagamentoAlvo({ id: orcamento.id, numero: orcamento.numero ?? "Venda sem número" })}><CircleDollarSign className="h-4 w-4 mr-1.5" />Registrar pagamento</Button>}{orcamento.pago && !orcamento.entregue && <Button size="sm" className="h-8 bg-sky-700 hover:bg-sky-800 text-white" disabled={entregarFisicamente.isPending} onClick={() => setEntregaAlvo({ id: orcamento.id, numero: orcamento.numero ?? "Venda sem número" })}><Truck className="h-4 w-4 mr-1.5" />Registrar entrega</Button>}{orcamento.pago && orcamento.entregue && <Button size="sm" variant="outline" className="h-8 text-destructive hover:text-destructive" disabled={estornarEntrega.isPending} onClick={() => { setEstornoEntregaAlvo({ id: orcamento.id, numero: orcamento.numero ?? "Venda sem número" }); setMotivoEstornoEntrega(""); }}><RotateCcw className="h-4 w-4 mr-1.5" />Estornar entrega</Button>}{orcamento.pago && <><Button variant="outline" size="sm" className="h-8" onClick={() => window.open(`/api/pdf/recibo/${orcamento.id}`, "_blank", "noopener,noreferrer")}><Download className="h-4 w-4 mr-1.5" />Recibo</Button><CheckCircle2 className="h-4 w-4 text-emerald-600 mx-1" /></>}</div></TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        ) : <div className="p-14 text-center text-muted-foreground"><FileText className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">Nenhuma venda aprovada encontrada para os filtros selecionados.</p></div>}
      </div>

      <Dialog open={Boolean(pagamentoAlvo)} onOpenChange={(aberto) => !aberto && setPagamentoAlvo(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar pagamento</DialogTitle>
            <DialogDescription>Informe a forma e a data exata da quitação de {pagamentoAlvo?.numero ?? ""}. Após confirmar, a venda será bloqueada.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2"><Label htmlFor="forma-pagamento">Forma de pagamento</Label><Select value={formaPagamento} onValueChange={(valor) => setFormaPagamento(valor as FormaPagamento)}><SelectTrigger id="forma-pagamento"><SelectValue /></SelectTrigger><SelectContent>{FORMAS_PAGAMENTO.map(([valor, rotulo]) => <SelectItem key={valor} value={valor}>{rotulo}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="data-pagamento">Data de pagamento</Label><Input id="data-pagamento" type="date" value={dataPagamento} onChange={(event) => setDataPagamento(event.target.value)} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setPagamentoAlvo(null)}>Cancelar</Button><Button className="bg-emerald-700 hover:bg-emerald-800 text-white" disabled={registrarPagamento.isPending || !dataPagamento} onClick={handleConfirmarPagamento}>{registrarPagamento.isPending ? "Registrando..." : "Confirmar pagamento"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(entregaAlvo)} onOpenChange={(aberto) => !aberto && setEntregaAlvo(null)}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Confirmar entrega física</DialogTitle><DialogDescription>A entrega de {entregaAlvo?.numero ?? ""} será registrada e as peças correspondentes serão baixadas do estoque produzido, usando os lotes mais antigos disponíveis.</DialogDescription></DialogHeader><div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">Esta ação somente está disponível porque o recebimento da venda já foi confirmado.</div><DialogFooter><Button variant="outline" onClick={() => setEntregaAlvo(null)} disabled={entregarFisicamente.isPending}>Voltar</Button><Button className="bg-sky-700 hover:bg-sky-800" onClick={confirmarEntrega} disabled={entregarFisicamente.isPending}>{entregarFisicamente.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar entrega e baixa</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={Boolean(estornoEntregaAlvo)} onOpenChange={(aberto) => !aberto && setEstornoEntregaAlvo(null)}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Estornar entrega física</DialogTitle><DialogDescription>As peças baixadas de {estornoEntregaAlvo?.numero ?? ""} retornarão aos lotes originais do estoque.</DialogDescription></DialogHeader><div className="space-y-2"><Label htmlFor="motivo-estorno-entrega">Motivo do estorno *</Label><Input id="motivo-estorno-entrega" value={motivoEstornoEntrega} onChange={(evento) => setMotivoEstornoEntrega(evento.target.value)} placeholder="Ex.: entrega devolvida pelo cliente" /></div><DialogFooter><Button variant="outline" onClick={() => setEstornoEntregaAlvo(null)} disabled={estornarEntrega.isPending}>Voltar</Button><Button variant="destructive" onClick={confirmarEstornoEntrega} disabled={estornarEntrega.isPending}>{estornarEntrega.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar estorno</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
