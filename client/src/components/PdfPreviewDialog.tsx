import { useEffect, useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type PdfPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string | null;
  title: string;
  description?: string;
  downloadFileName?: string;
  onClose?: () => void;
};

function urlDeDownload(url: string) {
  if (url.startsWith("blob:")) return url;
  return `${url}${url.includes("?") ? "&" : "?"}download=1`;
}

/** Exibe o documento no próprio sistema; o download só ocorre após confirmação explícita. */
export function PdfPreviewDialog({ open, onOpenChange, url, title, description, downloadFileName, onClose }: PdfPreviewDialogProps) {
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (open && url) setCarregando(true);
  }, [open, url]);

  const fechar = (aberto: boolean) => {
    onOpenChange(aberto);
    if (!aberto) onClose?.();
  };

  const confirmarDownload = () => {
    if (!url) return;
    const link = document.createElement("a");
    link.href = urlDeDownload(url);
    if (downloadFileName) link.download = downloadFileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return <Dialog open={open} onOpenChange={fechar}>
    <DialogContent className="flex h-[min(92vh,900px)] w-[calc(100vw-1rem)] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:w-[calc(100vw-2rem)]">
      <DialogHeader className="border-b px-5 pb-4 pt-5 sm:px-6">
        <DialogTitle className="flex items-center gap-2 text-base sm:text-lg"><FileText className="h-5 w-5 text-primary" />{title}</DialogTitle>
        <DialogDescription>{description ?? "Confira o documento antes de confirmar o download."}</DialogDescription>
      </DialogHeader>
      <div className="relative min-h-0 flex-1 bg-muted/40">
        {carregando && <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-muted/80 text-sm text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin text-primary" />A carregar a pré-visualização…</div>}
        {url && <iframe key={url} title={`Pré-visualização: ${title}`} src={url} className="h-full w-full border-0 bg-white" onLoad={() => setCarregando(false)} />}
      </div>
      <DialogFooter className="border-t bg-background px-5 py-4 sm:px-6">
        <Button type="button" variant="outline" onClick={() => fechar(false)}>Voltar</Button>
        <Button type="button" onClick={confirmarDownload} disabled={!url}><Download className="mr-2 h-4 w-4" />Confirmar download</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
