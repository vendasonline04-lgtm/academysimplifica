import { createFileRoute, redirect, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
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
import { Plus, Trash2, Upload, Folder, BookOpen, PlayCircle, Link2, Send, Pencil, Users, Phone, Mail, DollarSign, Eye, EyeOff, Calendar, GripVertical, ChevronUp, ChevronDown, Webhook, Copy, CheckCircle2, ClipboardList, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import type { AccessTier, AppRole, Category, Module, Lesson, UserSubscription, Profile, WebhookProduct } from "@/lib/database.types";
import { SurveyAdmin } from "@/components/admin/SurveyAdmin";
import { AnalyticsAdmin } from "@/components/admin/AnalyticsAdmin";

const adminSearchSchema = z.object({
  tab: z.enum(["content", "subs", "clientes", "webhook", "view", "surveys", "analytics"]).optional(),
});

export const Route = createFileRoute("/_app/admin")({
  validateSearch: zodValidator(adminSearchSchema),
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
  const { tab } = useSearch({ from: "/_app/admin" });
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Painel Admin</h1>
      <Tabs defaultValue={tab ?? "content"}>
        <TabsList>
          <TabsTrigger value="content">Conteúdo</TabsTrigger>
          <TabsTrigger value="subs">Assinaturas</TabsTrigger>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="webhook">Webhook</TabsTrigger>
          <TabsTrigger value="analytics"><TrendingUp className="mr-1 h-4 w-4" />Análises</TabsTrigger>
          <TabsTrigger value="surveys"><ClipboardList className="mr-1 h-4 w-4" />Pesquisas</TabsTrigger>
          <TabsTrigger value="view">Visualização</TabsTrigger>
        </TabsList>
        <TabsContent value="content" className="mt-6"><ContentManager /></TabsContent>
        <TabsContent value="subs" className="mt-6"><SubscriptionsManager /></TabsContent>
        <TabsContent value="clientes" className="mt-6"><ClientesManager /></TabsContent>
        <TabsContent value="webhook" className="mt-6"><WebhookManager /></TabsContent>
        <TabsContent value="analytics" className="mt-6"><AnalyticsAdmin /></TabsContent>
        <TabsContent value="surveys" className="mt-6"><SurveysManager /></TabsContent>
        <TabsContent value="view" className="mt-6"><StructureView /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------- Surveys Manager ------------------- */

function SurveysManager() {
  const { data } = useQuery({
    queryKey: ["admin-surveys-refs"],
    queryFn: async () => {
      const [l, p] = await Promise.all([
        supabase.from("lessons").select("id, title").order("sort_order"),
        supabase.from("profiles").select("user_id, full_name"),
      ]);
      return {
        lessons: (l.data ?? []) as { id: string; title: string }[],
        profiles: (p.data ?? []) as { user_id: string; full_name: string | null }[],
      };
    },
  });

  if (!data) return <div className="text-muted-foreground">Carregando...</div>;

  return <SurveyAdmin lessons={data.lessons} profiles={data.profiles} />;
}

/* ------------------- Content Manager ------------------- */

async function uploadCover(file: File): Promise<string | null> {
  const path = `${Date.now()}-${file.name.replace(/[^a-z0-9.\-_]/gi, "_")}`;
  const { error } = await supabase.storage.from("covers").upload(path, file, { upsert: false });
  if (error) { toast.error(error.message); return null; }
  const { data } = supabase.storage.from("covers").getPublicUrl(path);
  return data.publicUrl;
}

/* Modal estilizado — substitui window.prompt/confirm */
function InlineModal({ title, placeholder, onConfirm, onCancel }: {
  title: string; placeholder: string;
  onConfirm: (value: string) => void; onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <Input
          autoFocus value={value} placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && value.trim()) onConfirm(value.trim()); if (e.key === "Escape") onCancel(); }}
        />
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
          <Button disabled={!value.trim()} onClick={() => onConfirm(value.trim())} className="gradient-primary text-primary-foreground">Confirmar</Button>
        </div>
      </div>
    </div>
  );
}

/* Modal de confirmação */
function ConfirmModal({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4">
        <p className="text-sm text-foreground">{message}</p>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
          <Button variant="destructive" onClick={onConfirm}>Excluir</Button>
        </div>
      </div>
    </div>
  );
}

/* Handle de reordenação */
function ReorderHandle({ canUp, canDown, onUp, onDown }: { canUp: boolean; canDown: boolean; onUp: () => void; onDown: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center w-5 shrink-0 cursor-pointer select-none opacity-40 hover:opacity-100 transition-opacity">
      <button onClick={onUp} disabled={!canUp} className="h-3.5 w-full flex items-end justify-center pb-px disabled:opacity-20 hover:text-primary">
        <ChevronUp className="h-3 w-3" />
      </button>
      <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
      <button onClick={onDown} disabled={!canDown} className="h-3.5 w-full flex items-start justify-center pt-px disabled:opacity-20 hover:text-primary">
        <ChevronDown className="h-3 w-3" />
      </button>
    </div>
  );
}

function ContentManager() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<{ type: "category" } | null>(null);

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

  const handleAddCategory = async (title: string) => {
    setModal(null);
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const { error } = await supabase.from("categories").insert({ title, slug, sort_order: data?.categories.length ?? 0 });
    if (error) toast.error(error.message); else invalidate();
  };

  if (!data) return <div className="text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-3">
      {modal?.type === "category" && (
        <InlineModal title="Novo Curso" placeholder="Nome do curso..." onConfirm={handleAddCategory} onCancel={() => setModal(null)} />
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-muted-foreground">Estrutura do Curso</h2>
        <Button onClick={() => setModal({ type: "category" })} className="gradient-primary text-primary-foreground">
          <Plus className="mr-2 h-4 w-4" /> Novo Curso
        </Button>
      </div>

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
  const [modal, setModal] = useState<"module" | "delete" | null>(null);

  const handleAddModule = async (title: string) => {
    setModal(null);
    await supabase.from("modules").insert({ title, category_id: category.id, access_tier: "free", unlock_delay_days: 0, sort_order: modules.length });
    onChange();
  };
  const handleDelete = async () => { setModal(null); await supabase.from("categories").delete().eq("id", category.id); onChange(); };

  return (
    <div className="rounded-xl border bg-white shadow-sm">
      {modal === "module" && <InlineModal title="Novo Módulo" placeholder="Nome do módulo..." onConfirm={handleAddModule} onCancel={() => setModal(null)} />}
      {modal === "delete" && <ConfirmModal message="Excluir categoria e tudo dentro?" onConfirm={handleDelete} onCancel={() => setModal(null)} />}

      <div className="flex items-center gap-2 p-3">
        <ReorderHandle canUp={canUp} canDown={canDown} onUp={() => neighborUp && onReorder(neighborUp)} onDown={() => neighborDown && onReorder(neighborDown)} />
        <button onClick={() => setOpen(!open)} className="flex items-center justify-center w-6 h-6 shrink-0 text-primary font-bold text-lg leading-none">
          {open ? "−" : "+"}
        </button>
        <Folder className="h-4 w-4 text-primary shrink-0" />
        <span className="flex-1 font-semibold text-sm">{category.title}</span>
        <span className="text-xs text-muted-foreground">{modules.length} módulos</span>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEdit(!edit)}><Pencil className="h-3.5 w-3.5" /></Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setModal("delete")}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
      </div>

      {edit && <div className="px-3 pb-3"><CategoryEditor category={category} onDone={() => { setEdit(false); onChange(); }} /></div>}

      {open && (
        <div className="border-t mx-3 mb-3">
          {modules.map((m, i) => (
            <ModuleRow
              key={m.id} module={m} index={i + 1}
              lessons={lessons.filter((l) => l.module_id === m.id)}
              onChange={onChange}
              canUp={i > 0} canDown={i < modules.length - 1}
              neighborUp={modules[i - 1]} neighborDown={modules[i + 1]}
            />
          ))}
          <div className="pt-2">
            <Button size="sm" variant="outline" onClick={() => setModal("module")} className="w-full border-dashed text-muted-foreground hover:text-primary">
              <Plus className="mr-1 h-3 w-3" /> Novo Módulo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ModuleRow({ module: m, index, lessons, onChange, canUp, canDown, neighborUp, neighborDown }: {
  module: Module; index: number; lessons: Lesson[]; onChange: () => void;
  canUp: boolean; canDown: boolean; neighborUp?: Module; neighborDown?: Module;
}) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(false);
  const [modal, setModal] = useState<"lesson" | "delete" | null>(null);

  const reorder = async (n: Module) => {
    await supabase.from("modules").update({ sort_order: n.sort_order }).eq("id", m.id);
    await supabase.from("modules").update({ sort_order: m.sort_order }).eq("id", n.id);
    onChange();
  };
  const handleAddLesson = async (title: string) => {
    setModal(null);
    await supabase.from("lessons").insert({ title, module_id: m.id, category_id: m.category_id, panda_embed_url: "", access_tier: m.access_tier, published: true, sort_order: lessons.length });
    onChange();
  };
  const handleDelete = async () => { setModal(null); await supabase.from("modules").delete().eq("id", m.id); onChange(); };

  return (
    <div className="mt-2 rounded-lg border bg-background/50">
      {modal === "lesson" && <InlineModal title="Nova Aula" placeholder="Nome da aula..." onConfirm={handleAddLesson} onCancel={() => setModal(null)} />}
      {modal === "delete" && <ConfirmModal message="Excluir módulo e suas aulas?" onConfirm={handleDelete} onCancel={() => setModal(null)} />}

      <div className="flex items-center gap-2 p-2.5">
        <ReorderHandle canUp={canUp} canDown={canDown} onUp={() => neighborUp && reorder(neighborUp)} onDown={() => neighborDown && reorder(neighborDown)} />
        <button onClick={() => setOpen(!open)} className="flex items-center justify-center w-5 h-5 shrink-0 text-primary font-bold leading-none text-base">
          {open ? "−" : "+"}
        </button>
        <BookOpen className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="font-bold text-primary text-xs mr-1">{index}.</span>
        <span className="flex-1 text-sm font-medium">{m.title}</span>
        <span className="text-xs text-muted-foreground">{lessons.length} aulas</span>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEdit(!edit)}><Pencil className="h-3.5 w-3.5" /></Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setModal("delete")}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
      </div>

      {edit && <div className="px-3 pb-3 border-t pt-3"><ModuleEditor module={m} onDone={() => { setEdit(false); onChange(); }} /></div>}

      {open && (
        <div className="border-t px-2 pb-2">
          {lessons.map((l, i) => (
            <LessonRow key={l.id} lesson={l} index={i + 1} onChange={onChange}
              canUp={i > 0} canDown={i < lessons.length - 1}
              neighborUp={lessons[i - 1]} neighborDown={lessons[i + 1]}
              moduleLessons={lessons} />
          ))}
          <div className="pt-1">
            <Button size="sm" variant="outline" onClick={() => setModal("lesson")} className="w-full border-dashed text-muted-foreground hover:text-primary text-xs">
              <Plus className="mr-1 h-3 w-3" /> Nova Aula
            </Button>
          </div>
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

function LessonRow({ lesson, index, onChange, canUp, canDown, neighborUp, neighborDown, moduleLessons }: {
  lesson: Lesson; index: number; onChange: () => void;
  canUp: boolean; canDown: boolean; neighborUp?: Lesson; neighborDown?: Lesson; moduleLessons: Lesson[];
}) {
  const [edit, setEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const reorder = async (n: Lesson) => {
    await supabase.from("lessons").update({ sort_order: n.sort_order }).eq("id", lesson.id);
    await supabase.from("lessons").update({ sort_order: lesson.sort_order }).eq("id", n.id);
    onChange();
  };
  const handleDelete = async () => { setConfirmDelete(false); await supabase.from("lessons").delete().eq("id", lesson.id); onChange(); };

  return (
    <div className="mt-1.5 rounded-md border bg-background/70">
      {confirmDelete && <ConfirmModal message="Excluir esta aula?" onConfirm={handleDelete} onCancel={() => setConfirmDelete(false)} />}
      <div className="flex items-center gap-2 px-2 py-2">
        <ReorderHandle canUp={canUp} canDown={canDown} onUp={() => neighborUp && reorder(neighborUp)} onDown={() => neighborDown && reorder(neighborDown)} />
        <PlayCircle className="h-3.5 w-3.5 text-green-600 shrink-0" />
        <span className="font-bold text-green-600 text-xs mr-1">{index}.</span>
        <span className="flex-1 text-sm">{lesson.title}</span>
        {!lesson.published && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">rascunho</span>}
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEdit(!edit)}><Pencil className="h-3.5 w-3.5" /></Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setConfirmDelete(true)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
      </div>
      {edit && <div className="border-t px-3 py-3"><LessonEditor lesson={lesson} moduleLessons={moduleLessons} onDone={() => { setEdit(false); onChange(); }} /></div>}
    </div>
  );
}

function LessonEditor({ lesson, onDone, moduleLessons = [] }: { lesson: Lesson; onDone: () => void; moduleLessons?: Lesson[] }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(lesson.title);
  const [desc, setDesc] = useState(lesson.description ?? "");
  const [published, setPublished] = useState(lesson.published);
  const [videoMode, setVideoMode] = useState<"url" | "embed">(
    lesson.panda_embed_url?.startsWith("<") ? "embed" : "url"
  );
  const [videoVal, setVideoVal] = useState(lesson.panda_embed_url ?? "");
  const [tier, setTier] = useState<AccessTier>(lesson.access_tier);
  const [surveyGateId, setSurveyGateId] = useState<string>((lesson as any).survey_gate_survey_id ?? "none");
  const { data: allSurveys = [] } = useQuery({
    queryKey: ["all-surveys-for-gate"],
    queryFn: async () => {
      const { data } = await supabase.from("surveys").select("id, title, lesson_id").eq("is_active", true).order("title");
      return (data ?? []) as { id: string; title: string; lesson_id: string | null }[];
    },
  });

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
      title, description: desc, panda_embed_url: videoVal, access_tier: tier, published,
      survey_gate_survey_id: surveyGateId === "none" ? null : surveyGateId,
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

      {/* Gate de pesquisa */}
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5">
          <ClipboardList className="h-3.5 w-3.5 text-primary" />
          Exige pesquisa respondida antes de assistir
        </Label>
        <p className="text-xs text-muted-foreground">Se selecionado, o aluno só acessa esta aula após responder a pesquisa da aula escolhida.</p>
        <Select value={surveyGateId} onValueChange={setSurveyGateId}>
          <SelectTrigger>
            <SelectValue placeholder="Sem restrição (acesso livre)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem restrição (acesso livre)</SelectItem>
            {allSurveys.map((sv) => {
              const gateLessonTitle = moduleLessons.find((l) => l.id === sv.lesson_id)?.title;
              return (
                <SelectItem key={sv.id} value={sv.id}>
                  {sv.title}{gateLessonTitle ? ` — (${gateLessonTitle})` : ""}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">{published ? "Aula publicada" : "Rascunho"}</p>
          <p className="text-xs text-muted-foreground">{published ? "Visível para os alunos" : "Não aparece para os alunos"}</p>
        </div>
        <Switch checked={published} onCheckedChange={setPublished} />
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

/* ------------------- Webhook Manager ------------------- */

type EditingProduct = { id: string | null; name: string; price: number; category_ids: string[]; cackto_secret: string };

function SetupModal({ onClose }: { onClose: () => void }) {
  const [pat, setPat] = useState("");
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  const run = async () => {
    if (!pat.trim()) return;
    setRunning(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";
      const res = await fetch("/api/admin/run-migration", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ pat: pat.trim() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.detail ?? body.error ?? "Erro desconhecido");
      setDone(true);
      toast.success("Tabelas criadas com sucesso! Recarregue a página.");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4">
        <div className="flex items-center gap-2">
          <Webhook className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Configurar banco de dados</h3>
        </div>

        {done ? (
          <div className="text-center space-y-3 py-4">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <p className="font-medium">Tabelas criadas com sucesso!</p>
            <Button onClick={() => window.location.reload()} className="gradient-primary text-primary-foreground w-full">
              Recarregar página
            </Button>
          </div>
        ) : (
          <>
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Como obter o token:</p>
              <p>1. Acesse <strong>supabase.com</strong> → seu projeto</p>
              <p>2. Clique no avatar (canto superior direito) → <strong>Access Tokens</strong></p>
              <p>3. Gere um token e cole abaixo</p>
            </div>
            <div className="space-y-1.5">
              <Label>Personal Access Token do Supabase</Label>
              <Input
                type="password"
                value={pat}
                onChange={(e) => setPat(e.target.value)}
                placeholder="sbp_..."
                autoFocus
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                disabled={!pat.trim() || running}
                onClick={run}
                className="gradient-primary text-primary-foreground flex-1"
              >
                {running ? "Criando tabelas..." : "Criar tabelas agora"}
              </Button>
              <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function WebhookManager() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<EditingProduct | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  const { data: products = [], isLoading: loadingProducts, error: productsError } = useQuery({
    queryKey: ["webhook-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhook_products" as any)
        .select("*")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as WebhookProduct[];
    },
    retry: false,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["webhook-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*").order("sort_order");
      return (data ?? []) as Category[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["webhook-products"] });

  const webhookUrl = "https://lzfqofifjdzcqnglugrc.supabase.co/functions/v1/cackto-webhook";

  const copyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast.success("URL copiada!");
    setTimeout(() => setCopied(false), 2000);
  };

  const startNew = () =>
    setEditing({ id: null, name: "", price: 0, category_ids: [], cackto_secret: "" });

  const startEdit = (p: WebhookProduct) =>
    setEditing({ id: p.id, name: p.name, price: p.price, category_ids: p.category_ids, cackto_secret: p.cackto_secret ?? "" });

  const saveProduct = async () => {
    if (!editing || !editing.name.trim()) return;
    setSaving(true);
    try {
      if (editing.id) {
        const { error } = await supabase
          .from("webhook_products" as any)
          .update({ name: editing.name, price: editing.price, category_ids: editing.category_ids, cackto_secret: editing.cackto_secret || null })
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Produto atualizado!");
      } else {
        const { error } = await supabase
          .from("webhook_products" as any)
          .insert({ name: editing.name, price: editing.price, category_ids: editing.category_ids, cackto_secret: editing.cackto_secret || null });
        if (error) throw error;
        toast.success("Produto criado!");
      }
      setEditing(null);
      invalidate();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async (id: string) => {
    const { error } = await supabase.from("webhook_products" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Produto removido!");
    invalidate();
  };

  const toggleCategory = (catId: string) => {
    if (!editing) return;
    const ids = editing.category_ids.includes(catId)
      ? editing.category_ids.filter((id) => id !== catId)
      : [...editing.category_ids, catId];
    setEditing({ ...editing, category_ids: ids });
  };

  const tablesMissing = (productsError as any)?.message?.includes("schema cache") ||
    (productsError as any)?.message?.includes("does not exist") ||
    (productsError as any)?.code === "PGRST200";

  return (
    <div className="space-y-6 max-w-2xl">
      {showSetup && <SetupModal onClose={() => setShowSetup(false)} />}

      {/* Banner de setup quando tabela não existe */}
      {tablesMissing && (
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 flex items-start gap-3">
          <div className="text-yellow-500 text-xl">⚠️</div>
          <div className="flex-1 space-y-2">
            <p className="text-sm font-medium text-yellow-800">Banco de dados não configurado</p>
            <p className="text-xs text-yellow-700">As tabelas necessárias ainda não foram criadas no Supabase.</p>
            <Button size="sm" onClick={() => setShowSetup(true)} className="gradient-primary text-primary-foreground">
              Configurar agora
            </Button>
          </div>
        </div>
      )}

      {/* Platform + URL */}
      <div className="glass-card rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Webhook className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold">Configuração do Webhook</h2>
        </div>

        <div className="space-y-1.5">
          <Label>Plataforma de pagamento</Label>
          <div className="flex items-center gap-2">
            <div className="rounded-lg border bg-muted/40 px-4 py-2 text-sm font-medium">Cackto</div>
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-medium text-green-800">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Ativa
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>URL do Webhook</Label>
          <p className="text-xs text-muted-foreground">Cole esta URL no painel da Cackto em Configurações → Webhook</p>
          <div className="flex gap-2">
            <Input readOnly value={webhookUrl} className="font-mono text-xs bg-muted/30 flex-1" />
            <Button variant="outline" size="sm" onClick={copyUrl} className="shrink-0 gap-1.5">
              {copied ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </div>
        </div>
      </div>

      {/* Products */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Produtos / Ofertas</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Defina quais cursos cada produto libera ao comprador.</p>
          </div>
          <Button size="sm" onClick={startNew} className="gradient-primary text-primary-foreground">
            <Plus className="mr-1 h-4 w-4" /> Novo Produto
          </Button>
        </div>

        {loadingProducts && <div className="text-sm text-muted-foreground">Carregando...</div>}

        {!loadingProducts && products.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-10 text-sm text-muted-foreground">
            <DollarSign className="h-8 w-8 opacity-30" />
            <span>Nenhum produto cadastrado</span>
          </div>
        )}

        <div className="space-y-3">
          {products.map((p) => (
            <div key={p.id} className="rounded-xl border bg-background/60 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <p className="font-medium text-sm">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(p.price / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </p>
                  {p.cackto_secret
                    ? <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">🔑 Secret configurado</span>
                    : <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-medium text-yellow-700">⚠️ Sem secret</span>
                  }
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(p)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteProduct(p.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
              {p.category_ids.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.category_ids.map((cid) => {
                    const cat = categories.find((c) => c.id === cid);
                    return cat ? (
                      <Badge key={cid} variant="secondary" className="text-xs">{cat.title}</Badge>
                    ) : null;
                  })}
                </div>
              ) : (
                <p className="mt-2 text-[11px] text-muted-foreground italic">Nenhum curso associado</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Editor modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold">{editing.id ? "Editar Produto" : "Novo Produto"}</h3>

            <div className="space-y-1.5">
              <Label>Nome do produto / oferta</Label>
              <Input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="Ex: Curso Completo — Acesso Vitalício"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label>Preço (R$)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  value={editing.price > 0 ? editing.price / 100 : ""}
                  onChange={(e) => setEditing({ ...editing, price: Math.round(Number(e.target.value) * 100) })}
                  placeholder="0,00"
                  className="pl-9"
                  min={0}
                  step={0.01}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Chave Secreta da Cackto</Label>
              <p className="text-xs text-muted-foreground">Cole aqui o secret gerado pela Cackto para este produto/oferta</p>
              <div className="relative flex gap-2">
                <Input
                  type={showSecret ? "text" : "password"}
                  value={editing.cackto_secret}
                  onChange={(e) => setEditing({ ...editing, cackto_secret: e.target.value })}
                  placeholder="sk_..."
                  className="flex-1 font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 h-9 w-9"
                  onClick={() => setShowSecret(!showSecret)}
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Cursos liberados com esta compra</Label>
              <p className="text-xs text-muted-foreground">Clique nos cursos que serão desbloqueados</p>
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {categories.length === 0 && (
                  <p className="text-center text-xs text-muted-foreground py-4">Nenhum curso criado ainda</p>
                )}
                {categories.map((cat) => {
                  const selected = editing.category_ids.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleCategory(cat.id)}
                      className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors ${
                        selected
                          ? "border-primary bg-primary/5 text-primary font-medium"
                          : "hover:border-primary/40 hover:bg-muted/40"
                      }`}
                    >
                      <div className={`h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                        selected ? "border-primary bg-primary" : "border-muted-foreground/50"
                      }`}>
                        {selected && (
                          <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <span className="flex-1">{cat.title}</span>
                      {selected && <Badge className="text-[10px] h-5 px-1.5">Selecionado</Badge>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t">
              <Button
                disabled={!editing.name.trim() || saving}
                onClick={saveProduct}
                className="gradient-primary text-primary-foreground flex-1"
              >
                {saving ? "Salvando..." : editing.id ? "Salvar Alterações" : "Criar Produto"}
              </Button>
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            </div>
          </div>
        </div>
      )}
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

/* ------------------- Clientes (CRM) ------------------- */

type AdminCliente = {
  id: string; external_id: string | null;
  nome_completo: string | null; cpf: string | null; email: string | null; telefone: string | null;
  produto: string | null; tipo_oferta: string | null; valor: number | null;
  status: string; data_compra: string | null; hora_compra: string | null; created_at: string;
};

function ClientesManager() {
  const [search, setSearch] = useState("");

  const { data: clientes } = useQuery({
    queryKey: ["crm-clientes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_clientes" as any)
        .select("*")
        .order("created_at", { ascending: false });
      return (data ?? []) as AdminCliente[];
    },
  });

  const filtered = (clientes ?? []).filter((o) => {
    const q = search.toLowerCase();
    return !q || [o.email, o.nome_completo, o.cpf, o.telefone].some((v) => v?.toLowerCase().includes(q));
  });

  const totalReceita = (clientes ?? []).reduce((s, o) => s + (o.valor ?? 0), 0);
  const uniqueEmails = new Set((clientes ?? []).map((o) => o.email)).size;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="glass-card rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-primary">{clientes?.length ?? 0}</div>
          <div className="text-xs text-muted-foreground mt-1">Total compras</div>
        </div>
        <div className="glass-card rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{clientes?.length ?? 0}</div>
          <div className="text-xs text-muted-foreground mt-1">Compras aprovadas</div>
        </div>
        <div className="glass-card rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-primary">
            {totalReceita.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Receita total</div>
        </div>
        <div className="glass-card rounded-xl p-4 text-center">
          <div className="text-2xl font-bold">{uniqueEmails}</div>
          <div className="text-xs text-muted-foreground mt-1">Clientes únicos</div>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-3 flex-wrap">
        <Input placeholder="Buscar por nome, email, CPF..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr>
                <th className="p-3 font-medium">Nome Completo</th>
                <th className="p-3 font-medium">CPF</th>
                <th className="p-3 font-medium">Email</th>
                <th className="p-3 font-medium">Telefone</th>
                <th className="p-3 font-medium">Produto</th>
                <th className="p-3 font-medium">Tipo</th>
                <th className="p-3 font-medium">Valor</th>
                <th className="p-3 font-medium">Data</th>
                <th className="p-3 font-medium">Hora</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Nenhum cliente encontrado</td></tr>
              )}
              {filtered.map((o) => (
                <tr key={o.id} className="border-b hover:bg-muted/20 transition-colors">
                  <td className="p-3 font-medium">{o.nome_completo ?? "—"}</td>
                  <td className="p-3 text-xs text-muted-foreground">{o.cpf ?? "—"}</td>
                  <td className="p-3 text-xs">
                    <div className="flex items-center gap-1"><Mail className="h-3 w-3" />{o.email ?? "—"}</div>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {o.telefone ? <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{o.telefone}</div> : "—"}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{o.produto ?? "—"}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${o.tipo_oferta === "Premium" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                      {o.tipo_oferta ?? "Básico"}
                    </span>
                  </td>
                  <td className="p-3 font-medium">
                    {o.valor != null ? o.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1"><Calendar className="h-3 w-3" />{o.data_compra ?? "—"}</div>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{o.hora_compra ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
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