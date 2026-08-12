import { useMemo, useState } from "react";
import { Box, ClipboardList, Loader2, PackagePlus, Plus, TreePine, Warehouse } from "lucide-react";
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

type PlaquetaCarga = { codigo: string; madeiraNome: string; diametro: string; comprimento: string; observacoes: string };

const hoje = () => new Date().toISOString().slice(0, 10);
const num = (valor: string | number | null | undefined) => Number(String(valor ?? "").replace(",", ".")) || 0;
const volumeTora = (diametro: string | number, comprimento: string | number) => Math.PI * ((num(diametro) / 100) / 2) ** 2 * num(comprimento);
const formatarNumero = (valor: number | string, casas = 3) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: casas }).format(Number(valor ?? 0));
const formatarData = (valor: string | Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(valor));
const novaPlaqueta = (): PlaquetaCarga => ({ codigo: "", madeiraNome: "", diametro: "", comprimento: "", observacoes: "" });

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs font-medium">{label}</Label>{children}</div>;
}

function EstadoTora({ estado }: { estado: string }) {
  const rotulos: Record<string, string> = { disponivel: "Disponível", consumida: "Consumida", cancelada: "Cancelada" };
  return <Badge variant="outline" className={estado === "disponivel" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"}>{rotulos[estado] ?? estado}</Badge>;
}

export default function EstoquePage() {
  const [categoria, setCategoria] = useState<"toras" | "serrado">("toras");
  const [dialogCarga, setDialogCarga] = useState(false);
  const [carga, setCarga] = useState({ dataCarga: hoje(), origem: "", responsavel: "", observacoes: "", plaquetas: [novaPlaqueta()] });
  const utils = trpc.useUtils();
  const cargas = trpc.producao.cargas.list.useQuery();
  const plaquetas = trpc.producao.plaquetas.list.useQuery();
  const serrado = trpc.producao.estoque.resumo.useQuery();
  const criarCarga = trpc.producao.cargas.create.useMutation();
  const totais = useMemo(() => ({
    plaquetas: carga.plaquetas.length,
    volume: carga.plaquetas.reduce((total, plaqueta) => total + volumeTora(plaqueta.diametro, plaqueta.comprimento), 0),
  }), [carga.plaquetas]);
  const torasDisponiveis = useMemo(() => (plaquetas.data ?? []).filter((plaqueta: any) => plaqueta.estado === "disponivel"), [plaquetas.data]);
  const salvarCarga = () => criarCarga.mutate({
    ...carga,
    origem: carga.origem || null,
    responsavel: carga.responsavel || null,
    observacoes: carga.observacoes || null,
    plaquetas: carga.plaquetas.map((plaqueta) => ({ ...plaqueta, observacoes: plaqueta.observacoes || null })),
  }, {
    onSuccess: (resultado) => {
      toast.success(`${resultado.numero} registrado com ${resultado.totalPlaquetas} plaqueta(s)`);
      setDialogCarga(false);
      setCarga({ dataCarga: hoje(), origem: "", responsavel: "", observacoes: "", plaquetas: [novaPlaqueta()] });
      utils.producao.cargas.list.invalidate();
      utils.producao.plaquetas.list.invalidate();
    },
    onError: (erro) => toast.error(erro.message),
  });
  const atualizarPlaqueta = (indice: number, campo: keyof PlaquetaCarga, valor: string) => setCarga({ ...carga, plaquetas: carga.plaquetas.map((plaqueta, posicao) => posicao === indice ? { ...plaqueta, [campo]: valor } : plaqueta) });

  return <div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Pátio e armazenamento</p><h1 className="mt-1 text-2xl font-bold tracking-tight">Estoque</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Controle as cargas de toras recebidas e as peças serradas já produzidas.</p></div>{categoria === "toras" && <Button onClick={() => setDialogCarga(true)}><PackagePlus className="mr-2 h-4 w-4" />Novo romaneio de carga</Button>}</header>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Resumo icone={<ClipboardList />} titulo="Cargas recebidas" valor={(cargas.data ?? []).length} detalhe="Romaneios de toras" cor="sky" /><Resumo icone={<TreePine />} titulo="Tor­as disponíveis" valor={torasDisponiveis.length} detalhe="Prontas para a produção" cor="emerald" /><Resumo icone={<Box />} titulo="Peças serradas" valor={(serrado.data ?? []).reduce((total: number, item: any) => total + item.quantidadeDisponivel, 0)} detalhe="Disponíveis para entrega" cor="amber" /><Resumo icone={<Warehouse />} titulo="Volume serrado" valor={`${formatarNumero((serrado.data ?? []).reduce((total: number, item: any) => total + num(item.volumeDisponivel), 0))} m³`} detalhe="Saldo por dimensões" cor="violet" /></div>
    <Tabs value={categoria} onValueChange={(valor) => setCategoria(valor as typeof categoria)}><TabsList><TabsTrigger value="toras">Toras</TabsTrigger><TabsTrigger value="serrado">Serrado</TabsTrigger></TabsList></Tabs>
    {categoria === "toras" && <div className="space-y-5"><section className="overflow-hidden rounded-xl border bg-card shadow-sm"><div className="flex flex-col gap-3 border-b bg-muted/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">Romaneios de carga</h2><p className="mt-0.5 text-xs text-muted-foreground">Cada carga agrupa as plaquetas recebidas e soma seu volume automaticamente.</p></div><Button size="sm" onClick={() => setDialogCarga(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />Novo romaneio de carga</Button></div>{cargas.isLoading ? <Carregando /> : cargas.data?.length ? <Table><TableHeader><TableRow><TableHead>Romaneio</TableHead><TableHead>Data</TableHead><TableHead>Origem</TableHead><TableHead>Responsável</TableHead><TableHead className="text-right">Plaquetas</TableHead><TableHead className="text-right">Volume total</TableHead></TableRow></TableHeader><TableBody>{cargas.data.map((romaneio: any) => <TableRow key={romaneio.id}><TableCell className="font-medium">{romaneio.numero}</TableCell><TableCell>{formatarData(romaneio.dataCarga)}</TableCell><TableCell>{romaneio.origem || "—"}</TableCell><TableCell>{romaneio.responsavel || "—"}</TableCell><TableCell className="text-right">{romaneio.totalPlaquetas}</TableCell><TableCell className="text-right font-medium">{formatarNumero(romaneio.volumeTotal)} m³</TableCell></TableRow>)}</TableBody></Table> : <Vazio icone={<ClipboardList />} texto="Registre o primeiro romaneio de carga para dar entrada nas toras." />}</section><section className="overflow-hidden rounded-xl border bg-card shadow-sm"><div className="border-b bg-muted/20 px-5 py-4"><h2 className="font-semibold">Plaquetas no estoque</h2><p className="mt-0.5 text-xs text-muted-foreground">Cada plaqueta entra por uma carga e pode ser utilizada uma única vez na produção.</p></div>{plaquetas.isLoading ? <Carregando /> : plaquetas.data?.length ? <Table><TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Essência</TableHead><TableHead className="text-right">Diâmetro</TableHead><TableHead className="text-right">Comprimento</TableHead><TableHead className="text-right">Volume</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader><TableBody>{plaquetas.data.map((plaqueta: any) => <TableRow key={plaqueta.id}><TableCell className="font-medium">{plaqueta.codigo}</TableCell><TableCell>{plaqueta.madeiraNome}</TableCell><TableCell className="text-right">{plaqueta.diametro ? `${formatarNumero(plaqueta.diametro, 2)} cm` : "—"}</TableCell><TableCell className="text-right">{plaqueta.comprimento ? `${formatarNumero(plaqueta.comprimento, 2)} m` : "—"}</TableCell><TableCell className="text-right">{formatarNumero(plaqueta.volumeDisponivel)} m³</TableCell><TableCell><EstadoTora estado={plaqueta.estado} /></TableCell></TableRow>)}</TableBody></Table> : <Vazio icone={<TreePine />} texto="Nenhuma plaqueta recebida no estoque." />}</section></div>}
    {categoria === "serrado" && <section className="overflow-hidden rounded-xl border bg-card shadow-sm"><div className="border-b bg-muted/20 px-5 py-4"><h2 className="font-semibold">Estoque serrado</h2><p className="mt-0.5 text-xs text-muted-foreground">Peças originadas em romaneios de produção e disponíveis para entrega física.</p></div>{serrado.isLoading ? <Carregando /> : serrado.data?.length ? <Table><TableHeader><TableRow><TableHead>Essência</TableHead><TableHead className="text-right">Espessura</TableHead><TableHead className="text-right">Largura</TableHead><TableHead className="text-right">Comprimento</TableHead><TableHead className="text-right">Peças</TableHead><TableHead className="text-right">Volume</TableHead></TableRow></TableHeader><TableBody>{serrado.data.map((item: any, indice: number) => <TableRow key={`${item.madeiraNome}-${indice}`}><TableCell className="font-medium">{item.madeiraNome}</TableCell><TableCell className="text-right">{formatarNumero(item.espessura, 2)} cm</TableCell><TableCell className="text-right">{formatarNumero(item.largura, 2)} cm</TableCell><TableCell className="text-right">{formatarNumero(item.comprimento, 2)} m</TableCell><TableCell className="text-right">{item.quantidadeDisponivel}</TableCell><TableCell className="text-right">{formatarNumero(item.volumeDisponivel)} m³</TableCell></TableRow>)}</TableBody></Table> : <Vazio icone={<Box />} texto="As peças confirmadas na Produção aparecerão aqui." />}</section>}
    <Dialog open={dialogCarga} onOpenChange={setDialogCarga}><DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto"><DialogHeader><DialogTitle>Novo romaneio de carga</DialogTitle></DialogHeader><div className="space-y-5"><div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">Registre todas as plaquetas recebidas nesta carga. O volume de cada tora é calculado pelo diâmetro em centímetros e comprimento em metros.</div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Campo label="Data da carga *"><Input type="date" value={carga.dataCarga} onChange={(evento) => setCarga({ ...carga, dataCarga: evento.target.value })} /></Campo><Campo label="Origem"><Input value={carga.origem} onChange={(evento) => setCarga({ ...carga, origem: evento.target.value })} placeholder="Fornecedor ou fazenda" /></Campo><Campo label="Responsável"><Input value={carga.responsavel} onChange={(evento) => setCarga({ ...carga, responsavel: evento.target.value })} placeholder="Quem recebeu" /></Campo><div className="rounded-lg bg-muted/60 px-3 py-2"><p className="text-xs text-muted-foreground">Volume total da carga</p><p className="text-lg font-bold">{formatarNumero(totais.volume)} m³</p><p className="text-xs text-muted-foreground">{totais.plaquetas} plaqueta(s)</p></div></div><div className="overflow-hidden rounded-lg border"><Table><TableHeader><TableRow className="bg-muted/30"><TableHead className="w-[16%]">Código *</TableHead><TableHead>Essência *</TableHead><TableHead className="w-[15%]">Diâmetro (cm) *</TableHead><TableHead className="w-[15%]">Comprimento (m) *</TableHead><TableHead className="w-[14%] text-right">Volume (m³)</TableHead><TableHead className="w-12" /></TableRow></TableHeader><TableBody>{carga.plaquetas.map((plaqueta, indice) => <TableRow key={indice}><TableCell><Input value={plaqueta.codigo} onChange={(evento) => atualizarPlaqueta(indice, "codigo", evento.target.value)} placeholder="PLQ-001" /></TableCell><TableCell><Input value={plaqueta.madeiraNome} onChange={(evento) => atualizarPlaqueta(indice, "madeiraNome", evento.target.value)} placeholder="Ex.: Cedrinho" /></TableCell><TableCell><Input inputMode="decimal" value={plaqueta.diametro} onChange={(evento) => atualizarPlaqueta(indice, "diametro", evento.target.value)} placeholder="0,00" /></TableCell><TableCell><Input inputMode="decimal" value={plaqueta.comprimento} onChange={(evento) => atualizarPlaqueta(indice, "comprimento", evento.target.value)} placeholder="0,00" /></TableCell><TableCell className="text-right font-medium">{formatarNumero(volumeTora(plaqueta.diametro, plaqueta.comprimento))}</TableCell><TableCell><Button type="button" size="icon" variant="ghost" className="text-muted-foreground" disabled={carga.plaquetas.length === 1} onClick={() => setCarga({ ...carga, plaquetas: carga.plaquetas.filter((_, posicao) => posicao !== indice) })} aria-label={`Remover plaqueta ${indice + 1}`}>×</Button></TableCell></TableRow>)}</TableBody></Table></div><Button type="button" variant="outline" onClick={() => setCarga({ ...carga, plaquetas: [...carga.plaquetas, novaPlaqueta()] })}><Plus className="mr-2 h-4 w-4" />Adicionar plaqueta</Button><Campo label="Observações da carga"><Textarea value={carga.observacoes} onChange={(evento) => setCarga({ ...carga, observacoes: evento.target.value })} placeholder="Informações gerais da carga" /></Campo><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setDialogCarga(false)} disabled={criarCarga.isPending}>Cancelar</Button><Button onClick={salvarCarga} disabled={criarCarga.isPending}>{criarCarga.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar entrada</Button></div></div></DialogContent></Dialog>
  </div>;
}

function Resumo({ icone, titulo, valor, detalhe, cor }: { icone: React.ReactNode; titulo: string; valor: React.ReactNode; detalhe: string; cor: "sky" | "emerald" | "amber" | "violet" }) {
  const cores = { sky: "bg-sky-50 text-sky-700", emerald: "bg-emerald-50 text-emerald-700", amber: "bg-amber-50 text-amber-700", violet: "bg-violet-50 text-violet-700" };
  return <div className="rounded-xl border bg-card p-4 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-xs font-medium text-muted-foreground">{titulo}</p><p className="mt-2 text-2xl font-bold tracking-tight">{valor}</p><p className="mt-1 text-xs text-muted-foreground">{detalhe}</p></div><div className={`rounded-lg p-2.5 ${cores[cor]}`}>{icone}</div></div></div>;
}

function Carregando() { return <div className="py-12 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Carregando estoque...</div>; }
function Vazio({ icone, texto }: { icone: React.ReactNode; texto: string }) { return <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center text-sm text-muted-foreground"><div className="rounded-full bg-muted p-3">{icone}</div><p>{texto}</p></div>; }
