import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useCurrentUser, tierAllows, isModuleUnlocked } from "@/hooks/use-auth";
import useEmblaCarousel from "embla-carousel-react";
import { Lock, ChevronLeft, ChevronRight, PlayCircle } from "lucide-react";
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
        supabase.from("categories").select("*").order("sort_order"),
        supabase.from("modules").select("*, lessons(count)").order("sort_order"),
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
                fallbackCover={category.cover_url}
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

function ModuleCard({ module: m, fallbackCover, lessonCount, locked, lockReason }: { module: Module; fallbackCover?: string | null; lessonCount: number; locked: boolean; lockReason: "tier" | "delay" }) {
  const cover = m.cover_url ?? fallbackCover ?? null;
  const card = (
    <div className="group relative w-[170px] shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-gradient-card transition-all hover:-translate-y-1 hover:shadow-glow sm:w-[210px]">
      <div className="relative aspect-[9/16] w-full overflow-hidden bg-gradient-to-br from-primary to-accent">
        {cover ? (
          <img src={cover} alt={m.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <PlayCircle className="h-14 w-14 text-primary-foreground/80" />
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/30 to-transparent" />

        {/* Tier badge */}
        {m.access_tier !== "free" && (
          <Badge className={`absolute left-3 top-3 ${m.access_tier === "premium" ? "gradient-primary text-primary-foreground" : "bg-secondary"}`}>
            {m.access_tier === "premium" ? "✨ Premium" : "Básico"}
          </Badge>
        )}

        {/* Lock overlay */}
        {locked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/70 backdrop-blur-sm px-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full gradient-primary shadow-glow">
              <Lock className="h-6 w-6 text-primary-foreground" />
            </div>
            <p className="mt-2 text-xs font-semibold leading-tight">
              {lockReason === "tier" ? "Faça upgrade" : "Em breve"}
            </p>
          </div>
        )}

        {/* Title inside card */}
        <div className="absolute inset-x-0 bottom-0 p-4">
          <h3 className="line-clamp-2 text-base font-bold leading-tight">{m.title}</h3>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <PlayCircle className="h-3 w-3" /> {lessonCount} aulas
          </p>
        </div>
      </div>
    </div>
  );

  if (locked && lockReason === "tier") return <Link to="/upgrade" className="block">{card}</Link>;
  if (locked) return card;
  return <Link to="/modulos/$id" params={{ id: m.id }} search={{ aula: undefined }} className="block">{card}</Link>;
}