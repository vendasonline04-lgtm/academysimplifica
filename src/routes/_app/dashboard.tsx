import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useCurrentUser, tierAllows, isModuleUnlocked } from "@/hooks/use-auth";
import useEmblaCarousel from "embla-carousel-react";
import { Lock, ChevronLeft, ChevronRight, PlayCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Category, Module } from "@/lib/database.types";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Academy" }] }),
  component: Dashboard,
});

type ModuleWithCount = Module & { lessons: { count: number }[] };

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard-content"],
    queryFn: async () => {
      const [cats, mods] = await Promise.all([
        supabase.from("categories").select("*").order("order_index"),
        supabase.from("modules").select("*, lessons(count)").order("order_index"),
      ]);
      return {
        categories: (cats.data ?? []) as Category[],
        modules: (mods.data ?? []) as unknown as ModuleWithCount[],
      };
    },
  });

  if (!data) return <div className="text-muted-foreground">Carregando...</div>;
  if (data.categories.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-12 text-center">
        <h2 className="text-xl font-semibold">Nenhum conteúdo ainda</h2>
        <p className="mt-2 text-muted-foreground">O conteúdo aparecerá aqui em breve.</p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <div>
        <h1 className="text-3xl font-bold">Bem-vindo de volta</h1>
        <p className="mt-1 text-muted-foreground">Continue de onde parou ou explore novos módulos.</p>
      </div>
      {data.categories.map((cat) => (
        <CategorySection
          key={cat.id}
          category={cat}
          modules={data.modules.filter((m) => m.category_id === cat.id)}
        />
      ))}
    </div>
  );
}

function CategorySection({ category, modules }: { category: Category; modules: ModuleWithCount[] }) {
  const { data: userData } = useCurrentUser();
  const [emblaRef, emblaApi] = useEmblaCarousel({ align: "start", dragFree: true });

  if (modules.length === 0) return null;

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{category.title}</h2>
          {category.description && <p className="text-sm text-muted-foreground">{category.description}</p>}
        </div>
        <div className="flex gap-1">
          <Button size="icon" variant="outline" onClick={() => emblaApi?.scrollPrev()} aria-label="Anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="outline" onClick={() => emblaApi?.scrollNext()} aria-label="Próximo">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-4">
          {modules.map((m) => {
            const tier = userData?.tier ?? "free";
            const tierOk = tierAllows(tier, m.access_tier);
            const unlocked = isModuleUnlocked(userData?.subscription?.created_at, m.unlock_delay_days);
            const locked = !tierOk || !unlocked;
            const lessonCount = m.lessons?.[0]?.count ?? 0;
            return (
              <ModuleCard
                key={m.id}
                module={m}
                lessonCount={lessonCount}
                locked={locked}
                lockReason={!tierOk ? "tier" : "delay"}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ModuleCard({ module: m, lessonCount, locked, lockReason }: { module: Module; lessonCount: number; locked: boolean; lockReason: "tier" | "delay" }) {
  const target = locked && lockReason === "tier" ? "/upgrade" : `/modulos/${m.id}`;
  return (
    <Link
      to={locked && lockReason === "tier" ? "/upgrade" : "/modulos/$id"}
      params={locked && lockReason === "tier" ? undefined : { id: m.id }}
      className="group relative min-w-[260px] max-w-[260px] shrink-0"
    >
      <div className="glass-card overflow-hidden rounded-2xl transition hover:shadow-glow">
        <div className="relative aspect-video w-full overflow-hidden bg-muted">
          {m.cover_url ? (
            <img src={m.cover_url} alt={m.title} className="h-full w-full object-cover transition group-hover:scale-105" />
          ) : (
            <div className="grid h-full w-full place-items-center gradient-primary text-primary-foreground">
              <PlayCircle className="h-10 w-10 opacity-80" />
            </div>
          )}
          {locked && (
            <div className="absolute inset-0 grid place-items-center bg-background/70 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-1 text-center">
                <Lock className="h-6 w-6 text-primary" />
                <span className="text-xs font-medium">
                  {lockReason === "tier" ? "Faça upgrade" : "Em breve"}
                </span>
              </div>
            </div>
          )}
        </div>
        <div className="space-y-2 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="line-clamp-1 font-semibold">{m.title}</h3>
            <Badge variant="secondary" className="shrink-0 text-[10px] uppercase">{m.access_tier}</Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><PlayCircle className="h-3 w-3" /> {lessonCount} aulas</span>
            {m.unlock_delay_days > 0 && (
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {m.unlock_delay_days}d</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}