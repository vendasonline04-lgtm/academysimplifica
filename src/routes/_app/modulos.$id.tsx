import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState, useCallback, lazy, Suspense } from "react";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { supabase } from "@/lib/supabase";
import { useAuth, useCurrentUser, tierAllows, isModuleUnlocked } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, PlayCircle, Check, Heart, Lock, Sparkles, Clock, Menu, X } from "lucide-react";
import { toast } from "sonner";
import type { Lesson, Module } from "@/lib/database.types";

declare global { interface Window { __pandaEnded?: () => void; } }

const LessonExtras = lazy(() =>
  import("@/components/LessonExtras").then((m) => ({ default: m.LessonExtras }))
);

const searchSchema = z.object({ aula: z.string().optional() });

export const Route = createFileRoute("/_app/modulos/$id")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [{ title: "Aula — Academy" }] }),
  component: ModulePage,
});

function fmt(s: number | null) {
  if (!s) return null;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function getSafeVideo(value: string | null | undefined) {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const isEmbed = raw.startsWith("<");
  if (!isEmbed) return { raw, isEmbed, aspectPct: 56.25 };
  const w = raw.match(/width="(\d+)"/)?.[1];
  const h = raw.match(/height="(\d+)"/)?.[1];
  const aspectPct = w && h ? (parseInt(h) / parseInt(w)) * 100 : 56.25;
  let responsive = raw
    .replace(/\s+width="\d+"/g, "")
    .replace(/\s+height="\d+"/g, "")
    .replace(/style="[^"]*"/, 'style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;"');
  responsive = responsive.replace(/;\}\}\)/, ';},onEnded(){window.__pandaEnded&&window.__pandaEnded();}}})')
    || responsive.replace(/onReady\(\)\{[^\}]*\}/, (m) => m + ',onEnded(){window.__pandaEnded&&window.__pandaEnded();}');
  return { raw: responsive, isEmbed, aspectPct };
}

function ModulePage() {
  const { id } = Route.useParams();
  const { aula: aulaParam } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: userData } = useCurrentUser();
  const userId = user?.id ?? null;

  const [mod, setMod] = useState<(Module & { category: { title: string } | null }) | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [active, setActive] = useState<Lesson | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [nextModuleId, setNextModuleId] = useState<string | null>(null);

  // Load module + lessons
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      supabase.from("modules").select("*, category:categories(title)").eq("id", id).maybeSingle(),
      supabase.from("lessons").select("*").eq("module_id", id).eq("published", true).order("sort_order"),
    ]).then(([modRes, lsnRes]) => {
      if (cancelled) return;
      const m = modRes.data as any;
      const ls = (lsnRes.data ?? []) as Lesson[];
      setMod(m);
      setLessons(ls);
      const initial = aulaParam ? ls.find((l) => l.id === aulaParam) ?? ls[0] : ls[0];
      setActive(initial ?? null);
      setLoading(false);
      // Next module
      if (m?.category_id) {
        supabase.from("modules").select("id, sort_order").eq("category_id", m.category_id).order("sort_order")
          .then(({ data: siblings }) => {
            if (!siblings) return;
            const idx = siblings.findIndex((s) => s.id === id);
            setNextModuleId(idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1].id : null);
          });
      }
    });
    return () => { cancelled = true; };
  }, [id]);

  // Load progress + favorites
  useEffect(() => {
    if (!userId || !lessons.length) return;
    const ids = lessons.map((l) => l.id);
    Promise.all([
      supabase.from("lesson_progress").select("lesson_id").eq("user_id", userId).in("lesson_id", ids),
      supabase.from("lesson_favorites").select("lesson_id").eq("user_id", userId).in("lesson_id", ids),
    ]).then(([prog, favs]) => {
      setCompleted(new Set((prog.data ?? []).map((p) => p.lesson_id)));
      setFavorites(new Set((favs.data ?? []).map((f) => f.lesson_id)));
    });
  }, [lessons, userId]);

  const fireConfetti = useCallback(async () => {
    const { default: confetti } = await import("canvas-confetti");
    confetti({ particleCount: 120, spread: 90, origin: { x: 0.5, y: 0.6 }, colors: ["#a78bfa", "#ec4899", "#22d3ee", "#f59e0b"] });
  }, []);

  const autoAdvance = useCallback((lessonId: string) => {
    const idx = lessons.findIndex((l) => l.id === lessonId);
    if (idx < lessons.length - 1) {
      setTimeout(() => setActive(lessons[idx + 1]), 800);
    } else if (nextModuleId) {
      toast("Módulo concluído! Indo para o próximo...", { duration: 2500 });
      setTimeout(() => navigate({ to: "/modulos/$id", params: { id: nextModuleId } }), 2500);
    }
  }, [lessons, nextModuleId, navigate]);

  const handleVideoEnd = useCallback(async () => {
    if (!active || !userId || completed.has(active.id)) { autoAdvance(active?.id ?? ""); return; }
    await supabase.from("lesson_progress").insert({ user_id: userId, lesson_id: active.id });
    setCompleted((prev) => new Set(prev).add(active.id));
    toast.success("Aula concluída! 🎉");
    await fireConfetti();
    autoAdvance(active.id);
  }, [active, userId, completed, autoAdvance, fireConfetti]);

  useEffect(() => {
    window.__pandaEnded = () => handleVideoEnd();
    const onMsg = (e: MessageEvent) => {
      const d = e.data;
      if (d === "ended" || d?.event === "ended" || d?.name === "ended" || d?.type === "ended") handleVideoEnd();
    };
    window.addEventListener("message", onMsg);
    return () => { delete window.__pandaEnded; window.removeEventListener("message", onMsg); };
  }, [handleVideoEnd]);

  const toggleComplete = async () => {
    if (!active || !userId) return;
    if (completed.has(active.id)) {
      await supabase.from("lesson_progress").delete().eq("user_id", userId).eq("lesson_id", active.id);
      setCompleted((prev) => { const s = new Set(prev); s.delete(active.id); return s; });
    } else {
      await supabase.from("lesson_progress").insert({ user_id: userId, lesson_id: active.id });
      setCompleted((prev) => new Set(prev).add(active.id));
      toast.success("Aula concluída! 🎉");
      await fireConfetti();
      autoAdvance(active.id);
    }
  };

  const toggleFavorite = async () => {
    if (!active || !userId) return;
    if (favorites.has(active.id)) {
      await supabase.from("lesson_favorites").delete().eq("user_id", userId).eq("lesson_id", active.id);
      setFavorites((prev) => { const s = new Set(prev); s.delete(active.id); return s; });
    } else {
      await supabase.from("lesson_favorites").insert({ user_id: userId, lesson_id: active.id });
      setFavorites((prev) => new Set(prev).add(active.id));
      toast.success("Adicionado aos favoritos ♡");
    }
  };

  if (loading) return <div className="flex flex-1 items-center justify-center text-muted-foreground">Carregando...</div>;
  if (!mod) return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      <p className="text-muted-foreground">Módulo não encontrado.</p>
      <Button asChild variant="ghost"><Link to="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Link></Button>
    </div>
  );

  const tier = userData?.tier ?? "free";
  const moduleLocked = !tierAllows(tier, mod.access_tier);
  const unlocked = isModuleUnlocked(userData?.subscription?.created_at, mod.unlock_delay_days);
  const progressPct = lessons.length ? (lessons.filter((l) => completed.has(l.id)).length / lessons.length) * 100 : 0;
  const activeVideo = getSafeVideo(active?.panda_embed_url);
  const activeLocked = active ? !tierAllows(tier, active.access_tier) : false;
  const activeIdx = active ? lessons.findIndex((l) => l.id === active.id) : -1;

  if (moduleLocked || !unlocked) return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Card className="glass-card mx-auto max-w-md p-10 text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full gradient-primary shadow-glow">
          <Lock className="h-8 w-8 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold">{!unlocked ? "Conteúdo em breve" : `Conteúdo ${mod.access_tier === "premium" ? "Premium" : "Básico"}`}</h1>
        <p className="text-muted-foreground text-sm">
          {!unlocked ? `Este módulo desbloqueia ${mod.unlock_delay_days} dias após o início da sua assinatura.` : "Faça upgrade para acessar este módulo."}
        </p>
        {moduleLocked && (
          <Button onClick={() => navigate({ to: "/upgrade" })} className="gradient-primary text-primary-foreground">
            <Sparkles className="mr-2 h-4 w-4" /> Fazer Upgrade
          </Button>
        )}
        <Button asChild variant="ghost"><Link to="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Link></Button>
      </Card>
    </div>
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Breadcrumb */}
      <div className="border-b border-border/40 bg-background/80 px-4 py-2 backdrop-blur flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm min-w-0">
          <Button asChild variant="ghost" size="sm" className="h-8 px-2 shrink-0">
            <Link to="/dashboard"><ArrowLeft className="mr-1 h-4 w-4" />Início</Link>
          </Button>
          {(mod as any).category && (
            <><span className="text-muted-foreground">/</span>
            <span className="text-muted-foreground truncate max-w-[120px]">{(mod as any).category.title}</span></>
          )}
          <span className="text-muted-foreground">/</span>
          <span className="font-semibold truncate max-w-[160px] sm:max-w-xs">{mod.title}</span>
        </div>
        <button className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium lg:hidden shrink-0" onClick={() => setSidebarOpen((v) => !v)}>
          {sidebarOpen ? <X size={14} /> : <Menu size={14} />}<span>Aulas</span>
        </button>
      </div>

      {lessons.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <Card className="glass-card p-10 text-center text-muted-foreground">Ainda não há aulas neste módulo.</Card>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Main */}
          <div className="flex flex-1 flex-col overflow-y-auto">
            {/* Video area */}
            <div className="w-full bg-gradient-to-b from-primary/10 via-primary/5 to-background px-4 pt-5 pb-6">
              <div className="mx-auto max-w-3xl">
                {active && (
                  <p className="mb-3 text-xs font-bold uppercase tracking-widest text-primary">
                    Aula {activeIdx + 1} de {lessons.length}
                  </p>
                )}
                <Card className="overflow-hidden rounded-2xl border border-primary/20 bg-zinc-950 p-0 shadow-lg">
                  <div style={{ position: "relative", paddingBottom: `${activeVideo?.aspectPct ?? 56.25}%`, height: 0, width: "100%" }}>
                    {active && !activeLocked && activeVideo ? (
                      activeVideo.isEmbed ? (
                        <div key={active.id} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
                          dangerouslySetInnerHTML={{ __html: activeVideo.raw }} />
                      ) : (
                        <iframe key={active.id} src={activeVideo.raw} title={active.title}
                          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                          allowFullScreen />
                      )
                    ) : active && activeLocked ? (
                      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
                        className="flex flex-col items-center justify-center gap-3 bg-muted">
                        <Lock className="h-10 w-10 text-primary" />
                        <p className="font-semibold">Aula {active.access_tier === "premium" ? "Premium" : "Básica"}</p>
                        <Button onClick={() => navigate({ to: "/upgrade" })} className="gradient-primary text-primary-foreground">
                          <Sparkles className="mr-2 h-4 w-4" /> Fazer Upgrade
                        </Button>
                      </div>
                    ) : (
                      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
                        className="flex items-center justify-center bg-muted text-sm text-muted-foreground">
                        Vídeo não configurado.
                      </div>
                    )}
                  </div>
                </Card>

                {/* Title + action buttons */}
                {active && (
                  <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
                    <h2 className="text-lg font-bold sm:text-xl">{active.title}</h2>
                    {!activeLocked && (
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={toggleComplete}
                          className={completed.has(active.id) ? "gradient-primary text-primary-foreground" : ""}
                          variant={completed.has(active.id) ? "default" : "outline"}>
                          <Check className="mr-1 h-4 w-4" />
                          {completed.has(active.id) ? "Concluída" : "Marcar concluída"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={toggleFavorite}>
                          <Heart className={`mr-1 h-4 w-4 ${favorites.has(active.id) ? "fill-current text-primary" : ""}`} />
                          {favorites.has(active.id) ? "Favoritada" : "Favoritar"}
                        </Button>
                        {activeIdx < lessons.length - 1 && (
                          <Button size="sm" className="gradient-primary text-primary-foreground"
                            onClick={() => setActive(lessons[activeIdx + 1])}>
                            Próxima aula →
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Description + extras */}
            {active && (
              <div className="mx-auto w-full max-w-3xl px-4 py-4 space-y-4">
                {active.description && (
                  <p className="whitespace-pre-line text-muted-foreground text-sm leading-relaxed">{active.description}</p>
                )}
                {/* Progress — mobile only */}
                <div className="lg:hidden">
                  <Card className="glass-card p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Progresso do módulo</p>
                    <Progress value={progressPct} className="mt-2" />
                    <div className="mt-1.5 flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">{lessons.filter((l) => completed.has(l.id)).length} de {lessons.length} aulas concluídas</p>
                      <p className="text-xs font-bold text-primary">{Math.round(progressPct)}%</p>
                    </div>
                  </Card>
                </div>
                {!activeLocked && userId && (
                  <Suspense fallback={null}>
                    <LessonExtras lessonId={active.id} userId={userId} isAdmin={userData?.isAdmin ?? false} hideIfEmpty />
                  </Suspense>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className={`flex-shrink-0 border-l border-border/60 bg-background overflow-y-auto transition-all duration-300
            ${sidebarOpen ? "w-full absolute inset-0 z-20 pt-14" : "hidden"} lg:relative lg:flex lg:w-80 lg:flex-col lg:pt-0`}>
            {sidebarOpen && (
              <button className="absolute top-3 right-3 lg:hidden rounded-full border p-1.5" onClick={() => setSidebarOpen(false)}>
                <X size={16} />
              </button>
            )}
            <div className="p-4 space-y-4">
              {active && (
                <p className="text-xs font-bold uppercase tracking-widest text-primary">
                  Aula {activeIdx + 1} de {lessons.length}
                </p>
              )}
              <Card className="glass-card p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Progresso do módulo</p>
                <Progress value={progressPct} className="mt-2" />
                <div className="mt-1.5 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{lessons.filter((l) => completed.has(l.id)).length} de {lessons.length} aulas concluídas</p>
                  <p className="text-xs font-bold text-primary">{Math.round(progressPct)}%</p>
                </div>
              </Card>

              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Aulas ({lessons.length})</h3>
                <div className="space-y-2">
                  {lessons.map((l, i) => {
                    const isActive = active?.id === l.id;
                    const lLocked = !tierAllows(tier, l.access_tier);
                    const done = completed.has(l.id);
                    return (
                      <button key={l.id} onClick={() => { setActive(l); setSidebarOpen(false); }}
                        className={`w-full rounded-xl border p-3 text-left transition-all ${isActive ? "border-primary bg-primary/5 shadow-sm" : "border-border/60 bg-card hover:border-primary/40"}`}>
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${done ? "gradient-primary shadow-glow" : isActive ? "bg-primary/20" : "bg-muted"}`}>
                            {lLocked ? <Lock className="h-4 w-4 text-muted-foreground" />
                              : done ? <Check className="h-4 w-4 text-primary-foreground" />
                              : <PlayCircle className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-semibold text-primary">Aula {i + 1}</span>
                              {l.access_tier !== "free" && (
                                <Badge className={`text-[9px] px-1.5 py-0 ${l.access_tier === "premium" ? "gradient-primary text-primary-foreground" : "bg-secondary"}`}>
                                  {l.access_tier === "premium" ? "Premium" : "Básico"}
                                </Badge>
                              )}
                            </div>
                            <div className="truncate text-sm font-semibold leading-tight mt-0.5">{l.title}</div>
                            {fmt(l.duration_seconds) && (
                              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" /> {fmt(l.duration_seconds)}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
