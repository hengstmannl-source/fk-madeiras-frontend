import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Trash2, Save, Send, Loader2, ArrowLeft, Calculator, UserPlus, Check, ChevronsUpDown } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  calculatePrecoLinear,
  calculateValorPeca,
  calculateValorTotal,
  calculateVolume,
  centimetersToMillimeters,
  formatCurrency,
  formatDimensionCm,
  formatMeasurement,
  parseDecimalInput,
} from "@/lib/utils";
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

  const addItem = () => {
    const madeiraNome = (document.getElementById("madeira-input") as HTMLInputElement)?.value.trim();
    const precoM3Input = (document.getElementById("preco-m3-input") as HTMLInputElement)?.value;
    const espValue = (document.getElementById("esp-input") as HTMLInputElement)?.value;
    const largValue = (document.getElementById("larg-input") as HTMLInputElement)?.value;
    const compValue = (document.getElementById("comp-input") as HTMLInputElement)?.value;
    const qtdValue = (document.getElementById("qtd-input") as HTMLInputElement)?.value;

    if (!madeiraNome) { toast.error("Informe o nome da madeira"); return; }
    const precoM3 = parseDecimalInput(precoM3Input);
    if (!Number.isFinite(precoM3) || precoM3 <= 0) { toast.error("Informe um preço por m³ válido"); return; }
    if (!espValue || !largValue) { toast.error("Preencha espessura e largura"); return; }
    const espCm = parseDecimalInput(espValue);
    const largCm = parseDecimalInput(largValue);
    const comp = parseDecimalInput(compValue) || 3;
    const qtd = parseInt(qtdValue) || 1;
    if (!Number.isFinite(espCm) || espCm <= 0 || !Number.isFinite(largCm) || largCm <= 0) {
      toast.error("Introduza dimensões válidas em centímetros");
      return;
    }
    if (!Number.isFinite(comp) || comp <= 0 || !Number.isInteger(qtd) || qtd <= 0) {
      toast.error("Introduza comprimento e quantidade válidos");
      return;
    }

    // A venda conserva milímetros; a integração de entrega converte para centímetros ao consultar o estoque.
    const esp = centimetersToMillimeters(espCm);
    const larg = centimetersToMillimeters(largCm);
    const precoLinear = calculatePrecoLinear(esp, larg, precoM3);
    const valorPeca = calculateValorPeca(precoLinear, comp);
    const valorTotal = calculateValorTotal(valorPeca, qtd);

    setItens([...itens, {
      madeiraId: null,
      bitolaId: null,
      madeiraNome,
      bitolaDescricao: `${formatDimensionCm(esp)}×${formatDimensionCm(larg)} cm`,
      espessura: String(esp),
      largura: String(larg),
      comprimento: String(comp),
      quantidade: qtd,
      precoM3: String(precoM3),
      precoLinear: String(parseFloat(precoLinear.toFixed(4))),
      valorPeca: String(parseFloat(valorPeca.toFixed(2))),
      valorTotal: String(parseFloat(valorTotal.toFixed(2))),
    }]);
    ["madeira-input", "preco-m3-input", "esp-input", "larg-input", "comp-input", "qtd-input"].forEach((id) => {
      const input = document.getElementById(id) as HTMLInputElement | null;
      if (input) input.value = "";
    });
    toast.success("Item adicionado");
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

          {/* Adicionar Item */}
          <Card className="border border-border/50 shadow-sm">
            <CardContent className="p-5">
              <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><Calculator className="h-4 w-4" />Adicionar Item</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-2">
                    <Label>Madeira *</Label>
                    <Input id="madeira-input" placeholder="Ex.: Guarandi" className="bg-white" />
                  </div>
                  <div className="space-y-2">
                    <Label>Preço por m³ (R$) *</Label>
                    <Input id="preco-m3-input" type="text" inputMode="decimal" placeholder="2400,00" className="bg-white" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Dimensões (preencha livremente)</Label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Espessura (cm) *</Label>
                    <Input id="esp-input" type="text" inputMode="decimal" placeholder="2,5" className="bg-white" />
                  </div>
                  <div className="space-y-2">
                    <Label>Largura (cm) *</Label>
                    <Input id="larg-input" type="text" inputMode="decimal" placeholder="15" className="bg-white" />
                  </div>
                  <div className="space-y-2">
                    <Label>Comprimento (m)</Label>
                    <Input id="comp-input" type="text" inputMode="decimal" placeholder="3" className="bg-white" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Quantidade *</Label>
                  <Input id="qtd-input" type="number" placeholder="1" min="1" className="bg-white" />
                </div>
                <Button onClick={addItem} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Plus className="h-4 w-4 mr-2" />Adicionar Item
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
