import { useEffect, useMemo, useRef, useState } from "react";
import { Box, ClipboardList, Download, FileSpreadsheet, FileText, Loader2, Pencil, Plus, Trash2, TreePine, Upload, Warehouse } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type PlaquetaCarga = {
  codigo: string;
  madeiraNome: string;
  diametro: string;
  comprimento: string;
  valorMetroCubico: string;
  observacoes: string;
};

type CargaFormulario = {
  dataCarga: string;
  origem: string;
  responsavel: string;
  observacoes: string;
  fretePorMetroCubico: string;
  plaquetas: PlaquetaCarga[];
};

type CabecalhoCarga = Omit<CargaFormulario, "plaquetas">;

const hoje = () => new Date().toISOString().slice(0, 10);
const num = (valor: string | number | null | undefined) => Number(String(valor ?? "").replace(",", ".")) || 0;
const volumeTora = (diametro: string | number, comprimento: string | number) => Math.PI * ((num(diametro) / 100) / 2) ** 2 * num(comprimento);
const valorTora = (diametro: string | number, comprimento: string | number, valorMetroCubico: string | number) => volumeTora(diametro, comprimento) * num(valorMetroCubico);
const formatarNumero = (valor: number | string, casas = 3) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: casas }).format(Number(valor ?? 0));
const formatarMoeda = (valor: number | string) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(valor ?? 0));
const formatarData = (valor: string | Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(valor));
const novaPlaqueta = (): PlaquetaCarga => ({ codigo: "", madeiraNome: "", diametro: "", comprimento: "", valorMetroCubico: "", observacoes: "" });
const novoCabecalhoCarga = (): CabecalhoCarga => ({ dataCarga: hoje(), origem: "", responsavel: "", observacoes: "", fretePorMetroCubico: "0" });
const novaCarga = (): CargaFormulario => ({ ...novoCabecalhoCarga(), plaquetas: [novaPlaqueta()] });

function baixarCsv(conteudo: string, nomeArquivo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function Campo({ label, children, ajuda }: { label: string; children: React.ReactNode; ajuda?: string }) {
  return <div className="min-w-0 space-y-1.5"><Label className="text-xs font-medium leading-4">{label}</Label>{children}{ajuda && <p className="text-[11px] leading-4 text-muted-foreground">{ajuda}</p>}</div>;
}

function EstadoTora({ estado }: { estado: string }) {
  const rotulos: Record<string, string> = { disponivel: "Disponível", consumida: "Consumida", cancelada: "Cancelada" };
  return <Badge variant="outline" className={estado === "disponivel" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"}>{rotulos[estado] ?? estado}</Badge>;
}

function taxaFrete(item: any) {
  const taxaPersistida = num(item.fretePorMetroCubico);
  if (taxaPersistida || !num(item.frete)) return taxaPersistida;
  const volume = num(item.volumeTotal);
  return volume ? num(item.frete) / volume : 0;
}

export default function EstoquePage() {
  const [categoria, setCategoria] = useState<"toras" | "serrado">("toras");
  const [filtrosCargas, setFiltrosCargas] = useState({ dataInicial: "", dataFinal: "", origem: "" });
  const [buscaPlaquetas, setBuscaPlaquetas] = useState("");
  const [deslocamentoPlaquetas, setDeslocamentoPlaquetas] = useState(0);
  const [dialogCarga, setDialogCarga] = useState(false);
  const [dialogImportacao, setDialogImportacao] = useState(false);
  const [cargaEmEdicao, setCargaEmEdicao] = useState<number | null>(null);
  const [cargaParaExcluir, setCargaParaExcluir] = useState<{ id: number; numero: string } | null>(null);
  const [carga, setCarga] = useState<CargaFormulario>(novaCarga);
  const [cabecalhoImportacao, setCabecalhoImportacao] = useState<CabecalhoCarga>(novoCabecalhoCarga);
  const [arquivoImportacao, setArquivoImportacao] = useState<File | null>(null);
  const [errosImportacao, setErrosImportacao] = useState<string[]>([]);
  const carregouEdicao = useRef<number | null>(null);
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const filtrosCargasAtivos = useMemo(() => ({
    dataInicial: filtrosCargas.dataInicial || undefined,
    dataFinal: filtrosCargas.dataFinal || undefined,
    origem: filtrosCargas.origem || undefined,
  }), [filtrosCargas]);
  const cargas = trpc.producao.cargas.list.useQuery(filtrosCargasAtivos);
  const detalheCarga = trpc.producao.cargas.get.useQuery({ id: cargaEmEdicao ?? 1 }, { enabled: cargaEmEdicao !== null });
  const modeloPlaquetasCsv = trpc.producao.cargas.modeloPlaquetasCsv.useQuery(undefined, { enabled: false });
  const plaquetas = trpc.producao.plaquetas.list.useQuery({ busca: buscaPlaquetas || undefined, limite: 10, deslocamento: deslocamentoPlaquetas });
  const serrado = trpc.producao.estoque.resumo.useQuery();
  const criarCarga = trpc.producao.cargas.create.useMutation();
  const atualizarCarga = trpc.producao.cargas.update.useMutation();
  const excluirCarga = trpc.producao.cargas.excluir.useMutation();
  const importarPlaquetasCsv = trpc.producao.cargas.importarPlaquetasCsv.useMutation();

  useEffect(() => {
    const detalhe = detalheCarga.data;
    if (!detalhe || cargaEmEdicao === null || carregouEdicao.current === cargaEmEdicao) return;
    carregouEdicao.current = cargaEmEdicao;
    setCarga({
      dataCarga: new Date(detalhe.carga.dataCarga).toISOString().slice(0, 10),
      origem: detalhe.carga.origem ?? "",
      responsavel: detalhe.carga.responsavel ?? "",
      observacoes: detalhe.carga.observacoes ?? "",
      fretePorMetroCubico: String(taxaFrete(detalhe.carga)),
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
    const volume = carga.plaquetas.reduce((total, item) => total + volumeTora(item.diametro, item.comprimento), 0);
    const valorProdutos = carga.plaquetas.reduce((total, item) => total + valorTora(item.diametro, item.comprimento, item.valorMetroCubico), 0);
    const fretePorMetroCubico = num(carga.fretePorMetroCubico);
    const frete = volume * fretePorMetroCubico;
    return { plaquetas: carga.plaquetas.length, volume, valorProdutos, fretePorMetroCubico, frete, valorTotal: valorProdutos + frete };
  }, [carga]);

  const plaquetasVisiveis = plaquetas.data?.itens ?? [];
  const torasDisponiveis = plaquetas.data?.totalDisponiveis ?? 0;
  const podeExcluirRomaneio = user?.role === "admin";
  const salvando = criarCarga.isPending || atualizarCarga.isPending;
  const excluindo = excluirCarga.isPending;
  const redefinirCarga = () => { carregouEdicao.current = null; setCarga(novaCarga()); setCargaEmEdicao(null); };
  const fecharDialogo = () => { setDialogCarga(false); redefinirCarga(); };
  const abrirNovoRomaneio = () => { redefinirCarga(); setDialogCarga(true); };
  const abrirImportacao = () => { setCabecalhoImportacao(novoCabecalhoCarga()); setArquivoImportacao(null); setErrosImportacao([]); setDialogImportacao(true); };
  const abrirEdicao = (id: number) => { carregouEdicao.current = null; setCarga(novaCarga()); setCargaEmEdicao(id); setDialogCarga(true); };
  const atualizarPlaqueta = (indice: number, campo: keyof PlaquetaCarga, valor: string) => setCarga((anterior) => ({ ...anterior, plaquetas: anterior.plaquetas.map((item, posicao) => posicao === indice ? { ...item, [campo]: valor } : item) }));
  const adicionarPlaqueta = () => setCarga((anterior) => {
    const ultimaPlaqueta = anterior.plaquetas.at(-1);
    const proximaPlaqueta = { ...novaPlaqueta(), madeiraNome: ultimaPlaqueta?.madeiraNome ?? "", valorMetroCubico: ultimaPlaqueta?.valorMetroCubico ?? "" };
    return { ...anterior, plaquetas: [...anterior.plaquetas, proximaPlaqueta] };
  });
  const removerPlaqueta = (indice: number) => setCarga((anterior) => ({ ...anterior, plaquetas: anterior.plaquetas.filter((_, posicao) => posicao !== indice) }));
  const carregarPdf = (id: number) => window.open(`/api/pdf/romaneio-carga/${id}`, "_blank", "noopener,noreferrer");
  const confirmarExclusao = () => {
    if (!cargaParaExcluir) return;
    const cargaExcluida = cargaParaExcluir;
    excluirCarga.mutate({ id: cargaExcluida.id }, {
      onSuccess: (resultado) => {
        toast.success(`${resultado.numero} excluído com ${resultado.totalPlaquetas} plaqueta(s) removida(s)`);
        if (cargaEmEdicao === cargaExcluida.id) fecharDialogo();
        setCargaParaExcluir(null);
        utils.producao.cargas.list.invalidate();
        utils.producao.plaquetas.list.invalidate();
      },
      onError: (erro) => toast.error(erro.message),
    });
  };

  const baixarModeloImportacao = async () => {
    const resposta = await modeloPlaquetasCsv.refetch();
    if (!resposta.data) { toast.error("Não foi possível gerar o modelo de planilha"); return; }
    baixarCsv(resposta.data, "modelo-importacao-toras-fk-madeiras.csv");
    toast.success("Modelo de planilha baixado");
  };

  const importarArquivo = async () => {
    if (!arquivoImportacao) { toast.error("Selecione uma planilha CSV para importar"); return; }
    try {
      const conteudo = await arquivoImportacao.text();
      importarPlaquetasCsv.mutate({
        ...cabecalhoImportacao,
        origem: cabecalhoImportacao.origem || null,
        responsavel: cabecalhoImportacao.responsavel || null,
        observacoes: cabecalhoImportacao.observacoes || null,
        conteudo,
      }, {
        onSuccess: (resultado) => {
          if (resultado.erros.length) { setErrosImportacao(resultado.erros); toast.error("A importação foi recusada. Revise as linhas indicadas."); return; }
          toast.success(`${resultado.numero} criado com ${resultado.importados} tora(s)`);
          setDialogImportacao(false);
          setArquivoImportacao(null);
          setErrosImportacao([]);
          utils.producao.cargas.list.invalidate();
          utils.producao.plaquetas.list.invalidate();
        },
        onError: (erro) => toast.error(erro.message),
      });
    } catch {
      toast.error("Não foi possível ler o arquivo selecionado");
    }
  };

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
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Resumo icone={<ClipboardList />} titulo="Cargas recebidas" valor={(cargas.data ?? []).length} detalhe="Romaneios de toras" cor="sky" /><Resumo icone={<TreePine />} titulo="Toras disponíveis" valor={torasDisponiveis} detalhe="Prontas para a produção" cor="emerald" /><Resumo icone={<Box />} titulo="Peças serradas" valor={(serrado.data ?? []).reduce((total: number, item: any) => total + item.quantidadeDisponivel, 0)} detalhe="Disponíveis para entrega" cor="amber" /><Resumo icone={<Warehouse />} titulo="Volume serrado" valor={`${formatarNumero((serrado.data ?? []).reduce((total: number, item: any) => total + num(item.volumeDisponivel), 0))} m³`} detalhe="Saldo por dimensões" cor="violet" /></div>
    <Tabs value={categoria} onValueChange={(valor) => setCategoria(valor as typeof categoria)}><TabsList><TabsTrigger value="toras">Toras</TabsTrigger><TabsTrigger value="serrado">Serrado</TabsTrigger></TabsList></Tabs>
    {categoria === "toras" && <div className="space-y-5">
      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b bg-muted/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">Romaneios de carga</h2><p className="mt-0.5 text-xs text-muted-foreground">Cada carga agrupa as plaquetas, o frete e os valores calculados automaticamente.</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={abrirImportacao}><Upload className="mr-1.5 h-3.5 w-3.5" />Importar planilha</Button><Button size="sm" onClick={abrirNovoRomaneio}><Plus className="mr-1.5 h-3.5 w-3.5" />Novo romaneio de carga</Button></div></div>
        <div className="grid gap-3 border-b bg-muted/10 px-5 py-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"><Campo label="Período inicial"><Input aria-label="Período inicial" type="date" value={filtrosCargas.dataInicial} onChange={(evento) => setFiltrosCargas((anterior) => ({ ...anterior, dataInicial: evento.target.value }))} /></Campo><Campo label="Período final"><Input aria-label="Período final" type="date" value={filtrosCargas.dataFinal} onChange={(evento) => setFiltrosCargas((anterior) => ({ ...anterior, dataFinal: evento.target.value }))} /></Campo><Campo label="Origem"><Input aria-label="Filtrar por origem" value={filtrosCargas.origem} onChange={(evento) => setFiltrosCargas((anterior) => ({ ...anterior, origem: evento.target.value }))} placeholder="Fornecedor ou fazenda" /></Campo><Button type="button" variant="ghost" size="sm" disabled={!filtrosCargas.dataInicial && !filtrosCargas.dataFinal && !filtrosCargas.origem} onClick={() => setFiltrosCargas({ dataInicial: "", dataFinal: "", origem: "" })}>Limpar filtros</Button></div>
        {cargas.isLoading ? <Carregando /> : cargas.data?.length ? <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Romaneio</TableHead><TableHead>Data</TableHead><TableHead>Origem</TableHead><TableHead>Responsável</TableHead><TableHead className="text-right">Plaquetas</TableHead><TableHead className="text-right">Volume</TableHead><TableHead className="text-right">Frete/m³</TableHead><TableHead className="text-right">Frete total</TableHead><TableHead className="text-right">Valor total</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{cargas.data.map((item: any) => <TableRow key={item.id}><TableCell className="font-medium">{item.numero}</TableCell><TableCell>{formatarData(item.dataCarga)}</TableCell><TableCell>{item.origem || "—"}</TableCell><TableCell>{item.responsavel || "—"}</TableCell><TableCell className="text-right">{item.totalPlaquetas}</TableCell><TableCell className="text-right font-medium">{formatarNumero(item.volumeTotal)} m³</TableCell><TableCell className="text-right">{formatarMoeda(taxaFrete(item))}</TableCell><TableCell className="text-right">{formatarMoeda(item.frete)}</TableCell><TableCell className="text-right font-semibold">{formatarMoeda(item.valorTotal)}</TableCell><TableCell><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" title="Editar romaneio" aria-label={`Editar ${item.numero}`} onClick={() => abrirEdicao(item.id)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" title="Gerar PDF" aria-label={`Gerar PDF de ${item.numero}`} onClick={() => carregarPdf(item.id)}><FileText className="h-4 w-4" /></Button>{podeExcluirRomaneio && <Button variant="ghost" size="icon" title="Excluir romaneio" aria-label={`Excluir ${item.numero}`} onClick={() => setCargaParaExcluir({ id: item.id, numero: item.numero })}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</div></TableCell></TableRow>)}</TableBody></Table></div> : <Vazio icone={<ClipboardList />} texto="Nenhum romaneio encontrado para os filtros informados." />}
      </section>
      <section className="overflow-hidden rounded-xl border bg-card shadow-sm"><div className="flex flex-col gap-3 border-b bg-muted/20 px-5 py-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-semibold">Plaquetas no estoque</h2><p className="mt-0.5 text-xs text-muted-foreground">Exibindo 10 entradas por vez. Pesquise por plaqueta ou essência para localizar uma tora.</p></div><div className="w-full sm:max-w-xs"><Campo label="Pesquisar plaqueta ou essência"><Input aria-label="Pesquisar plaqueta ou essência" value={buscaPlaquetas} onChange={(evento) => { setBuscaPlaquetas(evento.target.value); setDeslocamentoPlaquetas(0); }} placeholder="Código ou essência" /></Campo></div></div>{plaquetas.isLoading ? <Carregando /> : plaquetasVisiveis.length ? <><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Essência</TableHead><TableHead className="text-right">Diâmetro</TableHead><TableHead className="text-right">Comprimento</TableHead><TableHead className="text-right">Volume</TableHead><TableHead className="text-right">R$/m³</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader><TableBody>{plaquetasVisiveis.map((item: any) => <TableRow key={item.id}><TableCell className="font-medium">{item.codigo}</TableCell><TableCell>{item.madeiraNome}</TableCell><TableCell className="text-right">{item.diametro ? `${formatarNumero(item.diametro, 2)} cm` : "—"}</TableCell><TableCell className="text-right">{item.comprimento ? `${formatarNumero(item.comprimento, 2)} m` : "—"}</TableCell><TableCell className="text-right">{formatarNumero(item.volumeDisponivel)} m³</TableCell><TableCell className="text-right">{formatarMoeda(item.valorMetroCubico)}</TableCell><TableCell className="text-right font-medium">{formatarMoeda(item.valorTotal)}</TableCell><TableCell><EstadoTora estado={item.estado} /></TableCell></TableRow>)}</TableBody></Table></div><div className="flex flex-col gap-3 border-t bg-muted/10 px-5 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>Exibindo {deslocamentoPlaquetas + 1}–{deslocamentoPlaquetas + plaquetasVisiveis.length} de {plaquetas.data?.total ?? 0} plaqueta(s).</span><div className="flex gap-2"><Button type="button" size="sm" variant="outline" disabled={deslocamentoPlaquetas === 0} onClick={() => setDeslocamentoPlaquetas((anterior) => Math.max(0, anterior - 10))}>Anteriores</Button><Button type="button" size="sm" variant="outline" disabled={plaquetas.data?.proximoDeslocamento === null} onClick={() => setDeslocamentoPlaquetas(plaquetas.data?.proximoDeslocamento ?? deslocamentoPlaquetas)}>Próximas 10</Button></div></div></> : <Vazio icone={<TreePine />} texto={buscaPlaquetas ? "Nenhuma plaqueta encontrada para a pesquisa." : "Nenhuma plaqueta recebida no estoque."} />}</section>
    </div>}
    {categoria === "serrado" && <section className="overflow-hidden rounded-xl border bg-card shadow-sm"><div className="border-b bg-muted/20 px-5 py-4"><h2 className="font-semibold">Estoque serrado</h2><p className="mt-0.5 text-xs text-muted-foreground">Peças originadas em romaneios de produção e disponíveis para entrega física.</p></div>{serrado.isLoading ? <Carregando /> : serrado.data?.length ? <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Essência</TableHead><TableHead className="text-right">Espessura</TableHead><TableHead className="text-right">Largura</TableHead><TableHead className="text-right">Comprimento</TableHead><TableHead className="text-right">Peças</TableHead><TableHead className="text-right">Volume</TableHead></TableRow></TableHeader><TableBody>{serrado.data.map((item: any, indice: number) => <TableRow key={`${item.madeiraNome}-${indice}`}><TableCell className="font-medium">{item.madeiraNome}</TableCell><TableCell className="text-right">{formatarNumero(item.espessura, 2)} cm</TableCell><TableCell className="text-right">{formatarNumero(item.largura, 2)} cm</TableCell><TableCell className="text-right">{formatarNumero(item.comprimento, 2)} m</TableCell><TableCell className="text-right">{item.quantidadeDisponivel}</TableCell><TableCell className="text-right">{formatarNumero(item.volumeDisponivel)} m³</TableCell></TableRow>)}</TableBody></Table></div> : <Vazio icone={<Box />} texto="As peças confirmadas na Produção aparecerão aqui." />}</section>}
    <Dialog open={dialogCarga} onOpenChange={(aberto) => { if (!aberto) fecharDialogo(); else setDialogCarga(true); }}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] overflow-x-hidden overflow-y-auto p-4 sm:max-w-5xl sm:p-6">
        <DialogHeader><DialogTitle>{cargaEmEdicao ? "Editar romaneio de carga" : "Novo romaneio de carga"}</DialogTitle><DialogDescription>Informe as toras recebidas; valores e frete são calculados automaticamente.</DialogDescription></DialogHeader>
        <div className="space-y-5">
          {detalheCarga.isLoading && cargaEmEdicao ? <Carregando /> : <>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm leading-5 text-emerald-950">O frete é informado por m³ e multiplicado pelo volume total da carga. O valor final soma o custo das toras e o frete calculado.</div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Campo label="Data da carga *"><Input type="date" value={carga.dataCarga} onChange={(evento) => setCarga((anterior) => ({ ...anterior, dataCarga: evento.target.value }))} /></Campo>
              <Campo label="Origem"><Input value={carga.origem} onChange={(evento) => setCarga((anterior) => ({ ...anterior, origem: evento.target.value }))} placeholder="Fornecedor ou fazenda" /></Campo>
              <Campo label="Responsável"><Input value={carga.responsavel} onChange={(evento) => setCarga((anterior) => ({ ...anterior, responsavel: evento.target.value }))} placeholder="Quem recebeu" /></Campo>
              <Campo label="Frete por m³ (R$)" ajuda="Ex.: R$ 30,00 × volume total"><Input aria-label="Frete por m³ (R$)" inputMode="decimal" value={carga.fretePorMetroCubico} onChange={(evento) => setCarga((anterior) => ({ ...anterior, fretePorMetroCubico: evento.target.value }))} placeholder="0,00" /></Campo>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <IndicadorCarga rotulo="Plaquetas" valor={totais.plaquetas} />
              <IndicadorCarga rotulo="Volume total" valor={`${formatarNumero(totais.volume)} m³`} />
              <IndicadorCarga rotulo="Valor das toras" valor={formatarMoeda(totais.valorProdutos)} />
              <IndicadorCarga rotulo={`Frete (${formatarMoeda(totais.fretePorMetroCubico)}/m³)`} valor={formatarMoeda(totais.frete)} />
              <IndicadorCarga rotulo="Valor total da carga" valor={formatarMoeda(totais.valorTotal)} destaque />
            </div>
            <div className="space-y-3">{carga.plaquetas.map((item, indice) => {
              const volume = volumeTora(item.diametro, item.comprimento);
              const valor = valorTora(item.diametro, item.comprimento, item.valorMetroCubico);
              return <article key={indice} className="min-w-0 overflow-hidden rounded-xl border bg-muted/15 p-4">
                <div className="mb-4 flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between"><div className="min-w-0"><p className="text-sm font-semibold">Plaqueta {indice + 1}</p><p className="text-xs leading-4 text-muted-foreground">Informe a identificação, as medidas e o custo desta tora.</p></div><Button type="button" size="sm" variant="ghost" className="shrink-0 self-start text-muted-foreground" disabled={carga.plaquetas.length === 1} onClick={() => removerPlaqueta(indice)} aria-label={`Remover plaqueta ${indice + 1}`}>Remover</Button></div>
                <div className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-2 lg:grid-cols-3">
                  <Campo label="Código *"><Input value={item.codigo} onChange={(evento) => atualizarPlaqueta(indice, "codigo", evento.target.value)} placeholder="PLQ-001" /></Campo>
                  <Campo label="Essência *"><Input value={item.madeiraNome} onChange={(evento) => atualizarPlaqueta(indice, "madeiraNome", evento.target.value)} placeholder="Ex.: Cedrinho" /></Campo>
                  <Campo label="Diâmetro (cm) *"><Input aria-label="Diâmetro (cm)" inputMode="decimal" value={item.diametro} onChange={(evento) => atualizarPlaqueta(indice, "diametro", evento.target.value)} placeholder="0,00" /></Campo>
                  <Campo label="Comprimento (m) *"><Input aria-label="Comprimento (m)" inputMode="decimal" value={item.comprimento} onChange={(evento) => atualizarPlaqueta(indice, "comprimento", evento.target.value)} placeholder="0,00" /></Campo>
                  <Campo label="Preço por m³ (R$) *"><Input aria-label="Preço por m³ (R$)" inputMode="decimal" value={item.valorMetroCubico} onChange={(evento) => atualizarPlaqueta(indice, "valorMetroCubico", evento.target.value)} placeholder="900,00" /></Campo>
                  <div className="grid min-w-0 grid-cols-2 gap-2 rounded-lg border bg-background p-3 min-[520px]:col-span-2 lg:col-span-1"><div className="min-w-0"><p className="text-[11px] leading-4 text-muted-foreground">Volume</p><p className="mt-1 break-words text-sm font-semibold tabular-nums">{formatarNumero(volume)} m³</p></div><div className="min-w-0 border-l pl-2"><p className="text-[11px] leading-4 text-muted-foreground">Valor da tora</p><p className="mt-1 break-words text-sm font-semibold tabular-nums text-emerald-700">{formatarMoeda(valor)}</p></div></div>
                </div>
              </article>;
            })}</div>
            <Button type="button" variant="outline" onClick={adicionarPlaqueta}><Plus className="mr-2 h-4 w-4" />Adicionar plaqueta</Button>
            <Campo label="Observações da carga"><Textarea value={carga.observacoes} onChange={(evento) => setCarga((anterior) => ({ ...anterior, observacoes: evento.target.value }))} placeholder="Informações gerais da carga" /></Campo>
            <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row"><Button variant="outline" onClick={fecharDialogo} disabled={salvando}>Cancelar</Button><Button onClick={salvarCarga} disabled={salvando}>{salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{cargaEmEdicao ? "Salvar alterações" : "Confirmar entrada"}</Button></div>
          </>}
        </div>
      </DialogContent>
    </Dialog>
    <Dialog open={dialogImportacao} onOpenChange={(aberto) => { setDialogImportacao(aberto); if (!aberto) { setArquivoImportacao(null); setErrosImportacao([]); } }}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] overflow-y-auto p-4 sm:max-w-2xl sm:p-6">
        <DialogHeader><DialogTitle>Importar toras por planilha</DialogTitle><DialogDescription>Crie um romaneio de carga usando uma planilha CSV compatível com Excel. Todos os dados são validados antes de qualquer entrada no estoque.</DialogDescription></DialogHeader>
        <div className="space-y-5">
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm leading-5 text-sky-950"><p className="font-medium">Formato esperado da planilha</p><p className="mt-1 text-xs">Código, essência, diâmetro em cm, comprimento em m, preço por m³ e observações opcionais. Baixe o modelo para manter os cabeçalhos corretos.</p></div>
          <Button variant="outline" size="sm" onClick={baixarModeloImportacao}><Download className="mr-2 h-4 w-4" />Baixar modelo CSV</Button>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo label="Data da carga *"><Input type="date" value={cabecalhoImportacao.dataCarga} onChange={(evento) => setCabecalhoImportacao((anterior) => ({ ...anterior, dataCarga: evento.target.value }))} /></Campo>
            <Campo label="Frete por m³ (R$)" ajuda="Ex.: R$ 30,00 × volume total"><Input inputMode="decimal" value={cabecalhoImportacao.fretePorMetroCubico} onChange={(evento) => setCabecalhoImportacao((anterior) => ({ ...anterior, fretePorMetroCubico: evento.target.value }))} placeholder="0,00" /></Campo>
            <Campo label="Origem"><Input value={cabecalhoImportacao.origem} onChange={(evento) => setCabecalhoImportacao((anterior) => ({ ...anterior, origem: evento.target.value }))} placeholder="Fornecedor ou fazenda" /></Campo>
            <Campo label="Responsável"><Input value={cabecalhoImportacao.responsavel} onChange={(evento) => setCabecalhoImportacao((anterior) => ({ ...anterior, responsavel: evento.target.value }))} placeholder="Quem recebeu" /></Campo>
          </div>
          <Campo label="Planilha CSV *" ajuda="Máximo de 200 toras e 1 MB por importação."><Input aria-label="Planilha CSV" type="file" accept=".csv,text/csv" onChange={(evento) => { setArquivoImportacao(evento.target.files?.[0] ?? null); setErrosImportacao([]); }} /></Campo>
          {arquivoImportacao && <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm"><FileSpreadsheet className="h-4 w-4 text-primary" /><span className="min-w-0 truncate">{arquivoImportacao.name}</span></div>}
          {errosImportacao.length > 0 && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3"><p className="text-sm font-medium text-destructive">Corrija a planilha antes de importar</p><ul className="mt-2 max-h-40 list-disc space-y-1 overflow-y-auto pl-5 text-xs leading-5 text-destructive">{errosImportacao.map((erro, indice) => <li key={`${erro}-${indice}`}>{erro}</li>)}</ul></div>}
          <Campo label="Observações da carga"><Textarea value={cabecalhoImportacao.observacoes} onChange={(evento) => setCabecalhoImportacao((anterior) => ({ ...anterior, observacoes: evento.target.value }))} placeholder="Informações gerais da carga importada" /></Campo>
          <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row"><Button variant="outline" onClick={() => setDialogImportacao(false)} disabled={importarPlaquetasCsv.isPending}>Cancelar</Button><Button onClick={importarArquivo} disabled={importarPlaquetasCsv.isPending}>{importarPlaquetasCsv.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Importar toras</Button></div>
        </div>
      </DialogContent>
    </Dialog>
    <AlertDialog open={Boolean(cargaParaExcluir)} onOpenChange={(aberto) => { if (!aberto && !excluindo) setCargaParaExcluir(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Excluir romaneio de carga?</AlertDialogTitle><AlertDialogDescription>Esta ação remove o romaneio <strong>{cargaParaExcluir?.numero}</strong> e todas as suas plaquetas disponíveis do estoque. Romaneios com toras já usadas na produção são protegidos e não podem ser excluídos.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={excluindo} onClick={confirmarExclusao}>{excluindo && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Excluir romaneio</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}

function IndicadorCarga({ rotulo, valor, destaque = false }: { rotulo: string; valor: React.ReactNode; destaque?: boolean }) {
  return <div className={`min-w-0 overflow-hidden rounded-lg border p-3 ${destaque ? "border-emerald-200 bg-emerald-50" : "bg-muted/40"}`}><p className="break-words text-xs leading-4 text-muted-foreground">{rotulo}</p><p className={`mt-1 break-words text-base font-bold leading-5 tabular-nums sm:text-lg ${destaque ? "text-emerald-800" : ""}`}>{valor}</p></div>;
}

function Resumo({ icone, titulo, valor, detalhe, cor }: { icone: React.ReactNode; titulo: string; valor: React.ReactNode; detalhe: string; cor: "sky" | "emerald" | "amber" | "violet" }) {
  const cores = { sky: "bg-sky-50 text-sky-700", emerald: "bg-emerald-50 text-emerald-700", amber: "bg-amber-50 text-amber-700", violet: "bg-violet-50 text-violet-700" };
  return <div className="rounded-xl border bg-card p-4 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-xs font-medium text-muted-foreground">{titulo}</p><p className="mt-2 text-2xl font-bold tracking-tight">{valor}</p><p className="mt-1 text-xs text-muted-foreground">{detalhe}</p></div><div className={`rounded-lg p-2.5 ${cores[cor]}`}>{icone}</div></div></div>;
}

function Carregando() { return <div className="py-12 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Carregando estoque...</div>; }
function Vazio({ icone, texto }: { icone: React.ReactNode; texto: string }) { return <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center text-sm text-muted-foreground"><div className="rounded-full bg-muted p-3">{icone}</div><p>{texto}</p></div>; }
