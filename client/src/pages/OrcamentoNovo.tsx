import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Trash2, Save, Send, Loader2, ArrowLeft, Calculator, UserPlus, Check, ChevronsUpDown } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  calculateVolume,
  formatCurrency,
  formatMeasurement,
} from "@/lib/utils";
import { criarItensVendaPorMedida, criarLinhasComprimentoVazias, type LinhaComprimentoVenda } from "@/lib/vendaItemGroup";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ItemOrcamento {
  madeiraId: number | null;
  bitolaId: number | null;
  madeiraNome: string;
  bitolaDescricao: string;
  espessura: string;
  largura: string;
  comprimento: string;
  quantidade: number;
  precoM3: string;
  precoLinear: string;
  valorPeca: string;
  valorTotal: string;
}

function dataLocalParaInput(data = new Date()) {
  const deslocamento = data.getTimezoneOffset() * 60_000;
  return new Date(data.getTime() - deslocamento).toISOString().slice(0, 10);
}

export default function OrcamentoNovo() {
  const [, setLocation] = useLocation();
  const clientes = trpc.cliente.list.useQuery();

  const [clienteId, setClienteId] = useState("");
  const [clienteSelectorOpen, setClienteSelectorOpen] = useState(false);
  const [novoClienteOpen, setNovoClienteOpen] = useState(false);
  const [novoClienteForm, setNovoClienteForm] = useState({ nome: "", contacto: "", email: "", morada: "", nif: "" });
  const createCliente = trpc.cliente.create.useMutation();
  const [desconto, setDesconto] = useState("0");
  const [frete, setFrete] = useState("0");
  const [observacoes, setObservacoes] = useState("");
  const [vendedor, setVendedor] = useState("");
  const [dataVencimento, setDataVencimento] = useState(() => dataLocalParaInput());
  const [competencia, setCompetencia] = useState(() => dataLocalParaInput());
  const [itens, setItens] = useState<ItemOrcamento[]>([]);
  const [grupoItem, setGrupoItem] = useState({ madeiraNome: "", precoM3: "", espessuraCm: "", larguraCm: "" });
  const [linhasComprimento, setLinhasComprimento] = useState<LinhaComprimentoVenda[]>(() => criarLinhasComprimentoVazias());

  const clienteSelecionado = clientes.data?.find((cliente) => cliente.id === Number(clienteId));

  const totals = useMemo(() => {
    let subtotal = 0;
    let totalPecas = 0;
    let totalMetroLinear = 0;
    let totalVolume = 0;
    for (const item of itens) {
      const q = item.quantidade;
      const vp = parseFloat(item.valorPeca) || 0;
      const comp = parseFloat(item.comprimento) || 0;
      const esp = parseFloat(item.espessura) || 0;
      const larg = parseFloat(item.largura) || 0;
      subtotal += vp * q;
      totalPecas += q;
      totalMetroLinear += comp * q;
      totalVolume += calculateVolume(esp, larg, comp, q);
    }
    const descVal = parseFloat(desconto) || 0;
    const freteVal = parseFloat(frete) || 0;
    const total = subtotal - descVal + freteVal;
    return { subtotal, totalPecas, totalMetroLinear, totalVolume, total };
  }, [itens, desconto, frete]);

  const atualizarLinhaComprimento = (id: number, campo: "comprimento" | "quantidade", valor: string) => {
    setLinhasComprimento((linhas) => linhas.map((linha) => linha.id === id ? { ...linha, [campo]: valor } : linha));
  };

  const adicionarLinhaComprimento = () => {
    setLinhasComprimento((linhas) => [...linhas, { id: Math.max(0, ...linhas.map((linha) => linha.id)) + 1, comprimento: "", quantidade: "" }]);
  };

  const removerLinhaComprimento = (id: number) => {
    setLinhasComprimento((linhas) => linhas.length === 1 ? linhas : linhas.filter((linha) => linha.id !== id));
  };

  const adicionarGrupoItens = () => {
    const resultado = criarItensVendaPorMedida({ ...grupoItem, linhas: linhasComprimento });
    if (resultado.erro) { toast.error(resultado.erro); return; }
    setItens((itensAtuais) => [...itensAtuais, ...resultado.itens]);
    setGrupoItem((grupo) => ({ ...grupo, espessuraCm: "", larguraCm: "" }));
    setLinhasComprimento(criarLinhasComprimentoVazias());
    toast.success(`${resultado.itens.length} comprimento(s) adicionado(s) à venda`);
  };

  const removeItem = (index: number) => setItens(itens.filter((_, i) => i !== index));

  const create = trpc.orcamento.create.useMutation();
  const utils = trpc.useUtils();

  const handleCriarCliente = () => {
    if (!novoClienteForm.nome.trim()) { toast.error("Nome é obrigatório"); return; }
    createCliente.mutate(novoClienteForm, {
      onSuccess: async (res) => {
        toast.success("Cliente criado com sucesso");
        await utils.cliente.list.invalidate();
        if (res.id) setClienteId(String(res.id));
        setNovoClienteOpen(false);
        setNovoClienteForm({ nome: "", contacto: "", email: "", morada: "", nif: "" });
      },
      onError: (err: any) => toast.error(err.message),
    });
  };

  const handleSave = (estado: "rascunho" | "enviado") => {
    if (!clienteId) { toast.error("Selecione um cliente"); return; }
    if (itens.length === 0) { toast.error("Adicione pelo menos um item"); return; }
    create.mutate({
      clienteId: Number(clienteId),
      estado,
      desconto,
      frete,
      subtotal: String(totals.subtotal.toFixed(2)),
      total: String(totals.total.toFixed(2)),
      totalPecas: totals.totalPecas,
      totalMetroLinear: String(totals.totalMetroLinear.toFixed(2)),
      totalVolume: String(totals.totalVolume.toFixed(4)),
      observacoes: observacoes || undefined,
      vendedor: vendedor || undefined,
      dataVencimento,
      competencia,
      itens,
    }, {
      onSuccess: () => { toast.success(estado === "enviado" ? "Venda enviada!" : "Venda salva!"); utils.orcamento.list.invalidate(); setLocation("/orcamentos"); },
      onError: (err: any) => toast.error(err.message),
    });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" onClick={() => setLocation("/orcamentos")} className="mb-2 -ml-2"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Button>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Nova Venda</h1>
          <p className="text-sm text-muted-foreground mt-1">Registre a venda de madeira serrada e programe o recebimento</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Cliente */}
          <Card className="border border-border/50 shadow-sm">
            <CardContent className="p-5">
              <h3 className="font-semibold text-sm mb-4">Dados da Venda</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Cliente *</Label>
                  <div className="flex gap-2">
                    <Popover open={clienteSelectorOpen} onOpenChange={setClienteSelectorOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={clienteSelectorOpen}
                          className="bg-white flex-1 justify-between font-normal"
                        >
                          <span className="truncate">
                            {clienteSelecionado
                              ? `${clienteSelecionado.nome}${clienteSelecionado.contacto ? ` · ${clienteSelecionado.contacto}` : ""}`
                              : "Buscar cliente por nome ou telefone"}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[420px] max-w-[calc(100vw-2rem)] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Digite nome ou telefone..." />
                          <CommandList>
                            <CommandGroup heading="Ação rápida">
                              <CommandItem
                                value="criar novo cliente"
                                onSelect={() => {
                                  setClienteSelectorOpen(false);
                                  setNovoClienteOpen(true);
                                }}
                                className="text-primary"
                              >
                                <Plus className="h-4 w-4" />
                                <span className="font-medium">Criar novo cliente</span>
                              </CommandItem>
                            </CommandGroup>
                            <CommandSeparator />
                            <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                            <CommandGroup heading="Clientes">
                              {clientes.data?.map((cliente) => (
                                <CommandItem
                                  key={cliente.id}
                                  value={`${cliente.nome} ${cliente.contacto ?? ""}`}
                                  onSelect={() => {
                                    setClienteId(String(cliente.id));
                                    setClienteSelectorOpen(false);
                                  }}
                                >
                                  <Check className={`mr-2 h-4 w-4 ${clienteId === String(cliente.id) ? "opacity-100" : "opacity-0"}`} />
                                  <span className="min-w-0 truncate">{cliente.nome}</span>
                                  {cliente.contacto && <span className="ml-auto pl-3 text-xs text-muted-foreground">{cliente.contacto}</span>}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0 border-primary/40 text-primary hover:bg-primary/10"
                      onClick={() => setNovoClienteOpen(true)}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Novo cliente
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Vendedor</Label>
                    <Input value={vendedor} onChange={(e) => setVendedor(e.target.value)} placeholder="Nome do vendedor" className="bg-white" />
                  </div>
                  <div className="space-y-2">
                    <Label>Vencimento *</Label>
                    <Input type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} className="bg-white" />
                  </div>
                  <div className="space-y-2">
                    <Label>Competência *</Label>
                    <Input type="date" value={competencia} onChange={(e) => setCompetencia(e.target.value)} className="bg-white" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Adicionar itens por medida */}
          <Card className="border border-border/50 shadow-sm">
            <CardContent className="p-5">
              <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-semibold text-sm flex items-center gap-2"><Calculator className="h-4 w-4" />Romaneio de itens</h3><p className="mt-1 text-xs text-muted-foreground">Defina a medida uma vez e preencha todos os comprimentos e quantidades abaixo.</p></div><span className="text-xs font-medium text-primary">Medida em centímetros</span></div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-2">
                    <Label>Madeira *</Label>
                    <Input value={grupoItem.madeiraNome} onChange={(e) => setGrupoItem({ ...grupoItem, madeiraNome: e.target.value })} placeholder="Ex.: Guarandi" className="bg-white" />
                  </div>
                  <div className="space-y-2">
                    <Label>Preço por m³ (R$) *</Label>
                    <Input value={grupoItem.precoM3} onChange={(e) => setGrupoItem({ ...grupoItem, precoM3: e.target.value })} type="text" inputMode="decimal" placeholder="2400,00" className="bg-white" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-primary/15 bg-primary/[0.03] p-3">
                  <div className="space-y-2">
                    <Label>Bitola / espessura (cm) *</Label>
                    <Input value={grupoItem.espessuraCm} onChange={(e) => setGrupoItem({ ...grupoItem, espessuraCm: e.target.value })} type="text" inputMode="decimal" placeholder="2" className="bg-white" />
                  </div>
                  <div className="space-y-2">
                    <Label>Largura (cm) *</Label>
                    <Input value={grupoItem.larguraCm} onChange={(e) => setGrupoItem({ ...grupoItem, larguraCm: e.target.value })} type="text" inputMode="decimal" placeholder="5" className="bg-white" />
                  </div>
                </div>
                <div className="overflow-hidden rounded-lg border border-border/70">
                  <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2"><div><p className="text-sm font-medium">Comprimentos do romaneio</p><p className="text-xs text-muted-foreground">Preencha cada comprimento e a quantidade de peças correspondente.</p></div><span className="text-xs text-muted-foreground">m / peças</span></div>
                  <div className="venda-comprimentos"><table className="w-full table-fixed text-sm"><thead className="bg-muted/20 text-xs text-muted-foreground"><tr><th className="w-[45%] px-3 py-2 text-left font-medium">Comprimento (m)</th><th className="w-[42%] px-3 py-2 text-left font-medium">Quantidade</th><th className="w-[13%] px-2 py-2 text-right font-medium">Ação</th></tr></thead><tbody>{linhasComprimento.map((linha, indice) => <tr key={linha.id} className="border-t border-border/50"><td className="p-2"><Input aria-label={`Comprimento da linha ${indice + 1}`} value={linha.comprimento} onChange={(e) => atualizarLinhaComprimento(linha.id, "comprimento", e.target.value)} inputMode="decimal" placeholder="Ex.: 3,00" className="h-9 bg-white" /></td><td className="p-2"><Input aria-label={`Quantidade da linha ${indice + 1}`} value={linha.quantidade} onChange={(e) => atualizarLinhaComprimento(linha.id, "quantidade", e.target.value)} type="number" min="1" placeholder="Ex.: 20" className="h-9 bg-white" /></td><td className="p-2 text-right"><Button type="button" variant="ghost" size="icon" aria-label={`Remover comprimento ${indice + 1}`} disabled={linhasComprimento.length === 1} onClick={() => removerLinhaComprimento(linha.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button></td></tr>)}</tbody></table></div>
                  <div className="border-t bg-muted/10 px-3 py-2"><Button type="button" size="sm" variant="outline" onClick={adicionarLinhaComprimento}><Plus className="mr-1.5 h-3.5 w-3.5" />Adicionar comprimento</Button></div>
                </div>
                <Button onClick={adicionarGrupoItens} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Plus className="h-4 w-4 mr-2" />Adicionar comprimentos à venda
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Itens */}
          {itens.length > 0 && (
            <Card className="border border-border/50 shadow-sm">
              <CardContent className="p-5">
                <h3 className="font-semibold text-sm mb-4">Itens da Venda ({itens.length})</h3>
                <div className="space-y-2">
                  {itens.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/30">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{item.madeiraNome} — {item.bitolaDescricao} × {item.comprimento}m</p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantidade} pcs × {formatCurrency(item.valorPeca)} = {formatCurrency(item.valorTotal)}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeItem(idx)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Summary */}
        <div className="space-y-4">
          <Card className="border border-border/50 shadow-sm sticky top-6">
            <CardContent className="p-5 space-y-4">
              <h3 className="font-semibold text-sm">Resumo da Venda</h3>
              <Separator />
              <div className="space-y-3">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">{formatCurrency(String(totals.subtotal))}</span></div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground">Desconto</Label>
                    <Input type="number" value={desconto} onChange={(e) => setDesconto(e.target.value)} className="w-24 h-8 text-right bg-white" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground">Frete</Label>
                    <Input type="number" value={frete} onChange={(e) => setFrete(e.target.value)} className="w-24 h-8 text-right bg-white" />
                  </div>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold"><span>Total</span><span className="text-primary">{formatCurrency(String(totals.total))}</span></div>
              </div>
              <Separator />
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><p className="text-xs text-muted-foreground">Peças</p><p className="font-semibold text-sm">{totals.totalPecas}</p></div>
                <div><p className="text-xs text-muted-foreground">M. Linear</p><p className="font-semibold text-sm">{formatMeasurement(totals.totalMetroLinear)} m</p></div>
                <div><p className="text-xs text-muted-foreground">Volume</p><p className="font-semibold text-sm">{formatMeasurement(totals.totalVolume)} m³</p></div>
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="space-y-2"><Label className="text-sm">Observações</Label><Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Notas adicionais" className="bg-white text-sm" rows={3} /></div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => handleSave("rascunho")} disabled={!clienteId || itens.length === 0} className="flex-1">
                  <Save className="h-4 w-4 mr-2" />Salvar venda
                </Button>
                <Button onClick={() => handleSave("enviado")} disabled={!clienteId || itens.length === 0} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Send className="h-4 w-4 mr-2" />Enviar venda
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog: Criar cliente em contexto */}
      <Dialog open={novoClienteOpen} onOpenChange={setNovoClienteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" />
              Novo Cliente
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={novoClienteForm.nome}
                onChange={(e) => setNovoClienteForm({ ...novoClienteForm, nome: e.target.value })}
                placeholder="Nome completo"
                className="bg-white"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Contacto</Label>
                <Input
                  value={novoClienteForm.contacto}
                  onChange={(e) => setNovoClienteForm({ ...novoClienteForm, contacto: e.target.value })}
                  placeholder="+55 ..."
                  className="bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label>CPF / CNPJ</Label>
                <Input
                  value={novoClienteForm.nif}
                  onChange={(e) => setNovoClienteForm({ ...novoClienteForm, nif: e.target.value })}
                  placeholder="000.000.000-00"
                  className="bg-white"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={novoClienteForm.email}
                onChange={(e) => setNovoClienteForm({ ...novoClienteForm, email: e.target.value })}
                placeholder="email@exemplo.com"
                className="bg-white"
              />
            </div>
            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input
                value={novoClienteForm.morada}
                onChange={(e) => setNovoClienteForm({ ...novoClienteForm, morada: e.target.value })}
                placeholder="Endereço completo"
                className="bg-white"
              />
            </div>
            <Button
              onClick={handleCriarCliente}
              disabled={createCliente.isPending}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {createCliente.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
              Criar e Selecionar Cliente
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
