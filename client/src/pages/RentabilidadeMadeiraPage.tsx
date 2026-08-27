import { useState } from "react";
import { AlertTriangle, BarChart3, Building2, CheckCircle2, CircleDollarSign, Factory, Layers3, Loader2, Plus, ShieldCheck, Tags, TreePine, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const volume = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const mesAtual = () => new Date().toISOString().slice(0, 7);

type TipoCentro = "industrial" | "comercial_administrativo" | "nao_apropriavel";
type Aba = "analise" | "centros";
type Registro = Record<string, any>;

const numero = (valor: unknown) => {
  const convertido = Number(valor ?? 0);
  return Number.isFinite(convertido) ? convertido : 0;
};

function textoTipo(tipo: string) {
  if (tipo === "industrial") return "Industrial";
  if (tipo === "comercial_administrativo") return "Comercial / Administrativo";
  return "Não apropriável à madeira";
}

function classeTipo(tipo: string) {
  if (tipo === "industrial") return "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200";
  if (tipo === "comercial_administrativo") return "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-200";
  return "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200";
}

function mensagemErro(erro: unknown) {
  return erro instanceof Error ? erro.message : "Não foi possível concluir a operação.";
}

function Kpi({ titulo, valor, descricao, icone: Icone, destaque }: { titulo: string; valor: string; descricao: string; icone: typeof CircleDollarSign; destaque?: "verde" | "azul" | "ambar" }) {
  const cor = destaque === "verde" ? "text-emerald-700 dark:text-emerald-300" : destaque === "azul" ? "text-sky-700 dark:text-sky-300" : destaque === "ambar" ? "text-amber-700 dark:text-amber-300" : "text-primary";
  return <Card className="border-border/70"><CardContent className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{titulo}</p><p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{valor}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{descricao}</p></div><Icone className={`h-5 w-5 ${cor}`} /></div></CardContent></Card>;
}

export default function RentabilidadeMadeiraPage() {
  const utils = trpc.useUtils();
  const [aba, setAba] = useState<Aba>("analise");
  const [mes, setMes] = useState(mesAtual());
  const [novoCentro, setNovoCentro] = useState({ nome: "", tipo: "industrial" as TipoCentro, observacoes: "" });
  const [edicao, setEdicao] = useState<{ id: number; nome: string; tipo: TipoCentro; observacoes: string } | null>(null);
  const competencia = `${mes}-01`;
  const resumo = trpc.financeiro.rentabilidade.resumo.useQuery({ competencia });
  const centros = trpc.financeiro.centrosCusto.list.useQuery({ incluirInativos: true });
  const invalidar = async () => Promise.all([utils.financeiro.rentabilidade.resumo.invalidate(), utils.financeiro.centrosCusto.list.invalidate(), utils.financeiro.titulos.list.invalidate()]);
  const criar = trpc.financeiro.centrosCusto.create.useMutation({
    onSuccess: async () => { toast.success("Centro de Custo criado."); setNovoCentro({ nome: "", tipo: "industrial", observacoes: "" }); await invalidar(); },
    onError: (erro) => toast.error(mensagemErro(erro)),
  });
  const atualizar = trpc.financeiro.centrosCusto.update.useMutation({
    onSuccess: async () => { toast.success("Centro de Custo atualizado."); setEdicao(null); await invalidar(); },
    onError: (erro) => toast.error(mensagemErro(erro)),
  });
  const dados = resumo.data as Registro | undefined;
  const indicadores = dados?.indicadores as Registro | undefined;
  const qualidade = dados?.qualidadeDados as Registro | undefined;

  return <div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-col gap-4 border-b border-border/70 pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="mb-2 flex items-center gap-2 text-primary"><BarChart3 className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-[0.16em]">Financeiro V2 · Rentabilidade</span></div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Rentabilidade da madeira</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">Leitura por competência dos custos financeiros classificados em Centros de Custo. Esta área não cria despesas, títulos, rateios ou cálculos históricos.</p>
      </div>
      <Badge variant="outline" className="h-auto max-w-md whitespace-normal border-sky-300 bg-sky-50 px-3 py-2 text-left text-sky-900 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-100"><ShieldCheck className="mr-2 inline h-4 w-4" />Uma única fonte por evento: notas de diesel são excluídas; o diesel operacional entra pelo abastecimento.</Badge>
    </header>

    <nav className="flex gap-1 overflow-x-auto rounded-xl border border-border/70 bg-muted/35 p-1" aria-label="Seções de rentabilidade">
      <button onClick={() => setAba("analise")} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${aba === "analise" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:bg-background/60 hover:text-foreground"}`}><BarChart3 className="h-4 w-4" />Análise por competência</button>
      <button onClick={() => setAba("centros")} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${aba === "centros" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:bg-background/60 hover:text-foreground"}`}><Tags className="h-4 w-4" />Centros de Custo</button>
    </nav>

    {aba === "analise" && <>
      <Card className="border-border/70"><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium text-foreground">Competência de análise</p><p className="text-xs text-muted-foreground">O pagamento e a baixa não modificam o período econômico do custo.</p></div><Input className="w-full sm:w-44" type="month" value={mes} onChange={(evento) => setMes(evento.target.value)} /></CardContent></Card>
      {resumo.isLoading && <Card><CardContent className="flex items-center gap-3 p-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Carregando análise financeira…</CardContent></Card>}
      {resumo.error && <Card className="border-rose-200 bg-rose-50/50 dark:border-rose-900 dark:bg-rose-950/20"><CardContent className="flex items-center gap-3 p-5 text-sm text-rose-900 dark:text-rose-100"><XCircle className="h-5 w-5" />{mensagemErro(resumo.error)}</CardContent></Card>}
      {dados && indicadores && <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Kpi titulo="Custos industriais" valor={moeda.format(numero(indicadores.custosIndustriais))} descricao="Centros industriais e diesel por abastecimento" icone={Factory} destaque="verde" />
          <Kpi titulo="Matéria-prima" valor={moeda.format(numero(indicadores.custosMateriaPrima))} descricao="Títulos de romaneio de carga classificados" icone={TreePine} destaque="verde" />
          <Kpi titulo="Comercial / administrativo" valor={moeda.format(numero(indicadores.custosComerciaisAdministrativos))} descricao="Camada separada de estrutura" icone={Building2} destaque="azul" />
          <Kpi titulo="Produção própria" valor={`${volume.format(numero(indicadores.volumeProprioM3))} m³`} descricao={`${dados.totalRomaneiosProducao ?? 0} romaneio(s) confirmado(s)`} icone={Layers3} />
          <Kpi titulo="Custo industrial por m³" valor={indicadores.custoIndustrialPorM3 == null ? "Não determinado" : moeda.format(numero(indicadores.custoIndustrialPorM3))} descricao="Custos industriais ÷ produção própria" icone={CircleDollarSign} destaque="ambar" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-border/70"><CardHeader><CardTitle className="text-base">Custo por Centro de Custo</CardTitle><CardDescription>Inclui apenas centros industriais e comercial/administrativo ativos ou históricos classificados.</CardDescription></CardHeader><CardContent className="p-0"><TabelaCentros itens={(dados.porCentro ?? []) as Registro[]} /></CardContent></Card>
          <Card className="border-border/70"><CardHeader><CardTitle className="text-base">Custo por categoria financeira</CardTitle><CardDescription>A categoria explica a natureza do gasto; o centro identifica a área responsável.</CardDescription></CardHeader><CardContent className="p-0"><TabelaCategorias itens={(dados.porCategoria ?? []) as Registro[]} /></CardContent></Card>
        </div>

        {qualidade && (numero(qualidade.titulosSemCentro?.quantidade) > 0 || numero(qualidade.titulosSemCompetencia?.quantidade) > 0 || numero(qualidade.titulosExcluidosPorOrigem?.quantidade) > 0) && <Card className="border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20"><CardContent className="flex gap-3 p-4 text-sm text-amber-950 dark:text-amber-100"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-semibold">Qualidade e elegibilidade dos dados</p><ul className="mt-1 space-y-1 text-xs leading-5"><li>{qualidade.titulosSemCentro.quantidade} título(s) sem Centro de Custo nesta competência ({moeda.format(numero(qualidade.titulosSemCentro.valor))}); não entram no custo apropriado.</li><li>{qualidade.titulosSemCompetencia.quantidade} título(s) de despesa sem competência ({moeda.format(numero(qualidade.titulosSemCompetencia.valor))}); permanecem fora da análise até classificação explícita.</li><li>{qualidade.titulosExcluidosPorOrigem.quantidade} título(s) de nota de diesel foram excluídos ({moeda.format(numero(qualidade.titulosExcluidosPorOrigem.valor))}) para evitar duplicidade com o abastecimento.</li></ul></div></CardContent></Card>}

        <Card className="border-border/70"><CardHeader><CardTitle className="text-base">Composição auditável do período</CardTitle><CardDescription>Os valores são lidos das fontes originais e não geram novo lançamento financeiro.</CardDescription></CardHeader><CardContent className="p-0"><TabelaComponentes itens={(dados.componentes ?? []) as Registro[]} /></CardContent></Card>
      </>}
    </>}

    {aba === "centros" && <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="h-fit border-border/70"><CardHeader><CardTitle className="text-base">Novo Centro de Custo</CardTitle><CardDescription>O tipo determina como os títulos classificados aparecem na Rentabilidade.</CardDescription></CardHeader><CardContent className="space-y-4"><Campo id="novo-centro-nome" rotulo="Nome" value={novoCentro.nome} onChange={(nome) => setNovoCentro({ ...novoCentro, nome })} placeholder="Ex.: Serraria" /><CampoSelect id="novo-centro-tipo" rotulo="Tipo" value={novoCentro.tipo} onChange={(tipo) => setNovoCentro({ ...novoCentro, tipo: tipo as TipoCentro })} /><div className="space-y-2"><Label htmlFor="novo-centro-observacoes">Observações</Label><Textarea id="novo-centro-observacoes" value={novoCentro.observacoes} onChange={(evento) => setNovoCentro({ ...novoCentro, observacoes: evento.target.value })} placeholder="Opcional" /></div><Button className="w-full" disabled={!novoCentro.nome.trim() || criar.isPending} onClick={() => criar.mutate({ nome: novoCentro.nome, tipo: novoCentro.tipo, observacoes: novoCentro.observacoes || null })}>{criar.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Criar Centro de Custo</Button></CardContent></Card>
      <Card className="border-border/70"><CardHeader><CardTitle className="text-base">Centros cadastrados</CardTitle><CardDescription>Centros inativos permanecem nos títulos históricos, mas não podem ser escolhidos em novos lançamentos.</CardDescription></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Centro</TableHead><TableHead>Tipo</TableHead><TableHead>Situação</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{centros.isLoading ? <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Carregando centros…</TableCell></TableRow> : (centros.data ?? []).length === 0 ? <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Nenhum Centro de Custo cadastrado.</TableCell></TableRow> : (centros.data ?? []).map((centro: Registro) => <TableRow key={centro.id}><TableCell><p className="font-medium text-foreground">{centro.nome}</p><p className="text-xs text-muted-foreground">{centro.codigo}</p></TableCell><TableCell><Badge variant="outline" className={classeTipo(centro.tipo)}>{textoTipo(centro.tipo)}</Badge></TableCell><TableCell>{centro.ativo ? <span className="inline-flex items-center gap-1 text-sm text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" />Ativo</span> : <span className="text-sm text-muted-foreground">Inativo</span>}</TableCell><TableCell className="text-right"><div className="inline-flex flex-wrap justify-end gap-2"><Button variant="outline" size="sm" onClick={() => setEdicao({ id: centro.id, nome: centro.nome, tipo: centro.tipo, observacoes: centro.observacoes ?? "" })}>Editar</Button><Button variant="outline" size="sm" disabled={atualizar.isPending} onClick={() => atualizar.mutate({ id: centro.id, ativo: !centro.ativo })}>{centro.ativo ? "Inativar" : "Reativar"}</Button></div></TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
    </div>}

    {edicao && <Card className="border-primary/30 bg-primary/[0.03]"><CardHeader><CardTitle className="text-base">Editar Centro de Custo</CardTitle><CardDescription>Alterações preservam os títulos e históricos já classificados.</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><Campo id="editar-centro-nome" rotulo="Nome" value={edicao.nome} onChange={(nome) => setEdicao({ ...edicao, nome })} /><CampoSelect id="editar-centro-tipo" rotulo="Tipo" value={edicao.tipo} onChange={(tipo) => setEdicao({ ...edicao, tipo: tipo as TipoCentro })} /><div className="space-y-2 md:col-span-2"><Label htmlFor="editar-centro-observacoes">Observações</Label><Textarea id="editar-centro-observacoes" value={edicao.observacoes} onChange={(evento) => setEdicao({ ...edicao, observacoes: evento.target.value })} /></div><div className="flex gap-2 md:col-span-2"><Button disabled={!edicao.nome.trim() || atualizar.isPending} onClick={() => atualizar.mutate({ id: edicao.id, nome: edicao.nome, tipo: edicao.tipo, observacoes: edicao.observacoes || null })}>{atualizar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar alterações</Button><Button variant="outline" onClick={() => setEdicao(null)}>Cancelar</Button></div></CardContent></Card>}
  </div>;
}

function Campo({ id, rotulo, value, onChange, placeholder }: { id: string; rotulo: string; value: string; onChange: (valor: string) => void; placeholder?: string }) {
  return <div className="space-y-2"><Label htmlFor={id}>{rotulo}</Label><Input id={id} value={value} onChange={(evento) => onChange(evento.target.value)} placeholder={placeholder} /></div>;
}

function CampoSelect({ id, rotulo, value, onChange }: { id: string; rotulo: string; value: TipoCentro; onChange: (valor: string) => void }) {
  return <div className="space-y-2"><Label htmlFor={id}>{rotulo}</Label><select id={id} value={value} onChange={(evento) => onChange(evento.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"><option value="industrial">Industrial</option><option value="comercial_administrativo">Comercial / Administrativo</option><option value="nao_apropriavel">Não apropriável à madeira</option></select></div>;
}

function TabelaCentros({ itens }: { itens: Registro[] }) {
  if (!itens.length) return <p className="p-6 text-sm text-muted-foreground">Nenhum custo elegível classificado nesta competência.</p>;
  return <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Centro</TableHead><TableHead>Tipo</TableHead><TableHead>Itens</TableHead><TableHead className="text-right">Custo</TableHead></TableRow></TableHeader><TableBody>{itens.map((item) => <TableRow key={item.id}><TableCell className="font-medium">{item.nome}</TableCell><TableCell><Badge variant="outline" className={classeTipo(item.tipo)}>{textoTipo(item.tipo)}</Badge></TableCell><TableCell>{item.quantidade}</TableCell><TableCell className="text-right font-medium tabular-nums">{moeda.format(numero(item.total))}</TableCell></TableRow>)}</TableBody></Table></div>;
}

function TabelaCategorias({ itens }: { itens: Registro[] }) {
  if (!itens.length) return <p className="p-6 text-sm text-muted-foreground">Nenhuma categoria financeira elegível nesta competência.</p>;
  return <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Categoria</TableHead><TableHead>Centro</TableHead><TableHead className="text-right">Custo</TableHead></TableRow></TableHeader><TableBody>{itens.map((item) => <TableRow key={item.chave}><TableCell className="font-medium">{item.categoriaNome}</TableCell><TableCell className="text-muted-foreground">{item.centroNome}</TableCell><TableCell className="text-right font-medium tabular-nums">{moeda.format(numero(item.total))}</TableCell></TableRow>)}</TableBody></Table></div>;
}

function TabelaComponentes({ itens }: { itens: Registro[] }) {
  if (!itens.length) return <p className="p-6 text-sm text-muted-foreground">Nenhum componente de custo elegível encontrado nesta competência.</p>;
  return <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Origem</TableHead><TableHead>Descrição</TableHead><TableHead>Centro</TableHead><TableHead>Categoria</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader><TableBody>{itens.map((item) => <TableRow key={item.chave}><TableCell><Badge variant="outline">{item.origem === "abastecimento_diesel" ? "Abastecimento de diesel" : item.origem.replaceAll("_", " ")}</Badge></TableCell><TableCell className="min-w-48">{item.descricao}</TableCell><TableCell>{item.centroNome}</TableCell><TableCell>{item.categoriaNome}</TableCell><TableCell className="text-right font-medium tabular-nums">{moeda.format(numero(item.valor))}</TableCell></TableRow>)}</TableBody></Table></div>;
}
