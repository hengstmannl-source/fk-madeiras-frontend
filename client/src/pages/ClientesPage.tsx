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
import { Plus, Pencil, Trash2, Users, Loader2, Mail, Phone, MapPin, Download, FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";

export default function ClientesPage() {
  const clientes = trpc.cliente.list.useQuery();
  const create = trpc.cliente.create.useMutation();
  const update = trpc.cliente.update.useMutation();
  const remove = trpc.cliente.delete.useMutation();
  const modeloImportacao = trpc.cliente.modeloCsv.useQuery(undefined, { enabled: false });
  const prepararImportacao = trpc.cliente.prepararImportacaoCsv.useMutation();
  const importarClientes = trpc.cliente.importarCsv.useMutation();
  const utils = trpc.useUtils();

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ nome: "", contacto: "", email: "", morada: "", nif: "", observacoes: "" });
  const [importacaoAberta, setImportacaoAberta] = useState(false);
  const [arquivoImportacao, setArquivoImportacao] = useState<File | null>(null);
  const [conteudoImportacao, setConteudoImportacao] = useState("");
  const [preparoImportacao, setPreparoImportacao] = useState<{ linhas: Array<{ numeroLinha: number; nome: string; contacto: string | null; email: string | null; nif: string | null; morada: string | null; observacoes: string | null }>; erros: string[] } | null>(null);

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

  const limparImportacao = () => {
    setArquivoImportacao(null);
    setConteudoImportacao("");
    setPreparoImportacao(null);
    prepararImportacao.reset();
    importarClientes.reset();
  };

  const selecionarArquivoImportacao = (arquivo: File | null) => {
    setArquivoImportacao(arquivo);
    setConteudoImportacao("");
    setPreparoImportacao(null);
    if (!arquivo) return;
    if (arquivo.size > 1_000_000) { toast.error("O arquivo excede o limite de 1 MB"); return; }
    const leitor = new FileReader();
    leitor.onload = () => {
      const conteudo = String(leitor.result ?? "");
      setConteudoImportacao(conteudo);
      prepararImportacao.mutate({ conteudo }, {
        onSuccess: setPreparoImportacao,
        onError: (erro) => toast.error(erro.message),
      });
    };
    leitor.onerror = () => toast.error("Não foi possível ler o arquivo selecionado");
    leitor.readAsText(arquivo, "utf-8");
  };

  const baixarModeloImportacao = async () => {
    const resultado = await modeloImportacao.refetch();
    if (!resultado.data) { toast.error("Não foi possível gerar o modelo de clientes"); return; }
    const url = URL.createObjectURL(new Blob([resultado.data], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "modelo-importacao-clientes.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const confirmarImportacao = () => {
    if (!conteudoImportacao || !preparoImportacao?.linhas.length || preparoImportacao.erros.length) return;
    importarClientes.mutate({ conteudo: conteudoImportacao }, {
      onSuccess: (resultado) => {
        if (resultado.erros.length) { setPreparoImportacao((atual) => atual ? { ...atual, erros: resultado.erros } : atual); return; }
        toast.success(`${resultado.importados} cliente(s) importado(s) com sucesso`);
        utils.cliente.list.invalidate();
        setImportacaoAberta(false);
        limparImportacao();
      },
      onError: (erro) => toast.error(erro.message),
    });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestão de clientes e contactos</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Dialog open={importacaoAberta} onOpenChange={(aberto) => { setImportacaoAberta(aberto); if (!aberto) limparImportacao(); }}>
            <DialogTrigger asChild><Button variant="outline"><Upload className="mr-2 h-4 w-4" />Importar planilha</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
              <DialogHeader><DialogTitle>Importar clientes por planilha</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950"><p className="font-medium">Importação segura com pré-visualização</p><p className="mt-1 text-sky-900">Use o modelo CSV. Todos os dados e duplicidades são verificados antes da confirmação.</p></div>
                <div className="space-y-2"><Label htmlFor="arquivo-clientes">Arquivo CSV *</Label><Input id="arquivo-clientes" aria-label="Arquivo CSV de clientes" type="file" accept=".csv,text/csv" onChange={(evento) => selecionarArquivoImportacao(evento.target.files?.[0] ?? null)} /><p className="text-xs text-muted-foreground">Limite de 1.000 clientes e 1 MB por arquivo.</p></div>
                {arquivoImportacao && <div className="flex items-center gap-2 rounded-md bg-muted/60 px-3 py-2 text-sm"><FileSpreadsheet className="h-4 w-4 text-primary" /><span className="truncate">{arquivoImportacao.name}</span>{prepararImportacao.isPending && <Loader2 className="ml-auto h-4 w-4 animate-spin" />}</div>}
                {preparoImportacao?.erros.length ? <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900"><p className="font-medium">Corrija a planilha antes de importar:</p>{preparoImportacao.erros.map((erro, indice) => <p key={`${erro}-${indice}`} className="text-xs">• {erro}</p>)}</div> : null}
                {preparoImportacao && !preparoImportacao.erros.length ? <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3"><p className="text-sm font-medium text-emerald-900">{preparoImportacao.linhas.length} cliente(s) pronto(s) para importar</p><div className="mt-2 max-h-40 overflow-y-auto rounded border bg-background"><Table><TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Contacto</TableHead><TableHead>E-mail</TableHead><TableHead>NIF</TableHead></TableRow></TableHeader><TableBody>{preparoImportacao.linhas.slice(0, 20).map((linha) => <TableRow key={linha.numeroLinha}><TableCell className="font-medium">{linha.nome}</TableCell><TableCell>{linha.contacto || "—"}</TableCell><TableCell>{linha.email || "—"}</TableCell><TableCell>{linha.nif || "—"}</TableCell></TableRow>)}</TableBody></Table></div>{preparoImportacao.linhas.length > 20 && <p className="mt-2 text-xs text-muted-foreground">A pré-visualização mostra os primeiros 20 clientes.</p>}</div> : null}
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between"><Button variant="ghost" onClick={baixarModeloImportacao} disabled={modeloImportacao.isFetching}><Download className="mr-1.5 h-4 w-4" />Baixar modelo</Button><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setImportacaoAberta(false)} disabled={importarClientes.isPending}>Cancelar</Button><Button onClick={confirmarImportacao} disabled={!preparoImportacao?.linhas.length || Boolean(preparoImportacao.erros.length) || importarClientes.isPending || prepararImportacao.isPending}>{importarClientes.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar importação</Button></div></div>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setForm({ nome: "", contacto: "", email: "", morada: "", nif: "", observacoes: "" }); } }}>
            <DialogTrigger asChild><Button className="bg-primary hover:bg-primary/90 text-primary-foreground"><Plus className="h-4 w-4 mr-2" />Novo Cliente</Button></DialogTrigger>
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
