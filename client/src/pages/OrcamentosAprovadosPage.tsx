import { trpc } from "@/lib/trpc";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BadgeCheck, CalendarDays, CheckCircle2, CircleDollarSign, Download, Eye, FileText, Loader2, LockKeyhole, PackageCheck, RotateCcw, Search, Truck } from "lucide-react";
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

const CATEGORIAS = {
  aprovadas: {
    titulo: "Vendas Aprovadas",
    descricao: "Vendas aprovadas que ainda aguardam pagamento e baixa física.",
    vazio: "Nenhuma venda aprovada pendente de pagamento ou entrega foi encontrada.",
    destaque: "border-amber-200 bg-amber-50 text-amber-900",
  },
  pagas: {
    titulo: "Vendas Pagas",
    descricao: "Recebimentos confirmados que aguardam a retirada ou a entrega física.",
    vazio: "Nenhuma venda paga aguardando entrega foi encontrada.",
    destaque: "border-emerald-200 bg-emerald-50 text-emerald-900",
  },
  entregues: {
    titulo: "Vendas Entregues",
    descricao: "Peças já baixadas do estoque, com o recebimento ainda em aberto.",
    vazio: "Nenhuma venda entregue aguardando pagamento foi encontrada.",
    destaque: "border-sky-200 bg-sky-50 text-sky-900",
  },
  concluidas: {
    titulo: "Vendas Concluídas",
    descricao: "Vendas com pagamento confirmado e entrega física registrada.",
    vazio: "Nenhuma venda concluída foi encontrada.",
    destaque: "border-violet-200 bg-violet-50 text-violet-900",
  },
} as const;

type CategoriaOperacional = keyof typeof CATEGORIAS;
type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number][0];
type ModalidadeEntrega = "retirada" | "entrega";
type AlvoVenda = { id: number; numero: string; entregue: boolean; pago: boolean };

const ROTAS_CATEGORIA: Record<CategoriaOperacional, string> = {
  aprovadas: "/orcamentos/aprovados",
  pagas: "/orcamentos/pagas",
  entregues: "/orcamentos/entregues",
  concluidas: "/orcamentos/concluidas",
};

function dataLocalDeHoje() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
}

function descricaoFormaPagamento(forma?: string | null) {
  return FORMAS_PAGAMENTO.find(([valor]) => valor === forma)?.[1] ?? "Não informada";
}

function descricaoModalidadeEntrega(modalidade?: string | null) {
  return modalidade === "retirada" ? "Retirada pelo cliente" : modalidade === "entrega" ? "Entrega" : "Não informada";
}

function categoriaDaRota(localizacao: string): CategoriaOperacional {
  if (localizacao.endsWith("/pagas")) return "pagas";
  if (localizacao.endsWith("/entregues")) return "entregues";
  if (localizacao.endsWith("/concluidas")) return "concluidas";
  return "aprovadas";
}

const formatarMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function OrcamentosAprovadosPage() {
  const [location, setLocation] = useLocation();
  const categoria = categoriaDaRota(location);
  const configuracao = CATEGORIAS[categoria];
  const vendas = trpc.orcamento.list.useQuery({ estado: "aprovado", categoria });
  const resumoFilas = trpc.orcamento.resumoFilas.useQuery();
  const clientes = trpc.cliente.list.useQuery();
  const registrarPagamento = trpc.orcamento.registrarPagamento.useMutation();
  const entregarFisicamente = trpc.orcamento.entregarFisicamente.useMutation();
  const utils = trpc.useUtils();
  const [buscaCliente, setBuscaCliente] = useState("");
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [pagamentoAlvo, setPagamentoAlvo] = useState<AlvoVenda | null>(null);
  const [entregaAlvo, setEntregaAlvo] = useState<AlvoVenda | null>(null);
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>("pix");
  const [dataPagamento, setDataPagamento] = useState(dataLocalDeHoje);
  const [dataEntrega, setDataEntrega] = useState(dataLocalDeHoje);
  const [modalidadeEntrega, setModalidadeEntrega] = useState<ModalidadeEntrega>("retirada");
  const [responsavelEntrega, setResponsavelEntrega] = useState("");
  const [observacoesEntrega, setObservacoesEntrega] = useState("");

  const clienteMap = useMemo(() => new Map(clientes.data?.map((cliente) => [cliente.id, cliente.nome]) ?? []), [clientes.data]);
  const vendasFiltradas = useMemo(() => {
    const termo = buscaCliente.trim().toLocaleLowerCase("pt-BR");
    const inicio = dataInicial ? new Date(`${dataInicial}T00:00:00`) : undefined;
    const fim = dataFinal ? new Date(`${dataFinal}T23:59:59.999`) : undefined;

    return (vendas.data ?? []).filter((venda) => {
      const nomeCliente = clienteMap.get(venda.clienteId) ?? "";
      const dataVenda = new Date(venda.createdAt);
      return (!termo || nomeCliente.toLocaleLowerCase("pt-BR").includes(termo))
        && (!inicio || dataVenda >= inicio)
        && (!fim || dataVenda <= fim);
    });
  }, [vendas.data, buscaCliente, clienteMap, dataFinal, dataInicial]);

  const limparFiltros = () => {
    setBuscaCliente("");
    setDataInicial("");
    setDataFinal("");
  };

  const abrirEntrega = (venda: AlvoVenda) => {
    setDataEntrega(dataLocalDeHoje());
    setModalidadeEntrega("retirada");
    setResponsavelEntrega("");
    setObservacoesEntrega("");
    setEntregaAlvo(venda);
  };

  const invalidarVendas = () => {
    utils.orcamento.list.invalidate();
    utils.orcamento.resumoFilas.invalidate();
    utils.orcamento.get.invalidate();
    utils.producao.estoque.resumo.invalidate();
  };

  const confirmarPagamento = () => {
    if (!pagamentoAlvo || !dataPagamento) return;
    registrarPagamento.mutate({ id: pagamentoAlvo.id, formaPagamento, pagoEm: dataPagamento }, {
      onSuccess: () => {
        toast.success(pagamentoAlvo.entregue
          ? "Pagamento registrado. A venda foi movida para Concluídas."
          : "Pagamento registrado. A venda foi movida para Pagas e aguarda a baixa física.");
        setPagamentoAlvo(null);
        invalidarVendas();
      },
      onError: (erro) => toast.error(erro.message),
    });
  };

  const confirmarEntrega = () => {
    if (!entregaAlvo) return;
    if (!dataEntrega) { toast.error("Informe a data da entrega"); return; }
    if (responsavelEntrega.trim().length < 2) { toast.error("Informe o responsável pela entrega"); return; }
    entregarFisicamente.mutate({
      id: entregaAlvo.id,
      entregueEm: dataEntrega,
      modalidadeEntrega,
      responsavelEntrega: responsavelEntrega.trim(),
      observacoesEntrega: observacoesEntrega.trim() || undefined,
    }, {
      onSuccess: (resultado) => {
        const avisoDeficit = resultado.pecasSemEstoque ? ` ${resultado.pecasSemEstoque} peça(s) ficaram em saldo negativo para regularização.` : "";
        const destino = entregaAlvo.pago ? "Concluídas" : "Entregues";
        toast.success(`Entrega registrada: ${resultado.pecasEntregues} peça(s) baixada(s) do estoque. A venda foi movida para ${destino}.${avisoDeficit}`);
        setEntregaAlvo(null);
        invalidarVendas();
      },
      onError: (erro) => toast.error(erro.message),
    });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-primary"><BadgeCheck className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-wider">Vendas</span></div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{configuracao.titulo}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{configuracao.descricao}</p>
        </div>
        <Card className={`${configuracao.destaque} shadow-none`}>
          <CardContent className="flex items-center gap-2 p-3 text-xs"><PackageCheck className="h-4 w-4 shrink-0" />Pagamento e entrega são registados separadamente.</CardContent>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(Object.keys(CATEGORIAS) as CategoriaOperacional[]).map((chave) => {
          const ativa = chave === categoria;
          const item = CATEGORIAS[chave];
          const totalNaFila = resumoFilas.data?.[chave];
          return <Button key={chave} variant="outline" onClick={() => setLocation(ROTAS_CATEGORIA[chave])} className={`h-auto justify-start border p-4 text-left ${ativa ? item.destaque : "bg-card text-card-foreground hover:bg-muted"}`}>
            <div className="w-full"><div className="flex items-center justify-between gap-3"><p className="font-semibold">{item.titulo.replace("Vendas ", "")}</p><Badge variant="outline" className="min-w-7 justify-center border-current/20 bg-background/55 text-xs" aria-label={`Total de vendas ${item.titulo.replace("Vendas ", "")}`}>{totalNaFila === undefined ? "…" : totalNaFila}</Badge></div><p className="mt-1 text-xs font-normal text-muted-foreground">{chave === "aprovadas" ? "Aguardam ambos" : chave === "pagas" ? "Aguardam entrega" : chave === "entregues" ? "Aguardam pagamento" : "Fluxo finalizado"}</p></div>
          </Button>;
        })}
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardContent className="p-4">
          <div className="mb-4 flex items-center gap-2"><Search className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold">Filtros de busca</h2></div>
          <div className="grid gap-4 md:grid-cols-[1.5fr_1fr_1fr_auto] md:items-end">
            <div className="space-y-2"><Label htmlFor="cliente-venda">Nome do cliente</Label><Input id="cliente-venda" value={buscaCliente} onChange={(event) => setBuscaCliente(event.target.value)} placeholder="Pesquisar por cliente" /></div>
            <div className="space-y-2"><Label htmlFor="data-inicial">Data inicial</Label><Input id="data-inicial" type="date" value={dataInicial} onChange={(event) => setDataInicial(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="data-final">Data final</Label><Input id="data-final" type="date" value={dataFinal} onChange={(event) => setDataFinal(event.target.value)} /></div>
            <Button variant="outline" className="w-full md:w-auto" onClick={limparFiltros}><RotateCcw className="mr-2 h-4 w-4" />Limpar</Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground"><CalendarDays className="mr-1 inline h-3.5 w-3.5" />O período considera a data de criação da venda.</p>
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-xl border border-border/50 bg-card shadow-sm">
        {vendas.isLoading ? <div className="p-10 text-center text-muted-foreground"><Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />A carregar...</div>
          : vendasFiltradas.length > 0 ? (
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow className="bg-muted/50"><TableHead>Venda</TableHead><TableHead>Cliente</TableHead><TableHead>Total</TableHead><TableHead>Pagamento</TableHead><TableHead>Entrega</TableHead><TableHead>Data</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
              <TableBody>{vendasFiltradas.map((venda) => {
                const alvo: AlvoVenda = { id: venda.id, numero: venda.numero ?? "Venda sem número", entregue: venda.entregue, pago: venda.pago };
                return <TableRow key={venda.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium text-primary">{venda.numero ?? "Venda sem número"}</TableCell>
                  <TableCell>{clienteMap.get(venda.clienteId) ?? "—"}</TableCell>
                  <TableCell className="font-semibold">{formatarMoeda.format(Number(venda.total))}</TableCell>
                  <TableCell>{venda.pago ? <div className="space-y-1"><div className="flex items-center gap-2"><Badge variant="outline" className="border-emerald-200 bg-emerald-100 text-emerald-800">Pago</Badge>{venda.pagoEm && <span className="text-xs text-muted-foreground">{new Date(venda.pagoEm).toLocaleDateString("pt-BR")}</span>}</div><p className="text-xs text-muted-foreground">{descricaoFormaPagamento(venda.formaPagamento)}</p></div> : <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Em aberto</Badge>}</TableCell>
                  <TableCell>{venda.entregue ? <div className="space-y-1"><div className="flex items-center gap-2"><Badge variant="outline" className="border-sky-200 bg-sky-100 text-sky-800">Entregue</Badge>{venda.entregueEm && <span className="text-xs text-muted-foreground">{new Date(venda.entregueEm).toLocaleDateString("pt-BR")}</span>}</div><p className="text-xs text-muted-foreground">{descricaoModalidadeEntrega(venda.modalidadeEntrega)}{venda.responsavelEntrega ? ` · ${venda.responsavelEntrega}` : ""}</p></div> : <Badge variant="outline" className="border-muted bg-muted text-muted-foreground">Aguardando baixa física</Badge>}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(venda.createdAt).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="text-right"><div className="flex min-w-max items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Ver venda" onClick={() => setLocation(`/orcamentos/${venda.id}`)}><Eye className="h-4 w-4" /></Button>
                    {!venda.pago && <Button size="sm" className="h-8 bg-emerald-700 text-white hover:bg-emerald-800" disabled={registrarPagamento.isPending} onClick={() => setPagamentoAlvo(alvo)}><CircleDollarSign className="mr-1.5 h-4 w-4" />Registrar pagamento</Button>}
                    {!venda.entregue && <Button size="sm" className="h-8 bg-sky-700 text-white hover:bg-sky-800" disabled={entregarFisicamente.isPending} onClick={() => abrirEntrega(alvo)}><Truck className="mr-1.5 h-4 w-4" />Registrar entrega</Button>}
                    {venda.pago && <Button variant="outline" size="sm" className="h-8" onClick={() => window.open(`/api/pdf/recibo/${venda.id}`, "_blank", "noopener,noreferrer")}><Download className="mr-1.5 h-4 w-4" />Recibo</Button>}
                    {venda.pago && venda.entregue && <CheckCircle2 className="mx-1 h-4 w-4 text-emerald-600" aria-label="Venda concluída" />}
                  </div></TableCell>
                </TableRow>;
              })}</TableBody>
            </Table></div>
          ) : <div className="p-14 text-center text-muted-foreground"><FileText className="mx-auto mb-3 h-10 w-10 opacity-30" /><p className="text-sm">{configuracao.vazio}</p></div>}
      </div>

      <Dialog open={Boolean(pagamentoAlvo)} onOpenChange={(aberto) => !aberto && setPagamentoAlvo(null)}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Registrar pagamento</DialogTitle><DialogDescription>Informe a forma e a data exata da quitação de {pagamentoAlvo?.numero ?? ""}. A entrega física continua independente deste registo.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2"><div className="space-y-2"><Label htmlFor="forma-pagamento">Forma de pagamento</Label><Select value={formaPagamento} onValueChange={(valor) => setFormaPagamento(valor as FormaPagamento)}><SelectTrigger id="forma-pagamento"><SelectValue /></SelectTrigger><SelectContent>{FORMAS_PAGAMENTO.map(([valor, rotulo]) => <SelectItem key={valor} value={valor}>{rotulo}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="data-pagamento">Data de pagamento</Label><Input id="data-pagamento" type="date" value={dataPagamento} onChange={(event) => setDataPagamento(event.target.value)} /></div></div>
          <DialogFooter><Button variant="outline" onClick={() => setPagamentoAlvo(null)}>Cancelar</Button><Button className="bg-emerald-700 text-white hover:bg-emerald-800" disabled={registrarPagamento.isPending || !dataPagamento} onClick={confirmarPagamento}>{registrarPagamento.isPending ? "Registrando..." : "Confirmar pagamento"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(entregaAlvo)} onOpenChange={(aberto) => !aberto && setEntregaAlvo(null)}>
        <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Registrar entrega física</DialogTitle><DialogDescription>A baixa de estoque de {entregaAlvo?.numero ?? ""} será registada agora, mesmo que o pagamento ainda esteja em aberto.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="data-entrega">Data da entrega *</Label><Input id="data-entrega" type="date" value={dataEntrega} onChange={(event) => setDataEntrega(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="modalidade-entrega">Modalidade *</Label><Select value={modalidadeEntrega} onValueChange={(valor) => setModalidadeEntrega(valor as ModalidadeEntrega)}><SelectTrigger id="modalidade-entrega"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="retirada">Retirada pelo cliente</SelectItem><SelectItem value="entrega">Entrega</SelectItem></SelectContent></Select></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="responsavel-entrega">Responsável pela entrega *</Label><Input id="responsavel-entrega" value={responsavelEntrega} onChange={(event) => setResponsavelEntrega(event.target.value)} placeholder="Nome de quem realizou ou recebeu a entrega" /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="observacoes-entrega">Observações</Label><Textarea id="observacoes-entrega" value={observacoesEntrega} onChange={(event) => setObservacoesEntrega(event.target.value)} placeholder="Ex.: retirado pelo cliente no pátio" rows={3} /></div></div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Se faltar alguma medida, a entrega continua registada e o estoque exibirá saldo negativo para regularização. O título financeiro permanece em aberto enquanto não houver pagamento.</div>
          <DialogFooter><Button variant="outline" onClick={() => setEntregaAlvo(null)} disabled={entregarFisicamente.isPending}>Voltar</Button><Button className="bg-sky-700 hover:bg-sky-800" onClick={confirmarEntrega} disabled={entregarFisicamente.isPending}>{entregarFisicamente.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar entrega e baixa</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
