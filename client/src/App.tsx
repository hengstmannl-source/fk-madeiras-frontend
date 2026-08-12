import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardLayout from "./components/DashboardLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import MadeirasPage from "./pages/MadeirasPage";
import ClientesPage from "./pages/ClientesPage";
import OrcamentosPage from "./pages/OrcamentosPage";
import OrcamentoNovo from "./pages/OrcamentoNovo";
import OrcamentoEdit from "./pages/OrcamentoEdit";
import EmpresaPage from "./pages/EmpresaPage";
import OrcamentosAprovadosPage from "./pages/OrcamentosAprovadosPage";
import FinanceiroPage from "./pages/FinanceiroPage";
import ProducaoPage from "./pages/ProducaoPage";
import EstoquePage from "./pages/EstoquePage";
import InventarioPage from "./pages/InventarioPage";
import DieselPage from "./pages/DieselPage";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/madeiras" component={MadeirasPage} />
        <Route path="/clientes" component={ClientesPage} />
        <Route path="/vendas/aprovadas" component={OrcamentosAprovadosPage} />
        <Route path="/orcamentos/aprovados" component={OrcamentosAprovadosPage} />
        <Route path="/orcamentos" component={OrcamentosPage} />
        <Route path="/orcamentos/novo" component={OrcamentoNovo} />
        <Route path="/orcamentos/:id" component={OrcamentoEdit} />
        <Route path="/financeiro" component={FinanceiroPage} />
        <Route path="/producao" component={ProducaoPage} />
        <Route path="/estoque" component={EstoquePage} />
        <Route path="/inventario" component={InventarioPage} />
        <Route path="/diesel" component={DieselPage} />
        <Route path="/empresa" component={EmpresaPage} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
