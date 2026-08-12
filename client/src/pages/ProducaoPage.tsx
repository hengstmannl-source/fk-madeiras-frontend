import { useMemo, useState, type ReactNode } from "react";
import { BarChart3, ChevronLeft, Download, Factory, FileSpreadsheet, FileText, Layers3, Loader2, Plus, Scissors, TreePine, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type ItemForm = { madeiraNome: string; espessura: string; largura: string; comprimento: string; quantidade: string };
type ToraForm = { plaquetaId: string; codigo: string; madeiraNome: string; diametro: string; comprimento: string; volume: string };
type RomaneioForm = { toras: ToraForm[]; dataProducao: string; fita: string; responsavel: string; observacoes: string; itens: ItemForm[] };

const hoje = () => new Date().toISOString().slice(0, 10);
const num = (valor: string | number | null | undefined) => Number(String(valor ?? "").replace(",", ".")) || 0;
const formatarNumero = (valor: number | string, casas = 3) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: casas }).format(Number(valor ?? 0));
const formatarData = (valor: string | Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(valor));
const novoItem = (madeiraNome = ""): ItemForm => ({ madeiraNome, espessura: "", largura: "", comprimento: "", quantidade: "" });
const novoRomaneio = (): RomaneioForm => ({ toras: [], dataProducao: hoje(), fita: "", responsavel: "", observacoes: "", itens: [novoItem()] });
const calcularVolumePecas = (espessura: string | number, largura: string | number, comprimento: string | number) => (num(espessura) * num(largura) * num(comprimento)) / 10000;
const calcularVolumeTora = (diametro: string | number, comprimento: string | number) => Math.PI * (num(diametro) / 200) ** 2 * num(comprimento);
const calcularItem = (item: ItemForm) => ({ quantidade: num(item.quantidade), metrosLineares: num(item.comprimento) * num(item.quantidade), volume: calcularVolumePecas(item.espessura, item.largura, num(item.comprimento) * num(item.quantidade)) });
const normalizarCodigo = (codigo: string) => codigo.trim().toLocaleUpperCase("pt-BR").replace(/\s+/g, "-");
const baixarCsv = (conteudo: string, nomeArquivo: string) => {
  const url = URL.createObjectURL(new Blob([conteudo], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export default function ProducaoPage() {
  const [dialogRomaneio, setDialogRomaneio] = useState(false);
  const [etapa, setEtapa] = useState<"toras" | "pecas">("toras");
  const [codigoPlaqueta, setCodigoPlaqueta] = useState("");
  const [dialogImportacao, setDialogImportacao] = useState(false);
  const [arquivoImportacao, setArquivoImportacao] = useState<File | null>(null);
  const [errosImportacao, setErrosImportacao] = useState<string[]>([]);
  const [romaneio, setRomaneio] = useState<RomaneioForm>(novoRomaneio);
  const utils = trpc.useUtils();
  const plaquetas = trpc.producao.plaquetas.list.useQuery({ busca: codigoPlaqueta.trim() ? normalizarCodigo(codigoPlaqueta) : undefined, limite: 10 });
  const romaneios = trpc.producao.romaneios.list.useQuery();
  const estoque = trpc.producao.estoque.resumo.useQuery();
  const confirmarRomaneio = trpc.producao.romaneios.confirmar.useMutation();
  const modeloTorasCsv = trpc.producao.romaneios.modeloTorasCsv.useQuery(undefined, { enabled: false });
  const importarTorasCsv = trpc.producao.romaneios.importarTorasCsv.useMutation();
  const torasDisponiveis = useMemo(() => (plaquetas.data?.itens ?? []).filter((item: any) => item.estado === "disponivel"), [plaquetas.data]);
  const totalToras = useMemo(() => romaneio.toras.reduce((total, tora) => total + num(tora.volume), 0), [romaneio.toras]);
  const totaisPecas = useMemo(() => romaneio.itens.reduce((total, item) => {
    const calculo = calcularItem(item);
    return { pecas: total.pecas + calculo.quantidade, metrosLineares: total.metrosLineares + calculo.metrosLineares, volume: total.volume + calculo.volume };
  }, { pecas: 0, metrosLineares: 0, volume: 0 }), [romaneio.itens]);
  const aproveitamento = totalToras > 0 ? (totaisPecas.volume / totalToras) * 100 : 0;
  const resumoEssencias = useMemo(() => {
    const totais = new Map<string, number>();
    romaneio.toras.forEach((tora) => totais.set(tora.madeiraNome.trim() || "Sem essência", (totais.get(tora.madeiraNome.trim() || "Sem essência") ?? 0) + num(tora.volume)));
    return Array.from(totais.entries());
  }, [romaneio.toras]);

  const invalidar = () => {
    utils.producao.plaquetas.list.invalidate();
    utils.producao.romaneios.list.invalidate();
    utils.producao.estoque.resumo.invalidate();
  };
  const abrirRomaneio = () => { setEtapa("toras"); setCodigoPlaqueta(""); setRomaneio(novoRomaneio()); setDialogRomaneio(true); };
  const abrirImportacao = () => { setArquivoImportacao(null); setErrosImportacao([]); setDialogImportacao(true); };
  const baixarModeloImportacao = async () => {
    const resposta = await modeloTorasCsv.refetch();
    if (!resposta.data) { toast.error("Não foi possível gerar o modelo de planilha"); return; }
    baixarCsv(resposta.data, "modelo-plaquetas-producao-fk-madeiras.csv");
    toast.success("Modelo de planilha baixado");
  };
  const importarArquivo = async () => {
    if (!arquivoImportacao) { toast.error("Selecione uma planilha CSV para importar"); return; }
    try {
      const conteudo = await arquivoImportacao.text();
      importarTorasCsv.mutate({ conteudo }, {
        onSuccess: (resultado) => {
          if (resultado.erros.length) { setErrosImportacao(resultado.erros); toast.error("A importação foi recusada. Revise as linhas indicadas."); return; }
          const idsAtuais = new Set(romaneio.toras.map((tora) => tora.plaquetaId));
          const repetidas = resultado.toras.filter((tora) => idsAtuais.has(String(tora.plaquetaId)));
          if (repetidas.length) { setErrosImportacao(repetidas.map((tora) => `A plaqueta ${tora.codigo} já foi adicionada ao romaneio atual`)); toast.error("A planilha contém plaquetas já adicionadas ao romaneio."); return; }
          setRomaneio((atual) => {
            const novasToras = resultado.toras.map((tora) => ({ ...tora, plaquetaId: String(tora.plaquetaId) }));
            const primeiraEssencia = novasToras[0]?.madeiraNome ?? "";
            return { ...atual, toras: [...atual.toras, ...novasToras], itens: atual.itens.map((item) => item.madeiraNome ? item : { ...item, madeiraNome: primeiraEssencia }) };
          });
          setDialogImportacao(false);
          setArquivoImportacao(null);
          setErrosImportacao([]);
          toast.success(`${resultado.toras.length} plaqueta(s) adicionada(s) ao romaneio`);
        },
        onError: (erro) => toast.error(erro.message),
      });
    } catch { toast.error("Não foi possível ler o arquivo selecionado"); }
  };
  const adicionarTora = () => {
    const codigoNormalizado = normalizarCodigo(codigoPlaqueta);
    if (!codigoNormalizado) { toast.error("Digite o código da plaqueta"); return; }
    const plaqueta: any = torasDisponiveis.find((item: any) => normalizarCodigo(item.codigo) === codigoNormalizado);
    if (!plaqueta) { toast.error("Plaqueta não encontrada ou indisponível. Confira o código digitado."); return; }
    if (romaneio.toras.some((tora) => tora.plaquetaId === String(plaqueta.id))) {
      toast.error("Essa plaqueta já foi adicionada ao romaneio diário");
      return;
    }
    const tora: ToraForm = {
      plaquetaId: String(plaqueta.id),
      codigo: plaqueta.codigo,
      madeiraNome: plaqueta.madeiraNome ?? "",
      diametro: String(plaqueta.diametro ?? ""),
      comprimento: String(plaqueta.comprimento ?? ""),
      volume: String(plaqueta.volumeDisponivel ?? plaqueta.volumeInicial ?? ""),
    };
    setRomaneio((atual) => ({ ...atual, toras: [...atual.toras, tora], itens: atual.itens.map((item) => item.madeiraNome ? item : { ...item, madeiraNome: tora.madeiraNome }) }));
    setCodigoPlaqueta("");
  };
  const atualizarTora = (indice: number, campo: keyof ToraForm, valor: string) => setRomaneio((atual) => ({ ...atual, toras: atual.toras.map((tora, posicao) => posicao === indice ? { ...tora, [campo]: valor } : tora) }));
  const removerTora = (indice: number) => setRomaneio((atual) => ({ ...atual, toras: atual.toras.filter((_, posicao) => posicao !== indice) }));
  const usarVolumeCalculado = (indice: number) => setRomaneio((atual) => ({ ...atual, toras: atual.toras.map((tora, posicao) => posicao === indice ? { ...tora, volume: calcularVolumeTora(tora.diametro, tora.comprimento).toFixed(6) } : tora) }));
  const atualizarItem = (indice: number, campo: keyof ItemForm, valor: string) => setRomaneio((atual) => ({ ...atual, itens: atual.itens.map((item, posicao) => posicao === indice ? { ...item, [campo]: valor } : item) }));
  const salvarRomaneio = () => confirmarRomaneio.mutate({
    ...romaneio,
    toras: romaneio.toras.map((tora) => ({ plaquetaId: Number(tora.plaquetaId), tora: { madeiraNome: tora.madeiraNome, diametro: tora.diametro || null, comprimento: tora.comprimento || null, volume: tora.volume } })),
    itens: romaneio.itens.map((item) => ({ ...item, quantidade: Number(item.quantidade) })),
  }, {
    onSuccess: (resultado) => { toast.success(`${resultado.numero} confirmado · aproveitamento de ${formatarNumero(resultado.aproveitamento, 2)}%`); setDialogRomaneio(false); invalidar(); },
    onError: (erro) => toast.error(erro.message),
  });

  return <div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Chão de fábrica</p><h1 className="mt-1 text-2xl font-bold tracking-tight">Produção diária</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Registre todas as plaquetas serradas no dia, ajuste as medidas efetivas e informe as peças produzidas para acompanhar o aproveitamento real.</p></div><Button onClick={abrirRomaneio}><Scissors className="mr-2 h-4 w-4" />Nova produção diária</Button></header>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Resumo icon={<TreePine />} titulo="Toras disponíveis" valor={torasDisponiveis.length} detalhe="Prontas para serragem" cor="emerald" /><Resumo icon={<Factory />} titulo="Romaneios" valor={(romaneios.data ?? []).length} detalhe="Produção confirmada" cor="sky" /><Resumo icon={<Layers3 />} titulo="Peças em estoque" valor={(estoque.data ?? []).reduce((total: number, item: any) => total + item.quantidadeDisponivel, 0)} detalhe="Disponíveis para entrega" cor="amber" /><Resumo icon={<BarChart3 />} titulo="Volume serrado" valor={`${formatarNumero((estoque.data ?? []).reduce((total: number, item: any) => total + item.volumeDisponivel, 0))} m³`} detalhe="Saldo por dimensões" cor="violet" /></div>
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm"><Cabecalho titulo="Romaneios diários" texto="Cada romaneio consolida as toras serradas, as peças produzidas e o aproveitamento do dia." acao={<Button size="sm" onClick={abrirRomaneio}><Plus className="mr-1.5 h-3.5 w-3.5" />Nova produção</Button>} />{romaneios.isLoading ? <Carregando /> : romaneios.data?.length ? <TabelaRomaneios romaneios={romaneios.data} /> : <Vazio icone={<Scissors />} texto="Nenhuma produção diária confirmada. Primeiro, registre as toras em Estoque." />}</section>

    <Dialog open={dialogRomaneio} onOpenChange={setDialogRomaneio}><DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-6xl overflow-y-auto"><DialogHeader><DialogTitle>Romaneio de produção diária</DialogTitle><DialogDescription>Informe as toras serradas e as peças produzidas para calcular o aproveitamento diário.</DialogDescription></DialogHeader><div className="space-y-5"><div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">Adicione as plaquetas serradas no dia. Os dados do estoque são sugeridos, mas podem ser corrigidos neste romaneio para representar o volume efetivamente aproveitado.</div><Tabs value={etapa} onValueChange={(valor) => setEtapa(valor as typeof etapa)}><TabsList className="grid w-full grid-cols-2"><TabsTrigger value="toras">1. Toras serradas</TabsTrigger><TabsTrigger value="pecas" disabled={!romaneio.toras.length}>2. Peças produzidas</TabsTrigger></TabsList></Tabs>
      {etapa === "toras" ? <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Campo label="Data da produção *"><Input type="date" value={romaneio.dataProducao} onChange={(e) => setRomaneio({ ...romaneio, dataProducao: e.target.value })} /></Campo><Campo label="Fita / linha"><Input value={romaneio.fita} onChange={(e) => setRomaneio({ ...romaneio, fita: e.target.value })} placeholder="Ex.: Fita 1" /></Campo><Campo label="Responsável"><Input value={romaneio.responsavel} onChange={(e) => setRomaneio({ ...romaneio, responsavel: e.target.value })} placeholder="Nome do responsável" /></Campo><Campo label="Toras no romaneio"><div className="flex h-9 items-center rounded-md border bg-muted/20 px-3 text-sm font-semibold">{romaneio.toras.length} plaqueta(s)</div></Campo></div>
        <div className="rounded-xl border bg-muted/20 p-4"><div className="grid gap-3 md:grid-cols-[1fr_auto_auto]"><Campo label="Código da plaqueta"><Input aria-label="Código da plaqueta" value={codigoPlaqueta} onChange={(evento) => setCodigoPlaqueta(evento.target.value)} onKeyDown={(evento) => { if (evento.key === "Enter") { evento.preventDefault(); adicionarTora(); } }} placeholder="Digite a plaqueta, ex.: TOR-0008" autoComplete="off" /><p className="text-xs text-muted-foreground">Digite o código e pressione Enter. As medidas registradas no Estoque serão preenchidas automaticamente e continuarão editáveis.</p>{codigoPlaqueta.trim() && !plaquetas.isLoading && <p className={`text-xs ${torasDisponiveis.some((item: any) => normalizarCodigo(item.codigo) === normalizarCodigo(codigoPlaqueta)) ? "text-emerald-700" : "text-amber-700"}`}>{torasDisponiveis.some((item: any) => normalizarCodigo(item.codigo) === normalizarCodigo(codigoPlaqueta)) ? "Plaqueta disponível encontrada. Pressione Enter para adicionar." : "Aguardando uma plaqueta disponível com este código."}</p>}</Campo><Button className="self-end" type="button" onClick={adicionarTora} disabled={!codigoPlaqueta.trim()}><Plus className="mr-1.5 h-4 w-4" />Adicionar tora</Button><Button className="self-end" type="button" variant="outline" onClick={abrirImportacao}><Upload className="mr-1.5 h-4 w-4" />Importar planilha</Button></div></div>
        {romaneio.toras.length ? <div className="space-y-3">{romaneio.toras.map((tora, indice) => { const volumePelasMedidas = calcularVolumeTora(tora.diametro, tora.comprimento); return <div key={tora.plaquetaId} className="rounded-xl border p-4"><div className="mb-3 flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold">{tora.codigo} <span className="font-normal text-muted-foreground">· tora {indice + 1}</span></p><p className="text-xs text-muted-foreground">Ajuste as medidas se a serragem aproveitou menos madeira que a medida registrada no estoque.</p></div><Button type="button" size="sm" variant="ghost" className="text-rose-700 hover:text-rose-800" onClick={() => removerTora(indice)}><X className="mr-1 h-4 w-4" />Remover</Button></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Campo label="Essência *"><Input value={tora.madeiraNome} onChange={(e) => atualizarTora(indice, "madeiraNome", e.target.value)} /></Campo><Campo label="Diâmetro (cm)"><Input inputMode="decimal" value={tora.diametro} onChange={(e) => atualizarTora(indice, "diametro", e.target.value)} /></Campo><Campo label="Comprimento (m)"><Input inputMode="decimal" value={tora.comprimento} onChange={(e) => atualizarTora(indice, "comprimento", e.target.value)} /></Campo><Campo label="Volume efetivo (m³) *"><Input inputMode="decimal" value={tora.volume} onChange={(e) => atualizarTora(indice, "volume", e.target.value)} /></Campo></div>{volumePelasMedidas > 0 && <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground"><span>Volume cilíndrico pelas medidas: <strong className="text-foreground">{formatarNumero(volumePelasMedidas)} m³</strong></span><Button type="button" size="sm" variant="outline" onClick={() => usarVolumeCalculado(indice)}>Usar cálculo</Button></div>}</div>; })}</div> : <Vazio icone={<TreePine />} texto="Digite ou importe ao menos uma plaqueta disponível do estoque para iniciar o romaneio do dia." />}
        {romaneio.toras.length > 0 && <><div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Resultado das toras serradas</p><div className="mt-2 flex flex-wrap gap-x-5 gap-y-1"><strong className="text-xl text-emerald-950">{formatarNumero(totalToras)} m³</strong>{resumoEssencias.map(([essencia, volume]) => <span key={essencia} className="text-sm text-emerald-900">{formatarNumero(volume)} m³ de {essencia}</span>)}</div></div><div className="flex justify-end"><Button onClick={() => setEtapa("pecas")} disabled={romaneio.toras.some((tora) => !tora.madeiraNome.trim() || num(tora.volume) <= 0)}>Continuar para peças</Button></div></>}</div> : <div className="space-y-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><p className="font-semibold">Romaneio de madeira serrada</p><p className="text-xs text-muted-foreground">Informe as bitolas e a quantidade de peças produzidas no dia. O volume é calculado automaticamente.</p></div><Button type="button" variant="outline" size="sm" onClick={() => setRomaneio((atual) => ({ ...atual, itens: [...atual.itens, novoItem(atual.toras[0]?.madeiraNome ?? "") ] }))}><Plus className="mr-1 h-3.5 w-3.5" />Adicionar bitola</Button></div><div className="space-y-3">{romaneio.itens.map((item, indice) => { const calculo = calcularItem(item); return <div key={indice} className="rounded-xl border p-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.3fr_.8fr_.8fr_.8fr_.7fr_auto]"><Campo label="Essência"><Input value={item.madeiraNome} onChange={(e) => atualizarItem(indice, "madeiraNome", e.target.value)} /></Campo><Campo label="Espessura (cm)"><Input inputMode="decimal" value={item.espessura} onChange={(e) => atualizarItem(indice, "espessura", e.target.value)} /></Campo><Campo label="Largura (cm)"><Input inputMode="decimal" value={item.largura} onChange={(e) => atualizarItem(indice, "largura", e.target.value)} /></Campo><Campo label="Comprimento (m)"><Input inputMode="decimal" value={item.comprimento} onChange={(e) => atualizarItem(indice, "comprimento", e.target.value)} /></Campo><Campo label="Quantidade"><Input inputMode="numeric" value={item.quantidade} onChange={(e) => atualizarItem(indice, "quantidade", e.target.value)} /></Campo><div className="flex items-end">{romaneio.itens.length > 1 && <Button type="button" size="icon" variant="outline" className="text-rose-700" onClick={() => setRomaneio((atual) => ({ ...atual, itens: atual.itens.filter((_, posicao) => posicao !== indice) }))}><X className="h-4 w-4" /></Button>}</div></div><p className="mt-3 text-sm text-muted-foreground">Volume da bitola: <strong className="text-foreground">{formatarNumero(calculo.volume)} m³</strong> · {formatarNumero(calculo.metrosLineares)} m lineares</p></div>; })}</div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Indicador texto="Toras serradas" valor={`${formatarNumero(totalToras)} m³`} destaque="primary" /><Indicador texto="Peças" valor={totaisPecas.pecas} /><Indicador texto="M. lineares" valor={`${formatarNumero(totaisPecas.metrosLineares)} m`} /><Indicador texto="Madeira serrada" valor={`${formatarNumero(totaisPecas.volume)} m³`} /><Indicador texto="Aproveitamento" valor={`${formatarNumero(aproveitamento, 2)}%`} destaque={aproveitamento > 100 ? "destructive" : "primary"} /></div><Campo label="Observações"><Textarea value={romaneio.observacoes} onChange={(e) => setRomaneio({ ...romaneio, observacoes: e.target.value })} /></Campo><div className="flex justify-between gap-2"><Button variant="outline" onClick={() => setEtapa("toras")}><ChevronLeft className="mr-1.5 h-4 w-4" />Voltar</Button><Acoes cancelar={() => setDialogRomaneio(false)} confirmar={salvarRomaneio} carregando={confirmarRomaneio.isPending} texto="Confirmar romaneio" /></div></div>}</div></DialogContent></Dialog>
    <Dialog open={dialogImportacao} onOpenChange={(aberto) => { setDialogImportacao(aberto); if (!aberto) { setArquivoImportacao(null); setErrosImportacao([]); } }}><DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] overflow-y-auto p-4 sm:max-w-2xl sm:p-6"><DialogHeader><DialogTitle>Importar plaquetas para produção</DialogTitle><DialogDescription>Carregue um CSV de plaquetas cadastradas e revise as medidas antes de confirmar o romaneio.</DialogDescription></DialogHeader><div className="space-y-5"><div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm leading-5 text-sky-950"><p className="font-medium">Use as plaquetas já cadastradas no Estoque</p><p className="mt-1 text-xs">A coluna <strong>plaqueta</strong> é obrigatória. Essência, diâmetro, comprimento e volume são opcionais: quando vazios, o sistema preenche as medidas do estoque. Você ainda pode revisar tudo antes de continuar para as peças.</p></div><Button variant="outline" size="sm" onClick={baixarModeloImportacao}><Download className="mr-2 h-4 w-4" />Baixar modelo CSV</Button><Campo label="Planilha CSV *"><Input aria-label="Planilha CSV de produção" type="file" accept=".csv,text/csv" onChange={(evento) => { setArquivoImportacao(evento.target.files?.[0] ?? null); setErrosImportacao([]); }} /><p className="text-xs text-muted-foreground">Máximo de 200 plaquetas e 1 MB por importação.</p></Campo>{arquivoImportacao && <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm"><FileSpreadsheet className="h-4 w-4 text-primary" /><span className="min-w-0 truncate">{arquivoImportacao.name}</span></div>}{errosImportacao.length > 0 && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3"><p className="text-sm font-medium text-destructive">Corrija a planilha antes de importar</p><ul className="mt-2 max-h-40 list-disc space-y-1 overflow-y-auto pl-5 text-xs leading-5 text-destructive">{errosImportacao.map((erro, indice) => <li key={`${erro}-${indice}`}>{erro}</li>)}</ul></div>}<div className="flex flex-col-reverse justify-end gap-2 sm:flex-row"><Button variant="outline" onClick={() => setDialogImportacao(false)} disabled={importarTorasCsv.isPending}>Cancelar</Button><Button onClick={importarArquivo} disabled={importarTorasCsv.isPending}>{importarTorasCsv.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Importar plaquetas</Button></div></div></DialogContent></Dialog>
  </div>;
}

function Campo({ label, children }: { label: string; children: ReactNode }) { return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>; }
function Cabecalho({ titulo, texto, acao }: { titulo: string; texto: string; acao?: ReactNode }) { return <div className="flex flex-col gap-3 border-b bg-muted/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">{titulo}</h2><p className="mt-0.5 text-xs text-muted-foreground">{texto}</p></div>{acao}</div>; }
function Resumo({ icon, titulo, valor, detalhe, cor }: { icon: ReactNode; titulo: string; valor: ReactNode; detalhe: string; cor: string }) { const cores: Record<string, string> = { emerald: "bg-emerald-50 text-emerald-700", sky: "bg-sky-50 text-sky-700", amber: "bg-amber-50 text-amber-700", violet: "bg-violet-50 text-violet-700" }; return <div className="rounded-xl border bg-card p-4 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-xs text-muted-foreground">{titulo}</p><p className="mt-1 text-xl font-bold">{valor}</p></div><div className={`rounded-lg p-2 ${cores[cor]}`}>{icon}</div></div><p className="mt-2 text-xs text-muted-foreground">{detalhe}</p></div>; }
function Indicador({ texto, valor, destaque }: { texto: string; valor: ReactNode; destaque?: string }) { return <div className={`min-w-0 rounded-lg border p-3 ${destaque === "destructive" ? "border-rose-200 bg-rose-50" : destaque ? "border-primary/20 bg-primary/5" : "bg-muted/20"}`}><p className="text-xs text-muted-foreground">{texto}</p><p className="mt-1 break-words font-semibold">{valor}</p></div>; }
function Acoes({ cancelar, confirmar, carregando, texto }: { cancelar: () => void; confirmar: () => void; carregando: boolean; texto: string }) { return <div className="flex gap-2"><Button variant="outline" onClick={cancelar} disabled={carregando}>Cancelar</Button><Button onClick={confirmar} disabled={carregando}>{carregando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{texto}</Button></div>; }
function Carregando() { return <div className="py-12 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Carregando...</div>; }
function Vazio({ icone, texto }: { icone: ReactNode; texto: string }) { return <div className="flex flex-col items-center gap-3 py-10 text-center text-muted-foreground"><div className="rounded-full bg-muted p-3">{icone}</div><p className="max-w-sm text-sm">{texto}</p></div>; }
function TabelaRomaneios({ romaneios }: { romaneios: any[] }) { return <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Romaneio</TableHead><TableHead>Data / toras</TableHead><TableHead>Produção</TableHead><TableHead>Aproveitamento</TableHead><TableHead className="text-right">Documento</TableHead></TableRow></TableHeader><TableBody>{romaneios.map((item) => <TableRow key={item.id}><TableCell><p className="font-medium">{item.numero}</p><p className="text-xs text-muted-foreground">{item.fita ?? "Sem fita"}</p></TableCell><TableCell><p>{formatarData(item.dataProducao)} · {item.totalToras ?? 1} tora(s)</p><p className="text-xs text-muted-foreground">{formatarNumero(item.volumeTora ?? item.volumePlaqueta)} m³ de toras</p></TableCell><TableCell><p>{item.totalPecas} peças</p><p className="text-xs text-muted-foreground">{formatarNumero(item.volumeProduzido)} m³</p></TableCell><TableCell><Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">{formatarNumero(item.aproveitamento ?? 0, 2)}%</Badge></TableCell><TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => window.open(`/api/pdf/romaneio/${item.id}`, "_blank", "noopener,noreferrer")}><FileText className="mr-1.5 h-3.5 w-3.5" />PDF</Button></TableCell></TableRow>)}</TableBody></Table></div>; }
