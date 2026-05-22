import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { PlayCircle } from "lucide-react";

export const Route = createFileRoute("/_app/favoritos")({
  head: () => ({ meta: [{ title: "Favoritos — Academy" }] }),
  component: Favoritos,
});

function Favoritos() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["favorites", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("lesson_favorites")
        .select("lesson_id, lessons(*)")
        .eq("user_id", user!.id);
      return (data ?? []) as unknown as Array<{ lesson_id: string; lessons: { id: string; title: string; cover_url: string | null; module_id: string; access_tier: string } | null }>;
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Favoritos</h1>
      {!data || data.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center text-muted-foreground">Nenhuma aula favoritada ainda.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((f) => f.lessons && (
            <Link
              key={f.lesson_id}
              to="/modulos/$id"
              params={{ id: f.lessons.module_id }}
              search={{ aula: f.lessons.id }}
              className="glass-card group overflow-hidden rounded-2xl transition hover:shadow-glow"
            >
              <div className="relative aspect-video bg-muted">
                {f.lessons.cover_url ? (
                  <img src={f.lessons.cover_url} alt={f.lessons.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center gradient-primary text-primary-foreground">
                    <PlayCircle className="h-10 w-10 opacity-80" />
                  </div>
                )}
              </div>
              <div className="space-y-2 p-4">
                <h3 className="line-clamp-1 font-semibold">{f.lessons.title}</h3>
                <Badge variant="secondary" className="text-[10px] uppercase">{f.lessons.access_tier}</Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}