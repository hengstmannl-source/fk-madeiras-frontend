import { useMemo, useState } from "react";
import { useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { formatCurrency, formatReceivableSaleReference } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowDownToLine, ArrowUpFromLine, Building2, CalendarClock, CheckCircle2,
  CircleAlert, CircleDollarSign, Landmark, Loader2, Plus, RefreshCw, Tags, WalletCards,
} from "lucide-react";
import { toast } from "sonner";

const hoje = () => new Date().toISOString().slice(0, 10);
const valorInicialLancamento = () => ({
  tipo: "receber" as "receber" | "pagar",
  descricao: "",
  categoriaId: "",
  valorOriginal: "",
  dataEmissao: hoje(),
  dataVencimento: hoje(),
  clienteId: "",
  fornecedorId: "",
  contraparteNome: "",
  desconto: "0",
  juros: "0",
  parcelar: false,
  quantidadeParcelas: "2",
  observacoes: "",
});

const valorInicialRecorrencia = () => ({
  tipo: "pagar" as "receber" | "pagar",
  descricao: "",
  categoriaId: "",
  valor: "",
  frequencia: "mensal" as "semanal" | "mensal" | "trimestral" | "semestral" | "anual",
  proximoVencimento: hoje(),
  dataFim: "",
  clienteId: "",
  fornecedorId: "",
  contraparteNome: "",
  observacoes: "",
});

const estadoLabels: Record<string, string> = {
  aberto: "Aberto", parcial: "Parcial", quitado: "Quitado", vencido: "Vencido", cancelado: "Cancelado",
};

function saldoTitulo(titulo: any): number {
  return Math.max(0,
    Number(titulo.valorOriginal || 0) - Number(titulo.desconto || 0) + Number(titulo.juros || 0) - Number(titulo.valorBaixado || 0),
  );
}

function formatarDataFinanceira(value: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value));
}

function StatusBadge({ estado }: { estado: string }) {
  const styles: Record<string, string> = {
    aberto: "bg-sky-50 text-sky-700 border-sky-200",
    parcial: "bg-amber-50 text-amber-700 border-amber-200",
    quitado: "bg-emerald-50 text-emerald-700 border-emerald-200",
    vencido: "bg-rose-50 text-rose-700 border-rose-200",
    cancelado: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return <Badge variant="outline" className={styles[estado] ?? ""}>{estadoLabels[estado] ?? estado}</Badge>;
}

export default function FinanceiroPage() {
  const utils = trpc.useUtils();
  const search = useSearch();
  const [aba, setAba] = useState<"lancamentos" | "recorrencias" | "fornecedores" | "categorias" | "contas">("lancamentos");
  const [lancamentoAberto, setLancamentoAberto] = useState(false);
  const [baixaAberta, setBaixaAberta] = useState(false);
  const [fornecedorAberto, setFornecedorAberto] = useState(false);
  const [categoriaAberta, setCategoriaAberta] = useState(false);
  const [contaAberta, setContaAberta] = useState(false);
  const [recorrenciaAberta, setRecorrenciaAberta] = useState(false);
  const [tituloSelecionado, setTituloSelecionado] = useState<any>(null);
  const [tituloBaixas, setTituloBaixas] = useState<any>(null);
  const [tituloParaCancelar, setTituloParaCancelar] = useState<any>(null);
  const [lancamento, setLancamento] = useState(valorInicialLancamento);
  const [baixa, setBaixa] = useState({ contaFinanceiraId: "", valor: "", dataBaixa: hoje(), formaPagamento: "pix", observacoes: "" });
  const [fornecedor, setFornecedor] = useState({ nome: "", contacto: "", email: "", documento: "", endereco: "", observacoes: "" });
  const [categoria, setCategoria] = useState({ nome: "", tipo: "ambos" as "receita" | "despesa" | "ambos" });
  const [conta, setConta] = useState({ nome: "", tipo: "caixa" as "caixa" | "banco" | "carteira" | "outro", saldoInicial: "0", observacoes: "" });
  const [recorrencia, setRecorrencia] = useState(valorInicialRecorrencia);

  const titulos = trpc.financeiro.titulos.list.useQuery();
  const categorias = trpc.financeiro.categorias.list.useQuery();
  const fornecedores = trpc.financeiro.fornecedores.list.useQuery();
  const contas = trpc.financeiro.contas.list.useQuery();
  const recorrencias = trpc.financeiro.recorrencias.list.useQuery();
  const alertas = trpc.financeiro.alertas.list.useQuery();
  const baixasTitulo = trpc.financeiro.titulos.baixas.useQuery(
    { tituloId: tituloBaixas?.id ?? 0 },
    { enabled: Boolean(tituloBaixas) },
  );
  const clientes = trpc.cliente.list.useQuery();
  const criarLancamento = trpc.financeiro.titulos.createManual.useMutation();
  const criarLancamentoParcelado = trpc.financeiro.titulos.createParcelado.useMutation();
  const registrarBaixa = trpc.financeiro.titulos.baixar.useMutation();
  const criarFornecedor = trpc.financeiro.fornecedores.create.useMutation();
  const criarCategoria = trpc.financeiro.categorias.create.useMutation();
  const criarConta = trpc.financeiro.contas.create.useMutation();
  const criarRecorrencia = trpc.financeiro.recorrencias.create.useMutation();
  const conciliarBaixa = trpc.financeiro.titulos.conciliarBaixa.useMutation();
  const cancelarTitulo = trpc.financeiro.titulos.cancelar.useMutation();

  const resumo = useMemo(() => {
    const dados = titulos.data ?? [];
    return dados.reduce((acumulado, titulo: any) => {
      if (titulo.estado === "cancelado" || titulo.estado === "quitado") return acumulado;
      const saldo = saldoTitulo(titulo);
      if (titulo.tipo === "receber") acumulado.receber += saldo;
      if (titulo.tipo === "pagar") acumulado.pagar += saldo;
      if (titulo.estado === "vencido") acumulado.vencidos += saldo;
      return acumulado;
    }, { receber: 0, pagar: 0, vencidos: 0 });
  }, [titulos.data]);

  const compromissos = useMemo(() => {
    const hoje = new Date();
    const limite = new Date();
    limite.setDate(limite.getDate() + 30);
    const emAberto = (titulos.data ?? []).filter((titulo: any) => !["quitado", "cancelado"].includes(titulo.estado));
    return {
      vencidos: emAberto.filter((titulo: any) => titulo.estado === "vencido"),
      proximos: emAberto.filter((titulo: any) => {
        const vencimento = new Date(titulo.dataVencimento);
        return vencimento >= hoje && vencimento <= limite;
      }).sort((a: any, b: any) => new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime()),
    };
  }, [titulos.data]);

  const tipoAtalho = new URLSearchParams(search).get("tipo") === "pagar" ? "pagar" : new URLSearchParams(search).get("tipo") === "receber" ? "receber" : null;
  const titulosExibidos = useMemo(() => (titulos.data ?? []).filter((titulo: any) => !tipoAtalho || titulo.tipo === tipoAtalho), [titulos.data, tipoAtalho]);
  const tituloLancamentos = tipoAtalho === "pagar" ? "Contas a pagar" : tipoAtalho === "receber" ? "Contas a receber" : "Contas a pagar e receber";

  const invalidarFinanceiro = () => {
    utils.financeiro.titulos.list.invalidate();
    utils.financeiro.categorias.list.invalidate();
    utils.financeiro.fornecedores.list.invalidate();
    utils.financeiro.contas.list.invalidate();
    utils.financeiro.recorrencias.list.invalidate();
    utils.financeiro.alertas.list.invalidate();
    if (tituloBaixas) utils.financeiro.titulos.baixas.invalidate({ tituloId: tituloBaixas.id });
  };

  const salvarLancamento = () => {
    if (!lancamento.categoriaId) { toast.error("Selecione uma categoria financeira"); return; }
    const { parcelar, quantidadeParcelas, ...dadosLancamento } = lancamento;
    const dados = {
      ...dadosLancamento,
      categoriaId: Number(lancamento.categoriaId),
      clienteId: lancamento.clienteId ? Number(lancamento.clienteId) : null,
      fornecedorId: lancamento.fornecedorId ? Number(lancamento.fornecedorId) : null,
      contraparteNome: lancamento.contraparteNome || null,
      observacoes: lancamento.observacoes || null,
    };
    const concluir = () => {
      toast.success(parcelar ? "Lançamento parcelado criado" : "Lançamento não programado criado");
      invalidarFinanceiro();
      setLancamentoAberto(false);
      setLancamento(valorInicialLancamento());
    };
    if (parcelar) {
      criarLancamentoParcelado.mutate({ ...dados, quantidadeParcelas: Number(quantidadeParcelas) }, {
        onSuccess: concluir,
        onError: (erro) => toast.error(erro.message),
      });
    } else {
      criarLancamento.mutate(dados, {
        onSuccess: concluir,
        onError: (erro) => toast.error(erro.message),
      });
    }
  };

  const abrirBaixa = (titulo: any) => {
    if (!contas.data?.length) { toast.error("Cadastre uma conta financeira antes de registrar uma baixa"); setAba("contas"); return; }
    setTituloSelecionado(titulo);
    setBaixa({ contaFinanceiraId: String(contas.data[0].id), valor: saldoTitulo(titulo).toFixed(2), dataBaixa: hoje(), formaPagamento: "pix", observacoes: "" });
    setBaixaAberta(true);
  };

  const salvarBaixa = () => {
    if (!tituloSelecionado || !baixa.contaFinanceiraId) return;
    registrarBaixa.mutate({
      tituloId: tituloSelecionado.id,
      contaFinanceiraId: Number(baixa.contaFinanceiraId),
      valor: baixa.valor,
      dataBaixa: baixa.dataBaixa,
      formaPagamento: baixa.formaPagamento as "pix" | "dinheiro" | "cartao_credito" | "cartao_debito" | "transferencia" | "boleto" | "outro",
      observacoes: baixa.observacoes || undefined,
    }, {
      onSuccess: () => { toast.success("Baixa registrada com sucesso"); invalidarFinanceiro(); setBaixaAberta(false); },
      onError: (erro) => toast.error(erro.message),
    });
  };

  const confirmarCancelamento = () => {
    if (!tituloParaCancelar) return;
    cancelarTitulo.mutate({ id: tituloParaCancelar.id }, {
      onSuccess: () => {
        toast.success(`${tituloParaCancelar.tipo === "receber" ? "Conta a receber" : "Conta a pagar"} cancelada com sucesso`);
        setTituloParaCancelar(null);
        invalidarFinanceiro();
      },
      onError: (erro) => toast.error(erro.message),
    });
  };

  const salvarFornecedor = () => criarFornecedor.mutate({ ...fornecedor, email: fornecedor.email || null, contacto: fornecedor.contacto || null, documento: fornecedor.documento || null, endereco: fornecedor.endereco || null, observacoes: fornecedor.observacoes || null }, {
    onSuccess: () => { toast.success("Fornecedor cadastrado"); utils.financeiro.fornecedores.list.invalidate(); setFornecedorAberto(false); setFornecedor({ nome: "", contacto: "", email: "", documento: "", endereco: "", observacoes: "" }); },
    onError: (erro) => toast.error(erro.message),
  });

  const salvarCategoria = () => criarCategoria.mutate(categoria, {
    onSuccess: () => { toast.success("Categoria criada"); utils.financeiro.categorias.list.invalidate(); setCategoriaAberta(false); setCategoria({ nome: "", tipo: "ambos" }); },
    onError: (erro) => toast.error(erro.message),
  });

  const salvarConta = () => criarConta.mutate({ ...conta, observacoes: conta.observacoes || null }, {
    onSuccess: () => { toast.success("Conta financeira cadastrada"); utils.financeiro.contas.list.invalidate(); setContaAberta(false); setConta({ nome: "", tipo: "caixa", saldoInicial: "0", observacoes: "" }); },
    onError: (erro) => toast.error(erro.message),
  });

  const salvarRecorrencia = () => {
    if (!recorrencia.categoriaId) { toast.error("Selecione uma categoria financeira"); return; }
    criarRecorrencia.mutate({
      ...recorrencia,
      categoriaId: Number(recorrencia.categoriaId),
      clienteId: recorrencia.clienteId ? Number(recorrencia.clienteId) : null,
      fornecedorId: recorrencia.fornecedorId ? Number(recorrencia.fornecedorId) : null,
      contraparteNome: recorrencia.contraparteNome || null,
      dataFim: recorrencia.dataFim || null,
      observacoes: recorrencia.observacoes || null,
    }, {
      onSuccess: () => { toast.success("Recorrência financeira criada"); invalidarFinanceiro(); setRecorrenciaAberta(false); setRecorrencia(valorInicialRecorrencia()); },
      onError: (erro) => toast.error(erro.message),
    });
  };

  const carregando = titulos.isLoading || categorias.isLoading || contas.isLoading || fornecedores.isLoading || recorrencias.isLoading;
  const abas = [
    ["lancamentos", "Lançamentos", WalletCards], ["fornecedores", "Fornecedores", Building2],
    ["recorrencias", "Recorrências", RefreshCw], ["categorias", "Categorias", Tags], ["contas", "Contas", Landmark],
  ] as const;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><div className="rounded-lg bg-primary/10 p-2"><WalletCards className="h-5 w-5 text-primary" /></div><h1 className="text-2xl font-bold tracking-tight text-foreground">Financeiro</h1></div>
          <p className="text-sm text-muted-foreground mt-2">Contas a receber, pagar e movimentações financeiras da empresa.</p>
        </div>
        <Button onClick={() => setLancamentoAberto(true)} className="bg-primary text-primary-foreground"><Plus className="h-4 w-4 mr-2" />Novo lançamento avulso</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <ResumoCard label="A receber" valor={resumo.receber} icon={<ArrowDownToLine className="h-5 w-5" />} color="text-emerald-700 bg-emerald-50" />
        <ResumoCard label="A pagar" valor={resumo.pagar} icon={<ArrowUpFromLine className="h-5 w-5" />} color="text-rose-700 bg-rose-50" />
        <ResumoCard label="Saldo projetado" valor={resumo.receber - resumo.pagar} icon={<CircleDollarSign className="h-5 w-5" />} color="text-primary bg-primary/10" descricao={resumo.vencidos > 0 ? `${formatCurrency(resumo.vencidos)} em atraso` : "Nenhum título vencido"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ListaCompromissos titulo="Títulos vencidos" descricao="Pendências que exigem atenção" titulos={compromissos.vencidos} classe="border-rose-200" vazio="Nenhum título vencido" />
        <ListaCompromissos titulo="Próximos 30 dias" descricao="Vencimentos previstos para o período" titulos={compromissos.proximos} classe="border-amber-200" vazio="Nenhum compromisso próximo" />
      </div>

      {alertas.data?.length ? <section className="rounded-xl border border-amber-200 bg-amber-50/40 shadow-sm overflow-hidden"><div className="flex items-center gap-2 border-b border-amber-200 px-5 py-4"><CircleAlert className="h-5 w-5 text-amber-700" /><div><h2 className="font-semibold text-sm text-amber-950">Alertas automáticos</h2><p className="text-xs text-amber-800">Gerados diariamente a partir dos vencimentos em aberto.</p></div><Badge className="ml-auto bg-amber-100 text-amber-800 hover:bg-amber-100">{alertas.data.length}</Badge></div><div className="divide-y divide-amber-100">{alertas.data.slice(0, 5).map((alerta: any) => <div key={alerta.id} className="flex items-center justify-between gap-4 px-5 py-3"><div><p className="text-sm font-medium text-amber-950">{alerta.mensagem}</p><p className="mt-0.5 text-xs text-amber-800">{alerta.tipo === "vencido" ? "Vencido" : "Próximo do vencimento"} · {formatCurrency(alerta.valorOriginal)}</p></div><Badge variant="outline" className="border-amber-300 bg-white text-amber-800">{alerta.tipo === "vencido" ? "Atenção" : "Acompanhar"}</Badge></div>)}</div></section> : null}

      <div className="flex items-center gap-1 overflow-x-auto border-b border-border">
        {abas.map(([id, label, Icon]) => <button key={id} onClick={() => setAba(id)} className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${aba === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}><Icon className="h-4 w-4" />{label}</button>)}
      </div>

      {aba === "lancamentos" && (
        <section className="rounded-xl border border-border/60 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b bg-muted/20"><div><h2 className="font-semibold">{tituloLancamentos}</h2><p className="text-xs text-muted-foreground mt-0.5">Inclui lançamentos originados em vendas e lançamentos avulsos.</p></div><Badge variant="outline">{titulosExibidos.length} títulos</Badge></div>
          {carregando ? <div className="p-12 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />Carregando financeiro...</div> : titulosExibidos.length ? (
            <Table>
              <TableHeader><TableRow className="bg-muted/40"><TableHead>Descrição</TableHead><TableHead>Tipo</TableHead><TableHead>Vencimento</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Saldo</TableHead><TableHead className="text-right">Ação</TableHead></TableRow></TableHeader>
              <TableBody>{titulosExibidos.map((titulo: any) => {
                const possuiBaixas = Number(titulo.valorBaixado || 0) > 0.005;
                const podeCancelar = !["quitado", "cancelado"].includes(titulo.estado) && !possuiBaixas;
                return <TableRow key={titulo.id} className="hover:bg-muted/20"><TableCell><p className="font-medium">{titulo.descricao}</p><p className="text-xs text-muted-foreground">{formatReceivableSaleReference(titulo.origem, titulo.descricao)}{titulo.numeroParcela ? ` · Parcela ${titulo.numeroParcela}/${titulo.totalParcelas}` : ""}</p></TableCell><TableCell><span className={`inline-flex items-center gap-1 text-sm ${titulo.tipo === "receber" ? "text-emerald-700" : "text-rose-700"}`}>{titulo.tipo === "receber" ? <ArrowDownToLine className="h-3.5 w-3.5" /> : <ArrowUpFromLine className="h-3.5 w-3.5" />}{titulo.tipo === "receber" ? "Receber" : "Pagar"}</span></TableCell><TableCell className="text-sm">{formatarDataFinanceira(titulo.dataVencimento)}</TableCell><TableCell><StatusBadge estado={titulo.estado} /></TableCell><TableCell className="text-right font-semibold">{formatCurrency(saldoTitulo(titulo))}</TableCell><TableCell className="text-right"><div className="flex justify-end gap-2">{possuiBaixas && <Button size="sm" variant="ghost" onClick={() => setTituloBaixas(titulo)}>Baixas</Button>}{!["quitado", "cancelado"].includes(titulo.estado) && <Button size="sm" variant="outline" onClick={() => abrirBaixa(titulo)}><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Baixar</Button>}{!["quitado", "cancelado"].includes(titulo.estado) && <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" title={possuiBaixas ? "Estorne as baixas antes de cancelar" : "Cancelar título"} disabled={!podeCancelar} onClick={() => setTituloParaCancelar(titulo)}>Cancelar</Button>}</div></TableCell></TableRow>;
              })}</TableBody>
            </Table>
          ) : <EstadoVazio icon={<CalendarClock className="h-9 w-9" />} texto="Nenhum lançamento financeiro encontrado" acao={() => setLancamentoAberto(true)} labelAcao="Criar lançamento avulso" />}
        </section>
      )}

      {aba === "recorrencias" && (
        <section className="rounded-xl border border-border/60 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b bg-muted/20"><div><h2 className="font-semibold">Lançamentos recorrentes</h2><p className="text-xs text-muted-foreground mt-0.5">O sistema gera os próximos títulos diariamente, respeitando a regra configurada.</p></div><Button size="sm" onClick={() => setRecorrenciaAberta(true)}><Plus className="h-3.5 w-3.5 mr-1.5" />Nova recorrência</Button></div>
          {carregando ? <div className="p-12 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />Carregando recorrências...</div> : recorrencias.data?.length ? <Table><TableHeader><TableRow className="bg-muted/40"><TableHead>Descrição</TableHead><TableHead>Tipo</TableHead><TableHead>Frequência</TableHead><TableHead>Próximo vencimento</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{recorrencias.data.map((item: any) => <TableRow key={item.id}><TableCell className="font-medium">{item.descricao}</TableCell><TableCell className={item.tipo === "receber" ? "text-emerald-700" : "text-rose-700"}>{item.tipo === "receber" ? "Receber" : "Pagar"}</TableCell><TableCell className="capitalize">{item.frequencia}</TableCell><TableCell>{formatarDataFinanceira(item.proximoVencimento)}</TableCell><TableCell className="text-right font-medium">{formatCurrency(item.valor)}</TableCell><TableCell><Badge variant="outline" className={item.ativa ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600"}>{item.ativa ? "Ativa" : "Pausada"}</Badge></TableCell></TableRow>)}</TableBody></Table> : <EstadoVazio icon={<RefreshCw className="h-8 w-8" />} texto="Nenhuma recorrência cadastrada" acao={() => setRecorrenciaAberta(true)} labelAcao="Criar recorrência" />}
        </section>
      )}

      {aba === "fornecedores" && <CadastroTabela titulo="Fornecedores" descricao="Cadastre os fornecedores utilizados em contas a pagar." icone={<Building2 className="h-5 w-5" />} botao="Novo fornecedor" aoCriar={() => setFornecedorAberto(true)} colunas={["Fornecedor", "Contato", "E-mail", "Documento"]} linhas={(fornecedores.data ?? []).map((item: any) => [item.nome, item.contacto || "—", item.email || "—", item.documento || "—"])} vazio="Nenhum fornecedor cadastrado" />}
      {aba === "categorias" && <CadastroTabela titulo="Categorias financeiras" descricao="Classifique receitas e despesas para os relatórios financeiros." icone={<Tags className="h-5 w-5" />} botao="Nova categoria" aoCriar={() => setCategoriaAberta(true)} colunas={["Categoria", "Aplicação"]} linhas={(categorias.data ?? []).map((item: any) => [item.nome, item.tipo === "ambos" ? "Receita e despesa" : item.tipo === "receita" ? "Receita" : "Despesa"])} vazio="Nenhuma categoria cadastrada" />}
      {aba === "contas" && <CadastroTabela titulo="Contas financeiras" descricao="Defina onde os valores entram e saem: caixa, bancos e carteiras." icone={<Landmark className="h-5 w-5" />} botao="Nova conta" aoCriar={() => setContaAberta(true)} colunas={["Conta", "Tipo", "Saldo inicial"]} linhas={(contas.data ?? []).map((item: any) => [item.nome, item.tipo, formatCurrency(item.saldoInicial)])} vazio="Nenhuma conta financeira cadastrada" />}

      <Dialog open={Boolean(tituloParaCancelar)} onOpenChange={(aberto) => !aberto && setTituloParaCancelar(null)}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Cancelar {tituloParaCancelar?.tipo === "receber" ? "conta a receber" : "conta a pagar"}</DialogTitle></DialogHeader><div className="space-y-4"><div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><p className="font-medium">{tituloParaCancelar?.descricao}</p><p className="mt-1">Este título deixará de aparecer nas listas ativas e permanecerá registrado como cancelado para auditoria.</p></div><p className="text-sm text-muted-foreground">A operação não pode ser usada em títulos com baixas financeiras. Deseja continuar?</p><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setTituloParaCancelar(null)} disabled={cancelarTitulo.isPending}>Voltar</Button><Button variant="destructive" onClick={confirmarCancelamento} disabled={cancelarTitulo.isPending}>{cancelarTitulo.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar cancelamento</Button></div></div></DialogContent></Dialog>

      <Dialog open={lancamentoAberto} onOpenChange={setLancamentoAberto}><DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Novo lançamento não programado</DialogTitle></DialogHeader><div className="space-y-4"><p className="text-sm text-muted-foreground">Use este lançamento para entradas ou saídas excepcionais, sem orçamento ou recorrência vinculados.</p><div className="grid grid-cols-2 gap-3"><CampoSelect label="Tipo" value={lancamento.tipo} onValueChange={(valor) => setLancamento({ ...lancamento, tipo: valor as "receber" | "pagar" })} opcoes={[["receber", "Conta a receber"], ["pagar", "Conta a pagar"]]} /><div className="space-y-2"><Label>Categoria *</Label><Select value={lancamento.categoriaId} onValueChange={(valor) => setLancamento({ ...lancamento, categoriaId: valor })}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{(categorias.data ?? []).filter((item: any) => item.tipo === "ambos" || item.tipo === (lancamento.tipo === "receber" ? "receita" : "despesa")).map((item: any) => <SelectItem key={item.id} value={String(item.id)}>{item.nome}</SelectItem>)}</SelectContent></Select></div></div><div className="space-y-2"><Label>Descrição *</Label><Input value={lancamento.descricao} onChange={(e) => setLancamento({ ...lancamento, descricao: e.target.value })} placeholder="Ex.: Frete emergencial" /></div><div className="grid grid-cols-3 gap-3"><Campo label="Valor (R$) *" value={lancamento.valorOriginal} onChange={(valor) => setLancamento({ ...lancamento, valorOriginal: valor })} /><Campo label="Data de emissão" type="date" value={lancamento.dataEmissao} onChange={(valor) => setLancamento({ ...lancamento, dataEmissao: valor })} /><Campo label="Vencimento" type="date" value={lancamento.dataVencimento} onChange={(valor) => setLancamento({ ...lancamento, dataVencimento: valor })} /></div><div className="rounded-lg border border-border bg-muted/20 p-3"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium">Parcelar lançamento</p><p className="text-xs text-muted-foreground mt-0.5">Cada parcela será criada como um título independente.</p></div><input type="checkbox" checked={lancamento.parcelar} onChange={(e) => setLancamento({ ...lancamento, parcelar: e.target.checked })} className="h-4 w-4 accent-primary" aria-label="Parcelar lançamento" /></div>{lancamento.parcelar && <div className="mt-3 max-w-[180px]"><Campo label="Quantidade de parcelas" type="number" value={lancamento.quantidadeParcelas} onChange={(valor) => setLancamento({ ...lancamento, quantidadeParcelas: valor })} /></div>}</div><div className="grid grid-cols-2 gap-3">{lancamento.tipo === "receber" ? <div className="space-y-2"><Label>Cliente (opcional)</Label><Select value={lancamento.clienteId || "nenhum"} onValueChange={(valor) => setLancamento({ ...lancamento, clienteId: valor === "nenhum" ? "" : valor })}><SelectTrigger><SelectValue placeholder="Sem cliente" /></SelectTrigger><SelectContent><SelectItem value="nenhum">Sem cliente vinculado</SelectItem>{(clientes.data ?? []).map((cliente: any) => <SelectItem key={cliente.id} value={String(cliente.id)}>{cliente.nome}</SelectItem>)}</SelectContent></Select></div> : <div className="space-y-2"><Label>Fornecedor (opcional)</Label><Select value={lancamento.fornecedorId || "nenhum"} onValueChange={(valor) => setLancamento({ ...lancamento, fornecedorId: valor === "nenhum" ? "" : valor })}><SelectTrigger><SelectValue placeholder="Sem fornecedor" /></SelectTrigger><SelectContent><SelectItem value="nenhum">Sem fornecedor vinculado</SelectItem>{(fornecedores.data ?? []).map((item: any) => <SelectItem key={item.id} value={String(item.id)}>{item.nome}</SelectItem>)}</SelectContent></Select></div>}<Campo label="Contraparte livre" value={lancamento.contraparteNome} onChange={(valor) => setLancamento({ ...lancamento, contraparteNome: valor })} /></div><div className="grid grid-cols-2 gap-3"><Campo label="Desconto (R$)" value={lancamento.desconto} onChange={(valor) => setLancamento({ ...lancamento, desconto: valor })} /><Campo label="Juros (R$)" value={lancamento.juros} onChange={(valor) => setLancamento({ ...lancamento, juros: valor })} /></div><div className="space-y-2"><Label>Observações</Label><Textarea rows={2} value={lancamento.observacoes} onChange={(e) => setLancamento({ ...lancamento, observacoes: e.target.value })} /></div><Button className="w-full" onClick={salvarLancamento} disabled={criarLancamento.isPending || criarLancamentoParcelado.isPending}>{(criarLancamento.isPending || criarLancamentoParcelado.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}{lancamento.parcelar ? "Criar parcelas" : "Criar lançamento"}</Button></div></DialogContent></Dialog>

      <Dialog open={baixaAberta} onOpenChange={setBaixaAberta}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Registrar baixa</DialogTitle></DialogHeader><div className="space-y-4"><div className="rounded-lg bg-muted/50 p-3 text-sm"><p className="font-medium">{tituloSelecionado?.descricao}</p><p className="text-muted-foreground mt-1">Saldo em aberto: <strong className="text-foreground">{formatCurrency(tituloSelecionado ? saldoTitulo(tituloSelecionado) : 0)}</strong></p></div><div className="space-y-2"><Label>Conta financeira *</Label><Select value={baixa.contaFinanceiraId} onValueChange={(valor) => setBaixa({ ...baixa, contaFinanceiraId: valor })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(contas.data ?? []).map((item: any) => <SelectItem key={item.id} value={String(item.id)}>{item.nome}</SelectItem>)}</SelectContent></Select></div><div className="grid grid-cols-2 gap-3"><Campo label="Valor (R$) *" value={baixa.valor} onChange={(valor) => setBaixa({ ...baixa, valor })} /><Campo label="Data da baixa" type="date" value={baixa.dataBaixa} onChange={(valor) => setBaixa({ ...baixa, dataBaixa: valor })} /></div><CampoSelect label="Forma de pagamento" value={baixa.formaPagamento} onValueChange={(valor) => setBaixa({ ...baixa, formaPagamento: valor })} opcoes={[["pix", "PIX"], ["dinheiro", "Dinheiro"], ["transferencia", "Transferência"], ["boleto", "Boleto"], ["cartao_credito", "Cartão de crédito"], ["cartao_debito", "Cartão de débito"], ["outro", "Outro"]]} /><div className="space-y-2"><Label>Observações</Label><Textarea rows={2} value={baixa.observacoes} onChange={(e) => setBaixa({ ...baixa, observacoes: e.target.value })} /></div><Button className="w-full" onClick={salvarBaixa} disabled={registrarBaixa.isPending}>{registrarBaixa.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Confirmar baixa</Button></div></DialogContent></Dialog>

      <Dialog open={Boolean(tituloBaixas)} onOpenChange={(aberto) => !aberto && setTituloBaixas(null)}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Baixas e conciliação</DialogTitle></DialogHeader><div className="space-y-3"><div className="rounded-lg bg-muted/50 p-3 text-sm"><p className="font-medium">{tituloBaixas?.descricao}</p><p className="text-muted-foreground mt-1">Marque como conciliada após conferir a movimentação na conta financeira.</p></div>{baixasTitulo.isLoading ? <div className="py-8 text-center text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />Carregando baixas...</div> : baixasTitulo.data?.length ? <div className="divide-y rounded-lg border">{baixasTitulo.data.map((item: any) => <div key={item.id} className="flex items-center justify-between gap-3 p-3"><div><p className="font-medium text-sm">{formatCurrency(item.valor)} · {item.formaPagamento}</p><p className="text-xs text-muted-foreground">{item.contaNome ?? "Conta não encontrada"} · {formatarDataFinanceira(item.dataBaixa)}</p><p className="text-xs text-muted-foreground">{item.conciliada ? "Conciliada" : "Pendente de conciliação"}</p></div><Button size="sm" variant={item.conciliada ? "outline" : "default"} disabled={conciliarBaixa.isPending} onClick={() => conciliarBaixa.mutate({ id: item.id, conciliada: !item.conciliada }, { onSuccess: () => { toast.success(item.conciliada ? "Conciliação desfeita" : "Baixa conciliada"); baixasTitulo.refetch(); } })}>{item.conciliada ? "Desconciliar" : "Conciliar"}</Button></div>)}</div> : <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma baixa encontrada.</p>}</div></DialogContent></Dialog>

      <Dialog open={fornecedorAberto} onOpenChange={setFornecedorAberto}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Novo fornecedor</DialogTitle></DialogHeader><div className="space-y-3"><Campo label="Nome *" value={fornecedor.nome} onChange={(valor) => setFornecedor({ ...fornecedor, nome: valor })} /><div className="grid grid-cols-2 gap-3"><Campo label="Contato" value={fornecedor.contacto} onChange={(valor) => setFornecedor({ ...fornecedor, contacto: valor })} /><Campo label="Documento" value={fornecedor.documento} onChange={(valor) => setFornecedor({ ...fornecedor, documento: valor })} /></div><Campo label="E-mail" type="email" value={fornecedor.email} onChange={(valor) => setFornecedor({ ...fornecedor, email: valor })} /><Campo label="Endereço" value={fornecedor.endereco} onChange={(valor) => setFornecedor({ ...fornecedor, endereco: valor })} /><div className="space-y-2"><Label>Observações</Label><Textarea rows={2} value={fornecedor.observacoes} onChange={(e) => setFornecedor({ ...fornecedor, observacoes: e.target.value })} /></div><Button className="w-full" onClick={salvarFornecedor} disabled={criarFornecedor.isPending}>Salvar fornecedor</Button></div></DialogContent></Dialog>

      <Dialog open={categoriaAberta} onOpenChange={setCategoriaAberta}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Nova categoria financeira</DialogTitle></DialogHeader><div className="space-y-4"><Campo label="Nome *" value={categoria.nome} onChange={(valor) => setCategoria({ ...categoria, nome: valor })} /><CampoSelect label="Aplicação" value={categoria.tipo} onValueChange={(valor) => setCategoria({ ...categoria, tipo: valor as "receita" | "despesa" | "ambos" })} opcoes={[["receita", "Somente receita"], ["despesa", "Somente despesa"], ["ambos", "Receita e despesa"]]} /><Button className="w-full" onClick={salvarCategoria} disabled={criarCategoria.isPending}>Salvar categoria</Button></div></DialogContent></Dialog>

      <Dialog open={contaAberta} onOpenChange={setContaAberta}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Nova conta financeira</DialogTitle></DialogHeader><div className="space-y-4"><Campo label="Nome *" value={conta.nome} onChange={(valor) => setConta({ ...conta, nome: valor })} /><CampoSelect label="Tipo" value={conta.tipo} onValueChange={(valor) => setConta({ ...conta, tipo: valor as "caixa" | "banco" | "carteira" | "outro" })} opcoes={[["caixa", "Caixa"], ["banco", "Banco"], ["carteira", "Carteira"], ["outro", "Outro"]]} /><Campo label="Saldo inicial (R$)" value={conta.saldoInicial} onChange={(valor) => setConta({ ...conta, saldoInicial: valor })} /><div className="space-y-2"><Label>Observações</Label><Textarea rows={2} value={conta.observacoes} onChange={(e) => setConta({ ...conta, observacoes: e.target.value })} /></div><Button className="w-full" onClick={salvarConta} disabled={criarConta.isPending}>Salvar conta</Button></div></DialogContent></Dialog>

      <Dialog open={recorrenciaAberta} onOpenChange={setRecorrenciaAberta}><DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Nova recorrência financeira</DialogTitle></DialogHeader><div className="space-y-4"><p className="text-sm text-muted-foreground">A regra será processada diariamente para criar o título correspondente na data do próximo vencimento.</p><div className="grid grid-cols-2 gap-3"><CampoSelect label="Tipo" value={recorrencia.tipo} onValueChange={(valor) => setRecorrencia({ ...recorrencia, tipo: valor as "receber" | "pagar" })} opcoes={[["receber", "Conta a receber"], ["pagar", "Conta a pagar"]]} /><div className="space-y-2"><Label>Categoria *</Label><Select value={recorrencia.categoriaId} onValueChange={(valor) => setRecorrencia({ ...recorrencia, categoriaId: valor })}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{(categorias.data ?? []).filter((item: any) => item.tipo === "ambos" || item.tipo === (recorrencia.tipo === "receber" ? "receita" : "despesa")).map((item: any) => <SelectItem key={item.id} value={String(item.id)}>{item.nome}</SelectItem>)}</SelectContent></Select></div></div><Campo label="Descrição *" value={recorrencia.descricao} onChange={(valor) => setRecorrencia({ ...recorrencia, descricao: valor })} /><div className="grid grid-cols-3 gap-3"><Campo label="Valor (R$) *" value={recorrencia.valor} onChange={(valor) => setRecorrencia({ ...recorrencia, valor })} /><CampoSelect label="Frequência" value={recorrencia.frequencia} onValueChange={(valor) => setRecorrencia({ ...recorrencia, frequencia: valor as typeof recorrencia.frequencia })} opcoes={[["semanal", "Semanal"], ["mensal", "Mensal"], ["trimestral", "Trimestral"], ["semestral", "Semestral"], ["anual", "Anual"]]} /><Campo label="Próximo vencimento" type="date" value={recorrencia.proximoVencimento} onChange={(valor) => setRecorrencia({ ...recorrencia, proximoVencimento: valor })} /></div><div className="grid grid-cols-2 gap-3">{recorrencia.tipo === "receber" ? <div className="space-y-2"><Label>Cliente (opcional)</Label><Select value={recorrencia.clienteId || "nenhum"} onValueChange={(valor) => setRecorrencia({ ...recorrencia, clienteId: valor === "nenhum" ? "" : valor })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="nenhum">Sem cliente vinculado</SelectItem>{(clientes.data ?? []).map((cliente: any) => <SelectItem key={cliente.id} value={String(cliente.id)}>{cliente.nome}</SelectItem>)}</SelectContent></Select></div> : <div className="space-y-2"><Label>Fornecedor (opcional)</Label><Select value={recorrencia.fornecedorId || "nenhum"} onValueChange={(valor) => setRecorrencia({ ...recorrencia, fornecedorId: valor === "nenhum" ? "" : valor })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="nenhum">Sem fornecedor vinculado</SelectItem>{(fornecedores.data ?? []).map((item: any) => <SelectItem key={item.id} value={String(item.id)}>{item.nome}</SelectItem>)}</SelectContent></Select></div>}<Campo label="Fim da recorrência" type="date" value={recorrencia.dataFim} onChange={(valor) => setRecorrencia({ ...recorrencia, dataFim: valor })} /></div><Campo label="Contraparte livre" value={recorrencia.contraparteNome} onChange={(valor) => setRecorrencia({ ...recorrencia, contraparteNome: valor })} /><div className="space-y-2"><Label>Observações</Label><Textarea rows={2} value={recorrencia.observacoes} onChange={(e) => setRecorrencia({ ...recorrencia, observacoes: e.target.value })} /></div><Button className="w-full" onClick={salvarRecorrencia} disabled={criarRecorrencia.isPending}>{criarRecorrencia.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Criar recorrência</Button></div></DialogContent></Dialog>
    </div>
  );
}

function ResumoCard({ label, valor, icon, color, descricao }: { label: string; valor: number; icon: React.ReactNode; color: string; descricao?: string }) {
  return <div className="rounded-xl border border-border/60 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold tracking-tight">{formatCurrency(valor)}</p><p className="mt-1 text-xs text-muted-foreground">{descricao ?? "Títulos em aberto"}</p></div><div className={`rounded-lg p-2.5 ${color}`}>{icon}</div></div></div>;
}

function ListaCompromissos({ titulo, descricao, titulos, classe, vazio }: { titulo: string; descricao: string; titulos: any[]; classe: string; vazio: string }) {
  return <section className={`rounded-xl border bg-white shadow-sm overflow-hidden ${classe}`}><div className="px-5 py-4 border-b"><h2 className="font-semibold text-sm">{titulo}</h2><p className="text-xs text-muted-foreground mt-0.5">{descricao}</p></div>{titulos.length ? <div className="divide-y">{titulos.slice(0, 4).map((titulo) => <div key={titulo.id} className="flex items-center justify-between gap-3 px-5 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{titulo.descricao}</p><p className="text-xs text-muted-foreground">{formatarDataFinanceira(titulo.dataVencimento)} · {titulo.tipo === "receber" ? "A receber" : "A pagar"}</p></div><p className="shrink-0 text-sm font-semibold">{formatCurrency(saldoTitulo(titulo))}</p></div>)}</div> : <p className="px-5 py-8 text-center text-sm text-muted-foreground">{vazio}</p>}</section>;
}

function Campo({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (valor: string) => void; type?: string }) {
  return <div className="space-y-2"><Label>{label}</Label><Input type={type} value={value} onChange={(e) => onChange(e.target.value)} /></div>;
}

function CampoSelect({ label, value, onValueChange, opcoes }: { label: string; value: string; onValueChange: (valor: string) => void; opcoes: [string, string][] }) {
  return <div className="space-y-2"><Label>{label}</Label><Select value={value} onValueChange={onValueChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{opcoes.map(([valor, texto]) => <SelectItem key={valor} value={valor}>{texto}</SelectItem>)}</SelectContent></Select></div>;
}

function CadastroTabela({ titulo, descricao, icone, botao, aoCriar, colunas, linhas, vazio }: { titulo: string; descricao: string; icone: React.ReactNode; botao: string; aoCriar: () => void; colunas: string[]; linhas: string[][]; vazio: string }) {
  return <section className="rounded-xl border border-border/60 bg-white shadow-sm overflow-hidden"><div className="flex items-center justify-between px-5 py-4 border-b bg-muted/20"><div className="flex items-center gap-3"><div className="rounded-lg bg-primary/10 p-2 text-primary">{icone}</div><div><h2 className="font-semibold">{titulo}</h2><p className="text-xs text-muted-foreground mt-0.5">{descricao}</p></div></div><Button size="sm" onClick={aoCriar}><Plus className="h-3.5 w-3.5 mr-1.5" />{botao}</Button></div>{linhas.length ? <Table><TableHeader><TableRow className="bg-muted/40">{colunas.map((coluna) => <TableHead key={coluna}>{coluna}</TableHead>)}</TableRow></TableHeader><TableBody>{linhas.map((linha, indice) => <TableRow key={`${linha[0]}-${indice}`}>{linha.map((celula, celulaIndice) => <TableCell key={`${celula}-${celulaIndice}`} className={celulaIndice === 0 ? "font-medium" : "text-muted-foreground"}>{celula}</TableCell>)}</TableRow>)}</TableBody></Table> : <EstadoVazio icon={<CircleAlert className="h-8 w-8" />} texto={vazio} acao={aoCriar} labelAcao={botao} />}</section>;
}

function EstadoVazio({ icon, texto, acao, labelAcao }: { icon: React.ReactNode; texto: string; acao: () => void; labelAcao: string }) {
  return <div className="p-12 text-center text-muted-foreground"><div className="mx-auto mb-3 w-fit opacity-40">{icon}</div><p className="text-sm">{texto}</p><Button variant="outline" size="sm" className="mt-4" onClick={acao}><Plus className="h-3.5 w-3.5 mr-1.5" />{labelAcao}</Button></div>;
}
