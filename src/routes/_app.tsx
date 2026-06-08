import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Header } from "@/components/layout/Header";
import { supabase } from "@/lib/supabase";
import { StudentPreviewProvider } from "@/hooks/use-student-preview";

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });

    // Admin passa direto
    try {
      const { data: isAdmin } = await supabase.rpc("has_role" as never, {
        _user_id: data.user.id, _role: "admin",
      } as never);
      if (isAdmin) return;
    } catch { /* se RPC falhar, cai na verificação de assinatura */ }

    // Verifica assinatura ativa
    const { data: sub } = await supabase
      .from("user_subscriptions")
      .select("status")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (sub?.status === "active") return;

    // Fallback: aluno pode ter comprado ANTES de criar conta
    // O webhook grava em allowed_emails mas não em user_subscriptions nesse caso
    const email = data.user.email?.toLowerCase().trim();
    if (email) {
      const { data: allowed } = await supabase
        .from("allowed_emails")
        .select("status, tier")
        .eq("email", email)
        .maybeSingle();

      if (allowed?.status === "active") {
        // Cria o registro em user_subscriptions automaticamente
        await supabase.from("user_subscriptions").upsert(
          { user_id: data.user.id, tier: allowed.tier ?? "basic", status: "active", payment_provider: "cackto" },
          { onConflict: "user_id" }
        );
        return;
      }
    }

    throw redirect({ to: "/auth?acesso=bloqueado" });
  },
  component: AppLayout,
});

function AppLayout() {
  return (
    <StudentPreviewProvider>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background">
          <AppSidebar />
          <div className="flex flex-1 flex-col">
            <Header />
            <main className="flex-1 p-4 md:p-8">
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </StudentPreviewProvider>
  );
}