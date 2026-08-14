import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, BarChart3, ChevronLeft, Download, Factory, FileSpreadsheet, FileText, Layers3, Loader2, Plus, Scissors, Trash2, TreePine, Upload, X } from "lucide-react";
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
import { criarLinhasComprimentoVazias, type LinhaComprimentoVenda } from "@/lib/vendaItemGroup";

type ItemForm = { madeiraNome: string; espessura: string; largura: string; comprimento: string; quantidade: string };
type GrupoPecasForm = { madeiraNome: string; espessura: string; largura: string };
type LinhaComprimento = LinhaComprimentoVenda;
type ToraForm = { plaquetaId: string; codigo: string; madeiraNome: string; diametro: string; comprimento: string; volume: string; origem: "estoque" | "entrada_imediata"; exigeConferenciaManual: boolean };
type RomaneioForm = { toras: ToraForm[]; dataProducao: string; fita: string; responsavel: string; observacoes: string; itens: ItemForm[] };

const hoje = () => new Date().toISOString().slice(0, 10);
const num = (valor: string | number | null | undefined) => Number(String(valor ?? "").replace(",", ".")) || 0;
const formatarNumero = (valor: number | string, casas = 3) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: casas }).format(Number(valor ?? 0));
const formatarData = (valor: string | Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(valor));
const novoItem = (madeiraNome = ""): ItemForm => ({ madeiraNome, espessura: "", largura: "", comprimento: "", quantidade: "" });
const novoGrupoPecas = (madeiraNome = ""): GrupoPecasForm => ({ madeiraNome, espessura: "", largura: "" });
const novoRomaneio = (): RomaneioForm => ({ toras: [], dataProducao: hoje(), fita: "", responsavel: "", observacoes: "", itens: [] });
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
  const [dialogImportacaoPecas, setDialogImportacaoPecas] = useState(false);
  const [arquivoImportacaoPecas, setArquivoImportacaoPecas] = useState<File | null>(null);
  const [errosImportacaoPecas, setErrosImportacaoPecas] = useState<string[]>([]);
  const [romaneio, setRomaneio] = useState<RomaneioForm>(novoRomaneio);
  const [romaneioEmEdicaoId, setRomaneioEmEdicaoId] = useState<number | null>(null);
  const [romaneioParaExcluir, setRomaneioParaExcluir] = useState<{ id: number; numero: string } | null>(null);
  const [grupoPecas, setGrupoPecas] = useState<GrupoPecasForm>(novoGrupoPecas);
  const [linhasComprimento, setLinhasComprimento] = useState<LinhaComprimento[]>(() => criarLinhasComprimentoVazias());
  const utils = trpc.useUtils();
  const plaquetas = trpc.producao.plaquetas.list.useQuery({ busca: codigoPlaqueta.trim() ? normalizarCodigo(codigoPlaqueta) : undefined, limite: 10 });
  const romaneios = trpc.producao.romaneios.list.useQuery();
  const estoque = trpc.producao.estoque.resumo.useQuery();
  const confirmarRomaneio = trpc.producao.romaneios.confirmar.useMutation();
  const atualizarRomaneio = trpc.producao.romaneios.update.useMutation();
  const excluirRomaneio = trpc.producao.romaneios.excluir.useMutation();
  const modeloTorasCsv = trpc.producao.romaneios.modeloTorasCsv.useQuery(undefined, { enabled: false });
  const importarTorasCsv = trpc.producao.romaneios.importarTorasCsv.useMutation();
  const modeloPecasCsv = trpc.producao.romaneios.modeloPecasCsv.useQuery(undefined, { enabled: false });
  const importarPecasCsv = trpc.producao.romaneios.importarPecasCsv.useMutation();
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
  const abrirRomaneio = () => { setRomaneioEmEdicaoId(null); setEtapa("toras"); setCodigoPlaqueta(""); setGrupoPecas(novoGrupoPecas()); setLinhasComprimento(criarLinhasComprimentoVazias()); setRomaneio(novoRomaneio()); setDialogRomaneio(true); };
  const abrirEdicaoRomaneio = async (id: number) => {
    try {
      const detalhe: any = await utils.producao.romaneios.detalhe.fetch({ id });
      const dataProducao = new Date(detalhe.romaneio.dataProducao).toISOString().slice(0, 10);
      const toras: ToraForm[] = (detalhe.toras ?? []).map((tora: any) => ({
        plaquetaId: String(tora.plaquetaId), codigo: tora.codigo ?? tora.plaquetaCodigo ?? `Plaqueta ${tora.plaquetaId}`,
        madeiraNome: String(tora.madeiraNome ?? ""), diametro: String(tora.diametro ?? ""), comprimento: String(tora.comprimento ?? ""),
        volume: String(tora.volume ?? ""), origem: "estoque" as const, exigeConferenciaManual: Boolean(tora.medidasConferidasManual),
      }));
      const itens: ItemForm[] = (detalhe.itens ?? []).map((item: any) => ({ madeiraNome: String(item.madeiraNome ?? ""), espessura: String(item.espessura ?? ""), largura: String(item.largura ?? ""), comprimento: String(item.comprimento ?? ""), quantidade: String(item.quantidade ?? "") }));
      setRomaneio({ toras, dataProducao, fita: detalhe.romaneio.fita ?? "", responsavel: detalhe.romaneio.responsavel ?? "", observacoes: detalhe.romaneio.observacoes ?? "", itens });
      const ultimoItem = itens.at(-1);
      setGrupoPecas(ultimoItem ? { madeiraNome: ultimoItem.madeiraNome, espessura: ultimoItem.espessura, largura: ultimoItem.largura } : novoGrupoPecas(toras[0]?.madeiraNome ?? ""));
      setLinhasComprimento(criarLinhasComprimentoVazias());
      setRomaneioEmEdicaoId(id); setCodigoPlaqueta(""); setEtapa("pecas"); setDialogRomaneio(true);
    } catch (erro: any) { toast.error(erro.message ?? "Não foi possível abrir o romaneio para edição"); }
  };
  const abrirImportacao = () => { setArquivoImportacao(null); setErrosImportacao([]); setDialogImportacao(true); };
  const abrirImportacaoPecas = () => { setArquivoImportacaoPecas(null); setErrosImportacaoPecas([]); setDialogImportacaoPecas(true); };
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
          const codigosAtuais = new Set(romaneio.toras.map((tora) => normalizarCodigo(tora.codigo)));
          const repetidas = resultado.toras.filter((tora) => codigosAtuais.has(normalizarCodigo(tora.codigo)));
          if (repetidas.length) { setErrosImportacao(repetidas.map((tora) => `A plaqueta ${tora.codigo} já foi adicionada ao romaneio atual`)); toast.error("A planilha contém plaquetas já adicionadas ao romaneio."); return; }
          setRomaneio((atual) => {
            const novasToras: ToraForm[] = resultado.toras.map((tora: any) => ({ ...tora, plaquetaId: tora.plaquetaId ? String(tora.plaquetaId) : "", origem: tora.origem, exigeConferenciaManual: Boolean(tora.exigeConferenciaManual) }));
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
  const baixarModeloPecas = async () => {
    const resposta = await modeloPecasCsv.refetch();
    if (!resposta.data) { toast.error("Não foi possível gerar o modelo de planilha"); return; }
    baixarCsv(resposta.data, "modelo-pecas-serradas-producao-fk-madeiras.csv");
    toast.success("Modelo de peças baixado");
  };
  const importarArquivoPecas = async () => {
    if (!arquivoImportacaoPecas) { toast.error("Selecione uma planilha CSV para importar"); return; }
    try {
      const conteudo = await arquivoImportacaoPecas.text();
      importarPecasCsv.mutate({ conteudo }, {
        onSuccess: (resultado) => {
          if (resultado.erros.length) { setErrosImportacaoPecas(resultado.erros); toast.error("A importação foi recusada. Revise as linhas indicadas."); return; }
          const novosItens = resultado.itens.map((item) => ({ ...item, quantidade: String(item.quantidade) }));
          setRomaneio((atual) => ({ ...atual, itens: [...atual.itens, ...novosItens] }));
          const ultimoItem = novosItens.at(-1);
          if (ultimoItem) setGrupoPecas({ madeiraNome: ultimoItem.madeiraNome, espessura: ultimoItem.espessura, largura: ultimoItem.largura });
          setLinhasComprimento(criarLinhasComprimentoVazias());
          setDialogImportacaoPecas(false);
          setArquivoImportacaoPecas(null);
          setErrosImportacaoPecas([]);
          toast.success(`${novosItens.length} peça(s) adicionada(s) ao romaneio`);
        },
        onError: (erro) => toast.error(erro.message),
      });
    } catch { toast.error("Não foi possível ler o arquivo selecionado"); }
  };
  const adicionarTora = () => {
    if (romaneioEmEdicaoId) { toast.error("As toras de um romaneio confirmado permanecem bloqueadas para preservar a rastreabilidade"); return; }
    const codigoNormalizado = normalizarCodigo(codigoPlaqueta);
    if (!codigoNormalizado) { toast.error("Digite o código da plaqueta"); return; }
    if (romaneio.toras.some((tora) => normalizarCodigo(tora.codigo) === codigoNormalizado)) {
      toast.error("Essa plaqueta já foi adicionada ao romaneio diário");
      return;
    }
    const plaqueta: any = torasDisponiveis.find((item: any) => normalizarCodigo(item.codigo) === codigoNormalizado);
    if (!plaqueta) {
      const toraAvulsa: ToraForm = { plaquetaId: "", codigo: codigoNormalizado, madeiraNome: "", diametro: "", comprimento: "", volume: "", origem: "entrada_imediata", exigeConferenciaManual: false };
      setRomaneio((atual) => ({ ...atual, toras: [...atual.toras, toraAvulsa] }));
      setCodigoPlaqueta("");
      toast.message("Plaqueta não encontrada no estoque. Informe os dados para registrar a entrada e o consumo imediato.");
      return;
    }
    const exigeConferenciaManual = plaqueta.situacaoIdentificacao === "duplicada";
    const tora: ToraForm = {
      plaquetaId: String(plaqueta.id),
      codigo: plaqueta.codigoFisico ?? plaqueta.codigo,
      madeiraNome: exigeConferenciaManual ? "" : plaqueta.madeiraNome ?? "",
      diametro: exigeConferenciaManual ? "" : String(plaqueta.diametro ?? ""),
      comprimento: exigeConferenciaManual ? "" : String(plaqueta.comprimento ?? ""),
      volume: exigeConferenciaManual ? "" : String(plaqueta.volumeDisponivel ?? plaqueta.volumeInicial ?? ""),
      origem: "estoque",
      exigeConferenciaManual,
    };
    setRomaneio((atual) => ({ ...atual, toras: [...atual.toras, tora], itens: atual.itens.map((item) => item.madeiraNome ? item : { ...item, madeiraNome: tora.madeiraNome }) }));
    setCodigoPlaqueta("");
    if (exigeConferenciaManual) toast.warning("Há mais de uma tora com esta plaqueta. Preencha manualmente as medidas da tora selecionada antes de continuar.");
  };
  const atualizarTora = (indice: number, campo: keyof ToraForm, valor: string) => { if (romaneioEmEdicaoId) return; setRomaneio((atual) => ({ ...atual, toras: atual.toras.map((tora, posicao) => posicao === indice ? { ...tora, [campo]: valor } : tora) })); };
  const removerTora = (indice: number) => { if (romaneioEmEdicaoId) return; setRomaneio((atual) => ({ ...atual, toras: atual.toras.filter((_, posicao) => posicao !== indice) })); };
  const usarVolumeCalculado = (indice: number) => { if (romaneioEmEdicaoId) return; setRomaneio((atual) => ({ ...atual, toras: atual.toras.map((tora, posicao) => posicao === indice ? { ...tora, volume: calcularVolumeTora(tora.diametro, tora.comprimento).toFixed(6) } : tora) })); };
  const prepararEtapaPecas = () => {
    setGrupoPecas((atual) => atual.madeiraNome.trim() ? atual : novoGrupoPecas(romaneio.toras[0]?.madeiraNome ?? ""));
    setEtapa("pecas");
  };
  const atualizarLinhaComprimento = (id: number, campo: "comprimento" | "quantidade", valor: string) => setLinhasComprimento((linhas) => linhas.map((linha) => linha.id === id ? { ...linha, [campo]: valor } : linha));
  const adicionarLinhaComprimento = () => setLinhasComprimento((linhas) => [...linhas, { id: Math.max(0, ...linhas.map((linha) => linha.id)) + 1, comprimento: "", quantidade: "" }]);
  const removerLinhaComprimento = (id: number) => setLinhasComprimento((linhas) => linhas.length === 1 ? linhas : linhas.filter((linha) => linha.id !== id));
  const adicionarGrupoPecas = () => {
    if (!grupoPecas.madeiraNome.trim() || num(grupoPecas.espessura) <= 0 || num(grupoPecas.largura) <= 0) {
      toast.error("Informe essência, espessura e largura para a medida produzida");
      return;
    }
    const linhasPreenchidas = linhasComprimento.filter((linha) => linha.comprimento.trim() || linha.quantidade.trim());
    if (!linhasPreenchidas.length) { toast.error("Informe ao menos um comprimento e sua quantidade"); return; }
    if (linhasPreenchidas.some((linha) => num(linha.comprimento) <= 0 || !Number.isInteger(num(linha.quantidade)) || num(linha.quantidade) <= 0)) {
      toast.error("Revise os comprimentos e as quantidades preenchidas");
      return;
    }
    const itens = linhasPreenchidas.map((linha) => ({ madeiraNome: grupoPecas.madeiraNome.trim(), espessura: grupoPecas.espessura, largura: grupoPecas.largura, comprimento: linha.comprimento, quantidade: linha.quantidade }));
    setRomaneio((atual) => ({ ...atual, itens: [...atual.itens, ...itens] }));
    setLinhasComprimento(criarLinhasComprimentoVazias());
    toast.success(`${itens.length} comprimento(s) adicionado(s). A medida foi mantida para o próximo lançamento.`);
  };
  const editarBitola = (indice: number) => {
    const item = romaneio.itens[indice];
    if (!item) return;
    setGrupoPecas({ madeiraNome: item.madeiraNome, espessura: item.espessura, largura: item.largura });
    setLinhasComprimento([{ id: Date.now(), comprimento: item.comprimento, quantidade: item.quantidade }]);
    setRomaneio((atual) => ({ ...atual, itens: atual.itens.filter((_, posicao) => posicao !== indice) }));
  };
  const removerBitola = (indice: number) => setRomaneio((atual) => ({ ...atual, itens: atual.itens.filter((_, posicao) => posicao !== indice) }));
  const salvarRomaneio = () => {
    if (!romaneio.itens.length) { toast.error("Adicione ao menos uma bitola produzida antes de confirmar"); return; }
    const dadosProducao = {
      dataProducao: romaneio.dataProducao,
      fita: romaneio.fita,
      responsavel: romaneio.responsavel,
      observacoes: romaneio.observacoes,
      itens: romaneio.itens.map((item) => ({ ...item, quantidade: Number(item.quantidade) })),
    };
    const aoSalvar = (resultado: any, mensagem: string) => {
      toast.success(`${resultado.numero} ${mensagem} · aproveitamento de ${formatarNumero(resultado.aproveitamento, 2)}%`);
      setDialogRomaneio(false); setRomaneioEmEdicaoId(null); invalidar();
    };
    if (romaneioEmEdicaoId) {
      atualizarRomaneio.mutate({ id: romaneioEmEdicaoId, ...dadosProducao }, {
        onSuccess: (resultado) => aoSalvar(resultado, "atualizado"), onError: (erro) => toast.error(erro.message),
      });
      return;
    }
    confirmarRomaneio.mutate({
    ...dadosProducao,
    toras: romaneio.toras.map((tora) => tora.origem === "entrada_imediata"
      ? { novaPlaqueta: { codigo: tora.codigo }, medidasConferidasManual: tora.exigeConferenciaManual, tora: { madeiraNome: tora.madeiraNome, diametro: tora.diametro || null, comprimento: tora.comprimento || null, volume: tora.volume } }
      : { plaquetaId: Number(tora.plaquetaId), medidasConferidasManual: tora.exigeConferenciaManual, tora: { madeiraNome: tora.madeiraNome, diametro: tora.diametro || null, comprimento: tora.comprimento || null, volume: tora.volume } }),
    }, {
    onSuccess: (resultado) => aoSalvar(resultado, "confirmado"),
    onError: (erro) => toast.error(erro.message),
    });
  };
  const confirmarExclusaoRomaneio = () => {
    if (!romaneioParaExcluir) return;
    excluirRomaneio.mutate({ id: romaneioParaExcluir.id }, {
      onSuccess: (resultado) => {
        toast.success(`${resultado.numero} removido e o estoque foi revertido`);
        setRomaneioParaExcluir(null);
        invalidar();
      },
      onError: (erro) => toast.error(erro.message),
    });
  };

  return <div className="mx-auto w-full min-w-0 max-w-7xl space-y-6">
    <header className="flex flex-col items-stretch justify-between gap-4 md:flex-row md:items-end"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Chão de fábrica</p><h1 className="mt-1 text-2xl font-bold tracking-tight">Produção diária</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Registre todas as plaquetas serradas no dia, ajuste as medidas efetivas e informe as peças produzidas para acompanhar o aproveitamento real.</p></div><Button className="w-full shrink-0 md:w-auto" onClick={abrirRomaneio}><Scissors className="mr-2 h-4 w-4" />Nova produção diária</Button></header>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Resumo icon={<TreePine />} titulo="Toras disponíveis" valor={torasDisponiveis.length} detalhe="Prontas para serragem" cor="emerald" /><Resumo icon={<Factory />} titulo="Romaneios" valor={(romaneios.data ?? []).length} detalhe="Produção confirmada" cor="sky" /><Resumo icon={<Layers3 />} titulo="Peças em estoque" valor={(estoque.data ?? []).reduce((total: number, item: any) => total + item.quantidadeDisponivel, 0)} detalhe="Disponíveis para entrega" cor="amber" /><Resumo icon={<BarChart3 />} titulo="Volume serrado" valor={`${formatarNumero((estoque.data ?? []).reduce((total: number, item: any) => total + item.volumeDisponivel, 0))} m³`} detalhe="Saldo por dimensões" cor="violet" /></div>
    <section className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-sm"><Cabecalho titulo="Romaneios diários" texto="Cada romaneio consolida as toras serradas, as peças produzidas e o aproveitamento do dia." />{romaneios.isLoading ? <Carregando /> : romaneios.data?.length ? <TabelaRomaneios romaneios={romaneios.data} onEditar={abrirEdicaoRomaneio} onExcluir={(item) => setRomaneioParaExcluir({ id: item.id, numero: item.numero })} /> : <Vazio icone={<Scissors />} texto="Nenhuma produção diária confirmada. Primeiro, registre as toras em Estoque." />}</section>
    <Dialog open={Boolean(romaneioParaExcluir)} onOpenChange={(aberto) => { if (!aberto) setRomaneioParaExcluir(null); }}><DialogContent className="w-[calc(100vw-1rem)] max-w-md p-5 sm:p-6"><DialogHeader><DialogTitle>Remover produção diária?</DialogTitle><DialogDescription>Esta ação exclui o romaneio <strong>{romaneioParaExcluir?.numero}</strong>, remove as peças produzidas e devolve as plaquetas ao estoque.</DialogDescription></DialogHeader><div className="space-y-4"><div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><div className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><p>A exclusão será bloqueada se qualquer peça deste romaneio já tiver sido entregue, inventariada ou ajustada.</p></div></div><Acoes cancelar={() => setRomaneioParaExcluir(null)} confirmar={confirmarExclusaoRomaneio} carregando={excluirRomaneio.isPending} texto="Remover produção" /></div></DialogContent></Dialog>

    <Dialog open={dialogRomaneio} onOpenChange={setDialogRomaneio}><DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] min-w-0 max-w-6xl overflow-x-hidden overflow-y-auto p-4 sm:p-6"><DialogHeader className="min-w-0"><DialogTitle className="break-words">Romaneio de produção diária</DialogTitle><DialogDescription>Informe as toras serradas e as peças produzidas para calcular o aproveitamento diário.</DialogDescription></DialogHeader><div className="min-w-0 space-y-5"><div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">Adicione as plaquetas serradas no dia. Os dados do estoque são sugeridos, mas podem ser corrigidos neste romaneio para representar o volume efetivamente aproveitado.</div><Tabs value={etapa} onValueChange={(valor) => setEtapa(valor as typeof etapa)}><TabsList className="grid w-full grid-cols-2"><TabsTrigger value="toras">1. Toras serradas</TabsTrigger><TabsTrigger value="pecas" disabled={!romaneio.toras.length}>2. Peças produzidas</TabsTrigger></TabsList></Tabs>
      {etapa === "toras" ? <div className="space-y-4"><div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-4"><Campo label="Data da produção *"><Input type="date" value={romaneio.dataProducao} onChange={(e) => setRomaneio({ ...romaneio, dataProducao: e.target.value })} /></Campo><Campo label="Fita / linha"><Input value={romaneio.fita} onChange={(e) => setRomaneio({ ...romaneio, fita: e.target.value })} placeholder="Ex.: Fita 1" /></Campo><Campo label="Responsável"><Input value={romaneio.responsavel} onChange={(e) => setRomaneio({ ...romaneio, responsavel: e.target.value })} placeholder="Nome do responsável" /></Campo><Campo label="Toras no romaneio"><div className="flex h-9 items-center rounded-md border bg-muted/20 px-3 text-sm font-semibold">{romaneio.toras.length} plaqueta(s)</div></Campo></div>
        <div className="min-w-0 rounded-xl border bg-muted/20 p-3 sm:p-4"><div className="min-w-0 space-y-3"><Campo label="Código da plaqueta"><Input aria-label="Código da plaqueta" value={codigoPlaqueta} onChange={(evento) => setCodigoPlaqueta(evento.target.value)} onKeyDown={(evento) => { if (evento.key === "Enter") { evento.preventDefault(); adicionarTora(); } }} placeholder="Digite a plaqueta, ex.: TOR-0008" autoComplete="off" /><p className="text-xs text-muted-foreground">Digite o código e pressione Enter. Se ele existir, as medidas do Estoque serão preenchidas. Se não existir, informe as medidas no cartão para registrar entrada e consumo imediato.</p>{codigoPlaqueta.trim() && !plaquetas.isLoading && <p className={`text-xs ${torasDisponiveis.some((item: any) => normalizarCodigo(item.codigo) === normalizarCodigo(codigoPlaqueta)) ? "text-emerald-700" : "text-amber-700"}`}>{torasDisponiveis.some((item: any) => normalizarCodigo(item.codigo) === normalizarCodigo(codigoPlaqueta)) ? "Plaqueta disponível encontrada. Pressione Enter para adicionar." : "Plaqueta ainda não cadastrada. Pressione Enter para adicioná-la com entrada imediata."}</p>}</Campo><div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><Button className="w-full" type="button" onClick={adicionarTora} disabled={!codigoPlaqueta.trim()}><Plus className="mr-1.5 h-4 w-4" />Adicionar tora</Button><Button className="w-full" type="button" variant="outline" onClick={abrirImportacao}><Upload className="mr-1.5 h-4 w-4" />Importar planilha</Button></div></div></div>
        {romaneio.toras.length ? <div className="grid w-full min-w-0 grid-cols-1 gap-3">{romaneio.toras.map((tora, indice) => { const volumePelasMedidas = calcularVolumeTora(tora.diametro, tora.comprimento); return <div key={`${tora.plaquetaId || tora.codigo}-${indice}`} className="w-full min-w-0 rounded-xl border p-4"><div className="mb-3 flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="break-words font-semibold">{tora.codigo} <span className="font-normal text-muted-foreground">· tora {indice + 1}</span></p><p className="text-xs text-muted-foreground">Ajuste as medidas se a serragem aproveitou menos madeira que a medida registrada no estoque.</p></div><Button type="button" size="sm" variant="ghost" className="shrink-0 text-rose-700 hover:text-rose-800" onClick={() => removerTora(indice)}><X className="mr-1 h-4 w-4" />Remover</Button></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Campo label="Essência *"><Input value={tora.madeiraNome} onChange={(e) => atualizarTora(indice, "madeiraNome", e.target.value)} /></Campo><Campo label="Diâmetro (cm)"><Input inputMode="decimal" value={tora.diametro} onChange={(e) => atualizarTora(indice, "diametro", e.target.value)} /></Campo><Campo label="Comprimento (m)"><Input inputMode="decimal" value={tora.comprimento} onChange={(e) => atualizarTora(indice, "comprimento", e.target.value)} /></Campo><Campo label="Volume efetivo (m³) *"><Input inputMode="decimal" value={tora.volume} onChange={(e) => atualizarTora(indice, "volume", e.target.value)} /></Campo></div>{volumePelasMedidas > 0 && <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground"><span>Volume cilíndrico pelas medidas: <strong className="text-foreground">{formatarNumero(volumePelasMedidas)} m³</strong></span><Button type="button" size="sm" variant="outline" onClick={() => usarVolumeCalculado(indice)}>Usar cálculo</Button></div>}</div>; })}</div> : <Vazio icone={<TreePine />} texto="Digite ou importe ao menos uma plaqueta disponível do estoque para iniciar o romaneio do dia." />}
        {romaneio.toras.length > 0 && <><div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Resultado das toras serradas</p><div className="mt-2 flex flex-wrap gap-x-5 gap-y-1"><strong className="text-xl text-emerald-950">{formatarNumero(totalToras)} m³</strong>{resumoEssencias.map(([essencia, volume]) => <span key={essencia} className="text-sm text-emerald-900">{formatarNumero(volume)} m³ de {essencia}</span>)}</div></div><div className="flex justify-end"><Button onClick={prepararEtapaPecas} disabled={romaneio.toras.some((tora) => !tora.madeiraNome.trim() || num(tora.volume) <= 0)}>Continuar para peças</Button></div></>}</div> : <div className="space-y-4"><div><p className="font-semibold">Romaneio de madeira serrada</p><p className="mt-1 text-xs text-muted-foreground">Defina a essência e a medida uma vez; abaixo, preencha todos os comprimentos e as quantidades produzidas no mesmo romaneio.</p></div><section className="min-w-0 rounded-xl border bg-muted/20 p-3 sm:p-4"><div className="mb-4 flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-medium">Medida e comprimentos</p><p className="mt-1 text-xs text-muted-foreground">A medida permanece preenchida após adicionar a grade para agilizar o próximo lançamento.</p></div><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{romaneio.itens.length} comprimento(s)</Badge><Button type="button" size="sm" variant="outline" onClick={abrirImportacaoPecas}><Upload className="mr-1.5 h-4 w-4" />Importar planilha</Button></div></div><div className="grid gap-3 sm:grid-cols-3"><Campo label="Essência *"><Input aria-label="Essência da medida" value={grupoPecas.madeiraNome} onChange={(e) => setGrupoPecas({ ...grupoPecas, madeiraNome: e.target.value })} /></Campo><Campo label="Espessura (cm) *"><Input aria-label="Espessura da medida" inputMode="decimal" value={grupoPecas.espessura} onChange={(e) => setGrupoPecas({ ...grupoPecas, espessura: e.target.value })} /></Campo><Campo label="Largura (cm) *"><Input aria-label="Largura da medida" inputMode="decimal" value={grupoPecas.largura} onChange={(e) => setGrupoPecas({ ...grupoPecas, largura: e.target.value })} /></Campo></div><div className="mt-4 overflow-hidden rounded-lg border bg-background"><div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2"><div><p className="text-sm font-medium">Comprimentos do romaneio</p><p className="text-xs text-muted-foreground">Preencha cada comprimento e a quantidade de peças correspondente.</p></div><span className="text-xs text-muted-foreground">m / peças</span></div><div className="overflow-x-auto"><table className="w-full min-w-[420px] table-fixed text-sm"><thead className="bg-muted/20 text-xs text-muted-foreground"><tr><th className="w-[42%] px-3 py-2 text-left font-medium">Comprimento (m)</th><th className="w-[42%] px-3 py-2 text-left font-medium">Quantidade</th><th className="w-[16%] px-2 py-2 text-right font-medium">Ação</th></tr></thead><tbody>{linhasComprimento.map((linha, indice) => <tr key={linha.id} className="border-t border-border/50"><td className="p-2"><Input aria-label={`Comprimento da linha ${indice + 1}`} value={linha.comprimento} onChange={(e) => atualizarLinhaComprimento(linha.id, "comprimento", e.target.value)} inputMode="decimal" placeholder="Ex.: 3,00" className="h-9" /></td><td className="p-2"><Input aria-label={`Quantidade da linha ${indice + 1}`} value={linha.quantidade} onChange={(e) => atualizarLinhaComprimento(linha.id, "quantidade", e.target.value)} inputMode="numeric" placeholder="Ex.: 20" className="h-9" onKeyDown={(evento) => { if (evento.key === "Enter") { evento.preventDefault(); adicionarGrupoPecas(); } }} /></td><td className="p-2 text-right"><Button type="button" variant="ghost" size="icon" aria-label={`Remover comprimento ${indice + 1}`} disabled={linhasComprimento.length === 1} onClick={() => removerLinhaComprimento(linha.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></Button></td></tr>)}</tbody></table></div><div className="border-t bg-muted/10 px-3 py-2"><Button type="button" size="sm" variant="outline" onClick={adicionarLinhaComprimento}><Plus className="mr-1.5 h-3.5 w-3.5" />Adicionar comprimento</Button></div></div><div className="mt-4 flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">Prévia da grade: <strong className="text-foreground">{formatarNumero(linhasComprimento.reduce((total, linha) => total + calcularVolumePecas(grupoPecas.espessura, grupoPecas.largura, num(linha.comprimento) * num(linha.quantidade)), 0))} m³</strong></p><Button type="button" className="w-full sm:w-auto" onClick={adicionarGrupoPecas}><Plus className="mr-1.5 h-4 w-4" />Adicionar comprimentos ao romaneio</Button></div></section>{romaneio.itens.length ? <section className="min-w-0 space-y-2"><p className="text-sm font-medium">Comprimentos adicionados</p>{romaneio.itens.map((item, indice) => { const calculo = calcularItem(item); return <div key={`${item.madeiraNome}-${indice}`} className="flex min-w-0 flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="break-words font-medium">{item.madeiraNome || "Sem essência"} · {item.espessura || "—"} × {item.largura || "—"} cm · {item.comprimento || "—"} m</p><p className="mt-1 text-xs text-muted-foreground">{formatarNumero(calculo.quantidade)} peças · {formatarNumero(calculo.volume)} m³ · {formatarNumero(calculo.metrosLineares)} m lineares</p></div><div className="flex shrink-0 gap-2"><Button type="button" size="sm" variant="outline" onClick={() => editarBitola(indice)}>Editar</Button><Button type="button" size="sm" variant="outline" className="text-rose-700 hover:text-rose-800" onClick={() => removerBitola(indice)}><X className="mr-1 h-4 w-4" />Remover</Button></div></div>; })}</section> : <Vazio icone={<Layers3 />} texto="Nenhum comprimento adicionado. Preencha a grade acima, importe uma planilha ou use Adicionar comprimentos ao romaneio." />}<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Indicador texto="Toras serradas" valor={`${formatarNumero(totalToras)} m³`} destaque="primary" /><Indicador texto="Peças" valor={totaisPecas.pecas} /><Indicador texto="M. lineares" valor={`${formatarNumero(totaisPecas.metrosLineares)} m`} /><Indicador texto="Madeira serrada" valor={`${formatarNumero(totaisPecas.volume)} m³`} /><Indicador texto="Aproveitamento" valor={`${formatarNumero(aproveitamento, 2)}%`} destaque={aproveitamento > 100 ? "destructive" : "primary"} /></div><Campo label="Observações"><Textarea value={romaneio.observacoes} onChange={(e) => setRomaneio({ ...romaneio, observacoes: e.target.value })} /></Campo><div className="flex flex-col justify-between gap-2 sm:flex-row"><Button variant="outline" onClick={() => setEtapa("toras")}><ChevronLeft className="mr-1.5 h-4 w-4" />Voltar</Button><Acoes cancelar={() => setDialogRomaneio(false)} confirmar={salvarRomaneio} carregando={confirmarRomaneio.isPending} texto="Confirmar romaneio" /></div></div>}</div></DialogContent></Dialog>
    <Dialog open={dialogImportacao} onOpenChange={(aberto) => { setDialogImportacao(aberto); if (!aberto) { setArquivoImportacao(null); setErrosImportacao([]); } }}><DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] overflow-y-auto p-4 sm:max-w-2xl sm:p-6"><DialogHeader><DialogTitle>Importar plaquetas para produção</DialogTitle><DialogDescription>Carregue um CSV, revise as medidas e confirme o romaneio.</DialogDescription></DialogHeader><div className="space-y-5"><div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm leading-5 text-sky-950"><p className="font-medium">Use plaquetas do Estoque ou dê entrada imediata</p><p className="mt-1 text-xs">A coluna <strong>plaqueta</strong> é obrigatória. Para uma plaqueta existente, os campos vazios são preenchidos pelo Estoque. Para um código novo, informe pelo menos <strong>essência</strong> e <strong>volume</strong>: a entrada e o consumo serão registrados ao confirmar o romaneio.</p></div><Button variant="outline" size="sm" onClick={baixarModeloImportacao}><Download className="mr-2 h-4 w-4" />Baixar modelo CSV</Button><Campo label="Planilha CSV *"><Input aria-label="Planilha CSV de produção" type="file" accept=".csv,text/csv" onChange={(evento) => { setArquivoImportacao(evento.target.files?.[0] ?? null); setErrosImportacao([]); }} /><p className="text-xs text-muted-foreground">Máximo de 200 plaquetas e 1 MB por importação.</p></Campo>{arquivoImportacao && <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm"><FileSpreadsheet className="h-4 w-4 text-primary" /><span className="min-w-0 truncate">{arquivoImportacao.name}</span></div>}{errosImportacao.length > 0 && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3"><p className="text-sm font-medium text-destructive">Corrija a planilha antes de importar</p><ul className="mt-2 max-h-40 list-disc space-y-1 overflow-y-auto pl-5 text-xs leading-5 text-destructive">{errosImportacao.map((erro, indice) => <li key={`${erro}-${indice}`}>{erro}</li>)}</ul></div>}<div className="flex flex-col-reverse justify-end gap-2 sm:flex-row"><Button variant="outline" onClick={() => setDialogImportacao(false)} disabled={importarTorasCsv.isPending}>Cancelar</Button><Button onClick={importarArquivo} disabled={importarTorasCsv.isPending}>{importarTorasCsv.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Importar plaquetas</Button></div></div></DialogContent></Dialog>
    <Dialog open={dialogImportacaoPecas} onOpenChange={(aberto) => { setDialogImportacaoPecas(aberto); if (!aberto) { setArquivoImportacaoPecas(null); setErrosImportacaoPecas([]); } }}><DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] overflow-y-auto p-4 sm:max-w-2xl sm:p-6"><DialogHeader><DialogTitle>Importar peças serradas</DialogTitle><DialogDescription>Carregue as bitolas produzidas para adicioná-las ao romaneio atual.</DialogDescription></DialogHeader><div className="space-y-5"><div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm leading-5 text-sky-950"><p className="font-medium">Importe as bitolas e quantidades produzidas</p><p className="mt-1 text-xs">Use as colunas <strong>essência, espessura_cm, largura_cm, comprimento_m e quantidade</strong>. Todas as medidas devem ser positivas e a quantidade deve ser inteira.</p></div><Button variant="outline" size="sm" onClick={baixarModeloPecas}><Download className="mr-2 h-4 w-4" />Baixar modelo CSV</Button><Campo label="Planilha CSV de peças *"><Input aria-label="Planilha CSV de peças" type="file" accept=".csv,text/csv" onChange={(evento) => { setArquivoImportacaoPecas(evento.target.files?.[0] ?? null); setErrosImportacaoPecas([]); }} /><p className="text-xs text-muted-foreground">Máximo de 1.000 peças e 1 MB por importação.</p></Campo>{arquivoImportacaoPecas && <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm"><FileSpreadsheet className="h-4 w-4 text-primary" /><span className="min-w-0 truncate">{arquivoImportacaoPecas.name}</span></div>}{errosImportacaoPecas.length > 0 && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3"><p className="text-sm font-medium text-destructive">Corrija a planilha antes de importar</p><ul className="mt-2 max-h-40 list-disc space-y-1 overflow-y-auto pl-5 text-xs leading-5 text-destructive">{errosImportacaoPecas.map((erro, indice) => <li key={`${erro}-${indice}`}>{erro}</li>)}</ul></div>}<div className="flex flex-col-reverse justify-end gap-2 sm:flex-row"><Button variant="outline" onClick={() => setDialogImportacaoPecas(false)} disabled={importarPecasCsv.isPending}>Cancelar</Button><Button onClick={importarArquivoPecas} disabled={importarPecasCsv.isPending}>{importarPecasCsv.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Importar peças</Button></div></div></DialogContent></Dialog>
  </div>;
}

function Campo({ label, children }: { label: string; children: ReactNode }) { return <div className="min-w-0 space-y-1.5"><Label className="break-words">{label}</Label>{children}</div>; }
function Cabecalho({ titulo, texto, acao }: { titulo: string; texto: string; acao?: ReactNode }) { return <div className="flex min-w-0 flex-col gap-3 border-b bg-muted/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"><div className="min-w-0"><h2 className="font-semibold">{titulo}</h2><p className="mt-0.5 text-xs text-muted-foreground">{texto}</p></div>{acao}</div>; }
function Resumo({ icon, titulo, valor, detalhe, cor }: { icon: ReactNode; titulo: string; valor: ReactNode; detalhe: string; cor: string }) { const cores: Record<string, string> = { emerald: "bg-emerald-50 text-emerald-700", sky: "bg-sky-50 text-sky-700", amber: "bg-amber-50 text-amber-700", violet: "bg-violet-50 text-violet-700" }; return <div className="min-w-0 rounded-xl border bg-card p-4 shadow-sm"><div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs text-muted-foreground">{titulo}</p><p className="mt-1 break-words text-xl font-bold">{valor}</p></div><div className={`shrink-0 rounded-lg p-2 ${cores[cor]}`}>{icon}</div></div><p className="mt-2 break-words text-xs text-muted-foreground">{detalhe}</p></div>; }
function Indicador({ texto, valor, destaque }: { texto: string; valor: ReactNode; destaque?: string }) { return <div className={`min-w-0 rounded-lg border p-3 ${destaque === "destructive" ? "border-rose-200 bg-rose-50" : destaque ? "border-primary/20 bg-primary/5" : "bg-muted/20"}`}><p className="text-xs text-muted-foreground">{texto}</p><p className="mt-1 break-words font-semibold">{valor}</p></div>; }
function Acoes({ cancelar, confirmar, carregando, texto }: { cancelar: () => void; confirmar: () => void; carregando: boolean; texto: string }) { return <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row"><Button className="w-full sm:w-auto" variant="outline" onClick={cancelar} disabled={carregando}>Cancelar</Button><Button className="w-full sm:w-auto" onClick={confirmar} disabled={carregando}>{carregando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{texto}</Button></div>; }
function Carregando() { return <div className="py-12 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Carregando...</div>; }
function Vazio({ icone, texto }: { icone: ReactNode; texto: string }) { return <div className="flex min-w-0 flex-col items-center gap-3 px-4 py-10 text-center text-muted-foreground"><div className="shrink-0 rounded-full bg-muted p-3">{icone}</div><p className="max-w-sm break-words text-sm">{texto}</p></div>; }
function TabelaRomaneios({ romaneios, onEditar, onExcluir }: { romaneios: any[]; onEditar: (id: number) => void; onExcluir: (item: any) => void }) {
  return <>
    <div className="space-y-3 p-3 sm:hidden">{romaneios.map((item) => <article key={item.id} className="rounded-lg border bg-card p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{item.numero}</p><p className="text-xs text-muted-foreground">{formatarData(item.dataProducao)} · {item.totalToras ?? 1} tora(s)</p></div><Badge variant="outline" className="shrink-0 border-emerald-200 bg-emerald-50 text-emerald-700">{formatarNumero(item.aproveitamento ?? 0, 2)}%</Badge></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div><p className="text-muted-foreground">Toras</p><p className="font-medium">{formatarNumero(item.volumeTora ?? item.volumePlaqueta)} m³</p></div><div><p className="text-muted-foreground">Produção</p><p className="font-medium">{item.totalPecas} peças · {formatarNumero(item.volumeProduzido)} m³</p></div></div><div className="mt-3 grid grid-cols-3 gap-2"><Button size="sm" variant="outline" onClick={() => onEditar(item.id)}>Editar</Button><Button size="sm" variant="outline" onClick={() => window.open(`/api/pdf/romaneio/${item.id}`, "_blank", "noopener,noreferrer")}><FileText className="mr-1.5 h-3.5 w-3.5" />PDF</Button><Button size="sm" variant="outline" className="text-rose-700 hover:text-rose-800" onClick={() => onExcluir(item)}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Excluir</Button></div></article>)}</div>
    <div className="hidden w-full max-w-full overflow-x-auto sm:block"><Table className="min-w-[850px]"><TableHeader><TableRow><TableHead>Romaneio</TableHead><TableHead>Data / toras</TableHead><TableHead>Produção</TableHead><TableHead>Aproveitamento</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{romaneios.map((item) => <TableRow key={item.id}><TableCell><p className="font-medium">{item.numero}</p><p className="text-xs text-muted-foreground">{item.fita ?? "Sem fita"}</p></TableCell><TableCell><p>{formatarData(item.dataProducao)} · {item.totalToras ?? 1} tora(s)</p><p className="text-xs text-muted-foreground">{formatarNumero(item.volumeTora ?? item.volumePlaqueta)} m³ de toras</p></TableCell><TableCell><p>{item.totalPecas} peças</p><p className="text-xs text-muted-foreground">{formatarNumero(item.volumeProduzido)} m³</p></TableCell><TableCell><Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">{formatarNumero(item.aproveitamento ?? 0, 2)}%</Badge></TableCell><TableCell><div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => onEditar(item.id)}>Editar</Button><Button size="sm" variant="outline" onClick={() => window.open(`/api/pdf/romaneio/${item.id}`, "_blank", "noopener,noreferrer")}><FileText className="mr-1.5 h-3.5 w-3.5" />PDF</Button><Button size="sm" variant="outline" className="text-rose-700 hover:text-rose-800" onClick={() => onExcluir(item)}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Excluir</Button></div></TableCell></TableRow>)}</TableBody></Table></div>
  </>;
}
