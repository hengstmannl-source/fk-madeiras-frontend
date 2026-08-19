import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BookOpen, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";

export type RhTutorialStep = {
  titulo: string;
  aba: string;
  acao: string;
  descricao: string;
  cuidado?: string;
};

export const RH_TUTORIAL_STEPS: RhTutorialStep[] = [
  {
    titulo: "Prepare os cadastros-base",
    aba: "cadastros",
    acao: "Abrir cadastros",
    descricao: "Cadastre os departamentos, cargos e eventos de folha que serão reutilizados nos lançamentos mensais.",
  },
  {
    titulo: "Cadastre os colaboradores",
    aba: "colaboradores",
    acao: "Abrir colaboradores",
    descricao: "Informe contrato, data de admissão, salário, dados bancários e, quando necessário, dependentes para dedução de IRRF.",
  },
  {
    titulo: "Confira as regras tributárias",
    aba: "regras",
    acao: "Abrir regras tributárias",
    descricao: "Cadastre ou revise as tabelas de INSS, IRRF e FGTS vigentes para a competência que será calculada.",
    cuidado: "Use parâmetros conferidos pelo contador antes de fechar uma competência oficial.",
  },
  {
    titulo: "Registre adiantamentos",
    aba: "visao",
    acao: "Abrir visão geral",
    descricao: "Lance os adiantamentos salariais do período. Eles serão abatidos automaticamente do líquido de cada colaborador.",
  },
  {
    titulo: "Abra e revise a folha",
    aba: "folha",
    acao: "Abrir folha",
    descricao: "Abra a competência, inclua eventos por colaborador e use Recalcular sempre que alterar informações da folha.",
  },
  {
    titulo: "Feche e acompanhe no Financeiro",
    aba: "folha",
    acao: "Ver espelhos e fechar",
    descricao: "Após conferir os espelhos, feche a folha. O sistema cria títulos de salários e encargos com vínculo único no Financeiro.",
    cuidado: "Para corrigir uma folha fechada, reabra-a antes. Títulos já baixados ou conciliados não são cancelados automaticamente.",
  },
  {
    titulo: "Consulte o histórico",
    aba: "relatorios",
    acao: "Abrir relatórios e auditoria",
    descricao: "Use o resumo da competência e a auditoria para conferir valores, decisões de fechamento e alterações feitas no módulo.",
  },
];

type RhTutorialDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (aba: string) => void;
};

export function RhTutorialDialog({ open, onOpenChange, onNavigate }: RhTutorialDialogProps) {
  const [etapa, setEtapa] = useState(0);
  const atual = RH_TUTORIAL_STEPS[etapa];
  const ultimaEtapa = etapa === RH_TUTORIAL_STEPS.length - 1;

  useEffect(() => {
    if (open) setEtapa(0);
  }, [open]);

  const abrirDestino = () => {
    onNavigate(atual.aba);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary"><BookOpen className="size-5" /><span className="text-sm font-semibold">Guia operacional</span></div>
          <DialogTitle>Tutorial do módulo de RH e Folha</DialogTitle>
          <DialogDescription>Use esta sequência para preparar, calcular, conferir e fechar a folha com segurança.</DialogDescription>
        </DialogHeader>

        <div aria-label="Etapas do tutorial de RH" className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {RH_TUTORIAL_STEPS.map((passo, indice) => (
            <button
              key={passo.titulo}
              type="button"
              onClick={() => setEtapa(indice)}
              aria-label={`Etapa ${indice + 1}: ${passo.titulo}`}
              aria-current={indice === etapa ? "step" : undefined}
              className={`rounded-lg border px-2 py-2 text-center text-xs font-semibold transition-colors ${indice === etapa ? "border-primary bg-primary text-primary-foreground" : indice < etapa ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-border bg-muted/40 text-muted-foreground"}`}
            >
              {indice < etapa ? <CheckCircle2 className="mx-auto size-4" /> : indice + 1}
            </button>
          ))}
        </div>

        <section className="space-y-4 rounded-xl border border-border bg-muted/30 p-5" aria-live="polite">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Etapa {etapa + 1} de {RH_TUTORIAL_STEPS.length}</p>
          <div><h3 className="text-lg font-semibold">{atual.titulo}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{atual.descricao}</p></div>
          {atual.cuidado && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-5 text-amber-950">{atual.cuidado}</p>}
        </section>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => setEtapa((indice) => Math.max(0, indice - 1))} disabled={etapa === 0}><ChevronLeft className="mr-1 size-4" />Anterior</Button>
          <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={abrirDestino}>{atual.acao}</Button><Button onClick={() => ultimaEtapa ? onOpenChange(false) : setEtapa((indice) => indice + 1)}>{ultimaEtapa ? "Concluir tutorial" : <>Próxima<ChevronRight className="ml-1 size-4" /></>}</Button></div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
