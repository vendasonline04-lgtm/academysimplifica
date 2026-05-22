import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { supabase } from "@/lib/supabase";
import { useAuth, useCurrentUser, tierAllows, isModuleUnlocked } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Heart, Check, Download, PlayCircle, Lock, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Lesson, Module, LessonResource, LessonComment } from "@/lib/database.types";

const searchSchema = z.object({ aula: fallback(z.string().optional(), undefined) });

export const Route = createFileRoute("/_app/modulos/$id")({
  validateSearch: zodValidator(searchSchema),
  component: ModulePage,
});

function ModulePage() {
  const { id } = Route.useParams();
  const { aula } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: userData } = useCurrentUser();

  const { data, isLoading } = useQuery({
    queryKey: ["module", id],
    queryFn: async () => {
      const [modRes, lessonsRes] = await Promise.all([
        supabase.from("modules").select("*").eq("id", id).maybeSingle(),
        supabase.from("lessons").select("*").eq("module_id", id).eq("published", true).order("order_index"),
      ]);
      return {
        module: modRes.data as Module | null,
        lessons: (lessonsRes.data ?? []) as Lesson[],
      };
    },
  });

  if (isLoading) return <div className="text-muted-foreground">Carregando...</div>;
  if (!data?.module) return <div>Módulo não encontrado.</div>;

  const tier = userData?.tier ?? "free";
  const tierOk = tierAllows(tier, data.module.access_tier);
  const unlocked = isModuleUnlocked(userData?.subscription?.created_at, data.module.unlock_delay_days);

  if (!tierOk) {
    throw redirect({ to: "/upgrade" });
  }

  if (!unlocked) {
    return (
      <div className="glass-card mx-auto max-w-xl rounded-2xl p-12 text-center">
        <Lock className="mx-auto mb-4 h-10 w-10 text-primary" />
        <h2 className="text-xl font-semibold">Conteúdo em breve</h2>
        <p className="mt-2 text-muted-foreground">
          Este módulo desbloqueia {data.module.unlock_delay_days} dias após o início da sua assinatura.
        </p>
      </div>
    );
  }

  const currentLesson = aula ? data.lessons.find((l) => l.id === aula) : data.lessons[0];

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/dashboard"><ArrowLeft className="mr-1 h-4 w-4" /> Voltar</Link>
        </Button>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {currentLesson ? (
            <LessonView lesson={currentLesson} userId={user?.id ?? null} />
          ) : (
            <div className="glass-card rounded-2xl p-12 text-center text-muted-foreground">
              Nenhuma aula publicada neste módulo.
            </div>
          )}
        </div>
        <aside className="glass-card h-fit rounded-2xl p-4">
          <h3 className="mb-3 px-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {data.module.title}
          </h3>
          <div className="space-y-1">
            {data.lessons.map((l, idx) => (
              <button
                key={l.id}
                onClick={() => navigate({ to: "/modulos/$id", params: { id }, search: { aula: l.id } })}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                  l.id === currentLesson?.id ? "bg-primary/15 text-primary" : "hover:bg-muted/60"
                }`}
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-xs">
                  {idx + 1}
                </span>
                <span className="line-clamp-1">{l.title}</span>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

function LessonView({ lesson, userId }: { lesson: Lesson; userId: string | null }) {
  const qc = useQueryClient();

  const { data: meta } = useQuery({
    queryKey: ["lesson-meta", lesson.id, userId],
    enabled: !!userId,
    queryFn: async () => {
      const [resources, comments, fav, progress] = await Promise.all([
        supabase.from("lesson_resources").select("*").eq("lesson_id", lesson.id),
        supabase.from("lesson_comments").select("*").eq("lesson_id", lesson.id).order("created_at", { ascending: false }),
        supabase.from("lesson_favorites").select("id").eq("lesson_id", lesson.id).eq("user_id", userId!).maybeSingle(),
        supabase.from("lesson_progress").select("id").eq("lesson_id", lesson.id).eq("user_id", userId!).maybeSingle(),
      ]);
      return {
        resources: (resources.data ?? []) as LessonResource[],
        comments: (comments.data ?? []) as LessonComment[],
        favorited: !!fav.data,
        completed: !!progress.data,
      };
    },
  });

  const toggleFav = async () => {
    if (!userId) return;
    if (meta?.favorited) {
      await supabase.from("lesson_favorites").delete().eq("lesson_id", lesson.id).eq("user_id", userId);
    } else {
      await supabase.from("lesson_favorites").insert({ lesson_id: lesson.id, user_id: userId });
    }
    qc.invalidateQueries({ queryKey: ["lesson-meta", lesson.id] });
  };

  const toggleComplete = async () => {
    if (!userId) return;
    if (meta?.completed) {
      await supabase.from("lesson_progress").delete().eq("lesson_id", lesson.id).eq("user_id", userId);
      toast.info("Desmarcado como concluído");
    } else {
      await supabase.from("lesson_progress").insert({ lesson_id: lesson.id, user_id: userId, completed_at: new Date().toISOString() });
      toast.success("Aula concluída!");
    }
    qc.invalidateQueries({ queryKey: ["lesson-meta", lesson.id] });
  };

  const [comment, setComment] = useState("");
  const postComment = async () => {
    if (!userId || !comment.trim()) return;
    const { error } = await supabase.from("lesson_comments").insert({
      lesson_id: lesson.id,
      user_id: userId,
      content: comment.trim(),
    });
    if (error) {
      toast.error(error.message);
    } else {
      setComment("");
      qc.invalidateQueries({ queryKey: ["lesson-meta", lesson.id] });
    }
  };

  const downloadResource = async (res: LessonResource) => {
    const { data, error } = await supabase.storage.from("lesson-files").createSignedUrl(res.file_path, 3600);
    if (error || !data) return toast.error("Não foi possível gerar o link");
    window.open(data.signedUrl, "_blank");
  };

  return (
    <>
      <div className="glass-card overflow-hidden rounded-2xl">
        <div className="aspect-video w-full bg-black">
          {lesson.panda_embed_url ? (
            <iframe
              src={lesson.panda_embed_url}
              className="h-full w-full"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              title={lesson.title}
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-muted-foreground">
              <PlayCircle className="h-12 w-12 opacity-50" />
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{lesson.title}</h1>
            <Badge variant="secondary" className="mt-2 text-[10px] uppercase">{lesson.access_tier}</Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={toggleFav}>
              <Heart className={`mr-2 h-4 w-4 ${meta?.favorited ? "fill-current text-primary" : ""}`} />
              {meta?.favorited ? "Favoritado" : "Favoritar"}
            </Button>
            <Button onClick={toggleComplete} className={meta?.completed ? "" : "gradient-primary text-primary-foreground"}>
              <Check className="mr-2 h-4 w-4" />
              {meta?.completed ? "Concluída" : "Marcar concluída"}
            </Button>
          </div>
        </div>
        {lesson.description && <p className="whitespace-pre-line text-muted-foreground">{lesson.description}</p>}
      </div>

      {meta && meta.resources.length > 0 && (
        <div className="glass-card rounded-2xl p-5">
          <h3 className="mb-3 font-semibold">Recursos para download</h3>
          <div className="space-y-2">
            {meta.resources.map((r) => (
              <button
                key={r.id}
                onClick={() => downloadResource(r)}
                className="flex w-full items-center justify-between rounded-lg border bg-background/50 px-4 py-3 text-sm transition hover:bg-muted/60"
              >
                <span>{r.title}</span>
                <Download className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="glass-card rounded-2xl p-5">
        <h3 className="mb-3 font-semibold">Comentários</h3>
        <div className="mb-4 flex gap-2">
          <Textarea
            placeholder="Escreva um comentário..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
          />
          <Button onClick={postComment} disabled={!comment.trim()} className="gradient-primary text-primary-foreground self-end">
            Postar
          </Button>
        </div>
        <div className="space-y-3">
          {meta?.comments.length === 0 && <p className="text-sm text-muted-foreground">Seja o primeiro a comentar.</p>}
          {meta?.comments.map((c) => (
            <div key={c.id} className="rounded-lg border bg-background/50 p-3 text-sm">
              <p className="whitespace-pre-line">{c.content}</p>
              <p className="mt-1 text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString("pt-BR")}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}