import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Users, Loader2, Mail, Phone, MapPin } from "lucide-react";
import { toast } from "sonner";

export default function ClientesPage() {
  const clientes = trpc.cliente.list.useQuery();
  const create = trpc.cliente.create.useMutation();
  const update = trpc.cliente.update.useMutation();
  const remove = trpc.cliente.delete.useMutation();
  const utils = trpc.useUtils();

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ nome: "", contacto: "", email: "", morada: "", nif: "", observacoes: "" });

  const handleSubmit = () => {
    if (!form.nome) { toast.error("Nome é obrigatório"); return; }
    if (editId) {
      update.mutate({ id: editId, ...form }, {
        onSuccess: () => { toast.success("Cliente atualizado"); utils.cliente.list.invalidate(); setOpen(false); setEditId(null); setForm({ nome: "", contacto: "", email: "", morada: "", nif: "", observacoes: "" }); },
        onError: (err: any) => toast.error(err.message),
      });
    } else {
      create.mutate(form, {
        onSuccess: () => { toast.success("Cliente criado"); utils.cliente.list.invalidate(); setOpen(false); },
        onError: (err: any) => toast.error(err.message),
      });
    }
  };

  const handleEdit = (c: any) => {
    setEditId(c.id); setForm({ nome: c.nome, contacto: c.contacto || "", email: c.email || "", morada: c.morada || "", nif: c.nif || "", observacoes: c.observacoes || "" }); setOpen(true);
  };
  const handleDelete = (id: number) => {
    if (!confirm("Eliminar este cliente?")) return;
    remove.mutate({ id }, { onSuccess: () => { toast.success("Cliente eliminado"); utils.cliente.list.invalidate(); }, onError: (err) => toast.error(err.message) });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestão de clientes e contactos</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setForm({ nome: "", contacto: "", email: "", morada: "", nif: "", observacoes: "" }); } }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground"><Plus className="h-4 w-4 mr-2" />Novo Cliente</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editId ? "Editar" : "Novo"} Cliente</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({...form, nome: e.target.value})} placeholder="Nome completo" className="bg-white" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Contacto</Label><Input value={form.contacto} onChange={(e) => setForm({...form, contacto: e.target.value})} placeholder="+351 ..." className="bg-white" /></div>
                <div className="space-y-2"><Label>NIF</Label><Input value={form.nif} onChange={(e) => setForm({...form, nif: e.target.value})} placeholder="NIF" className="bg-white" /></div>
              </div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} placeholder="email@exemplo.pt" className="bg-white" /></div>
              <div className="space-y-2"><Label>Morada</Label><Input value={form.morada} onChange={(e) => setForm({...form, morada: e.target.value})} placeholder="Morada completa" className="bg-white" /></div>
              <div className="space-y-2"><Label>Observações</Label><Textarea value={form.observacoes} onChange={(e) => setForm({...form, observacoes: e.target.value})} placeholder="Notas adicionais" className="bg-white" rows={2} /></div>
              <Button onClick={handleSubmit} disabled={create.isPending || update.isPending} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">{create.isPending || update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{editId ? "Atualizar" : "Criar"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border border-border/50 bg-white shadow-sm overflow-hidden">
        {clientes.isLoading ? <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />A carregar...</div>
        : clientes.data && clientes.data.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Nome</TableHead>
                <TableHead className="font-semibold">Contacto</TableHead>
                <TableHead className="font-semibold">Email</TableHead>
                <TableHead className="font-semibold">NIF</TableHead>
                <TableHead className="font-semibold">Morada</TableHead>
                <TableHead className="text-right font-semibold">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientes.data.map((c) => (
                <TableRow key={c.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell><span className="flex items-center gap-1 text-sm text-muted-foreground"><Phone className="h-3 w-3" />{c.contacto || "—"}</span></TableCell>
                  <TableCell><span className="flex items-center gap-1 text-sm text-muted-foreground"><Mail className="h-3 w-3" />{c.email || "—"}</span></TableCell>
                  <TableCell>{c.nif || "—"}</TableCell>
                  <TableCell><span className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3 w-3 shrink-0" /><span className="truncate max-w-[150px]">{c.morada || "—"}</span></span></TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-12 text-center text-muted-foreground"><Users className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">Nenhum cliente cadastrado</p></div>
        )}
      </div>
    </div>
  );
}
