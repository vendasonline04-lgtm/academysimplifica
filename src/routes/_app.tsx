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