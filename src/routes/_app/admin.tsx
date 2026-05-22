import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ChevronUp, ChevronDown, Plus, Trash2, Upload, Folder, BookOpen, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import type { AccessTier, Category, Module, Lesson, UserSubscription, Profile, SubscriptionStatus } from "@/lib/database.types";

export const Route = createFileRoute("/_app/admin")({
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: isAdmin } = await supabase.rpc("has_role" as never, { _user_id: u.user.id, _role: "admin" } as never);
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
        supabase.from("categories").select("*").order("order_index"),
        supabase.from("modules").select("*").order("order_index"),
        supabase.from("lessons").select("*").order("order_index"),
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
    await supabase.from(table).update({ order_index: neighborOrder }).eq("id", id);
    await supabase.from(table).update({ order_index: current }).eq("id", neighborId);
    invalidate();
  };

  const addCategory = async () => {
    const title = prompt("Nome da categoria:");
    if (!title) return;
    const order = (data?.categories.length ?? 0);
    const { error } = await supabase.from("categories").insert({ title, order_index: order });
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
          onReorder={(neighbor) => reorder("categories", cat.id, cat.order_index, neighbor.id, neighbor.order_index)}
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
      title, category_id: category.id, access_tier: "free", unlock_delay_days: 0, order_index: modules.length,
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
    await supabase.from("modules").update({ order_index: n.order_index }).eq("id", m.id);
    await supabase.from("modules").update({ order_index: m.order_index }).eq("id", n.id);
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
      title, module_id: m.id, access_tier: m.access_tier, published: false, order_index: lessons.length,
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
  const [delay, setDelay] = useState(m.unlock_delay_days);
  const [cover, setCover] = useState(m.cover_url ?? "");

  const onUpload = async (f: File) => {
    const url = await uploadCover(f);
    if (url) setCover(url);
  };
  const save = async () => {
    const { error } = await supabase.from("modules").update({
      title, description: desc, access_tier: tier, unlock_delay_days: delay, cover_url: cover || null,
    }).eq("id", m.id);
    if (error) toast.error(error.message); else { toast.success("Salvo"); onDone(); }
  };

  return (
    <div className="mt-3 space-y-3 rounded-md border bg-background p-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div><Label>Título</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div>
          <Label>Tier</Label>
          <Select value={tier} onValueChange={(v) => setTier(v as AccessTier)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="basic">Básico</SelectItem>
              <SelectItem value="premium">Premium</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Unlock delay (dias)</Label><Input type="number" value={delay} onChange={(e) => setDelay(Number(e.target.value))} /></div>
        <div>
          <Label>Capa</Label>
          <div className="flex items-center gap-2">
            <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
            {cover && <img src={cover} alt="" className="h-10 w-16 rounded object-cover" />}
          </div>
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
    await supabase.from("lessons").update({ order_index: n.order_index }).eq("id", lesson.id);
    await supabase.from("lessons").update({ order_index: lesson.order_index }).eq("id", n.id);
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
  const [title, setTitle] = useState(lesson.title);
  const [desc, setDesc] = useState(lesson.description ?? "");
  const [embed, setEmbed] = useState(lesson.panda_embed_url ?? "");
  const [tier, setTier] = useState<AccessTier>(lesson.access_tier);
  const [cover, setCover] = useState(lesson.cover_url ?? "");

  const save = async () => {
    const { error } = await supabase.from("lessons").update({
      title, description: desc, panda_embed_url: embed, access_tier: tier, cover_url: cover || null,
    }).eq("id", lesson.id);
    if (error) toast.error(error.message); else { toast.success("Salvo"); onDone(); }
  };
  const onUpload = async (f: File) => {
    const url = await uploadCover(f);
    if (url) setCover(url);
  };

  return (
    <div className="mt-2 space-y-3 rounded-md border bg-background p-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div><Label>Título</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div>
          <Label>Tier</Label>
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
      <div><Label>Embed URL (Panda)</Label><Input value={embed} onChange={(e) => setEmbed(e.target.value)} placeholder="https://..." /></div>
      <div>
        <Label>Capa</Label>
        <div className="flex items-center gap-2">
          <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
          {cover && <img src={cover} alt="" className="h-10 w-16 rounded object-cover" />}
        </div>
      </div>
      <div><Label>Descrição</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
      <div className="flex gap-2">
        <Button onClick={save} className="gradient-primary text-primary-foreground"><Upload className="mr-1 h-3 w-3" />Salvar</Button>
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
    await supabase.from("user_subscriptions").update({ status: "cancelled" as SubscriptionStatus }).eq("id", id);
    invalidate();
  };

  if (!data) return <div className="text-muted-foreground">Carregando...</div>;
  const profileById = (uid: string) => data.profiles.find((p) => p.id === uid);

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
                <td className="p-3">{p?.email ?? p?.display_name ?? s.user_id.slice(0, 8)}</td>
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

/* ------------------- Structure ------------------- */

function StructureView() {
  const { data } = useQuery({
    queryKey: ["admin-content"],
    queryFn: async () => {
      const [c, m, l] = await Promise.all([
        supabase.from("categories").select("*").order("order_index"),
        supabase.from("modules").select("*").order("order_index"),
        supabase.from("lessons").select("*").order("order_index"),
      ]);
      return {
        categories: (c.data ?? []) as Category[],
        modules: (m.data ?? []) as Module[],
        lessons: (l.data ?? []) as Lesson[],
      };
    },
  });
  if (!data) return <div className="text-muted-foreground">Carregando...</div>;

  return (
    <div className="glass-card rounded-2xl p-6">
      {data.categories.map((c) => (
        <div key={c.id} className="mb-6">
          <div className="flex items-center gap-2 font-semibold text-primary">
            <Folder className="h-4 w-4" /> {c.title}
          </div>
          <div className="ml-6 mt-2 space-y-2 border-l pl-4">
            {data.modules.filter((m) => m.category_id === c.id).map((m) => (
              <div key={m.id}>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <BookOpen className="h-3 w-3" /> {m.title}
                  <Badge variant="secondary" className="text-[10px] uppercase">{m.access_tier}</Badge>
                </div>
                <div className="ml-5 mt-1 space-y-1 border-l pl-3 text-xs text-muted-foreground">
                  {data.lessons.filter((l) => l.module_id === m.id).map((l) => (
                    <div key={l.id} className="flex items-center gap-2">
                      <PlayCircle className="h-3 w-3" /> {l.title}
                      {!l.published && <span className="text-[10px] text-muted-foreground">(rascunho)</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}