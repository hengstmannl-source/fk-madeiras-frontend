import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  centimetersToMillimeters,
  formatDimensionCm,
  millimetersToCentimeters,
  parseDecimalInput,
} from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Ruler, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function BitolasPage() {
  const madeiras = trpc.madeira.list.useQuery();
  const [filterMadeira, setFilterMadeira] = useState("all");
  const bitolas = trpc.bitola.list.useQuery(
    filterMadeira !== "all" ? { madeiraId: Number(filterMadeira) } : undefined
  );
  const create = trpc.bitola.create.useMutation();
  const update = trpc.bitola.update.useMutation();
  const remove = trpc.bitola.delete.useMutation();
  const utils = trpc.useUtils();

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ madeiraId: "", espessura: "", largura: "", comprimento: "", descricao: "" });

  const handleSubmit = () => {
    if (!form.madeiraId || !form.espessura || !form.largura) { toast.error("Preencha os campos obrigatórios"); return; }
    const espessuraCm = parseDecimalInput(form.espessura);
    const larguraCm = parseDecimalInput(form.largura);
    if (!Number.isFinite(espessuraCm) || espessuraCm <= 0 || !Number.isFinite(larguraCm) || larguraCm <= 0) {
      toast.error("Introduza dimensões válidas em centímetros");
      return;
    }
    const payload = {
      madeiraId: Number(form.madeiraId),
      espessura: String(centimetersToMillimeters(espessuraCm)),
      largura: String(centimetersToMillimeters(larguraCm)),
      comprimento: form.comprimento || undefined,
      descricao: form.descricao || undefined,
    };
    if (editId) {
      update.mutate({ id: editId, ...payload }, {
        onSuccess: () => { toast.success("Bitola atualizada"); utils.bitola.list.invalidate(); setOpen(false); setEditId(null); setForm({ madeiraId: "", espessura: "", largura: "", comprimento: "", descricao: "" }); },
        onError: (err: any) => toast.error(err.message),
      });
    } else {
      create.mutate(payload, {
        onSuccess: () => { toast.success("Bitola criada"); utils.bitola.list.invalidate(); setOpen(false); },
        onError: (err: any) => toast.error(err.message),
      });
    }
  };

  const handleEdit = (b: any) => {
    setEditId(b.id); setForm({ madeiraId: String(b.madeiraId), espessura: String(millimetersToCentimeters(b.espessura)), largura: String(millimetersToCentimeters(b.largura)), comprimento: b.comprimento || "", descricao: b.descricao || "" }); setOpen(true);
  };
  const handleDelete = (id: number) => {
    if (!confirm("Eliminar esta bitola?")) return;
    remove.mutate({ id }, { onSuccess: () => { toast.success("Bitola eliminada"); utils.bitola.list.invalidate(); }, onError: (err) => toast.error(err.message) });
  };

  const madeiraName = (id: number) => madeiras.data?.find(m => m.id === id)?.nome ?? "—";

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Bitolas</h1>
          <p className="text-sm text-muted-foreground mt-1">Dimensões disponíveis por tipo de madeira</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setForm({ madeiraId: "", espessura: "", largura: "", comprimento: "", descricao: "" }); } }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground"><Plus className="h-4 w-4 mr-2" />Nova Bitola</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "Editar" : "Nova"} Bitola</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Tipo de madeira *</Label>
                <Select value={form.madeiraId} onValueChange={(v) => setForm({...form, madeiraId: v})}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Selecionar madeira" /></SelectTrigger>
                  <SelectContent>{madeiras.data?.filter(m => m.ativo).map((m) => (<SelectItem key={m.id} value={String(m.id)}>{m.nome}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2"><Label>Espessura (cm) *</Label><Input type="text" inputMode="decimal" placeholder="2,5" value={form.espessura} onChange={(e) => setForm({...form, espessura: e.target.value})} className="bg-white" /></div>
                <div className="space-y-2"><Label>Largura (cm) *</Label><Input type="text" inputMode="decimal" placeholder="15" value={form.largura} onChange={(e) => setForm({...form, largura: e.target.value})} className="bg-white" /></div>
                <div className="space-y-2"><Label>Comprimento (m)</Label><Input type="text" inputMode="decimal" placeholder="3" value={form.comprimento} onChange={(e) => setForm({...form, comprimento: e.target.value})} className="bg-white" /></div>
              </div>
              <div className="space-y-2"><Label>Descrição</Label><Input value={form.descricao} onChange={(e) => setForm({...form, descricao: e.target.value})} className="bg-white" /></div>
              <Button onClick={handleSubmit} disabled={create.isPending || update.isPending} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">{create.isPending || update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{editId ? "Atualizar" : "Criar"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-3">
        <Select value={filterMadeira} onValueChange={setFilterMadeira}>
          <SelectTrigger className="w-56 bg-white"><SelectValue placeholder="Filtrar por madeira" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todas as madeiras</SelectItem>{madeiras.data?.filter(m => m.ativo).map((m) => (<SelectItem key={m.id} value={String(m.id)}>{m.nome}</SelectItem>))}</SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border/50 bg-white shadow-sm overflow-hidden">
        {bitolas.isLoading ? <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />A carregar...</div>
        : bitolas.data && bitolas.data.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Madeira</TableHead>
                <TableHead className="font-semibold">Espessura</TableHead>
                <TableHead className="font-semibold">Largura</TableHead>
                <TableHead className="font-semibold">Comprimento</TableHead>
                <TableHead className="font-semibold">Descrição</TableHead>
                <TableHead className="text-right font-semibold">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bitolas.data.map((b) => (
                <TableRow key={b.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium">{madeiraName(b.madeiraId)}</TableCell>
                  <TableCell>{formatDimensionCm(b.espessura)} cm</TableCell>
                  <TableCell>{formatDimensionCm(b.largura)} cm</TableCell>
                  <TableCell>{b.comprimento ? `${b.comprimento} m` : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{b.descricao || "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(b)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(b.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-12 text-center text-muted-foreground"><Ruler className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">Nenhuma bitola encontrada</p></div>
        )}
      </div>
    </div>
  );
}
