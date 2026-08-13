import { useEffect, useMemo, useState } from "react";
import { useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { formatCurrency, formatReceivableSaleReference } from "@/lib/utils";
import { exportarListaFinanceiraPdf } from "@/lib/financeiroPdf";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { SearchableEntitySelect } from "@/components/SearchableEntitySelect";
import {
  ArrowDownToLine, ArrowUpFromLine, Building2, CalendarClock, CheckCircle2,
  CircleAlert, CircleDollarSign, Download, FileSpreadsheet, Landmark, Loader2, Pencil, Plus, RefreshCw, RotateCcw, Tags, Upload, WalletCards,
} from "lucide-react";
import { toast } from "sonner";

const hoje = () => new Date().toISOString().slice(0, 10);
const primeiroDiaDoMes = () => {
  const data = new Date();
  data.setDate(1);
  return data.toISOString().slice(0, 10);
};

export function abaFinanceiraDaUrl(search: string): "fluxo" | "lancamentos" {
  return new URLSearchParams(search).get("aba") === "fluxo" ? "fluxo" : "lancamentos";
}
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

type EntidadeContextual = "cliente" | "fornecedor" | "categoria" | "conta";
type DestinoContextual = "lancamento" | "recorrencia" | "baixa";
type VisaoFinanceira = "pagar" | "receber" | "pagas" | "recebidas";

const opcoesVisaoFinanceira: Array<{ id: VisaoFinanceira; label: string; descricao: string }> = [
  { id: "pagar", label: "Contas a pagar", descricao: "Compromissos em aberto e em atraso" },
  { id: "receber", label: "Contas a receber", descricao: "Recebimentos previstos e em atraso" },
  { id: "pagas", label: "Contas pagas", descricao: "Histórico de pagamentos concluídos" },
  { id: "recebidas", label: "Contas recebidas", descricao: "Histórico de recebimentos concluídos" },
];

const valorInicialFiltrosFinanceiros = () => ({ descricao: "", valorMinimo: "", valorMaximo: "", dataInicio: "", dataFim: "" });

function saldoTitulo(titulo: any): number {
  return Math.max(0,
    Number(titulo.valorOriginal || 0) - Number(titulo.desconto || 0) + Number(titulo.juros || 0) - Number(titulo.valorBaixado || 0),
  );
}

function formatarDataFinanceira(value: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value));
}

function dataChaveFinanceira(value: string | Date): string {
  return new Date(value).toISOString().slice(0, 10);
}

function valorTotalTitulo(titulo: any): number {
  return Number(titulo.valorOriginal || 0) - Number(titulo.desconto || 0) + Number(titulo.juros || 0);
}

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
  const [aba, setAba] = useState<"lancamentos" | "fluxo" | "recorrencias" | "fornecedores" | "categorias" | "contas">(() => abaFinanceiraDaUrl(search));
  const [lancamentoAberto, setLancamentoAberto] = useState(false);
  const [baixaAberta, setBaixaAberta] = useState(false);
  const [fornecedorAberto, setFornecedorAberto] = useState(false);
  const [categoriaAberta, setCategoriaAberta] = useState(false);
  const [contaAberta, setContaAberta] = useState(false);
  const [clienteAberto, setClienteAberto] = useState(false);
  const [contextoCriacao, setContextoCriacao] = useState<{ entidade: EntidadeContextual; destino: DestinoContextual } | null>(null);
  const [visaoFinanceira, setVisaoFinanceira] = useState<VisaoFinanceira>(() => {
    const tipo = new URLSearchParams(search).get("tipo");
    return tipo === "receber" ? "receber" : "pagar";
  });
  const [filtrosFinanceiros, setFiltrosFinanceiros] = useState(valorInicialFiltrosFinanceiros);
  const [recorrenciaAberta, setRecorrenciaAberta] = useState(false);
  const [tituloSelecionado, setTituloSelecionado] = useState<any>(null);
  const [tituloParaEditar, setTituloParaEditar] = useState<any>(null);
  const [vencimentoEditado, setVencimentoEditado] = useState(hoje());
  const [tituloBaixas, setTituloBaixas] = useState<any>(null);
  const [tituloParaCancelar, setTituloParaCancelar] = useState<any>(null);
  const [baixaParaEstornar, setBaixaParaEstornar] = useState<any>(null);
  const [motivoEstorno, setMotivoEstorno] = useState("");
  const [periodoFluxo, setPeriodoFluxo] = useState({ dataInicio: primeiroDiaDoMes(), dataFim: hoje() });
  const [importacaoAberta, setImportacaoAberta] = useState(false);
  const [arquivoImportacao, setArquivoImportacao] = useState<File | null>(null);
  const [errosImportacao, setErrosImportacao] = useState<string[]>([]);

  useEffect(() => {
    setAba(abaFinanceiraDaUrl(search));
  }, [search]);
  const [lancamento, setLancamento] = useState(valorInicialLancamento);
  const [baixa, setBaixa] = useState({ contaFinanceiraId: "", valor: "", dataBaixa: hoje(), formaPagamento: "pix", observacoes: "" });
  const [fornecedor, setFornecedor] = useState({ nome: "", contacto: "", email: "", documento: "", endereco: "", observacoes: "" });
  const [categoria, setCategoria] = useState({ nome: "", tipo: "ambos" as "receita" | "despesa" | "ambos" });
  const [conta, setConta] = useState({ nome: "", tipo: "caixa" as "caixa" | "banco" | "carteira" | "outro", saldoInicial: "0", observacoes: "" });
  const [cliente, setCliente] = useState({ nome: "", contacto: "", email: "", morada: "", nif: "", observacoes: "" });
  const [recorrencia, setRecorrencia] = useState(valorInicialRecorrencia);
  const tipoConsulta = new URLSearchParams(search).get("tipo");
  const tipoAtalho: VisaoFinanceira | null = ["pagar", "receber", "pagas", "recebidas"].includes(tipoConsulta ?? "")
    ? tipoConsulta as VisaoFinanceira
    : null;
  const acessoDiretoLista = tipoAtalho !== null;

  useEffect(() => {
    if (tipoAtalho) setVisaoFinanceira(tipoAtalho);
  }, [tipoAtalho]);

  const titulos = trpc.financeiro.titulos.list.useQuery();
  const categorias = trpc.financeiro.categorias.list.useQuery();
  const fornecedores = trpc.financeiro.fornecedores.list.useQuery();
  const contas = trpc.financeiro.contas.list.useQuery();
  const recorrencias = trpc.financeiro.recorrencias.list.useQuery();
  const alertas = trpc.financeiro.alertas.list.useQuery();
  const fluxoCaixa = trpc.financeiro.relatorios.fluxoCaixa.useQuery(periodoFluxo);
  const previsaoSemanal = trpc.financeiro.relatorios.previsaoSemanal.useQuery({ semanas: 8 });
  const modeloImportacao = trpc.financeiro.intercambios.modeloLancamentosCsv.useQuery(undefined, { enabled: false });
  const exportacaoLancamentos = trpc.financeiro.intercambios.exportarLancamentosCsv.useQuery(
    visaoFinanceira === "pagar" || visaoFinanceira === "pagas" ? { tipo: "pagar" } : { tipo: "receber" },
    { enabled: false },
  );
  const baixasTitulo = trpc.financeiro.titulos.baixas.useQuery(
    { tituloId: tituloBaixas?.id ?? 0 },
    { enabled: Boolean(tituloBaixas) },
  );
  const clientes = trpc.cliente.list.useQuery();
  const criarLancamento = trpc.financeiro.titulos.createManual.useMutation();
  const criarLancamentoParcelado = trpc.financeiro.titulos.createParcelado.useMutation();
  const atualizarAgendamento = trpc.financeiro.titulos.updateAgendamento.useMutation();
  const registrarBaixa = trpc.financeiro.titulos.baixar.useMutation();
  const criarFornecedor = trpc.financeiro.fornecedores.create.useMutation();
  const criarCategoria = trpc.financeiro.categorias.create.useMutation();
  const criarConta = trpc.financeiro.contas.create.useMutation();
  const criarCliente = trpc.cliente.create.useMutation();
  const criarRecorrencia = trpc.financeiro.recorrencias.create.useMutation();
  const conciliarBaixa = trpc.financeiro.titulos.conciliarBaixa.useMutation();
  const estornarBaixa = trpc.financeiro.titulos.estornarBaixa.useMutation();
  const cancelarTitulo = trpc.financeiro.titulos.cancelar.useMutation();
  const importarLancamentos = trpc.financeiro.intercambios.importarLancamentosCsv.useMutation();
  const maiorFluxoDiario = useMemo(() => Math.max(...(fluxoCaixa.data?.dias ?? []).flatMap((dia: any) => [Number(dia.entradas), Number(dia.saidas)]), 1), [fluxoCaixa.data]);

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

  const titulosExibidos = useMemo(() => {
    const descricao = filtrosFinanceiros.descricao.trim().toLocaleLowerCase("pt-BR");
    const valorMinimo = filtrosFinanceiros.valorMinimo ? Number(filtrosFinanceiros.valorMinimo.replace(",", ".")) : null;
    const valorMaximo = filtrosFinanceiros.valorMaximo ? Number(filtrosFinanceiros.valorMaximo.replace(",", ".")) : null;
    const tipo = visaoFinanceira === "pagar" || visaoFinanceira === "pagas" ? "pagar" : "receber";
    const quitado = visaoFinanceira === "pagas" || visaoFinanceira === "recebidas";
    return (titulos.data ?? []).filter((titulo: any) => {
      if (titulo.tipo !== tipo || titulo.estado === "cancelado") return false;
      if (quitado ? titulo.estado !== "quitado" : ["quitado", "cancelado"].includes(titulo.estado)) return false;
      if (descricao && !`${titulo.descricao} ${titulo.contraparteNome ?? ""}`.toLocaleLowerCase("pt-BR").includes(descricao)) return false;
      const valor = valorTotalTitulo(titulo);
      if (valorMinimo !== null && valor < valorMinimo) return false;
      if (valorMaximo !== null && valor > valorMaximo) return false;
      const data = dataChaveFinanceira(titulo.dataVencimento);
      if (filtrosFinanceiros.dataInicio && data < filtrosFinanceiros.dataInicio) return false;
      if (filtrosFinanceiros.dataFim && data > filtrosFinanceiros.dataFim) return false;
      return true;
    });
  }, [titulos.data, visaoFinanceira, filtrosFinanceiros]);
  const tituloLancamentos = opcoesVisaoFinanceira.find((item) => item.id === visaoFinanceira)!;
  const titulosHoje = useMemo(() => titulosExibidos.filter((titulo: any) => dataChaveFinanceira(titulo.dataVencimento) === hoje()), [titulosExibidos]);

  const invalidarFinanceiro = () => {
    utils.financeiro.titulos.list.invalidate();
    utils.financeiro.categorias.list.invalidate();
    utils.financeiro.fornecedores.list.invalidate();
    utils.financeiro.contas.list.invalidate();
    utils.financeiro.recorrencias.list.invalidate();
    utils.financeiro.alertas.list.invalidate();
    utils.financeiro.relatorios.fluxoCaixa.invalidate();
    utils.financeiro.relatorios.previsaoSemanal.invalidate();
    if (tituloBaixas) utils.financeiro.titulos.baixas.invalidate({ tituloId: tituloBaixas.id });
  };

  const selecionarEntidadeCriada = (entidade: EntidadeContextual, id: number) => {
    if (contextoCriacao?.entidade !== entidade) return;
    const valor = String(id);
    if (contextoCriacao.destino === "lancamento") {
      setLancamento((atual) => ({
        ...atual,
        ...(entidade === "categoria" ? { categoriaId: valor } : {}),
        ...(entidade === "cliente" ? { clienteId: valor } : {}),
        ...(entidade === "fornecedor" ? { fornecedorId: valor } : {}),
      }));
    }
    if (contextoCriacao.destino === "recorrencia") {
      setRecorrencia((atual) => ({
        ...atual,
        ...(entidade === "categoria" ? { categoriaId: valor } : {}),
        ...(entidade === "cliente" ? { clienteId: valor } : {}),
        ...(entidade === "fornecedor" ? { fornecedorId: valor } : {}),
      }));
    }
    if (contextoCriacao.destino === "baixa" && entidade === "conta") {
      setBaixa((atual) => ({ ...atual, contaFinanceiraId: valor }));
    }
    setContextoCriacao(null);
  };

  const abrirCriacaoContextual = (entidade: EntidadeContextual, destino: DestinoContextual) => {
    setContextoCriacao({ entidade, destino });
    if (entidade === "fornecedor") { setFornecedor({ nome: "", contacto: "", email: "", documento: "", endereco: "", observacoes: "" }); setFornecedorAberto(true); }
    if (entidade === "categoria") { setCategoria({ nome: "", tipo: destino === "lancamento" ? (lancamento.tipo === "receber" ? "receita" : "despesa") : (recorrencia.tipo === "receber" ? "receita" : "despesa") }); setCategoriaAberta(true); }
    if (entidade === "conta") { setConta({ nome: "", tipo: "caixa", saldoInicial: "0", observacoes: "" }); setContaAberta(true); }
    if (entidade === "cliente") { setCliente({ nome: "", contacto: "", email: "", morada: "", nif: "", observacoes: "" }); setClienteAberto(true); }
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

  const abrirEdicaoAgendamento = (titulo: any) => {
    setTituloParaEditar(titulo);
    setVencimentoEditado(new Date(titulo.dataVencimento).toISOString().slice(0, 10));
  };

  const salvarAgendamento = () => {
    if (!tituloParaEditar || !vencimentoEditado) return;
    atualizarAgendamento.mutate({ id: tituloParaEditar.id, dataVencimento: vencimentoEditado }, {
      onSuccess: () => {
        toast.success("Vencimento atualizado com sucesso");
        setTituloParaEditar(null);
        invalidarFinanceiro();
      },
      onError: (erro) => toast.error(erro.message),
    });
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

  const confirmarEstorno = () => {
    if (!baixaParaEstornar || motivoEstorno.trim().length < 3) {
      toast.error("Informe o motivo do estorno");
      return;
    }
    estornarBaixa.mutate({ id: baixaParaEstornar.id, motivo: motivoEstorno.trim() }, {
      onSuccess: () => {
        toast.success("Baixa estornada e título recalculado com sucesso");
        setBaixaParaEstornar(null);
        setMotivoEstorno("");
        invalidarFinanceiro();
        baixasTitulo.refetch();
      },
      onError: (erro) => toast.error(erro.message),
    });
  };

  const baixarModeloImportacao = async () => {
    const resposta = await modeloImportacao.refetch();
    if (!resposta.data) { toast.error("Não foi possível gerar o modelo CSV"); return; }
    baixarCsv(resposta.data, "modelo-lancamentos-fk-madeiras.csv");
    toast.success("Modelo CSV baixado");
  };

  const exportarLancamentos = async () => {
    const resposta = await exportacaoLancamentos.refetch();
    if (!resposta.data) { toast.error("Não foi possível exportar os lançamentos"); return; }
    baixarCsv(resposta.data, `lancamentos-fk-madeiras-${hoje()}.csv`);
    toast.success("Lançamentos exportados em CSV");
  };

  const importarArquivo = async () => {
    if (!arquivoImportacao) { toast.error("Selecione um arquivo CSV para importar"); return; }
    try {
      const conteudo = await arquivoImportacao.text();
      importarLancamentos.mutate({ conteudo }, {
        onSuccess: (resultado) => {
          if (resultado.erros.length) { setErrosImportacao(resultado.erros); toast.error("A importação foi recusada. Revise as linhas indicadas."); return; }
          toast.success(`${resultado.importados} lançamento(s) importado(s) com sucesso`);
          setArquivoImportacao(null);
          setErrosImportacao([]);
          setImportacaoAberta(false);
          invalidarFinanceiro();
        },
        onError: (erro) => toast.error(erro.message),
      });
    } catch {
      toast.error("Não foi possível ler o arquivo selecionado");
    }
  };

  const salvarFornecedor = () => criarFornecedor.mutate({ ...fornecedor, email: fornecedor.email || null, contacto: fornecedor.contacto || null, documento: fornecedor.documento || null, endereco: fornecedor.endereco || null, observacoes: fornecedor.observacoes || null }, {
    onSuccess: (criado) => { toast.success("Fornecedor cadastrado"); utils.financeiro.fornecedores.list.invalidate(); selecionarEntidadeCriada("fornecedor", criado.id); setFornecedorAberto(false); setFornecedor({ nome: "", contacto: "", email: "", documento: "", endereco: "", observacoes: "" }); },
    onError: (erro) => toast.error(erro.message),
  });

  const salvarCategoria = () => criarCategoria.mutate(categoria, {
    onSuccess: (criada) => { toast.success("Categoria criada"); utils.financeiro.categorias.list.invalidate(); selecionarEntidadeCriada("categoria", criada.id); setCategoriaAberta(false); setCategoria({ nome: "", tipo: "ambos" }); },
    onError: (erro) => toast.error(erro.message),
  });

  const salvarConta = () => criarConta.mutate({ ...conta, observacoes: conta.observacoes || null }, {
    onSuccess: (criada) => { toast.success("Conta financeira cadastrada"); utils.financeiro.contas.list.invalidate(); selecionarEntidadeCriada("conta", criada.id); setContaAberta(false); setConta({ nome: "", tipo: "caixa", saldoInicial: "0", observacoes: "" }); },
    onError: (erro) => toast.error(erro.message),
  });

  const salvarCliente = () => criarCliente.mutate({ ...cliente, contacto: cliente.contacto || undefined, email: cliente.email || undefined, morada: cliente.morada || undefined, nif: cliente.nif || undefined, observacoes: cliente.observacoes || undefined }, {
    onSuccess: (criado) => { toast.success("Cliente cadastrado"); utils.cliente.list.invalidate(); selecionarEntidadeCriada("cliente", criado.id!); setClienteAberto(false); setCliente({ nome: "", contacto: "", email: "", morada: "", nif: "", observacoes: "" }); },
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

  const exportarListaFiltradaPdf = async () => {
    if (!titulosExibidos.length) {
      toast.error("Não há títulos visíveis para exportar");
      return;
    }
    try {
      await exportarListaFinanceiraPdf({
        titulo: tituloLancamentos.label,
        filtros: filtrosFinanceiros,
        titulos: titulosExibidos,
      });
      toast.success("PDF financeiro gerado");
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível gerar o PDF");
    }
  };

  const carregando = titulos.isLoading || categorias.isLoading || contas.isLoading || fornecedores.isLoading || recorrencias.isLoading;
  const abas = [
    ["lancamentos", "Lançamentos", WalletCards], ["fluxo", "Fluxo de caixa", CircleDollarSign], ["fornecedores", "Fornecedores", Building2],
    ["recorrencias", "Recorrências", RefreshCw], ["categorias", "Categorias", Tags], ["contas", "Contas", Landmark],
  ] as const;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><div className="rounded-lg bg-primary/10 p-2"><WalletCards className="h-5 w-5 text-primary" /></div><h1 className="text-2xl font-bold tracking-tight text-foreground">Financeiro</h1></div>
          <p className="text-sm text-muted-foreground mt-2">Contas a receber, pagar e movimentações financeiras da empresa.</p>
        </div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setImportacaoAberta(true)}><Upload className="mr-2 h-4 w-4" />Importar CSV</Button><Button onClick={() => setLancamentoAberto(true)} className="bg-primary text-primary-foreground"><Plus className="h-4 w-4 mr-2" />Novo lançamento avulso</Button></div>
      </div>

      {!acessoDiretoLista && <div className="grid gap-4 md:grid-cols-3">
        <ResumoCard label="A receber" valor={resumo.receber} icon={<ArrowDownToLine className="h-5 w-5" />} color="text-emerald-700 bg-emerald-50" />
        <ResumoCard label="A pagar" valor={resumo.pagar} icon={<ArrowUpFromLine className="h-5 w-5" />} color="text-rose-700 bg-rose-50" />
        <ResumoCard label="Saldo projetado" valor={resumo.receber - resumo.pagar} icon={<CircleDollarSign className="h-5 w-5" />} color="text-primary bg-primary/10" descricao={resumo.vencidos > 0 ? `${formatCurrency(resumo.vencidos)} em atraso` : "Nenhum título vencido"} />
      </div>}

      {!acessoDiretoLista && <div className="grid gap-4 lg:grid-cols-2">
        <ListaCompromissos titulo="Títulos vencidos" descricao="Pendências que exigem atenção" titulos={compromissos.vencidos} classe="border-rose-200" vazio="Nenhum título vencido" />
        <ListaCompromissos titulo="Próximos 30 dias" descricao="Vencimentos previstos para o período" titulos={compromissos.proximos} classe="border-amber-200" vazio="Nenhum compromisso próximo" />
      </div>}

      {!acessoDiretoLista && alertas.data?.length ? <section className="rounded-xl border border-amber-200 bg-amber-50/40 shadow-sm overflow-hidden"><div className="flex items-center gap-2 border-b border-amber-200 px-5 py-4"><CircleAlert className="h-5 w-5 text-amber-700" /><div><h2 className="font-semibold text-sm text-amber-950">Alertas automáticos</h2><p className="text-xs text-amber-800">Gerados diariamente a partir dos vencimentos em aberto.</p></div><Badge className="ml-auto bg-amber-100 text-amber-800 hover:bg-amber-100">{alertas.data.length}</Badge></div><div className="divide-y divide-amber-100">{alertas.data.slice(0, 5).map((alerta: any) => <div key={alerta.id} className="flex items-center justify-between gap-4 px-5 py-3"><div><p className="text-sm font-medium text-amber-950">{alerta.mensagem}</p><p className="mt-0.5 text-xs text-amber-800">{alerta.tipo === "vencido" ? "Vencido" : "Próximo do vencimento"} · {formatCurrency(alerta.valorOriginal)}</p></div><Badge variant="outline" className="border-amber-300 bg-white text-amber-800">{alerta.tipo === "vencido" ? "Atenção" : "Acompanhar"}</Badge></div>)}</div></section> : null}

      <div className="flex items-center gap-1 overflow-x-auto border-b border-border">
        {abas.map(([id, label, Icon]) => <button key={id} onClick={() => setAba(id)} className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${aba === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}><Icon className="h-4 w-4" />{label}</button>)}
      </div>

      {aba === "lancamentos" && (
        <section className="rounded-xl border border-border/60 bg-white shadow-sm overflow-hidden">
          <div className="border-b bg-muted/20 px-5 py-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">Gestão de títulos</h2><p className="text-xs text-muted-foreground mt-0.5">Organize compromissos, recebimentos e históricos em listas operacionais.</p></div><div className="flex flex-wrap items-center gap-2"><Button size="sm" variant="outline" onClick={baixarModeloImportacao} disabled={modeloImportacao.isFetching}><FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />Modelo CSV</Button><Button size="sm" variant="outline" onClick={exportarLancamentos} disabled={exportacaoLancamentos.isFetching}><Download className="mr-1.5 h-3.5 w-3.5" />Exportar CSV</Button><Button size="sm" variant="outline" onClick={exportarListaFiltradaPdf} disabled={!titulosExibidos.length}><Download className="mr-1.5 h-3.5 w-3.5" />Exportar PDF</Button></div></div><div className="mt-4 flex gap-2 overflow-x-auto pb-1">{opcoesVisaoFinanceira.map((item) => <button key={item.id} onClick={() => setVisaoFinanceira(item.id)} className={`min-w-max rounded-lg border px-3 py-2 text-left transition-colors ${visaoFinanceira === item.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-white text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}><span className="block text-sm font-semibold">{item.label}</span><span className={`block text-[11px] ${visaoFinanceira === item.id ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{item.descricao}</span></button>)}</div></div>
          <div className="grid gap-3 border-b px-5 py-4 sm:grid-cols-2 lg:grid-cols-5"><div className="space-y-1 lg:col-span-2"><Label htmlFor="filtro-descricao" className="text-xs">Descrição ou contraparte</Label><Input id="filtro-descricao" value={filtrosFinanceiros.descricao} onChange={(event) => setFiltrosFinanceiros({ ...filtrosFinanceiros, descricao: event.target.value })} placeholder="Pesquisar por descrição" /></div><div className="space-y-1"><Label htmlFor="filtro-valor-minimo" className="text-xs">Valor mínimo</Label><Input id="filtro-valor-minimo" inputMode="decimal" value={filtrosFinanceiros.valorMinimo} onChange={(event) => setFiltrosFinanceiros({ ...filtrosFinanceiros, valorMinimo: event.target.value })} placeholder="R$ 0,00" /></div><div className="space-y-1"><Label htmlFor="filtro-valor-maximo" className="text-xs">Valor máximo</Label><Input id="filtro-valor-maximo" inputMode="decimal" value={filtrosFinanceiros.valorMaximo} onChange={(event) => setFiltrosFinanceiros({ ...filtrosFinanceiros, valorMaximo: event.target.value })} placeholder="Sem limite" /></div><div className="flex items-end"><Button variant="ghost" className="w-full" onClick={() => setFiltrosFinanceiros(valorInicialFiltrosFinanceiros())}>Limpar filtros</Button></div><div className="space-y-1"><Label htmlFor="filtro-data-inicio" className="text-xs">Data inicial</Label><Input id="filtro-data-inicio" type="date" value={filtrosFinanceiros.dataInicio} onChange={(event) => setFiltrosFinanceiros({ ...filtrosFinanceiros, dataInicio: event.target.value })} /></div><div className="space-y-1"><Label htmlFor="filtro-data-fim" className="text-xs">Data final</Label><Input id="filtro-data-fim" type="date" value={filtrosFinanceiros.dataFim} onChange={(event) => setFiltrosFinanceiros({ ...filtrosFinanceiros, dataFim: event.target.value })} /></div><div className="flex items-end lg:col-span-3"><p className="text-xs text-muted-foreground">O período considera o vencimento dos títulos. Nos históricos, use-o para consultar as contas liquidadas por vencimento.</p></div></div>
          <div className="flex items-center justify-between gap-3 border-b bg-muted/10 px-5 py-3"><div><p className="font-semibold text-sm">{tituloLancamentos.label}</p><p className="text-xs text-muted-foreground">{titulosExibidos.length} títulos encontrados</p></div>{titulosHoje.length > 0 && <Badge className={visaoFinanceira === "pagar" ? "bg-amber-100 text-amber-900 hover:bg-amber-100" : "bg-emerald-100 text-emerald-900 hover:bg-emerald-100"}>{titulosHoje.length} {visaoFinanceira === "pagar" ? "vencem" : "recebem"} hoje</Badge>}</div>
          {carregando ? <div className="p-12 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />Carregando financeiro...</div> : <TabelaTitulosFinanceiros titulos={titulosExibidos} historico={visaoFinanceira === "pagas" || visaoFinanceira === "recebidas"} tipo={visaoFinanceira === "pagar" || visaoFinanceira === "pagas" ? "pagar" : "receber"} onBaixas={setTituloBaixas} onEditar={abrirEdicaoAgendamento} onBaixar={abrirBaixa} onCancelar={setTituloParaCancelar} />}
        </section>
      )}

      {aba === "fluxo" && (
        <section className="overflow-hidden rounded-xl border border-border/60 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b bg-muted/20 px-5 py-4 md:flex-row md:items-end md:justify-between">
            <div><h2 className="font-semibold">Relatório de fluxo de caixa</h2><p className="mt-0.5 text-xs text-muted-foreground">Movimentações efetivadas por baixas, organizadas pelo período selecionado.</p></div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-end"><div className="space-y-1"><Label htmlFor="fluxo-inicio" className="text-xs">Data inicial</Label><Input id="fluxo-inicio" aria-label="Data inicial do fluxo de caixa" type="date" value={periodoFluxo.dataInicio} onChange={(e) => setPeriodoFluxo({ ...periodoFluxo, dataInicio: e.target.value })} /></div><div className="space-y-1"><Label htmlFor="fluxo-fim" className="text-xs">Data final</Label><Input id="fluxo-fim" aria-label="Data final do fluxo de caixa" type="date" value={periodoFluxo.dataFim} onChange={(e) => setPeriodoFluxo({ ...periodoFluxo, dataFim: e.target.value })} /></div><Button variant="outline" onClick={() => fluxoCaixa.refetch()} disabled={fluxoCaixa.isFetching}><RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${fluxoCaixa.isFetching ? "animate-spin" : ""}`} />Atualizar</Button></div>
          </div>
          {fluxoCaixa.isLoading ? <div className="p-12 text-center text-muted-foreground"><Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />Calculando fluxo de caixa...</div> : fluxoCaixa.data ? <div className="space-y-6 p-5"><section className="overflow-hidden rounded-lg border border-primary/20 bg-primary/[0.03]"><div className="flex flex-col gap-3 border-b border-primary/15 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-sm font-semibold">Previsão semanal de caixa</h3><p className="text-xs text-muted-foreground">Projeção dos próximos 8 períodos baseada apenas nos títulos ainda em aberto.</p></div><Badge variant="outline" className="w-fit border-primary/30 text-primary">Títulos projetados</Badge></div>{previsaoSemanal.isLoading ? <div className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Calculando previsão semanal...</div> : previsaoSemanal.data?.length ? <div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-primary/5"><TableHead>Semana</TableHead><TableHead className="text-right text-emerald-700">Entradas</TableHead><TableHead className="text-right text-rose-700">Saídas</TableHead><TableHead className="text-right">Resultado</TableHead><TableHead className="text-right">Saldo projetado</TableHead></TableRow></TableHeader><TableBody>{previsaoSemanal.data.map((semana: any) => <TableRow key={semana.inicioSemana} className={semana.saldoProjetado < 0 ? "bg-rose-50/60" : ""}><TableCell><p className="font-medium text-sm">{formatarDataFinanceira(semana.inicioSemana)} – {formatarDataFinanceira(semana.fimSemana)}</p><p className="text-xs text-muted-foreground">{semana.quantidadeTitulos} título(s) previsto(s)</p></TableCell><TableCell className="text-right font-medium text-emerald-700">{formatCurrency(semana.entradas)}</TableCell><TableCell className="text-right font-medium text-rose-700">{formatCurrency(semana.saidas)}</TableCell><TableCell className={`text-right font-semibold ${semana.saldoLiquido >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{semana.saldoLiquido >= 0 ? "+" : ""}{formatCurrency(semana.saldoLiquido)}</TableCell><TableCell className={`text-right font-bold ${semana.saldoProjetado >= 0 ? "text-primary" : "text-rose-700"}`}>{formatCurrency(semana.saldoProjetado)}</TableCell></TableRow>)}</TableBody></Table></div> : <p className="p-8 text-center text-sm text-muted-foreground">Não há títulos em aberto para projetar nas próximas semanas.</p>}</section><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><ResumoCard label="Saldo de abertura" valor={fluxoCaixa.data.saldoAbertura} icon={<Landmark className="h-5 w-5" />} color="text-slate-700 bg-slate-100" descricao="Antes do período" /><ResumoCard label="Entradas" valor={fluxoCaixa.data.entradas} icon={<ArrowDownToLine className="h-5 w-5" />} color="text-emerald-700 bg-emerald-50" descricao="Recebimentos efetivados" /><ResumoCard label="Saídas" valor={fluxoCaixa.data.saidas} icon={<ArrowUpFromLine className="h-5 w-5" />} color="text-rose-700 bg-rose-50" descricao="Pagamentos efetivados" /><ResumoCard label="Resultado líquido" valor={fluxoCaixa.data.saldoLiquido} icon={<CircleDollarSign className="h-5 w-5" />} color={fluxoCaixa.data.saldoLiquido >= 0 ? "text-primary bg-primary/10" : "text-rose-700 bg-rose-50"} descricao="Entradas menos saídas" /><ResumoCard label="Saldo final" valor={fluxoCaixa.data.saldoFinal} icon={<WalletCards className="h-5 w-5" />} color="text-primary bg-primary/10" descricao="Após as movimentações" /></div><div className="grid gap-5 xl:grid-cols-[1fr_1.1fr]"><div className="rounded-lg border bg-muted/10 p-4"><div className="mb-4 flex items-center justify-between"><div><h3 className="text-sm font-semibold">Evolução diária</h3><p className="text-xs text-muted-foreground">Entradas e saídas efetivadas a cada dia.</p></div><Badge variant="outline">{fluxoCaixa.data.quantidadeMovimentos} movimentações</Badge></div><div className="space-y-3">{fluxoCaixa.data.dias.map((dia: any) => <div key={dia.data} className="grid grid-cols-[74px_1fr_96px] items-center gap-3 text-xs"><span className="text-muted-foreground">{formatarDataFinanceira(dia.data)}</span><div className="space-y-1"><div className="h-1.5 overflow-hidden rounded-full bg-emerald-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${(Number(dia.entradas) / maiorFluxoDiario) * 100}%` }} /></div><div className="h-1.5 overflow-hidden rounded-full bg-rose-100"><div className="h-full rounded-full bg-rose-500" style={{ width: `${(Number(dia.saidas) / maiorFluxoDiario) * 100}%` }} /></div></div><span className={`text-right font-medium ${dia.saldoLiquido >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{dia.saldoLiquido >= 0 ? "+" : ""}{formatCurrency(dia.saldoLiquido)}</span></div>)}</div></div><div className="overflow-hidden rounded-lg border"><div className="border-b bg-muted/30 px-4 py-3"><h3 className="text-sm font-semibold">Movimentações do período</h3></div>{fluxoCaixa.data.movimentos.length ? <Table><TableHeader><TableRow className="bg-muted/20"><TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead>Conta</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader><TableBody>{fluxoCaixa.data.movimentos.map((movimento: any) => <TableRow key={movimento.id}><TableCell className="whitespace-nowrap text-xs">{formatarDataFinanceira(movimento.dataBaixa)}</TableCell><TableCell><p className="text-sm font-medium">{movimento.descricao}</p><p className="text-xs text-muted-foreground">{movimento.formaPagamento}</p></TableCell><TableCell className="text-sm text-muted-foreground">{movimento.contaNome ?? "—"}</TableCell><TableCell className={`text-right font-semibold ${movimento.tipo === "receber" ? "text-emerald-700" : "text-rose-700"}`}>{movimento.tipo === "receber" ? "+" : "−"}{formatCurrency(movimento.valor)}</TableCell></TableRow>)}</TableBody></Table> : <p className="px-4 py-10 text-center text-sm text-muted-foreground">Nenhuma baixa efetivada no período selecionado.</p>}</div></div></div> : null}
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

      <Dialog open={importacaoAberta} onOpenChange={(aberto) => { setImportacaoAberta(aberto); if (!aberto) { setArquivoImportacao(null); setErrosImportacao([]); } }}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Importar lançamentos financeiros</DialogTitle></DialogHeader><div className="space-y-4"><div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950"><p className="font-medium">Importação segura por CSV</p><p className="mt-1 text-sky-900">Use o modelo disponibilizado. O sistema valida todo o arquivo antes de gravar: se houver alguma linha inválida ou referência duplicada, nenhum lançamento será criado.</p></div><div className="space-y-2"><Label htmlFor="arquivo-importacao">Arquivo CSV *</Label><Input id="arquivo-importacao" aria-label="Arquivo CSV para importação" type="file" accept=".csv,text/csv" onChange={(evento) => { setArquivoImportacao(evento.target.files?.[0] ?? null); setErrosImportacao([]); }} /><p className="text-xs text-muted-foreground">Limite de 1.000 lançamentos e 1 MB por arquivo.</p></div>{arquivoImportacao && <div className="flex items-center gap-2 rounded-md bg-muted/60 px-3 py-2 text-sm"><FileSpreadsheet className="h-4 w-4 text-primary" /><span className="truncate">{arquivoImportacao.name}</span></div>}{errosImportacao.length > 0 && <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900"><p className="font-medium">O arquivo não foi importado:</p>{errosImportacao.map((erro, indice) => <p key={`${erro}-${indice}`} className="text-xs">• {erro}</p>)}</div>}<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between"><Button variant="ghost" onClick={baixarModeloImportacao} disabled={modeloImportacao.isFetching}><Download className="mr-1.5 h-4 w-4" />Baixar modelo</Button><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setImportacaoAberta(false)} disabled={importarLancamentos.isPending}>Cancelar</Button><Button onClick={importarArquivo} disabled={!arquivoImportacao || importarLancamentos.isPending}>{importarLancamentos.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Importar arquivo</Button></div></div></div></DialogContent></Dialog>

      <Dialog open={Boolean(tituloParaCancelar)} onOpenChange={(aberto) => !aberto && setTituloParaCancelar(null)}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Cancelar {tituloParaCancelar?.tipo === "receber" ? "conta a receber" : "conta a pagar"}</DialogTitle></DialogHeader><div className="space-y-4"><div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><p className="font-medium">{tituloParaCancelar?.descricao}</p><p className="mt-1">Este título deixará de aparecer nas listas ativas e permanecerá registrado como cancelado para auditoria.</p></div><p className="text-sm text-muted-foreground">A operação não pode ser usada em títulos com baixas financeiras. Deseja continuar?</p><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setTituloParaCancelar(null)} disabled={cancelarTitulo.isPending}>Voltar</Button><Button variant="destructive" onClick={confirmarCancelamento} disabled={cancelarTitulo.isPending}>{cancelarTitulo.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar cancelamento</Button></div></div></DialogContent></Dialog>

      <Dialog open={lancamentoAberto} onOpenChange={setLancamentoAberto}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Novo lançamento não programado</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Use este lançamento para entradas ou saídas excepcionais, sem orçamento ou recorrência vinculados.</p>
            <div className="grid grid-cols-2 gap-3"><CampoSelect label="Tipo" value={lancamento.tipo} onValueChange={(valor) => setLancamento({ ...lancamento, tipo: valor as "receber" | "pagar" })} opcoes={[["receber", "Conta a receber"], ["pagar", "Conta a pagar"]]} /><div className="space-y-2"><Label>Categoria *</Label><Select value={lancamento.categoriaId} onCreate={() => abrirCriacaoContextual("categoria", "lancamento")} createLabel="Criar nova categoria" onValueChange={(valor) => setLancamento({ ...lancamento, categoriaId: valor })}><SelectTrigger className="w-full"><SelectValue placeholder="Pesquisar categoria" /></SelectTrigger><SelectContent>{(categorias.data ?? []).filter((item: any) => item.tipo === "ambos" || item.tipo === (lancamento.tipo === "receber" ? "receita" : "despesa")).map((item: any) => <SelectItem key={item.id} value={String(item.id)}>{item.nome}</SelectItem>)}</SelectContent></Select></div></div>
            <div className="space-y-2"><Label>Descrição *</Label><Input value={lancamento.descricao} onChange={(e) => setLancamento({ ...lancamento, descricao: e.target.value })} placeholder="Ex.: Frete emergencial" /></div>
            <div className="grid grid-cols-3 gap-3"><Campo label="Valor (R$) *" value={lancamento.valorOriginal} onChange={(valor) => setLancamento({ ...lancamento, valorOriginal: valor })} /><Campo label="Data de emissão" type="date" value={lancamento.dataEmissao} onChange={(valor) => setLancamento({ ...lancamento, dataEmissao: valor })} /><Campo label="Vencimento" type="date" value={lancamento.dataVencimento} onChange={(valor) => setLancamento({ ...lancamento, dataVencimento: valor })} /></div>
            <div className="rounded-lg border border-border bg-muted/20 p-3"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium">Parcelar lançamento</p><p className="mt-0.5 text-xs text-muted-foreground">Cada parcela será criada como um título independente.</p></div><input type="checkbox" checked={lancamento.parcelar} onChange={(e) => setLancamento({ ...lancamento, parcelar: e.target.checked })} className="h-4 w-4 accent-primary" aria-label="Parcelar lançamento" /></div>{lancamento.parcelar && <div className="mt-3 max-w-[180px]"><Campo label="Quantidade de parcelas" type="number" value={lancamento.quantidadeParcelas} onChange={(valor) => setLancamento({ ...lancamento, quantidadeParcelas: valor })} /></div>}</div>
            <div className="grid grid-cols-2 gap-3">{lancamento.tipo === "receber" ? <div className="space-y-2"><Label>Cliente (opcional)</Label><Select value={lancamento.clienteId || "nenhum"} onCreate={() => abrirCriacaoContextual("cliente", "lancamento")} createLabel="Criar novo cliente" onValueChange={(valor) => setLancamento({ ...lancamento, clienteId: valor === "nenhum" ? "" : valor })}><SelectTrigger className="w-full"><SelectValue placeholder="Pesquisar cliente" /></SelectTrigger><SelectContent><SelectItem value="nenhum">Sem cliente vinculado</SelectItem>{(clientes.data ?? []).map((item: any) => <SelectItem key={item.id} value={String(item.id)}>{item.nome}</SelectItem>)}</SelectContent></Select></div> : <div className="space-y-2"><Label>Fornecedor (opcional)</Label><Select value={lancamento.fornecedorId || "nenhum"} onCreate={() => abrirCriacaoContextual("fornecedor", "lancamento")} createLabel="Criar novo fornecedor" onValueChange={(valor) => setLancamento({ ...lancamento, fornecedorId: valor === "nenhum" ? "" : valor })}><SelectTrigger className="w-full"><SelectValue placeholder="Pesquisar fornecedor" /></SelectTrigger><SelectContent><SelectItem value="nenhum">Sem fornecedor vinculado</SelectItem>{(fornecedores.data ?? []).map((item: any) => <SelectItem key={item.id} value={String(item.id)}>{item.nome}</SelectItem>)}</SelectContent></Select></div>}<Campo label="Contraparte livre" value={lancamento.contraparteNome} onChange={(valor) => setLancamento({ ...lancamento, contraparteNome: valor })} /></div>
            <div className="grid grid-cols-2 gap-3"><Campo label="Desconto (R$)" value={lancamento.desconto} onChange={(valor) => setLancamento({ ...lancamento, desconto: valor })} /><Campo label="Juros (R$)" value={lancamento.juros} onChange={(valor) => setLancamento({ ...lancamento, juros: valor })} /></div>
            <div className="space-y-2"><Label>Observações</Label><Textarea rows={2} value={lancamento.observacoes} onChange={(e) => setLancamento({ ...lancamento, observacoes: e.target.value })} /></div>
            <Button className="w-full" onClick={salvarLancamento} disabled={criarLancamento.isPending || criarLancamentoParcelado.isPending}>{(criarLancamento.isPending || criarLancamentoParcelado.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{lancamento.parcelar ? "Criar parcelas" : "Criar lançamento"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={baixaAberta} onOpenChange={setBaixaAberta}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registrar baixa</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-3 text-sm"><p className="font-medium">{tituloSelecionado?.descricao}</p><p className="text-muted-foreground mt-1">Saldo em aberto: <strong className="text-foreground">{formatCurrency(tituloSelecionado ? saldoTitulo(tituloSelecionado) : 0)}</strong></p></div>
            <div className="space-y-2"><Label>Conta financeira *</Label><Select value={baixa.contaFinanceiraId} onCreate={() => abrirCriacaoContextual("conta", "baixa")} createLabel="Criar nova conta" onValueChange={(valor) => setBaixa({ ...baixa, contaFinanceiraId: valor })}><SelectTrigger className="w-full"><SelectValue placeholder="Pesquisar conta" /></SelectTrigger><SelectContent>{(contas.data ?? []).map((item: any) => <SelectItem key={item.id} value={String(item.id)}>{item.nome}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid grid-cols-2 gap-3"><Campo label="Valor (R$) *" value={baixa.valor} onChange={(valor) => setBaixa({ ...baixa, valor })} /><Campo label="Data da baixa" type="date" value={baixa.dataBaixa} onChange={(valor) => setBaixa({ ...baixa, dataBaixa: valor })} /></div>
            <CampoSelect label="Forma de pagamento" value={baixa.formaPagamento} onValueChange={(valor) => setBaixa({ ...baixa, formaPagamento: valor })} opcoes={[["pix", "PIX"], ["dinheiro", "Dinheiro"], ["transferencia", "Transferência"], ["boleto", "Boleto"], ["cartao_credito", "Cartão de crédito"], ["cartao_debito", "Cartão de débito"], ["outro", "Outro"]]} />
            <div className="space-y-2"><Label>Observações</Label><Textarea rows={2} value={baixa.observacoes} onChange={(e) => setBaixa({ ...baixa, observacoes: e.target.value})} /></div>
            <Button className="w-full" onClick={salvarBaixa} disabled={registrarBaixa.isPending}>{registrarBaixa.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Confirmar baixa</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(tituloParaEditar)} onOpenChange={(aberto) => !aberto && setTituloParaEditar(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar agendamento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-3 text-sm"><p className="font-medium">{tituloParaEditar?.descricao}</p><p className="mt-1 text-muted-foreground">Altere a data de vencimento conforme a negociação de pagamento.</p>{tituloParaEditar?.origem === "romaneio_carga" && <p className="mt-2 text-xs text-primary">Este vencimento também será atualizado no romaneio de carga vinculado.</p>}</div>
            <div className="space-y-2"><Label htmlFor="vencimento-agendamento">Novo vencimento *</Label><Input id="vencimento-agendamento" aria-label="Novo vencimento" type="date" value={vencimentoEditado} onChange={(event) => setVencimentoEditado(event.target.value)} /></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setTituloParaEditar(null)} disabled={atualizarAgendamento.isPending}>Cancelar</Button><Button onClick={salvarAgendamento} disabled={atualizarAgendamento.isPending}>{atualizarAgendamento.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar vencimento</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(tituloBaixas)} onOpenChange={(aberto) => !aberto && setTituloBaixas(null)}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Baixas e conciliação</DialogTitle></DialogHeader><div className="space-y-3"><div className="rounded-lg bg-muted/50 p-3 text-sm"><p className="font-medium">{tituloBaixas?.descricao}</p><p className="text-muted-foreground mt-1">Concilie após conferir a movimentação; estornos preservam a baixa original para auditoria.</p></div>{baixasTitulo.isLoading ? <div className="py-8 text-center text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />Carregando baixas...</div> : baixasTitulo.data?.length ? <div className="divide-y rounded-lg border">{baixasTitulo.data.map((item: any) => { const estornada = Boolean(item.estornada); return <div key={item.id} className={`flex items-center justify-between gap-3 p-3 ${estornada ? "bg-muted/30" : ""}`}><div><div className="flex items-center gap-2"><p className={`font-medium text-sm ${estornada ? "line-through text-muted-foreground" : ""}`}>{formatCurrency(item.valor)} · {item.formaPagamento}</p>{estornada && <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-600">Estornada</Badge>}</div><p className="text-xs text-muted-foreground">{item.contaNome ?? "Conta não encontrada"} · {formatarDataFinanceira(item.dataBaixa)}</p><p className="text-xs text-muted-foreground">{estornada ? `Estornada em ${formatarDataFinanceira(item.estornadaEm)}${item.motivoEstorno ? ` · ${item.motivoEstorno}` : ""}` : item.conciliada ? "Conciliada" : "Pendente de conciliação"}</p></div><div className="flex gap-2">{!estornada && <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => { setBaixaParaEstornar(item); setMotivoEstorno(""); }}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Estornar</Button>}<Button size="sm" variant={item.conciliada ? "outline" : "default"} disabled={estornada || conciliarBaixa.isPending} onClick={() => conciliarBaixa.mutate({ id: item.id, conciliada: !item.conciliada }, { onSuccess: () => { toast.success(item.conciliada ? "Conciliação desfeita" : "Baixa conciliada"); baixasTitulo.refetch(); } })}>{item.conciliada ? "Desconciliar" : "Conciliar"}</Button></div></div>; })}</div> : <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma baixa encontrada.</p>}</div></DialogContent></Dialog>

      <Dialog open={Boolean(baixaParaEstornar)} onOpenChange={(aberto) => !aberto && setBaixaParaEstornar(null)}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Estornar baixa financeira</DialogTitle></DialogHeader><div className="space-y-4"><div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><p className="font-medium">{baixaParaEstornar && formatCurrency(baixaParaEstornar.valor)} · {baixaParaEstornar?.formaPagamento}</p><p className="mt-1">O título será recalculado e a baixa permanecerá registrada como estornada para auditoria.</p></div><div className="space-y-2"><Label htmlFor="motivo-estorno">Motivo do estorno *</Label><Textarea id="motivo-estorno" value={motivoEstorno} onChange={(e) => setMotivoEstorno(e.target.value)} placeholder="Ex.: pagamento lançado em duplicidade" rows={3} /></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setBaixaParaEstornar(null)} disabled={estornarBaixa.isPending}>Voltar</Button><Button variant="destructive" onClick={confirmarEstorno} disabled={estornarBaixa.isPending}>{estornarBaixa.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar estorno</Button></div></div></DialogContent></Dialog>

      <Dialog open={fornecedorAberto} onOpenChange={setFornecedorAberto}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Novo fornecedor</DialogTitle></DialogHeader><div className="space-y-3"><Campo label="Nome *" value={fornecedor.nome} onChange={(valor) => setFornecedor({ ...fornecedor, nome: valor })} /><div className="grid grid-cols-2 gap-3"><Campo label="Contato" value={fornecedor.contacto} onChange={(valor) => setFornecedor({ ...fornecedor, contacto: valor })} /><Campo label="Documento" value={fornecedor.documento} onChange={(valor) => setFornecedor({ ...fornecedor, documento: valor })} /></div><Campo label="E-mail" type="email" value={fornecedor.email} onChange={(valor) => setFornecedor({ ...fornecedor, email: valor })} /><Campo label="Endereço" value={fornecedor.endereco} onChange={(valor) => setFornecedor({ ...fornecedor, endereco: valor })} /><div className="space-y-2"><Label>Observações</Label><Textarea rows={2} value={fornecedor.observacoes} onChange={(e) => setFornecedor({ ...fornecedor, observacoes: e.target.value })} /></div><Button className="w-full" onClick={salvarFornecedor} disabled={criarFornecedor.isPending}>Salvar fornecedor</Button></div></DialogContent></Dialog>

      <Dialog open={clienteAberto} onOpenChange={setClienteAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo cliente</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Campo label="Nome *" value={cliente.nome} onChange={(valor) => setCliente({ ...cliente, nome: valor })} />
            <div className="grid grid-cols-2 gap-3"><Campo label="Contato" value={cliente.contacto} onChange={(valor) => setCliente({ ...cliente, contacto: valor })} /><Campo label="Documento" value={cliente.nif} onChange={(valor) => setCliente({ ...cliente, nif: valor })} /></div>
            <Campo label="E-mail" type="email" value={cliente.email} onChange={(valor) => setCliente({ ...cliente, email: valor })} />
            <Campo label="Endereço" value={cliente.morada} onChange={(valor) => setCliente({ ...cliente, morada: valor })} />
            <div className="space-y-2"><Label>Observações</Label><Textarea rows={2} value={cliente.observacoes} onChange={(event) => setCliente({ ...cliente, observacoes: event.target.value })} /></div>
            <Button className="w-full" onClick={salvarCliente} disabled={criarCliente.isPending}>{criarCliente.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar cliente</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={categoriaAberta} onOpenChange={setCategoriaAberta}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Nova categoria financeira</DialogTitle></DialogHeader><div className="space-y-4"><Campo label="Nome *" value={categoria.nome} onChange={(valor) => setCategoria({ ...categoria, nome: valor })} /><CampoSelect label="Aplicação" value={categoria.tipo} onValueChange={(valor) => setCategoria({ ...categoria, tipo: valor as "receita" | "despesa" | "ambos" })} opcoes={[["receita", "Somente receita"], ["despesa", "Somente despesa"], ["ambos", "Receita e despesa"]]} /><Button className="w-full" onClick={salvarCategoria} disabled={criarCategoria.isPending}>Salvar categoria</Button></div></DialogContent></Dialog>

      <Dialog open={contaAberta} onOpenChange={setContaAberta}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Nova conta financeira</DialogTitle></DialogHeader><div className="space-y-4"><Campo label="Nome *" value={conta.nome} onChange={(valor) => setConta({ ...conta, nome: valor })} /><CampoSelect label="Tipo" value={conta.tipo} onValueChange={(valor) => setConta({ ...conta, tipo: valor as "caixa" | "banco" | "carteira" | "outro" })} opcoes={[["caixa", "Caixa"], ["banco", "Banco"], ["carteira", "Carteira"], ["outro", "Outro"]]} /><Campo label="Saldo inicial (R$)" value={conta.saldoInicial} onChange={(valor) => setConta({ ...conta, saldoInicial: valor })} /><div className="space-y-2"><Label>Observações</Label><Textarea rows={2} value={conta.observacoes} onChange={(e) => setConta({ ...conta, observacoes: e.target.value })} /></div><Button className="w-full" onClick={salvarConta} disabled={criarConta.isPending}>Salvar conta</Button></div></DialogContent></Dialog>

      <Dialog open={recorrenciaAberta} onOpenChange={setRecorrenciaAberta}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Nova recorrência financeira</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">A regra será processada diariamente para criar o título correspondente na data do próximo vencimento.</p>
            <div className="grid grid-cols-2 gap-3"><CampoSelect label="Tipo" value={recorrencia.tipo} onValueChange={(valor) => setRecorrencia({ ...recorrencia, tipo: valor as "receber" | "pagar" })} opcoes={[["receber", "Conta a receber"], ["pagar", "Conta a pagar"]]} /><div className="space-y-2"><Label>Categoria *</Label><Select value={recorrencia.categoriaId} onCreate={() => abrirCriacaoContextual("categoria", "recorrencia")} createLabel="Criar nova categoria" onValueChange={(valor) => setRecorrencia({ ...recorrencia, categoriaId: valor })}><SelectTrigger className="w-full"><SelectValue placeholder="Pesquisar categoria" /></SelectTrigger><SelectContent>{(categorias.data ?? []).filter((item: any) => item.tipo === "ambos" || item.tipo === (recorrencia.tipo === "receber" ? "receita" : "despesa")).map((item: any) => <SelectItem key={item.id} value={String(item.id)}>{item.nome}</SelectItem>)}</SelectContent></Select></div></div>
            <Campo label="Descrição *" value={recorrencia.descricao} onChange={(valor) => setRecorrencia({ ...recorrencia, descricao: valor })} />
            <div className="grid grid-cols-3 gap-3"><Campo label="Valor (R$) *" value={recorrencia.valor} onChange={(valor) => setRecorrencia({ ...recorrencia, valor })} /><CampoSelect label="Frequência" value={recorrencia.frequencia} onValueChange={(valor) => setRecorrencia({ ...recorrencia, frequencia: valor as typeof recorrencia.frequencia })} opcoes={[["semanal", "Semanal"], ["mensal", "Mensal"], ["trimestral", "Trimestral"], ["semestral", "Semestral"], ["anual", "Anual"]]} /><Campo label="Próximo vencimento" type="date" value={recorrencia.proximoVencimento} onChange={(valor) => setRecorrencia({ ...recorrencia, proximoVencimento: valor })} /></div>
            <div className="grid grid-cols-2 gap-3">{recorrencia.tipo === "receber" ? <div className="space-y-2"><Label>Cliente (opcional)</Label><Select value={recorrencia.clienteId || "nenhum"} onCreate={() => abrirCriacaoContextual("cliente", "recorrencia")} createLabel="Criar novo cliente" onValueChange={(valor) => setRecorrencia({ ...recorrencia, clienteId: valor === "nenhum" ? "" : valor })}><SelectTrigger className="w-full"><SelectValue placeholder="Pesquisar cliente" /></SelectTrigger><SelectContent><SelectItem value="nenhum">Sem cliente vinculado</SelectItem>{(clientes.data ?? []).map((item: any) => <SelectItem key={item.id} value={String(item.id)}>{item.nome}</SelectItem>)}</SelectContent></Select></div> : <div className="space-y-2"><Label>Fornecedor (opcional)</Label><Select value={recorrencia.fornecedorId || "nenhum"} onCreate={() => abrirCriacaoContextual("fornecedor", "recorrencia")} createLabel="Criar novo fornecedor" onValueChange={(valor) => setRecorrencia({ ...recorrencia, fornecedorId: valor === "nenhum" ? "" : valor })}><SelectTrigger className="w-full"><SelectValue placeholder="Pesquisar fornecedor" /></SelectTrigger><SelectContent><SelectItem value="nenhum">Sem fornecedor vinculado</SelectItem>{(fornecedores.data ?? []).map((item: any) => <SelectItem key={item.id} value={String(item.id)}>{item.nome}</SelectItem>)}</SelectContent></Select></div>}<Campo label="Fim da recorrência" type="date" value={recorrencia.dataFim} onChange={(valor) => setRecorrencia({ ...recorrencia, dataFim: valor })} /></div>
            <Campo label="Contraparte livre" value={recorrencia.contraparteNome} onChange={(valor) => setRecorrencia({ ...recorrencia, contraparteNome: valor })} />
            <div className="space-y-2"><Label>Observações</Label><Textarea rows={2} value={recorrencia.observacoes} onChange={(e) => setRecorrencia({ ...recorrencia, observacoes: e.target.value })} /></div>
            <Button className="w-full" onClick={salvarRecorrencia} disabled={criarRecorrencia.isPending}>{criarRecorrencia.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar recorrência</Button>
          </div>
        </DialogContent>
      </Dialog>
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

function TabelaTitulosFinanceiros({ titulos, historico, tipo, onBaixas, onEditar, onBaixar, onCancelar }: { titulos: any[]; historico: boolean; tipo: "pagar" | "receber"; onBaixas: (titulo: any) => void; onEditar: (titulo: any) => void; onBaixar: (titulo: any) => void; onCancelar: (titulo: any) => void }) {
  if (!titulos.length) return <EstadoVazio icon={<CalendarClock className="h-9 w-9" />} texto={historico ? `Nenhuma conta ${tipo === "pagar" ? "paga" : "recebida"} encontrada` : `Nenhuma conta a ${tipo === "pagar" ? "pagar" : "receber"} encontrada`} />;
  const hojeLocal = hoje();
  return <div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-muted/40"><TableHead>Descrição</TableHead><TableHead>Vencimento</TableHead><TableHead>Status</TableHead><TableHead className="text-right">{historico ? "Valor liquidado" : "Saldo"}</TableHead><TableHead className="text-right">Ação</TableHead></TableRow></TableHeader><TableBody>{titulos.map((titulo: any) => {
    const possuiBaixas = Number(titulo.valorBaixado || 0) > 0.005;
    const podeCancelar = !["quitado", "cancelado"].includes(titulo.estado) && !possuiBaixas;
    const venceHoje = !historico && dataChaveFinanceira(titulo.dataVencimento) === hojeLocal;
    return <TableRow key={titulo.id} className={venceHoje ? (tipo === "pagar" ? "bg-amber-50 hover:bg-amber-100/70" : "bg-emerald-50 hover:bg-emerald-100/70") : "hover:bg-muted/20"}><TableCell><p className="font-medium">{titulo.descricao}</p><p className="text-xs text-muted-foreground">{formatReceivableSaleReference(titulo.origem, titulo.descricao)}{titulo.numeroParcela ? ` · Parcela ${titulo.numeroParcela}/${titulo.totalParcelas}` : ""}</p></TableCell><TableCell className="text-sm"><div className="flex items-center gap-2">{formatarDataFinanceira(titulo.dataVencimento)}{venceHoje && <Badge variant="outline" className={tipo === "pagar" ? "border-amber-300 bg-amber-100 text-amber-900" : "border-emerald-300 bg-emerald-100 text-emerald-900"}>{tipo === "pagar" ? "Vence hoje" : "Recebe hoje"}</Badge>}</div></TableCell><TableCell><StatusBadge estado={titulo.estado} /></TableCell><TableCell className="text-right font-semibold">{formatCurrency(historico ? Number(titulo.valorBaixado || 0) : saldoTitulo(titulo))}</TableCell><TableCell className="text-right"><div className="flex justify-end gap-2">{possuiBaixas && <Button size="sm" variant="ghost" onClick={() => onBaixas(titulo)}>Baixas</Button>}{!historico && <><Button size="sm" variant="outline" onClick={() => onEditar(titulo)}><Pencil className="h-3.5 w-3.5 mr-1.5" />Editar</Button><Button size="sm" variant="outline" onClick={() => onBaixar(titulo)}><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />{tipo === "pagar" ? "Pagar" : "Receber"}</Button><Button size="sm" variant="outline" className="text-destructive hover:text-destructive" title={possuiBaixas ? "Estorne as baixas antes de cancelar" : "Cancelar título"} disabled={!podeCancelar} onClick={() => onCancelar(titulo)}>Cancelar</Button></>}</div></TableCell></TableRow>;
  })}</TableBody></Table></div>;
}

function EstadoVazio({ icon, texto, acao, labelAcao }: { icon: React.ReactNode; texto: string; acao?: () => void; labelAcao?: string }) {
  return <div className="p-12 text-center text-muted-foreground"><div className="mx-auto mb-3 w-fit opacity-40">{icon}</div><p className="text-sm">{texto}</p>{acao && labelAcao && <Button variant="outline" size="sm" className="mt-4" onClick={acao}><Plus className="h-3.5 w-3.5 mr-1.5" />{labelAcao}</Button>}</div>;
}
