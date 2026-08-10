import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileText, CheckCircle2, Clock, Send, XCircle, Package, Users,
  TrendingUp, ArrowRight,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";

const estadoColors: Record<string, string> = {
  rascunho: "bg-stone-100 text-stone-600 border-stone-200",
  enviado: "bg-blue-50 text-blue-700 border-blue-200",
  aprovado: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejeitado: "bg-red-50 text-red-700 border-red-200",
};

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: stats, isLoading } = trpc.dashboard.stats.useQuery();

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const kpis = [
    { title: "Orçamentos", value: stats?.totalOrcamentos ?? 0, icon: FileText, color: "text-primary", bg: "bg-primary/10" },
    { title: "Valor Total", value: formatCurrency(stats?.totalValor ?? "0"), icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
    { title: "Clientes", value: stats?.totalClientes ?? 0, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
    { title: "Madeiras", value: stats?.totalMadeiras ?? 0, icon: Package, color: "text-amber-600", bg: "bg-amber-50" },
  ];

  const statusCounts = [
    { label: "Rascunhos", value: stats?.totalRascunhos ?? 0, icon: Clock, color: "text-stone-500" },
    { label: "Enviados", value: stats?.totalEnviados ?? 0, icon: Send, color: "text-blue-600" },
    { label: "Aprovados", value: stats?.totalAprovados ?? 0, icon: CheckCircle2, color: "text-emerald-600" },
    { label: "Rejeitados", value: stats?.totalRejeitados ?? 0, icon: XCircle, color: "text-red-500" },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral do sistema de orçamentos</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title} className="border border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{kpi.title}</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{kpi.value}</p>
                </div>
                <div className={`w-10 h-10 rounded-lg ${kpi.bg} flex items-center justify-center`}>
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Status breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statusCounts.map((s) => (
          <div key={s.label} className="flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-white">
            <s.icon className={`h-4 w-4 ${s.color}`} />
            <div>
              <p className="text-lg font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent budgets */}
      <Card className="border border-border/50 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold">Orçamentos Recentes</CardTitle>
          <button onClick={() => setLocation("/orcamentos")} className="text-sm text-primary hover:underline flex items-center gap-1">
            Ver todos <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </CardHeader>
        <CardContent>
          {stats?.recent && stats.recent.length > 0 ? (
            <div className="space-y-2">
              {stats.recent.map((o: any) => (
                <div
                  key={o.id}
                  onClick={() => setLocation(`/orcamentos/${o.id}`)}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{o.numero}</p>
                      <p className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleDateString("pt-PT")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={`text-xs ${estadoColors[o.estado] ?? ""}`}>{o.estado}</Badge>
                    <span className="text-sm font-semibold text-foreground">{formatCurrency(o.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-sm">
              Nenhum orçamento encontrado. Crie o primeiro em <button onClick={() => setLocation("/orcamentos/novo")} className="text-primary hover:underline">Orçamentos</button>.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
