import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient, useQueryClient as useQC } from "@tanstack/react-query";
import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import type { FormState, CreatedPayload } from "@/components/flow/types";
import { slugify as flowSlugify } from "@/components/flow/helpers";

const FlowBuilder = lazy(() => import("@/components/FlowBuilder").then((m) => ({ default: m.FlowBuilder })));
import { supabase } from "@/lib/supabase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ChevronUp, ChevronDown, Plus, Trash2, Upload, Folder, BookOpen, PlayCircle, Link2, Send, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { AccessTier, AppRole, Category, Module, Lesson, UserSubscription, Profile } from "@/lib/database.types";

export const Route = createFileRoute("/_app/admin")({
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" as AppRole });
    if (!isAdmin) throw redirect({ to: "/dashboard" });
  },
  head: () => ({ meta: [{ title: "Admin — Academy" }] }),
  component: AdminPage,
});

function AdminPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Painel Admin</h1>
      <Tabs defaultValue="content">
        <TabsList>
          <TabsTrigger value="content">Conteúdo</TabsTrigger>
          <TabsTrigger value="subs">Assinaturas</TabsTrigger>
          <TabsTrigger value="view">Visualização</TabsTrigger>
        </TabsList>
        <TabsContent value="content" className="mt-6"><ContentManager /></TabsContent>
        <TabsContent value="subs" className="mt-6"><SubscriptionsManager /></TabsContent>
        <TabsContent value="view" className="mt-6"><StructureView /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------- Content Manager ------------------- */

async function uploadCover(file: File): Promise<string | null> {
  const path = `${Date.now()}-${file.name.replace(/[^a-z0-9.\-_]/gi, "_")}`;
  const { error } = await supabase.storage.from("covers").upload(path, file, { upsert: false });
  if (error) { toast.error(error.message); return null; }
  const { data } = supabase.storage.from("covers").getPublicUrl(path);
  return data.publicUrl;
}

function ContentManager() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-content"],
    queryFn: async () => {
      const [c, m, l] = await Promise.all([
        supabase.from("categories").select("*").order("sort_order"),
        supabase.from("modules").select("*").order("sort_order"),
        supabase.from("lessons").select("*").order("sort_order"),
      ]);
      return {
        categories: (c.data ?? []) as Category[],
        modules: (m.data ?? []) as Module[],
        lessons: (l.data ?? []) as Lesson[],
      };
    },
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-content"] });

  const reorder = async (table: "categories" | "modules" | "lessons", id: string, current: number, neighborId: string, neighborOrder: number) => {
    await supabase.from(table).update({ sort_order: neighborOrder }).eq("id", id);
    await supabase.from(table).update({ sort_order: current }).eq("id", neighborId);
    invalidate();
  };

  const addCategory = async () => {
    const title = prompt("Nome da categoria:");
    if (!title) return;
    const order = (data?.categories.length ?? 0);
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const { error } = await supabase.from("categories").insert({ title, slug, sort_order: order });
    if (error) toast.error(error.message); else invalidate();
  };

  if (!data) return <div className="text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-4">
      <Button onClick={addCategory} className="gradient-primary text-primary-foreground">
        <Plus className="mr-2 h-4 w-4" /> Nova categoria
      </Button>
      {data.categories.map((cat, i) => (
        <CategoryRow
          key={cat.id}
          category={cat}
          modules={data.modules.filter((m) => m.category_id === cat.id)}
          lessons={data.lessons}
          onReorder={(neighbor) => reorder("categories", cat.id, cat.sort_order, neighbor.id, neighbor.sort_order)}
          canUp={i > 0}
          canDown={i < data.categories.length - 1}
          neighborUp={data.categories[i - 1]}
          neighborDown={data.categories[i + 1]}
          onChange={invalidate}
        />
      ))}
    </div>
  );
}

function CategoryRow({ category, modules, lessons, onReorder, canUp, canDown, neighborUp, neighborDown, onChange }: {
  category: Category; modules: Module[]; lessons: Lesson[];
  onReorder: (n: Category) => void;
  canUp: boolean; canDown: boolean; neighborUp?: Category; neighborDown?: Category; onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(false);
  const remove = async () => {
    if (!confirm("Excluir categoria e tudo dentro?")) return;
    await supabase.from("categories").delete().eq("id", category.id);
    onChange();
  };
  const addModule = async () => {
    const title = prompt("Nome do módulo:");
    if (!title) return;
    await supabase.from("modules").insert({
      title, category_id: category.id, access_tier: "free", unlock_delay_days: 0, sort_order: modules.length,
    });
    onChange();
  };

  return (
    <div className="glass-card rounded-xl p-4">
      <div className="flex items-center gap-2">
        <Folder className="h-4 w-4 text-primary" />
        <button onClick={() => setOpen(!open)} className="flex-1 text-left font-semibold">{category.title}</button>
        <Button size="icon" variant="ghost" disabled={!canUp} onClick={() => neighborUp && onReorder(neighborUp)}><ChevronUp className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" disabled={!canDown} onClick={() => neighborDown && onReorder(neighborDown)}><ChevronDown className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" onClick={() => setEdit(!edit)}><Pencil className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" onClick={remove}><Trash2 className="h-4 w-4 text-destructive" /></Button>
      </div>
      {edit && <CategoryEditor category={category} onDone={() => { setEdit(false); onChange(); }} />}
      {open && (
        <div className="ml-6 mt-3 space-y-2 border-l pl-4">
          <Button size="sm" variant="outline" onClick={addModule}><Plus className="mr-1 h-3 w-3" /> Novo módulo</Button>
          {modules.map((m, i) => (
            <ModuleRow
              key={m.id}
              module={m}
              lessons={lessons.filter((l) => l.module_id === m.id)}
              onChange={onChange}
              neighborUp={modules[i - 1]}
              neighborDown={modules[i + 1]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ModuleRow({ module: m, lessons, onChange, neighborUp, neighborDown }: {
  module: Module; lessons: Lesson[]; onChange: () => void;
  neighborUp?: Module; neighborDown?: Module;
}) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(false);

  const reorder = async (n: Module) => {
    await supabase.from("modules").update({ sort_order: n.sort_order }).eq("id", m.id);
    await supabase.from("modules").update({ sort_order: m.sort_order }).eq("id", n.id);
    onChange();
  };
  const remove = async () => {
    if (!confirm("Excluir módulo?")) return;
    await supabase.from("modules").delete().eq("id", m.id);
    onChange();
  };
  const addLesson = async () => {
    const title = prompt("Nome da aula:");
    if (!title) return;
    await supabase.from("lessons").insert({
      title, module_id: m.id, category_id: m.category_id, panda_embed_url: "", access_tier: m.access_tier, published: false, sort_order: lessons.length,
    });
    onChange();
  };

  return (
    <div className="rounded-lg border bg-background/40 p-3">
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-primary" />
        <button onClick={() => setOpen(!open)} className="flex-1 text-left text-sm font-medium">{m.title}</button>
        <Badge variant="secondary" className="text-[10px] uppercase">{m.access_tier}</Badge>
        <Button size="icon" variant="ghost" disabled={!neighborUp} onClick={() => neighborUp && reorder(neighborUp)}><ChevronUp className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" disabled={!neighborDown} onClick={() => neighborDown && reorder(neighborDown)}><ChevronDown className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" onClick={() => setEdit(!edit)}>Editar</Button>
        <Button size="icon" variant="ghost" onClick={remove}><Trash2 className="h-4 w-4" /></Button>
      </div>
      {edit && <ModuleEditor module={m} onDone={() => { setEdit(false); onChange(); }} />}
      {open && (
        <div className="ml-6 mt-3 space-y-2 border-l pl-4">
          <Button size="sm" variant="outline" onClick={addLesson}><Plus className="mr-1 h-3 w-3" /> Nova aula</Button>
          {lessons.map((l, i) => (
            <LessonRow key={l.id} lesson={l} onChange={onChange} neighborUp={lessons[i - 1]} neighborDown={lessons[i + 1]} />
          ))}
        </div>
      )}
    </div>
  );
}

function ModuleEditor({ module: m, onDone }: { module: Module; onDone: () => void }) {
  const [title, setTitle] = useState(m.title);
  const [desc, setDesc] = useState(m.description ?? "");
  const [tier, setTier] = useState<AccessTier>(m.access_tier);
  const [delayOn, setDelayOn] = useState(m.unlock_delay_days > 0);
  const [delayDays, setDelayDays] = useState(m.unlock_delay_days || 7);
  const [cover, setCover] = useState(m.cover_url ?? "");

  const onUpload = async (f: File) => {
    const url = await uploadCover(f);
    if (url) setCover(url);
  };
  const save = async () => {
    const { error } = await supabase.from("modules").update({
      title, description: desc, access_tier: tier,
      unlock_delay_days: delayOn ? delayDays : 0,
      cover_url: cover || null,
    }).eq("id", m.id);
    if (error) toast.error(error.message); else { toast.success("Salvo"); onDone(); }
  };

  return (
    <div className="mt-3 space-y-3 rounded-md border bg-background p-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div><Label>Título</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div>
          <Label>Acesso</Label>
          <Select value={tier} onValueChange={(v) => setTier(v as AccessTier)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="basic">Básico</SelectItem>
              <SelectItem value="premium">Premium</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Liberar somente após {delayOn ? delayDays : "X"} dias</p>
          <p className="text-xs text-muted-foreground">{delayOn ? `Acesso liberado ${delayDays}d após a compra` : "Acesso imediato após compra"}</p>
        </div>
        <div className="flex items-center gap-3">
          {delayOn && (
            <Input type="number" value={delayDays} onChange={(e) => setDelayDays(Number(e.target.value))} className="w-20" min={1} />
          )}
          <Switch checked={delayOn} onCheckedChange={setDelayOn} />
        </div>
      </div>
      <div>
        <Label>Capa (1080×1920)</Label>
        <div className="flex items-center gap-2 mt-1">
          <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
          {cover && <img src={cover} alt="" className="h-10 w-16 rounded object-cover" />}
        </div>
      </div>
      <div><Label>Descrição</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
      <div className="flex gap-2">
        <Button onClick={save} className="gradient-primary text-primary-foreground">Salvar</Button>
        <Button variant="ghost" onClick={onDone}>Cancelar</Button>
      </div>
    </div>
  );
}

function LessonRow({ lesson, onChange, neighborUp, neighborDown }: { lesson: Lesson; onChange: () => void; neighborUp?: Lesson; neighborDown?: Lesson }) {
  const [edit, setEdit] = useState(false);
  const reorder = async (n: Lesson) => {
    await supabase.from("lessons").update({ sort_order: n.sort_order }).eq("id", lesson.id);
    await supabase.from("lessons").update({ sort_order: lesson.sort_order }).eq("id", n.id);
    onChange();
  };
  const togglePub = async () => {
    await supabase.from("lessons").update({ published: !lesson.published }).eq("id", lesson.id);
    onChange();
  };
  const remove = async () => {
    if (!confirm("Excluir aula?")) return;
    await supabase.from("lessons").delete().eq("id", lesson.id);
    onChange();
  };

  return (
    <div className="rounded-md border bg-background/60 p-2">
      <div className="flex items-center gap-2">
        <PlayCircle className="h-4 w-4 text-primary" />
        <span className="flex-1 text-sm">{lesson.title}</span>
        <Switch checked={lesson.published} onCheckedChange={togglePub} />
        <Button size="icon" variant="ghost" disabled={!neighborUp} onClick={() => neighborUp && reorder(neighborUp)}><ChevronUp className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" disabled={!neighborDown} onClick={() => neighborDown && reorder(neighborDown)}><ChevronDown className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" onClick={() => setEdit(!edit)}>Editar</Button>
        <Button size="icon" variant="ghost" onClick={remove}><Trash2 className="h-4 w-4" /></Button>
      </div>
      {edit && <LessonEditor lesson={lesson} onDone={() => { setEdit(false); onChange(); }} />}
    </div>
  );
}

function LessonEditor({ lesson, onDone }: { lesson: Lesson; onDone: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(lesson.title);
  const [desc, setDesc] = useState(lesson.description ?? "");
  const [videoMode, setVideoMode] = useState<"url" | "embed">(
    lesson.panda_embed_url?.startsWith("<") ? "embed" : "url"
  );
  const [videoVal, setVideoVal] = useState(lesson.panda_embed_url ?? "");
  const [tier, setTier] = useState<AccessTier>(lesson.access_tier);

  // Materials
  const { data: materials, refetch: refetchMats } = useQuery({
    queryKey: ["lesson-resources", lesson.id],
    queryFn: async () => {
      const { data } = await supabase.from("lesson_resources").select("*").eq("lesson_id", lesson.id).order("sort_order");
      return data ?? [];
    },
  });
  const [matTitle, setMatTitle] = useState("");
  const [matUrl, setMatUrl] = useState("");
  const addMaterial = async () => {
    if (!matTitle || !matUrl) return;
    await supabase.from("lesson_resources").insert({ lesson_id: lesson.id, title: matTitle, url: matUrl, kind: "link", sort_order: (materials?.length ?? 0) });
    setMatTitle(""); setMatUrl("");
    refetchMats();
  };
  const removeMaterial = async (id: string) => {
    await supabase.from("lesson_resources").delete().eq("id", id);
    refetchMats();
  };

  // Admin comment
  const { data: noteData, refetch: refetchNote } = useQuery({
    queryKey: ["lesson-note", lesson.id],
    queryFn: async () => {
      const { data } = await supabase.from("lesson_admin_notes").select("*").eq("lesson_id", lesson.id).maybeSingle();
      return data;
    },
  });
  const [comment, setComment] = useState("");
  useEffect(() => { if (noteData) setComment(noteData.body); }, [noteData]);
  const saveComment = async () => {
    if (noteData) {
      await supabase.from("lesson_admin_notes").update({ body: comment }).eq("id", noteData.id);
    } else {
      await supabase.from("lesson_admin_notes").insert({ lesson_id: lesson.id, body: comment });
    }
    toast.success("Comentário salvo"); refetchNote();
  };

  const save = async () => {
    const { error } = await supabase.from("lessons").update({
      title, description: desc, panda_embed_url: videoVal, access_tier: tier,
    }).eq("id", lesson.id);
    if (error) toast.error(error.message); else { toast.success("Aula salva"); qc.invalidateQueries({ queryKey: ["admin-content"] }); onDone(); }
  };

  return (
    <div className="mt-2 space-y-4 rounded-md border bg-background p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div><Label>Título</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div>
          <Label>Acesso</Label>
          <Select value={tier} onValueChange={(v) => setTier(v as AccessTier)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="basic">Básico</SelectItem>
              <SelectItem value="premium">Premium</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Video */}
      <div className="space-y-2">
        <Label>Vídeo da aula</Label>
        <div className="flex rounded-md border overflow-hidden text-sm">
          <button onClick={() => setVideoMode("url")} className={`flex-1 py-1.5 transition ${videoMode === "url" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>URL</button>
          <button onClick={() => setVideoMode("embed")} className={`flex-1 py-1.5 transition ${videoMode === "embed" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>Incorporar (Embed)</button>
        </div>
        {videoMode === "url" ? (
          <Input value={videoVal} onChange={(e) => setVideoVal(e.target.value)} placeholder="https://player-vz-....tv.pandavideo.com.br/embed/?v=..." />
        ) : (
          <Textarea value={videoVal} onChange={(e) => setVideoVal(e.target.value)} rows={4} placeholder={'<iframe id="panda-..." src="https://..." ...></iframe>'} className="font-mono text-xs" />
        )}
      </div>

      <div><Label>Descrição</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} /></div>

      {/* Materials */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1"><Link2 className="h-3 w-3" /> Materiais</Label>
        {materials?.map((r) => (
          <div key={r.id} className="flex items-center gap-2 rounded border px-3 py-1.5 text-sm">
            <span className="flex-1 truncate">{r.title}</span>
            <a href={r.url} target="_blank" rel="noopener" className="text-xs text-primary hover:underline">abrir</a>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeMaterial(r.id)}><Trash2 className="h-3 w-3" /></Button>
          </div>
        ))}
        <div className="flex gap-2">
          <Input placeholder="Título" value={matTitle} onChange={(e) => setMatTitle(e.target.value)} className="flex-1" />
          <Input placeholder="https://..." value={matUrl} onChange={(e) => setMatUrl(e.target.value)} className="flex-1" />
          <Button size="sm" variant="outline" onClick={addMaterial}><Plus className="h-3 w-3" /></Button>
        </div>
      </div>

      {/* Admin comment */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1"><Send className="h-3 w-3" /> Comentário/Aviso para alunos</Label>
        <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Escreva um comentário/aviso para os alunos..." rows={2} />
        <Button size="sm" variant="outline" onClick={saveComment}>Publicar aviso</Button>
      </div>

      <div className="flex gap-2 pt-2 border-t">
        <Button onClick={save} className="gradient-primary text-primary-foreground"><Upload className="mr-1 h-3 w-3" />Salvar aula</Button>
        <Button variant="ghost" onClick={onDone}>Cancelar</Button>
      </div>
    </div>
  );
}

function CategoryEditor({ category, onDone }: { category: Category; onDone: () => void }) {
  const [title, setTitle] = useState(category.title);
  const [desc, setDesc] = useState(category.description ?? "");
  const [tier, setTier] = useState<AccessTier>(category.access_tier);
  const [cover, setCover] = useState(category.cover_url ?? "");
  const onUpload = async (f: File) => { const url = await uploadCover(f); if (url) setCover(url); };
  const save = async () => {
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const { error } = await supabase.from("categories").update({ title, slug, description: desc, access_tier: tier, cover_url: cover || null }).eq("id", category.id);
    if (error) toast.error(error.message); else { toast.success("Tema salvo"); onDone(); }
  };
  return (
    <div className="mt-3 space-y-3 rounded-md border bg-background p-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div><Label>Título</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div>
          <Label>Acesso</Label>
          <Select value={tier} onValueChange={(v) => setTier(v as AccessTier)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="basic">Básico</SelectItem>
              <SelectItem value="premium">Premium</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>Capa</Label>
        <div className="flex items-center gap-2 mt-1">
          <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
          {cover && <img src={cover} alt="" className="h-10 w-16 rounded object-cover" />}
        </div>
      </div>
      <div><Label>Descrição</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
      <div className="flex gap-2">
        <Button onClick={save} className="gradient-primary text-primary-foreground">Salvar</Button>
        <Button variant="ghost" onClick={onDone}>Cancelar</Button>
      </div>
    </div>
  );
}

/* ------------------- Subscriptions ------------------- */

function SubscriptionsManager() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-subs"],
    queryFn: async () => {
      const [subs, profiles] = await Promise.all([
        supabase.from("user_subscriptions").select("*"),
        supabase.from("profiles").select("*"),
      ]);
      return {
        subs: (subs.data ?? []) as UserSubscription[],
        profiles: (profiles.data ?? []) as Profile[],
      };
    },
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-subs"] });

  const updateTier = async (id: string, tier: AccessTier) => {
    await supabase.from("user_subscriptions").update({ tier }).eq("id", id);
    invalidate();
  };
  const cancel = async (id: string) => {
    await supabase.from("user_subscriptions").update({ status: "canceled" }).eq("id", id);
    invalidate();
  };

  if (!data) return <div className="text-muted-foreground">Carregando...</div>;
  const profileById = (uid: string) => data.profiles.find((p) => p.user_id === uid);

  return (
    <div className="glass-card overflow-hidden rounded-2xl">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40 text-left">
          <tr>
            <th className="p-3">Usuário</th>
            <th className="p-3">Tier</th>
            <th className="p-3">Status</th>
            <th className="p-3">Desde</th>
            <th className="p-3"></th>
          </tr>
        </thead>
        <tbody>
          {data.subs.map((s) => {
            const p = profileById(s.user_id);
            return (
              <tr key={s.id} className="border-b">
                <td className="p-3">{p?.full_name ?? s.user_id.slice(0, 8)}</td>
                <td className="p-3">
                  <Select value={s.tier} onValueChange={(v) => updateTier(s.id, v as AccessTier)}>
                    <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="basic">Básico</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-3"><Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge></td>
                <td className="p-3 text-muted-foreground">{new Date(s.created_at).toLocaleDateString("pt-BR")}</td>
                <td className="p-3 text-right">
                  {s.status === "active" && (
                    <Button size="sm" variant="outline" onClick={() => cancel(s.id)}>Cancelar</Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------- Structure View (Flow Diagram) ------------------- */

function StructureView() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-content"],
    queryFn: async () => {
      const [c, m, l] = await Promise.all([
        supabase.from("categories").select("*").order("sort_order"),
        supabase.from("modules").select("*").order("sort_order"),
        supabase.from("lessons").select("*").order("sort_order"),
      ]);
      return {
        categories: (c.data ?? []) as Category[],
        modules: (m.data ?? []) as Module[],
        lessons: (l.data ?? []) as Lesson[],
      };
    },
  });

  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  const cats = data?.categories ?? [];
  const mods = data?.modules ?? [];
  const lsns = data?.lessons ?? [];
  const reload = () => qc.invalidateQueries({ queryKey: ["admin-content"] });

  const openCreate = useCallback((kind: FormState["kind"], parentId?: string, categoryId?: string) => {
    const sortOrder = kind === "category" ? cats.length : kind === "module" ? mods.filter((m) => m.category_id === parentId).length : lsns.filter((l) => l.module_id === parentId).length;
    setForm({ mode: "create", kind, parentId, categoryId, title: "", tier: "free", panda_embed_url: "", description: "", cover_url: null, slug: "", sort_order: sortOrder, unlock_delay_days: 0 });
  }, [cats, mods, lsns]);

  const openEdit = useCallback((kind: FormState["kind"], recordId: string) => {
    if (kind === "category") {
      const cat = cats.find((c) => c.id === recordId); if (!cat) return;
      setForm({ mode: "edit", kind: "category", recordId, title: cat.title, tier: cat.access_tier, slug: cat.slug, description: cat.description ?? "", cover_url: cat.cover_url, sort_order: cat.sort_order });
    } else if (kind === "module") {
      const mod = mods.find((m) => m.id === recordId); if (!mod) return;
      setForm({ mode: "edit", kind: "module", recordId, parentId: mod.category_id, title: mod.title, tier: mod.access_tier, description: mod.description ?? "", cover_url: mod.cover_url, sort_order: mod.sort_order, unlock_delay_days: mod.unlock_delay_days ?? 0 });
    } else {
      const lsn = lsns.find((l) => l.id === recordId); if (!lsn) return;
      setForm({ mode: "edit", kind: "lesson", recordId, parentId: lsn.module_id ?? undefined, categoryId: lsn.category_id, title: lsn.title, tier: lsn.access_tier, panda_embed_url: lsn.panda_embed_url, sort_order: lsn.sort_order });
    }
  }, [cats, mods, lsns]);

  const handleSave = useCallback(async (f: FormState) => {
    if (!f.title.trim()) return;
    setSaving(true);
    try {
      if (f.mode === "create") {
        if (f.kind === "category") {
          const { error } = await supabase.from("categories").insert({ title: f.title, slug: f.slug || flowSlugify(f.title), description: f.description || null, cover_url: f.cover_url ?? null, sort_order: f.sort_order ?? cats.length, access_tier: f.tier });
          if (error) throw error; toast.success("Tema criado!");
        } else if (f.kind === "module") {
          const { error } = await supabase.from("modules").insert({ title: f.title, category_id: f.parentId!, description: f.description || null, cover_url: f.cover_url ?? null, sort_order: f.sort_order ?? 0, access_tier: f.tier, unlock_delay_days: f.unlock_delay_days ?? 0 });
          if (error) throw error; toast.success("Módulo criado!");
        } else {
          const { error } = await supabase.from("lessons").insert({ title: f.title, module_id: f.parentId!, category_id: f.categoryId!, panda_embed_url: f.panda_embed_url ?? "", sort_order: f.sort_order ?? 0, published: true, access_tier: f.tier });
          if (error) throw error; toast.success("Aula criada!");
        }
      } else {
        if (f.kind === "category") {
          const { error } = await supabase.from("categories").update({ title: f.title, access_tier: f.tier, slug: f.slug || flowSlugify(f.title), description: f.description || null, cover_url: f.cover_url ?? null, sort_order: f.sort_order ?? 0 }).eq("id", f.recordId!);
          if (error) throw error; toast.success("Tema atualizado!");
        } else if (f.kind === "module") {
          const { error } = await supabase.from("modules").update({ title: f.title, access_tier: f.tier, description: f.description || null, cover_url: f.cover_url ?? null, sort_order: f.sort_order ?? 0, unlock_delay_days: f.unlock_delay_days ?? 0 }).eq("id", f.recordId!);
          if (error) throw error; toast.success("Módulo atualizado!");
        } else {
          const { error } = await supabase.from("lessons").update({ title: f.title, access_tier: f.tier, panda_embed_url: f.panda_embed_url ?? "", sort_order: f.sort_order ?? 0 }).eq("id", f.recordId!);
          if (error) throw error; toast.success("Aula atualizada!");
        }
      }
      setForm(null); reload();
    } catch (e: any) { toast.error(e.message ?? "Erro ao salvar"); }
    finally { setSaving(false); }
  }, [cats, mods, lsns]);

  const handleDelete = useCallback(async () => {
    if (!form?.recordId) return;
    if (!confirm(form.kind === "category" ? "Excluir tema e tudo dentro?" : form.kind === "module" ? "Excluir módulo e aulas?" : "Excluir aula?")) return;
    setSaving(true);
    const table = form.kind === "category" ? "categories" : form.kind === "module" ? "modules" : "lessons";
    const { error } = await supabase.from(table).delete().eq("id", form.recordId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Excluído!"); setForm(null); reload();
  }, [form]);
  if (!data) return <div className="text-muted-foreground">Carregando...</div>;

  return (
    <Suspense fallback={<div className="text-muted-foreground">Carregando visualização...</div>}>
      <FlowBuilder
        cats={cats}
        mods={mods}
        lsns={lsns}
        form={form}
        saving={saving}
        onOpenCreate={openCreate}
        onOpenEdit={openEdit}
        onCloseForm={() => setForm(null)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </Suspense>
  );
}