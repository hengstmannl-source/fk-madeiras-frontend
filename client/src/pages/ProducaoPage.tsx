import { useMemo, useState } from "react";
import { useSearch } from "wouter";
import { BarChart3, Box, Factory, Layers3, Loader2, PackagePlus, Plus, Scissors, TreePine } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type ItemForm = { madeiraNome: string; espessura: string; largura: string; comprimento: string; quantidade: string };
const hoje = () => new Date().toISOString().slice(0, 10);
const formatarNumero = (valor: number | string, casas = 3) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: casas }).format(Number(valor ?? 0));
const formatarData = (valor: string | Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(valor));
const novoItem = (madeiraNome = ""): ItemForm => ({ madeiraNome, espessura: "", largura: "", comprimento: "", quantidade: "" });

function calcularItem(item: ItemForm) {
  const espessura = Number(item.espessura.replace(",", ".")) || 0;
  const largura = Number(item.largura.replace(",", ".")) || 0;
  const comprimento = Number(item.comprimento.replace(",", ".")) || 0;
  const quantidade = Number(item.quantidade) || 0;
  const metrosLineares = comprimento * quantidade;
  return { metrosLineares, volume: (espessura * largura * metrosLineares) / 10000, quantidade };
}

export default function ProducaoPage() {
  const search = useSearch();
  const abaInicial = new URLSearchParams(search).get("aba") === "estoque" ? "estoque" : "romaneios";
  const [aba, setAba] = useState<"romaneios" | "plaquetas" | "estoque">(abaInicial);
  const [dialogPlaqueta, setDialogPlaqueta] = useState(false);
  const [dialogRomaneio, setDialogRomaneio] = useState(false);
  const [plaquetaForm, setPlaquetaForm] = useState({ codigo: "", madeiraNome: "", volumeInicial: "", dataEntrada: hoje(), origem: "", localizacao: "", observacoes: "" });
  const [romaneioForm, setRomaneioForm] = useState({ plaquetaId: "", dataProducao: hoje(), fita: "", responsavel: "", observacoes: "", itens: [novoItem()] as ItemForm[] });
  const utils = trpc.useUtils();
  const plaquetas = trpc.producao.plaquetas.list.useQuery();
  const romaneios = trpc.producao.romaneios.list.useQuery();
  const estoque = trpc.producao.estoque.resumo.useQuery();
  const criarPlaqueta = trpc.producao.plaquetas.create.useMutation();
  const confirmarRomaneio = trpc.producao.romaneios.confirmar.useMutation();
  const plaquetasDisponiveis = useMemo(() => (plaquetas.data ?? []).filter((plaqueta) => plaqueta.estado === "disponivel"), [plaquetas.data]);
  const itemSelecionado = plaquetasDisponiveis.find((plaqueta) => String(plaqueta.id) === romaneioForm.plaquetaId);
  const totais = useMemo(() => romaneioForm.itens.reduce((total, item) => {
    const calculo = calcularItem(item);
    return { pecas: total.pecas + calculo.quantidade, metrosLineares: total.metrosLineares + calculo.metrosLineares, volume: total.volume + calculo.volume };
  }, { pecas: 0, metrosLineares: 0, volume: 0 }), [romaneioForm.itens]);
  const invalidar = () => {
    utils.producao.plaquetas.list.invalidate();
    utils.producao.romaneios.list.invalidate();
    utils.producao.estoque.resumo.invalidate();
  };

  const abrirRomaneio = () => {
    setRomaneioForm({ plaquetaId: "", dataProducao: hoje(), fita: "", responsavel: "", observacoes: "", itens: [novoItem()] });
    setDialogRomaneio(true);
  };

  const salvarPlaqueta = () => criarPlaqueta.mutate(plaquetaForm, {
    onSuccess: () => { toast.success("Plaqueta registrada e disponível para produção"); setDialogPlaqueta(false); setPlaquetaForm({ codigo: "", madeiraNome: "", volumeInicial: "", dataEntrada: hoje(), origem: "", localizacao: "", observacoes: "" }); invalidar(); },
    onError: (erro) => toast.error(erro.message),
  });

  const salvarRomaneio = () => confirmarRomaneio.mutate({
    ...romaneioForm,
    plaquetaId: Number(romaneioForm.plaquetaId),
    itens: romaneioForm.itens.map((item) => ({ ...item, quantidade: Number(item.quantidade) })),
  }, {
    onSuccess: (resultado) => { toast.success(`${resultado.numero} confirmado: ${resultado.totalPecas} peças entraram no estoque`); setDialogRomaneio(false); invalidar(); },
    onError: (erro) => toast.error(erro.message),
  });

  return <div className="mx-auto max-w-7xl space-y-6">
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Chão de fábrica</p><h1 className="mt-1 text-2xl font-bold tracking-tight">Produção e estoque serrado</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Cada romaneio consome uma única plaqueta e gera peças rastreáveis para a entrega física das vendas.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setDialogPlaqueta(true)}><PackagePlus className="mr-2 h-4 w-4" />Nova plaqueta</Button><Button onClick={abrirRomaneio}><Scissors className="mr-2 h-4 w-4" />Registrar romaneio</Button></div></div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Resumo icon={<TreePine />} titulo="Plaquetas disponíveis" valor={plaquetasDisponiveis.length} detalhe="Matéria-prima pronta" cor="emerald" /><Resumo icon={<Factory />} titulo="Romaneios confirmados" valor={(romaneios.data ?? []).filter((romaneio) => romaneio.estado === "confirmado").length} detalhe="Produção rastreada" cor="sky" /><Resumo icon={<Layers3 />} titulo="Peças em estoque" valor={(estoque.data ?? []).reduce((total, item) => total + item.quantidadeDisponivel, 0)} detalhe="Disponíveis para entrega" cor="amber" /><Resumo icon={<BarChart3 />} titulo="Volume em estoque" valor={`${formatarNumero((estoque.data ?? []).reduce((total, item) => total + item.volumeDisponivel, 0))} m³`} detalhe="Saldo de madeira serrada" cor="violet" /></div>

    <Tabs value={aba} onValueChange={(valor) => setAba(valor as typeof aba)}><TabsList className="w-full justify-start overflow-x-auto"><TabsTrigger value="romaneios">Romaneios</TabsTrigger><TabsTrigger value="plaquetas">Plaquetas</TabsTrigger><TabsTrigger value="estoque">Estoque de peças</TabsTrigger></TabsList></Tabs>

    {aba === "romaneios" && <section className="overflow-hidden rounded-xl border bg-card shadow-sm"><Cabecalho titulo="Romaneios de produção" texto="Produções confirmadas, cada uma vinculada a uma plaqueta única." acao={<Button size="sm" onClick={abrirRomaneio}><Plus className="mr-1.5 h-3.5 w-3.5" />Novo romaneio</Button>} />{romaneios.isLoading ? <Carregando /> : romaneios.data?.length ? <TabelaRomaneios romaneios={romaneios.data} /> : <Vazio icone={<Scissors />} texto="Nenhum romaneio confirmado. Registre a primeira produção a partir de uma plaqueta disponível." />}</section>}
    {aba === "plaquetas" && <section className="overflow-hidden rounded-xl border bg-card shadow-sm"><Cabecalho titulo="Plaquetas de matéria-prima" texto="Cada código é único e só pode ser consumido por um romaneio." acao={<Button size="sm" onClick={() => setDialogPlaqueta(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />Nova plaqueta</Button>} />{plaquetas.isLoading ? <Carregando /> : plaquetas.data?.length ? <TabelaPlaquetas plaquetas={plaquetas.data} /> : <Vazio icone={<TreePine />} texto="Registre uma plaqueta para iniciar o controle da matéria-prima." />}</section>}
    {aba === "estoque" && <section className="overflow-hidden rounded-xl border bg-card shadow-sm"><Cabecalho titulo="Estoque disponível de peças serradas" texto="Saldo consolidado por madeira, dimensões e comprimento. A baixa ocorrerá na entrega física." />{estoque.isLoading ? <Carregando /> : estoque.data?.length ? <TabelaEstoque itens={estoque.data} /> : <Vazio icone={<Box />} texto="As peças produzidas aparecerão aqui após a confirmação dos romaneios." />}</section>}

    <Dialog open={dialogPlaqueta} onOpenChange={setDialogPlaqueta}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Nova plaqueta</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><Campo label="Código da plaqueta *"><Input value={plaquetaForm.codigo} onChange={(e) => setPlaquetaForm({ ...plaquetaForm, codigo: e.target.value })} placeholder="Ex.: PLQ-0001" /></Campo><Campo label="Madeira *"><Input value={plaquetaForm.madeiraNome} onChange={(e) => setPlaquetaForm({ ...plaquetaForm, madeiraNome: e.target.value })} placeholder="Ex.: Cedrinho" /></Campo><Campo label="Volume inicial (m³) *"><Input inputMode="decimal" value={plaquetaForm.volumeInicial} onChange={(e) => setPlaquetaForm({ ...plaquetaForm, volumeInicial: e.target.value })} placeholder="0,000" /></Campo><Campo label="Data de entrada *"><Input type="date" value={plaquetaForm.dataEntrada} onChange={(e) => setPlaquetaForm({ ...plaquetaForm, dataEntrada: e.target.value })} /></Campo><Campo label="Origem"><Input value={plaquetaForm.origem} onChange={(e) => setPlaquetaForm({ ...plaquetaForm, origem: e.target.value })} placeholder="Fornecedor, fazenda ou lote" /></Campo><Campo label="Localização"><Input value={plaquetaForm.localizacao} onChange={(e) => setPlaquetaForm({ ...plaquetaForm, localizacao: e.target.value })} placeholder="Ex.: Pátio A" /></Campo><div className="sm:col-span-2"><Campo label="Observações"><Textarea value={plaquetaForm.observacoes} onChange={(e) => setPlaquetaForm({ ...plaquetaForm, observacoes: e.target.value })} placeholder="Informações complementares" /></Campo></div></div><AcoesDialogo cancelar={() => setDialogPlaqueta(false)} confirmar={salvarPlaqueta} carregando={criarPlaqueta.isPending} texto="Registrar plaqueta" /></DialogContent></Dialog>

    <Dialog open={dialogRomaneio} onOpenChange={setDialogRomaneio}><DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto"><DialogHeader><DialogTitle>Registrar romaneio de produção</DialogTitle></DialogHeader><div className="space-y-5"><div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">Uma plaqueta só pode ser usada uma vez. Ao confirmar, seu saldo será consumido e as peças produzidas entrarão no estoque.</div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Campo label="Plaqueta *"><Select value={romaneioForm.plaquetaId} onValueChange={(plaquetaId) => { const plaqueta = plaquetasDisponiveis.find((item) => String(item.id) === plaquetaId); setRomaneioForm({ ...romaneioForm, plaquetaId, itens: romaneioForm.itens.map((item) => item.madeiraNome ? item : { ...item, madeiraNome: plaqueta?.madeiraNome ?? "" }) }); }}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{plaquetasDisponiveis.map((plaqueta) => <SelectItem value={String(plaqueta.id)} key={plaqueta.id}>{plaqueta.codigo} · {plaqueta.madeiraNome}</SelectItem>)}</SelectContent></Select></Campo><Campo label="Data da produção *"><Input type="date" value={romaneioForm.dataProducao} onChange={(e) => setRomaneioForm({ ...romaneioForm, dataProducao: e.target.value })} /></Campo><Campo label="Fita / linha"><Input value={romaneioForm.fita} onChange={(e) => setRomaneioForm({ ...romaneioForm, fita: e.target.value })} placeholder="Ex.: Fita 1" /></Campo><Campo label="Responsável"><Input value={romaneioForm.responsavel} onChange={(e) => setRomaneioForm({ ...romaneioForm, responsavel: e.target.value })} /></Campo></div>{itemSelecionado && <div className="rounded-md bg-muted/60 px-3 py-2 text-sm"><span className="font-medium">Plaqueta selecionada:</span> {itemSelecionado.codigo} · {itemSelecionado.madeiraNome} · <span className="font-semibold">{formatarNumero(itemSelecionado.volumeDisponivel)} m³ disponíveis</span></div>}<div className="overflow-hidden rounded-lg border"><div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2"><div><p className="text-sm font-semibold">Peças produzidas</p><p className="text-xs text-muted-foreground">Espessura e largura em cm; comprimento em metros.</p></div><Button type="button" variant="outline" size="sm" onClick={() => setRomaneioForm({ ...romaneioForm, itens: [...romaneioForm.itens, novoItem(itemSelecionado?.madeiraNome ?? "")] })}><Plus className="mr-1 h-3.5 w-3.5" />Adicionar linha</Button></div><div className="min-w-[780px]"><div className="grid grid-cols-[1.3fr_.7fr_.7fr_.8fr_.6fr_.7fr] gap-2 border-b bg-muted/20 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><span>Madeira</span><span>Esp. cm</span><span>Larg. cm</span><span>Comp. m</span><span>Peças</span><span>Volume</span></div>{romaneioForm.itens.map((item, indice) => { const calculo = calcularItem(item); return <div key={indice} className="grid grid-cols-[1.3fr_.7fr_.7fr_.8fr_.6fr_.7fr] items-center gap-2 border-b px-3 py-2 last:border-b-0"><Input value={item.madeiraNome} onChange={(e) => atualizarItem(indice, "madeiraNome", e.target.value, romaneioForm, setRomaneioForm)} placeholder="Madeira" /><Input inputMode="decimal" value={item.espessura} onChange={(e) => atualizarItem(indice, "espessura", e.target.value, romaneioForm, setRomaneioForm)} /><Input inputMode="decimal" value={item.largura} onChange={(e) => atualizarItem(indice, "largura", e.target.value, romaneioForm, setRomaneioForm)} /><Input inputMode="decimal" value={item.comprimento} onChange={(e) => atualizarItem(indice, "comprimento", e.target.value, romaneioForm, setRomaneioForm)} /><Input inputMode="numeric" value={item.quantidade} onChange={(e) => atualizarItem(indice, "quantidade", e.target.value, romaneioForm, setRomaneioForm)} /><div className="flex items-center justify-between gap-1"><span className="text-sm font-medium">{formatarNumero(calculo.volume)} m³</span>{romaneioForm.itens.length > 1 && <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setRomaneioForm({ ...romaneioForm, itens: romaneioForm.itens.filter((_, posicao) => posicao !== indice) })}>×</Button>}</div></div>; })}</div></div><div className="grid gap-2 sm:grid-cols-3"><Indicador texto="Peças" valor={totais.pecas} /><Indicador texto="Metros lineares" valor={`${formatarNumero(totais.metrosLineares)} m`} /><Indicador texto="Volume produzido" valor={`${formatarNumero(totais.volume)} m³`} /></div><Campo label="Observações"><Textarea value={romaneioForm.observacoes} onChange={(e) => setRomaneioForm({ ...romaneioForm, observacoes: e.target.value })} /></Campo><AcoesDialogo cancelar={() => setDialogRomaneio(false)} confirmar={salvarRomaneio} carregando={confirmarRomaneio.isPending} texto="Confirmar produção" /></div></DialogContent></Dialog>
  </div>;
}

function atualizarItem(indice: number, campo: keyof ItemForm, valor: string, form: any, setForm: (form: any) => void) { const itens = [...form.itens]; itens[indice] = { ...itens[indice], [campo]: valor }; setForm({ ...form, itens }); }
function Campo({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>; }
function Resumo({ icon, titulo, valor, detalhe, cor }: { icon: React.ReactNode; titulo: string; valor: string | number; detalhe: string; cor: "emerald" | "sky" | "amber" | "violet" }) { const cores = { emerald: "bg-emerald-50 text-emerald-700", sky: "bg-sky-50 text-sky-700", amber: "bg-amber-50 text-amber-700", violet: "bg-violet-50 text-violet-700" }; return <div className="rounded-xl border bg-card p-4 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-xs text-muted-foreground">{titulo}</p><p className="mt-1 text-xl font-bold tracking-tight">{valor}</p><p className="mt-1 text-xs text-muted-foreground">{detalhe}</p></div><div className={`rounded-lg p-2.5 ${cores[cor]}`}>{icon}</div></div></div>; }
function Indicador({ texto, valor }: { texto: string; valor: string | number }) { return <div className="rounded-lg border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">{texto}</p><p className="mt-1 font-semibold">{valor}</p></div>; }
function Cabecalho({ titulo, texto, acao }: { titulo: string; texto: string; acao?: React.ReactNode }) { return <div className="flex flex-col gap-3 border-b bg-muted/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">{titulo}</h2><p className="mt-0.5 text-xs text-muted-foreground">{texto}</p></div>{acao}</div>; }
function Carregando() { return <div className="py-16 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />Carregando dados de produção...</div>; }
function Vazio({ icone, texto }: { icone: React.ReactNode; texto: string }) { return <div className="flex flex-col items-center px-6 py-16 text-center text-muted-foreground"><div className="mb-3 rounded-full bg-muted p-3">{icone}</div><p className="max-w-md text-sm">{texto}</p></div>; }
function AcoesDialogo({ cancelar, confirmar, carregando, texto }: { cancelar: () => void; confirmar: () => void; carregando: boolean; texto: string }) { return <div className="flex justify-end gap-2"><Button variant="outline" onClick={cancelar} disabled={carregando}>Cancelar</Button><Button onClick={confirmar} disabled={carregando}>{carregando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{texto}</Button></div>; }
function TabelaPlaquetas({ plaquetas }: { plaquetas: any[] }) { return <Table><TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Madeira</TableHead><TableHead>Entrada</TableHead><TableHead>Localização</TableHead><TableHead className="text-right">Volume</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader><TableBody>{plaquetas.map((plaqueta) => <TableRow key={plaqueta.id}><TableCell className="font-medium">{plaqueta.codigo}</TableCell><TableCell>{plaqueta.madeiraNome}</TableCell><TableCell>{formatarData(plaqueta.dataEntrada)}</TableCell><TableCell>{plaqueta.localizacao || "—"}</TableCell><TableCell className="text-right">{formatarNumero(plaqueta.volumeDisponivel)} m³</TableCell><TableCell><Badge variant={plaqueta.estado === "disponivel" ? "default" : "secondary"}>{plaqueta.estado === "disponivel" ? "Disponível" : plaqueta.estado === "consumida" ? "Consumida" : "Cancelada"}</Badge></TableCell></TableRow>)}</TableBody></Table>; }
function TabelaRomaneios({ romaneios }: { romaneios: any[] }) { return <Table><TableHeader><TableRow><TableHead>Romaneio</TableHead><TableHead>Data</TableHead><TableHead>Plaqueta</TableHead><TableHead>Madeira</TableHead><TableHead>Fita</TableHead><TableHead>Responsável</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader><TableBody>{romaneios.map((romaneio) => <TableRow key={romaneio.id}><TableCell className="font-medium">{romaneio.numero}</TableCell><TableCell>{formatarData(romaneio.dataProducao)}</TableCell><TableCell>{romaneio.plaquetaCodigo}</TableCell><TableCell>{romaneio.madeiraNome}</TableCell><TableCell>{romaneio.fita || "—"}</TableCell><TableCell>{romaneio.responsavel || "—"}</TableCell><TableCell><Badge variant={romaneio.estado === "confirmado" ? "default" : "secondary"}>{romaneio.estado}</Badge></TableCell></TableRow>)}</TableBody></Table>; }
function TabelaEstoque({ itens }: { itens: any[] }) { return <Table><TableHeader><TableRow><TableHead>Madeira</TableHead><TableHead>Espessura</TableHead><TableHead>Largura</TableHead><TableHead>Comprimento</TableHead><TableHead className="text-right">Peças disponíveis</TableHead><TableHead className="text-right">Volume</TableHead></TableRow></TableHeader><TableBody>{itens.map((item) => <TableRow key={`${item.madeiraNome}-${item.espessura}-${item.largura}-${item.comprimento}`}><TableCell className="font-medium">{item.madeiraNome}</TableCell><TableCell>{formatarNumero(item.espessura, 2)} cm</TableCell><TableCell>{formatarNumero(item.largura, 2)} cm</TableCell><TableCell>{formatarNumero(item.comprimento, 2)} m</TableCell><TableCell className="text-right font-semibold">{item.quantidadeDisponivel}</TableCell><TableCell className="text-right">{formatarNumero(item.volumeDisponivel)} m³</TableCell></TableRow>)}</TableBody></Table>; }
