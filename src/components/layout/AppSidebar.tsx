import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Heart, History, LifeBuoy, Crown, ShieldCheck, GraduationCap, UserRound, Webhook, Eye, Users, X } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentUser } from "@/hooks/use-auth";
import { useStudentPreview } from "@/hooks/use-student-preview";

const main = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Favoritos", url: "/favoritos", icon: Heart },
  { title: "Histórico", url: "/historico", icon: History },
];

const more = [
  { title: "Upgrade", url: "/upgrade", icon: Crown },
  { title: "Suporte", url: "/suporte", icon: LifeBuoy },
];

export function AppSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { data } = useCurrentUser();
  const { previewMode, setPreviewMode } = useStudentPreview();
  const navigate = useNavigate();
  const isActive = (u: string) => path === u || path.startsWith(u + "/");

  function activatePreview(mode: "full" | "student") {
    setPreviewMode(mode);
    navigate({ to: "/dashboard" });
  }

  function exitPreview() {
    setPreviewMode(null);
    navigate({ to: "/dashboard" });
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link to="/dashboard" className="flex items-center gap-2 px-2 py-1.5 font-semibold">
          <div className="grid h-8 w-8 place-items-center rounded-lg gradient-primary text-primary-foreground">
            <GraduationCap className="h-4 w-4" />
          </div>
          <span>Academy</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Aprender</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {main.map((i) => (
                <SidebarMenuItem key={i.url}>
                  <SidebarMenuButton asChild isActive={isActive(i.url)}>
                    <Link to={i.url}>
                      <i.icon />
                      <span>{i.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Conta</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {more.map((i) => (
                <SidebarMenuItem key={i.url}>
                  <SidebarMenuButton asChild isActive={isActive(i.url)}>
                    <Link to={i.url}>
                      <i.icon />
                      <span>{i.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {data?.isAdmin && (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/admin")}>
                      <Link to="/admin">
                        <ShieldCheck />
                        <span>Admin</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={path === "/admin" && typeof window !== "undefined" && window.location.search.includes("tab=webhook")}>
                      <Link to="/admin" search={{ tab: "webhook" }}>
                        <Webhook />
                        <span>Webhook</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                          isActive={!!previewMode}
                          className={previewMode ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground"}
                        >
                          <UserRound />
                          <span>
                            {previewMode === "full"
                              ? "Preview: Completo"
                              : previewMode === "student"
                              ? "Preview: Aluno"
                              : "Ver como Aluno"}
                          </span>
                        </SidebarMenuButton>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="right" align="end" className="w-56">
                        <DropdownMenuLabel className="text-xs text-muted-foreground">Modo de visualização</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => activatePreview("full")}
                          className={previewMode === "full" ? "bg-primary/10 text-primary font-medium" : ""}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          <div>
                            <div className="font-medium">Plataforma Completa</div>
                            <div className="text-xs text-muted-foreground">Todas as aulas desbloqueadas</div>
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => activatePreview("student")}
                          className={previewMode === "student" ? "bg-primary/10 text-primary font-medium" : ""}
                        >
                          <Users className="mr-2 h-4 w-4" />
                          <div>
                            <div className="font-medium">Como Aluno (Básico)</div>
                            <div className="text-xs text-muted-foreground">Simula um aluno no plano básico</div>
                          </div>
                        </DropdownMenuItem>
                        {previewMode && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={exitPreview} className="text-destructive">
                              <X className="mr-2 h-4 w-4" />
                              Sair do modo preview
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuItem>
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}