import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ChevronUp, ChevronDown, Plus, Trash2, Upload, Folder, BookOpen, PlayCircle, Link2, Send } from "lucide-react";
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
        <Button size="icon" variant="ghost" onClick={remove}><Trash2 className="h-4 w-4" /></Button>
      </div>
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
  if (!data) return <div className="text-muted-foreground">Carregando...</div>;

  const totalLessons = data.lessons.length;
  const TIER_COLOR: Record<string, string> = { free: "bg-green-100 text-green-800", basic: "bg-blue-100 text-blue-800", premium: "bg-purple-100 text-purple-800" };

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex items-center gap-4 text-sm">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-purple-500 inline-block" /> Temas: {data.categories.length}</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-blue-500 inline-block" /> Módulos: {data.modules.length}</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-green-500 inline-block" /> Aulas: {totalLessons}</span>
      </div>

      {/* Flow columns */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-0 min-w-max">
          {/* TEMAS column */}
          <div className="flex flex-col gap-3 w-52">
            <div className="text-xs font-bold uppercase tracking-widest text-purple-600 px-1">TEMAS</div>
            {data.categories.map((cat) => {
              const catModules = data.modules.filter((m) => m.category_id === cat.id);
              return (
                <div key={cat.id} className="relative">
                  <div className="rounded-lg border-2 border-purple-300 bg-purple-50 p-3 text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <Folder className="h-4 w-4 text-purple-600 shrink-0" />
                      <span className="font-semibold text-purple-900 line-clamp-2">{cat.title}</span>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TIER_COLOR[cat.access_tier]}`}>{cat.access_tier}</span>
                    <div className="mt-1 text-[11px] text-purple-700">{catModules.length} módulos</div>
                  </div>
                  {/* connector line */}
                  <div className="absolute top-1/2 -right-6 w-6 border-t-2 border-dashed border-purple-300" />
                </div>
              );
            })}
          </div>

          <div className="w-6" /> {/* spacer */}

          {/* MÓDULOS column */}
          <div className="flex flex-col gap-2 w-56">
            <div className="text-xs font-bold uppercase tracking-widest text-blue-600 px-1">MÓDULOS</div>
            {data.modules.map((mod) => {
              const modLessons = data.lessons.filter((l) => l.module_id === mod.id);
              return (
                <div key={mod.id} className="relative">
                  <div className="rounded-lg border-2 border-blue-300 bg-blue-50 p-3 text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <BookOpen className="h-4 w-4 text-blue-600 shrink-0" />
                      <span className="font-medium text-blue-900 line-clamp-2">{mod.title}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TIER_COLOR[mod.access_tier]}`}>{mod.access_tier}</span>
                      {mod.unlock_delay_days > 0 && <span className="text-[10px] text-orange-600">+{mod.unlock_delay_days}d</span>}
                    </div>
                    <div className="mt-1 text-[11px] text-blue-700">{modLessons.length} aulas</div>
                  </div>
                  <div className="absolute top-1/2 -right-6 w-6 border-t-2 border-dashed border-blue-300" />
                </div>
              );
            })}
          </div>

          <div className="w-6" /> {/* spacer */}

          {/* AULAS column */}
          <div className="flex flex-col gap-1.5 w-56">
            <div className="text-xs font-bold uppercase tracking-widest text-green-600 px-1">AULAS</div>
            {data.lessons.map((l) => (
              <div key={l.id} className={`rounded-lg border-2 p-2 text-xs ${l.published ? "border-green-300 bg-green-50" : "border-gray-200 bg-gray-50"}`}>
                <div className="flex items-center gap-1.5">
                  <PlayCircle className={`h-3 w-3 shrink-0 ${l.published ? "text-green-600" : "text-gray-400"}`} />
                  <span className={`line-clamp-1 ${l.published ? "text-green-900" : "text-gray-500"}`}>{l.title}</span>
                </div>
                <div className="flex gap-1.5 mt-1">
                  <span className={`text-[9px] px-1 py-0.5 rounded ${TIER_COLOR[l.access_tier]}`}>{l.access_tier}</span>
                  {!l.published && <span className="text-[9px] text-gray-400">rascunho</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}