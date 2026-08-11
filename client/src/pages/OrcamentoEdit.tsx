import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, FileText, Download, Send, CheckCircle2, XCircle, Clock, Loader2,
  Mail, Phone, MapPin, Package,
} from "lucide-react";
import { formatCurrency, formatDimensionCm } from "@/lib/utils";
import { toast } from "sonner";

const estadoColors: Record<string, string> = {
  rascunho: "bg-stone-100 text-stone-600 border-stone-200",
  enviado: "bg-blue-50 text-blue-700 border-blue-200",
  aprovado: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejeitado: "bg-red-50 text-red-700 border-red-200",
};

export default function OrcamentoEdit() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const orcamentoId = parseInt(id || "0");
  const orc = trpc.orcamento.get.useQuery({ id: orcamentoId }, { enabled: orcamentoId > 0 });
  const updateEstado = trpc.orcamento.updateEstado.useMutation();
  const utils = trpc.useUtils();

  // Fetch cliente details
  const clientes = trpc.cliente.list.useQuery();
  const cliente = clientes.data?.find(c => c.id === orc.data?.orcamento.clienteId);

  const handleEstado = (estado: string) => {
    updateEstado.mutate({ id: orcamentoId, estado: estado as any }, {
      onSuccess: () => { toast.success(`Estado atualizado para "${estado}"`); utils.orcamento.get.invalidate({ id: orcamentoId }); },
      onError: (err) => toast.error(err.message),
    });
  };

  const downloadPdf = () => {
    window.open(`/api/pdf/orcamento/${orcamentoId}`, "_blank");
  };

  if (orc.isLoading) {
    return <div className="max-w-7xl mx-auto p-8 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />A carregar...</div>;
  }

  if (!orc.data) {
    return <div className="max-w-7xl mx-auto p-8 text-center text-muted-foreground">Orçamento não encontrado</div>;
  }

  const { orcamento, itens } = orc.data;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" onClick={() => setLocation("/orcamentos")} className="mb-2 -ml-2"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{orcamento.numero}</h1>
            <Badge variant="outline" className={`text-xs ${estadoColors[orcamento.estado] ?? ""}`}>{orcamento.estado}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {new Date(orcamento.createdAt).toLocaleDateString("pt-PT", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={downloadPdf}><Download className="h-4 w-4 mr-2" />PDF</Button>
          {orcamento.estado !== "aprovado" && (
            <Button variant="outline" onClick={() => handleEstado("enviado")} className="text-blue-600 border-blue-200"><Send className="h-4 w-4 mr-2" />Enviar</Button>
          )}
          {orcamento.estado !== "aprovado" && (
            <Button variant="outline" onClick={() => handleEstado("aprovado")} className="text-emerald-600 border-emerald-200"><CheckCircle2 className="h-4 w-4 mr-2" />Aprovar</Button>
          )}
          <Button variant="outline" onClick={() => handleEstado("rejeitado")} className="text-red-500 border-red-200"><XCircle className="h-4 w-4 mr-2" />Rejeitar</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Cliente */}
          <Card className="border border-border/50 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-base font-semibold flex items-center gap-2"><Package className="h-4 w-4" />Cliente</CardTitle></CardHeader>
            <CardContent>
              {cliente ? (
                <div className="space-y-2">
                  <p className="font-medium">{cliente.nome}</p>
                  {cliente.contacto && <p className="text-sm text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{cliente.contacto}</p>}
                  {cliente.email && <p className="text-sm text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{cliente.email}</p>}
                  {cliente.morada && <p className="text-sm text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{cliente.morada}</p>}
                  {cliente.nif && <p className="text-sm text-muted-foreground">NIF: {cliente.nif}</p>}
                </div>
              ) : <p className="text-sm text-muted-foreground">Cliente não encontrado</p>}
            </CardContent>
          </Card>

          {/* Itens */}
          <Card className="border border-border/50 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-base font-semibold flex items-center gap-2"><FileText className="h-4 w-4" />Itens ({itens?.length || 0})</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 font-medium text-muted-foreground">Madeira</th>
                      <th className="text-left py-2 font-medium text-muted-foreground">Dimensões</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Qtd</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Preço/m³</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Preço/m.l.</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Valor/peça</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens?.map((item, idx) => (
                      <tr key={idx} className="border-b border-border/50">
                        <td className="py-2.5 font-medium">{item.madeiraNome}</td>
                        <td className="py-2.5 text-muted-foreground">{formatDimensionCm(item.espessura)}×{formatDimensionCm(item.largura)} cm × {item.comprimento} m</td>
                        <td className="py-2.5 text-right">{item.quantidade}</td>
                        <td className="py-2.5 text-right">{formatCurrency(item.precoM3)}</td>
                        <td className="py-2.5 text-right">{formatCurrency(item.precoLinear)}</td>
                        <td className="py-2.5 text-right">{formatCurrency(item.valorPeca)}</td>
                        <td className="py-2.5 text-right font-semibold">{formatCurrency(item.valorTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {orcamento.observacoes && (
            <Card className="border border-border/50 shadow-sm">
              <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">Observações</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">{orcamento.observacoes}</p></CardContent>
            </Card>
          )}
        </div>

        {/* Right: Summary */}
        <div>
          <Card className="border border-border/50 shadow-sm sticky top-6">
            <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">Resumo</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">{formatCurrency(orcamento.subtotal)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Desconto</span><span className="text-destructive">- {formatCurrency(orcamento.desconto || "0")}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Frete</span><span>+ {formatCurrency(orcamento.frete || "0")}</span></div>
              <Separator />
              <div className="flex justify-between text-lg font-bold"><span>Total</span><span className="text-primary">{formatCurrency(orcamento.total)}</span></div>
              <Separator />
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><p className="text-xs text-muted-foreground">Peças</p><p className="font-semibold text-sm">{orcamento.totalPecas}</p></div>
                <div><p className="text-xs text-muted-foreground">M. Linear</p><p className="font-semibold text-sm">{orcamento.totalMetroLinear}m</p></div>
                <div><p className="text-xs text-muted-foreground">Volume</p><p className="font-semibold text-sm">{orcamento.totalVolume}m³</p></div>
              </div>
              {orcamento.vendedor && <div className="text-xs text-muted-foreground pt-2">Vendedor: {orcamento.vendedor}</div>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
