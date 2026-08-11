import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  LayoutDashboard, LogOut, PanelLeft, Users,
  FileText, Building2, BadgeCheck, WalletCards, ArrowDownToLine,
  ArrowUpFromLine, Warehouse, Factory, Fuel,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { toast } from "sonner";

type NavigationItem = {
  icon: typeof LayoutDashboard;
  label: string;
  path: string;
  disabled?: boolean;
};

export const dashboardNavigation = {
  principal: [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  ],
  financeiro: [
    { icon: WalletCards, label: "Financeiro", path: "/financeiro" },
    { icon: ArrowUpFromLine, label: "Contas a pagar", path: "/financeiro?tipo=pagar" },
    { icon: ArrowDownToLine, label: "Contas a receber", path: "/financeiro?tipo=receber" },
  ],
  vendas: [
    { icon: FileText, label: "Vendas", path: "/orcamentos" },
    { icon: BadgeCheck, label: "Aprovados", path: "/orcamentos/aprovados" },
  ],
  gestao: [
    { icon: Users, label: "Clientes", path: "/clientes" },
    { icon: Building2, label: "Empresa", path: "/empresa" },
  ],
  producao: [
    { icon: Factory, label: "Produção", path: "/producao" },
    { icon: Warehouse, label: "Estoque", path: "/producao?aba=estoque" },
  ],
  futuros: [
    { icon: Fuel, label: "Diesel", path: "/futuro/diesel", disabled: true },
  ],
} satisfies Record<string, NavigationItem[]>;

export const dashboardMenuItems = Object.values(dashboardNavigation).flat();

export function getNavigationPresentation(isMobile: boolean) {
  return {
    collapsible: "icon" as const,
    showMobileHeader: isMobile,
    groups: ["Financeiro", "Vendas", "Gestão", "Produção", "Em breve"],
  };
}

export function handleNavigationItemClick(
  item: NavigationItem,
  navigate: (path: string) => void,
  notify: (message: string) => void,
) {
  if (item.disabled) {
    notify(getFutureModuleMessage(item.label));
    return;
  }
  navigate(item.path);
}

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-xl bg-primary flex items-center justify-center mb-2">
              <span className="text-primary-foreground text-xl font-bold">FK</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              FK Madeiras
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Sistema de gestão de vendas e financeiro para madeireira
            </p>
          </div>
          <Button
            onClick={() => startLogin()}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            Iniciar Sessão
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({ children, setSidebarWidth }: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = dashboardMenuItems.find((item) => isItemActive(item, location));
  const isMobile = useIsMobile();
  const navigationPresentation = getNavigationPresentation(isMobile);

  useEffect(() => { if (isCollapsed) setIsResizing(false); }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible={navigationPresentation.collapsible} className="border-r-0" disableTransition={isResizing}>
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                    <span className="text-primary-foreground text-xs font-bold">FK</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold tracking-tight truncate text-sm text-foreground">FK Madeiras</span>
                    <span className="text-[10px] text-muted-foreground truncate">Gestão madeireira</span>
                  </div>
                </div>
              ) : (
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground text-xs font-bold">FK</span>
                </div>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 px-2 py-1">
            <SidebarMenu>
              {dashboardNavigation.principal.map((item) => <NavigationButton key={item.path} item={item} location={location} navigate={setLocation} />)}
            </SidebarMenu>
            <NavigationGroup label="Financeiro" items={dashboardNavigation.financeiro} location={location} navigate={setLocation} renderPrincipal />
            <NavigationGroup label="Vendas" items={dashboardNavigation.vendas} location={location} navigate={setLocation} />
            <NavigationGroup label="Gestão" items={dashboardNavigation.gestao} location={location} navigate={setLocation} />
            <NavigationGroup label="Produção" items={dashboardNavigation.producao} location={location} navigate={setLocation} />
            <NavigationGroup label="Em breve" items={dashboardNavigation.futuros} location={location} navigate={setLocation} />
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-primary text-primary-foreground">
                      {user?.name?.charAt(0).toUpperCase() ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none text-foreground">
                      {user?.name || "Utilizador"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || ""}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Terminar Sessão</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => { if (isCollapsed) return; setIsResizing(true); }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {navigationPresentation.showMobileHeader && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <span className="tracking-tight text-foreground font-medium">
                {activeMenuItem?.label ?? "FK Madeiras"}
              </span>
            </div>
          </div>
        )}
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </>
  );
}

function isItemActive(item: NavigationItem, location: string) {
  if (item.path === "/") return location === "/";
  if (item.path === "/orcamentos") return location === "/orcamentos" || (location.startsWith("/orcamentos/") && !location.startsWith("/orcamentos/aprovados"));
  return location === item.path || (item.path !== "/financeiro" && location.startsWith(item.path));
}

function NavigationButton({ item, location, navigate }: { item: NavigationItem; location: string; navigate: (path: string) => void }) {
  const active = isItemActive(item, location);
  return <SidebarMenuItem><SidebarMenuButton isActive={active} onClick={() => navigate(item.path)} tooltip={item.label} className="h-10 transition-all font-medium text-sm"><item.icon className={`h-4 w-4 ${active ? "text-primary" : ""}`} /><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>;
}

export function getFutureModuleMessage(label: string) {
  return `${label} será disponibilizado em uma próxima etapa.`;
}

function NavigationGroup({ label, items, location, navigate, renderPrincipal = false }: { label: string; items: NavigationItem[]; location: string; navigate: (path: string) => void; renderPrincipal?: boolean }) {
  const principal = renderPrincipal ? items[0] : undefined;
  const subitems = renderPrincipal ? items.slice(1) : items;
  return <div className="mt-2"><p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground group-data-[collapsible=icon]:hidden">{label}</p><SidebarMenu>{principal ? <NavigationButton item={principal} location={location} navigate={navigate} /> : null}<SidebarMenuSub>{subitems.map((item) => { const active = isItemActive(item, location); return <SidebarMenuSubItem key={item.path}><SidebarMenuSubButton isActive={active} onClick={() => handleNavigationItemClick(item, navigate, toast.info)} className={item.disabled ? "text-muted-foreground/70" : ""}><item.icon className={`h-3.5 w-3.5 ${active ? "text-primary" : ""}`} /><span>{item.label}</span>{item.disabled ? <span className="ml-auto text-[10px] text-muted-foreground">Em breve</span> : null}</SidebarMenuSubButton></SidebarMenuSubItem>; })}</SidebarMenuSub></SidebarMenu></div>;
}
