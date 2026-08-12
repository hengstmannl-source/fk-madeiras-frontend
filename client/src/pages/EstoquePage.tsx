import { useEffect, useMemo, useRef, useState } from "react";
import { Box, ClipboardList, FileText, Loader2, Pencil, Plus, TreePine, Warehouse } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type PlaquetaCarga = { codigo: string; madeiraNome: string; diametro: string; comprimento: string; valorMetroCubico: string; observacoes: string };
type CargaFormulario = { dataCarga: string; origem: string; responsavel: string; observacoes: string; frete: string; plaquetas: PlaquetaCarga[] };

const hoje = () => new Date().toISOString().slice(0, 10);
const num = (valor: string | number | null | undefined) => Number(String(valor ?? "").replace(",", ".")) || 0;
const volumeTora = (diametro: string | number, comprimento: string | number) => Math.PI * ((num(diametro) / 100) / 2) ** 2 * num(comprimento);
const valorTora = (diametro: string | number, comprimento: string | number, valorMetroCubico: string | number) => volumeTora(diametro, comprimento) * num(valorMetroCubico);
const formatarNumero = (valor: number | string, casas = 3) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: casas }).format(Number(valor ?? 0));
const formatarMoeda = (valor: number | string) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(valor ?? 0));
const formatarData = (valor: string | Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(valor));
const novaPlaqueta = (): PlaquetaCarga => ({ codigo: "", madeiraNome: "", diametro: "", comprimento: "", valorMetroCubico: "", observacoes: "" });
const novaCarga = (): CargaFormulario => ({ dataCarga: hoje(), origem: "", responsavel: "", observacoes: "", frete: "0", plaquetas: [novaPlaqueta()] });

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0 space-y-1.5"><Label className="text-xs font-medium">{label}</Label>{children}</div>;
}

function EstadoTora({ estado }: { estado: string }) {
  const rotulos: Record<string, string> = { disponivel: "Disponível", consumida: "Consumida", cancelada: "Cancelada" };
  return <Badge variant="outline" className={estado === "disponivel" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"}>{rotulos[estado] ?? estado}</Badge>;
}

export default function EstoquePage() {
  const [categoria, setCategoria] = useState<"toras" | "serrado">("toras");
  const [dialogCarga, setDialogCarga] = useState(false);
  const [cargaEmEdicao, setCargaEmEdicao] = useState<number | null>(null);
  const [carga, setCarga] = useState<CargaFormulario>(novaCarga);
  const carregouEdicao = useRef<number | null>(null);
  const utils = trpc.useUtils();
  const cargas = trpc.producao.cargas.list.useQuery();
  const detalheCarga = trpc.producao.cargas.get.useQuery({ id: cargaEmEdicao ?? 1 }, { enabled: cargaEmEdicao !== null });
  const plaquetas = trpc.producao.plaquetas.list.useQuery();
  const serrado = trpc.producao.estoque.resumo.useQuery();
  const criarCarga = trpc.producao.cargas.create.useMutation();
  const atualizarCarga = trpc.producao.cargas.update.useMutation();

  useEffect(() => {
    const detalhe = detalheCarga.data;
    if (!detalhe || cargaEmEdicao === null || carregouEdicao.current === cargaEmEdicao) return;
    carregouEdicao.current = cargaEmEdicao;
    setCarga({
      dataCarga: new Date(detalhe.carga.dataCarga).toISOString().slice(0, 10),
      origem: detalhe.carga.origem ?? "",
      responsavel: detalhe.carga.responsavel ?? "",
      observacoes: detalhe.carga.observacoes ?? "",
      frete: String(detalhe.carga.frete ?? "0"),
      plaquetas: detalhe.plaquetas.map((item: any) => ({
        codigo: item.codigo,
        madeiraNome: item.madeiraNome,
        diametro: String(item.diametro ?? ""),
        comprimento: String(item.comprimento ?? ""),
        valorMetroCubico: String(item.valorMetroCubico ?? ""),
        observacoes: item.observacoes ?? "",
      })),
    });
  }, [cargaEmEdicao, detalheCarga.data]);

  const totais = useMemo(() => {
    const valorProdutos = carga.plaquetas.reduce((total, item) => total + valorTora(item.diametro, item.comprimento, item.valorMetroCubico), 0);
    const frete = num(carga.frete);
    return {
      plaquetas: carga.plaquetas.length,
      volume: carga.plaquetas.reduce((total, item) => total + volumeTora(item.diametro, item.comprimento), 0),
      valorProdutos,
      frete,
      valorTotal: valorProdutos + frete,
    };
  }, [carga]);

  const torasDisponiveis = useMemo(() => (plaquetas.data ?? []).filter((item: any) => item.estado === "disponivel"), [plaquetas.data]);
  const salvando = criarCarga.isPending || atualizarCarga.isPending;
  const redefinirCarga = () => { carregouEdicao.current = null; setCarga(novaCarga()); setCargaEmEdicao(null); };
  const fecharDialogo = () => { setDialogCarga(false); redefinirCarga(); };
  const abrirNovoRomaneio = () => { redefinirCarga(); setDialogCarga(true); };
  const abrirEdicao = (id: number) => { carregouEdicao.current = null; setCarga(novaCarga()); setCargaEmEdicao(id); setDialogCarga(true); };
  const atualizarPlaqueta = (indice: number, campo: keyof PlaquetaCarga, valor: string) => setCarga((anterior) => ({ ...anterior, plaquetas: anterior.plaquetas.map((item, posicao) => posicao === indice ? { ...item, [campo]: valor } : item) }));
  const adicionarPlaqueta = () => setCarga((anterior) => {
    const ultimaPlaqueta = anterior.plaquetas.at(-1);
    const proximaPlaqueta = { ...novaPlaqueta(), madeiraNome: ultimaPlaqueta?.madeiraNome ?? "", valorMetroCubico: ultimaPlaqueta?.valorMetroCubico ?? "" };
    return { ...anterior, plaquetas: [...anterior.plaquetas, proximaPlaqueta] };
  });
  const removerPlaqueta = (indice: number) => setCarga((anterior) => ({ ...anterior, plaquetas: anterior.plaquetas.filter((_, posicao) => posicao !== indice) }));
  const carregarPdf = (id: number) => window.open(`/api/pdf/romaneio-carga/${id}`, "_blank", "noopener,noreferrer");

  const salvarCarga = () => {
    const entrada = {
      ...carga,
      origem: carga.origem || null,
      responsavel: carga.responsavel || null,
      observacoes: carga.observacoes || null,
      plaquetas: carga.plaquetas.map((item) => ({ ...item, observacoes: item.observacoes || null })),
    };
    const sucesso = (resultado: { numero: string; totalPlaquetas: number }) => {
      toast.success(`${resultado.numero} salvo com ${resultado.totalPlaquetas} plaqueta(s)`);
      fecharDialogo();
      utils.producao.cargas.list.invalidate();
      utils.producao.plaquetas.list.invalidate();
      if (cargaEmEdicao) utils.producao.cargas.get.invalidate({ id: cargaEmEdicao });
    };
    const erro = (motivo: { message: string }) => toast.error(motivo.message);
    if (cargaEmEdicao) atualizarCarga.mutate({ id: cargaEmEdicao, ...entrada }, { onSuccess: sucesso, onError: erro });
    else criarCarga.mutate(entrada, { onSuccess: sucesso, onError: erro });
  };

  return <div className="mx-auto max-w-7xl space-y-6">
    <header><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Pátio e armazenamento</p><h1 className="mt-1 text-2xl font-bold tracking-tight">Estoque</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Controle as cargas de toras recebidas e as peças serradas já produzidas.</p></header>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Resumo icone={<ClipboardList />} titulo="Cargas recebidas" valor={(cargas.data ?? []).length} detalhe="Romaneios de toras" cor="sky" /><Resumo icone={<TreePine />} titulo="Toras disponíveis" valor={torasDisponiveis.length} detalhe="Prontas para a produção" cor="emerald" /><Resumo icone={<Box />} titulo="Peças serradas" valor={(serrado.data ?? []).reduce((total: number, item: any) => total + item.quantidadeDisponivel, 0)} detalhe="Disponíveis para entrega" cor="amber" /><Resumo icone={<Warehouse />} titulo="Volume serrado" valor={`${formatarNumero((serrado.data ?? []).reduce((total: number, item: any) => total + num(item.volumeDisponivel), 0))} m³`} detalhe="Saldo por dimensões" cor="violet" /></div>
    <Tabs value={categoria} onValueChange={(valor) => setCategoria(valor as typeof categoria)}><TabsList><TabsTrigger value="toras">Toras</TabsTrigger><TabsTrigger value="serrado">Serrado</TabsTrigger></TabsList></Tabs>
    {categoria === "toras" && <div className="space-y-5">
      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b bg-muted/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">Romaneios de carga</h2><p className="mt-0.5 text-xs text-muted-foreground">Cada carga agrupa as plaquetas, o frete e os valores calculados automaticamente.</p></div><Button size="sm" onClick={abrirNovoRomaneio}><Plus className="mr-1.5 h-3.5 w-3.5" />Novo romaneio de carga</Button></div>
        {cargas.isLoading ? <Carregando /> : cargas.data?.length ? <Table><TableHeader><TableRow><TableHead>Romaneio</TableHead><TableHead>Data</TableHead><TableHead>Origem</TableHead><TableHead>Responsável</TableHead><TableHead className="text-right">Plaquetas</TableHead><TableHead className="text-right">Volume</TableHead><TableHead className="text-right">Frete</TableHead><TableHead className="text-right">Valor total</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{cargas.data.map((item: any) => <TableRow key={item.id}><TableCell className="font-medium">{item.numero}</TableCell><TableCell>{formatarData(item.dataCarga)}</TableCell><TableCell>{item.origem || "—"}</TableCell><TableCell>{item.responsavel || "—"}</TableCell><TableCell className="text-right">{item.totalPlaquetas}</TableCell><TableCell className="text-right font-medium">{formatarNumero(item.volumeTotal)} m³</TableCell><TableCell className="text-right">{formatarMoeda(item.frete)}</TableCell><TableCell className="text-right font-semibold">{formatarMoeda(item.valorTotal)}</TableCell><TableCell><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" title="Editar romaneio" aria-label={`Editar ${item.numero}`} onClick={() => abrirEdicao(item.id)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" title="Gerar PDF" aria-label={`Gerar PDF de ${item.numero}`} onClick={() => carregarPdf(item.id)}><FileText className="h-4 w-4" /></Button></div></TableCell></TableRow>)}</TableBody></Table> : <Vazio icone={<ClipboardList />} texto="Registre o primeiro romaneio de carga para dar entrada nas toras." />}
      </section>
      <section className="overflow-hidden rounded-xl border bg-card shadow-sm"><div className="border-b bg-muted/20 px-5 py-4"><h2 className="font-semibold">Plaquetas no estoque</h2><p className="mt-0.5 text-xs text-muted-foreground">Cada plaqueta entra por uma carga e pode ser utilizada uma única vez na produção.</p></div>{plaquetas.isLoading ? <Carregando /> : plaquetas.data?.length ? <Table><TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Essência</TableHead><TableHead className="text-right">Diâmetro</TableHead><TableHead className="text-right">Comprimento</TableHead><TableHead className="text-right">Volume</TableHead><TableHead className="text-right">R$/m³</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader><TableBody>{plaquetas.data.map((item: any) => <TableRow key={item.id}><TableCell className="font-medium">{item.codigo}</TableCell><TableCell>{item.madeiraNome}</TableCell><TableCell className="text-right">{item.diametro ? `${formatarNumero(item.diametro, 2)} cm` : "—"}</TableCell><TableCell className="text-right">{item.comprimento ? `${formatarNumero(item.comprimento, 2)} m` : "—"}</TableCell><TableCell className="text-right">{formatarNumero(item.volumeDisponivel)} m³</TableCell><TableCell className="text-right">{formatarMoeda(item.valorMetroCubico)}</TableCell><TableCell className="text-right font-medium">{formatarMoeda(item.valorTotal)}</TableCell><TableCell><EstadoTora estado={item.estado} /></TableCell></TableRow>)}</TableBody></Table> : <Vazio icone={<TreePine />} texto="Nenhuma plaqueta recebida no estoque." />}</section>
    </div>}
    {categoria === "serrado" && <section className="overflow-hidden rounded-xl border bg-card shadow-sm"><div className="border-b bg-muted/20 px-5 py-4"><h2 className="font-semibold">Estoque serrado</h2><p className="mt-0.5 text-xs text-muted-foreground">Peças originadas em romaneios de produção e disponíveis para entrega física.</p></div>{serrado.isLoading ? <Carregando /> : serrado.data?.length ? <Table><TableHeader><TableRow><TableHead>Essência</TableHead><TableHead className="text-right">Espessura</TableHead><TableHead className="text-right">Largura</TableHead><TableHead className="text-right">Comprimento</TableHead><TableHead className="text-right">Peças</TableHead><TableHead className="text-right">Volume</TableHead></TableRow></TableHeader><TableBody>{serrado.data.map((item: any, indice: number) => <TableRow key={`${item.madeiraNome}-${indice}`}><TableCell className="font-medium">{item.madeiraNome}</TableCell><TableCell className="text-right">{formatarNumero(item.espessura, 2)} cm</TableCell><TableCell className="text-right">{formatarNumero(item.largura, 2)} cm</TableCell><TableCell className="text-right">{formatarNumero(item.comprimento, 2)} m</TableCell><TableCell className="text-right">{item.quantidadeDisponivel}</TableCell><TableCell className="text-right">{formatarNumero(item.volumeDisponivel)} m³</TableCell></TableRow>)}</TableBody></Table> : <Vazio icone={<Box />} texto="As peças confirmadas na Produção aparecerão aqui." />}</section>}
    <Dialog open={dialogCarga} onOpenChange={(aberto) => { if (!aberto) fecharDialogo(); else setDialogCarga(true); }}><DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto"><DialogHeader><DialogTitle>{cargaEmEdicao ? "Editar romaneio de carga" : "Novo romaneio de carga"}</DialogTitle></DialogHeader><div className="space-y-5">{detalheCarga.isLoading && cargaEmEdicao ? <Carregando /> : <><div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">Registre as plaquetas e o frete da carga. O valor final soma automaticamente as toras e o frete informado.</div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Campo label="Data da carga *"><Input type="date" value={carga.dataCarga} onChange={(evento) => setCarga((anterior) => ({ ...anterior, dataCarga: evento.target.value }))} /></Campo><Campo label="Origem"><Input value={carga.origem} onChange={(evento) => setCarga((anterior) => ({ ...anterior, origem: evento.target.value }))} placeholder="Fornecedor ou fazenda" /></Campo><Campo label="Responsável"><Input value={carga.responsavel} onChange={(evento) => setCarga((anterior) => ({ ...anterior, responsavel: evento.target.value }))} placeholder="Quem recebeu" /></Campo><Campo label="Frete da carga (R$)"><Input inputMode="decimal" value={carga.frete} onChange={(evento) => setCarga((anterior) => ({ ...anterior, frete: evento.target.value }))} placeholder="0,00" /></Campo></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><IndicadorCarga rotulo="Plaquetas" valor={totais.plaquetas} /><IndicadorCarga rotulo="Volume total" valor={`${formatarNumero(totais.volume)} m³`} /><IndicadorCarga rotulo="Valor das toras" valor={formatarMoeda(totais.valorProdutos)} /><IndicadorCarga rotulo="Valor total da carga" valor={formatarMoeda(totais.valorTotal)} destaque /></div><div className="space-y-3">{carga.plaquetas.map((item, indice) => { const volume = volumeTora(item.diametro, item.comprimento); const valor = valorTora(item.diametro, item.comprimento, item.valorMetroCubico); return <article key={indice} className="rounded-xl border bg-muted/15 p-4"><div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">Plaqueta {indice + 1}</p><p className="text-xs text-muted-foreground">Informe a identificação, as medidas e o custo desta tora.</p></div><Button type="button" size="sm" variant="ghost" className="text-muted-foreground" disabled={carga.plaquetas.length === 1} onClick={() => removerPlaqueta(indice)} aria-label={`Remover plaqueta ${indice + 1}`}>Remover</Button></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Campo label="Código *"><Input value={item.codigo} onChange={(evento) => atualizarPlaqueta(indice, "codigo", evento.target.value)} placeholder="PLQ-001" /></Campo><Campo label="Essência *"><Input value={item.madeiraNome} onChange={(evento) => atualizarPlaqueta(indice, "madeiraNome", evento.target.value)} placeholder="Ex.: Cedrinho" /></Campo><Campo label="Diâmetro (cm) *"><Input inputMode="decimal" value={item.diametro} onChange={(evento) => atualizarPlaqueta(indice, "diametro", evento.target.value)} placeholder="0,00" /></Campo><Campo label="Comprimento (m) *"><Input inputMode="decimal" value={item.comprimento} onChange={(evento) => atualizarPlaqueta(indice, "comprimento", evento.target.value)} placeholder="0,00" /></Campo><Campo label="Preço por m³ (R$) *"><Input inputMode="decimal" value={item.valorMetroCubico} onChange={(evento) => atualizarPlaqueta(indice, "valorMetroCubico", evento.target.value)} placeholder="900,00" /></Campo><div className="grid grid-cols-2 gap-2 rounded-lg border bg-background p-3"><div><p className="text-[11px] text-muted-foreground">Volume</p><p className="mt-1 text-sm font-semibold">{formatarNumero(volume)} m³</p></div><div className="border-l pl-2"><p className="text-[11px] text-muted-foreground">Valor da tora</p><p className="mt-1 text-sm font-semibold text-emerald-700">{formatarMoeda(valor)}</p></div></div></div></article>; })}</div><Button type="button" variant="outline" onClick={adicionarPlaqueta}><Plus className="mr-2 h-4 w-4" />Adicionar plaqueta</Button><Campo label="Observações da carga"><Textarea value={carga.observacoes} onChange={(evento) => setCarga((anterior) => ({ ...anterior, observacoes: evento.target.value }))} placeholder="Informações gerais da carga" /></Campo><div className="flex flex-col-reverse justify-end gap-2 sm:flex-row"><Button variant="outline" onClick={fecharDialogo} disabled={salvando}>Cancelar</Button><Button onClick={salvarCarga} disabled={salvando}>{salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{cargaEmEdicao ? "Salvar alterações" : "Confirmar entrada"}</Button></div></>}</div></DialogContent></Dialog>
  </div>;
}

function IndicadorCarga({ rotulo, valor, destaque = false }: { rotulo: string; valor: React.ReactNode; destaque?: boolean }) { return <div className={`rounded-lg border p-3 ${destaque ? "border-emerald-200 bg-emerald-50" : "bg-muted/40"}`}><p className="text-xs text-muted-foreground">{rotulo}</p><p className={`mt-1 text-lg font-bold ${destaque ? "text-emerald-800" : ""}`}>{valor}</p></div>; }
function Resumo({ icone, titulo, valor, detalhe, cor }: { icone: React.ReactNode; titulo: string; valor: React.ReactNode; detalhe: string; cor: "sky" | "emerald" | "amber" | "violet" }) { const cores = { sky: "bg-sky-50 text-sky-700", emerald: "bg-emerald-50 text-emerald-700", amber: "bg-amber-50 text-amber-700", violet: "bg-violet-50 text-violet-700" }; return <div className="rounded-xl border bg-card p-4 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-xs font-medium text-muted-foreground">{titulo}</p><p className="mt-2 text-2xl font-bold tracking-tight">{valor}</p><p className="mt-1 text-xs text-muted-foreground">{detalhe}</p></div><div className={`rounded-lg p-2.5 ${cores[cor]}`}>{icone}</div></div></div>; }
function Carregando() { return <div className="py-12 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Carregando estoque...</div>; }
function Vazio({ icone, texto }: { icone: React.ReactNode; texto: string }) { return <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center text-sm text-muted-foreground"><div className="rounded-full bg-muted p-3">{icone}</div><p>{texto}</p></div>; }
