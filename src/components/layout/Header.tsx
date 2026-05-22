import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/hooks/use-auth";
import { useNavigate } from "@tanstack/react-router";

export function Header() {
  const { data } = useCurrentUser();
  const nav = useNavigate();
  const tier = data?.tier ?? "free";
  const handleLogout = async () => {
    await supabase.auth.signOut();
    nav({ to: "/" });
  };
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background/70 px-4 backdrop-blur">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
      </div>
      <div className="flex items-center gap-3">
        <Badge variant="secondary" className="capitalize">{tier}</Badge>
        <span className="hidden text-sm text-muted-foreground sm:block">{data?.user.email}</span>
        <Button size="sm" variant="ghost" onClick={handleLogout} aria-label="Sair">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}