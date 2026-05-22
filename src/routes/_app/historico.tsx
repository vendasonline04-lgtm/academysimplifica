import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_app/historico")({
  head: () => ({ meta: [{ title: "Histórico — Academy" }] }),
  component: Historico,
});

function Historico() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["history", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("lesson_progress")
        .select("completed_at, lessons(id, title, module_id)")
        .eq("user_id", user!.id)
        .order("completed_at", { ascending: false });
      return (data ?? []) as unknown as Array<{ completed_at: string; lessons: { id: string; title: string; module_id: string } | null }>;
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Histórico</h1>
      {!data || data.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center text-muted-foreground">Conclua aulas para vê-las aqui.</div>
      ) : (
        <div className="glass-card divide-y rounded-2xl">
          {data.map((h, i) => h.lessons && (
            <Link
              key={i}
              to="/modulos/$id"
              params={{ id: h.lessons.module_id }}
              search={{ aula: h.lessons.id }}
              className="flex items-center justify-between gap-4 p-4 transition hover:bg-muted/40"
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <span className="font-medium">{h.lessons.title}</span>
              </div>
              <span className="text-sm text-muted-foreground">{new Date(h.completed_at).toLocaleDateString("pt-BR")}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}