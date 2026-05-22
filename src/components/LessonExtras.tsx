import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Paperclip, Link2, Megaphone, Trash2, Send, Upload, Plus } from "lucide-react";
import { toast } from "sonner";

type Resource = { id: string; lesson_id: string; kind: "file" | "link"; title: string; url: string; sort_order: number };
type Note = { id: string; lesson_id: string; body: string; created_at: string };
type Comment = { id: string; lesson_id: string; user_id: string; parent_id: string | null; body: string; created_at: string };
type ProfileMap = Record<string, { full_name: string | null }>;

export function LessonExtras({ lessonId, userId, isAdmin, hideIfEmpty = false, layout = "tabs" }: { lessonId: string; userId: string; isAdmin: boolean; hideIfEmpty?: boolean; layout?: "tabs" | "stacked" }) {
  const [resources, setResources] = useState<Resource[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [profiles, setProfiles] = useState<ProfileMap>({});

  // admin form state
  const [resTitle, setResTitle] = useState("");
  const [resUrl, setResUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [noteBody, setNoteBody] = useState("");

  const load = async () => {
    const [{ data: r }, { data: n }] = await Promise.all([
      supabase.from("lesson_resources").select("*").eq("lesson_id", lessonId).order("sort_order"),
      supabase.from("lesson_admin_notes").select("*").eq("lesson_id", lessonId).order("created_at", { ascending: false }),
    ]);
    setResources((r ?? []) as Resource[]);
    setNotes((n ?? []) as Note[]);
    setLoaded(true);
  };

  useEffect(() => { load(); }, [lessonId]);

  // ---- Admin: upload file
  const onFileUpload = async (file: File) => {
    if (!file) return;
    setUploading(true);
    const path = `${lessonId}/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from("lesson-files").upload(path, file, { contentType: file.type });
    if (error) { setUploading(false); return toast.error(error.message); }
    const { data } = supabase.storage.from("lesson-files").getPublicUrl(path);
    const { error: e2 } = await supabase.from("lesson_resources").insert({
      lesson_id: lessonId, kind: "file", title: resTitle || file.name, url: data.publicUrl, sort_order: resources.length,
    });
    setUploading(false);
    if (e2) return toast.error(e2.message);
    toast.success("Arquivo adicionado");
    setResTitle("");
    load();
  };

  const addLink = async () => {
    if (!resTitle || !resUrl) return toast.error("Título e URL obrigatórios");
    const { error } = await supabase.from("lesson_resources").insert({
      lesson_id: lessonId, kind: "link", title: resTitle, url: resUrl, sort_order: resources.length,
    });
    if (error) return toast.error(error.message);
    toast.success("Link adicionado");
    setResTitle(""); setResUrl(""); load();
  };

  const removeResource = async (id: string) => {
    if (!confirm("Remover este recurso?")) return;
    const { error } = await supabase.from("lesson_resources").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const addNote = async () => {
    if (!noteBody.trim()) return;
    const { error } = await supabase.from("lesson_admin_notes").insert({ lesson_id: lessonId, body: noteBody.trim() });
    if (error) return toast.error(error.message);
    setNoteBody(""); load();
  };

  const removeNote = async (id: string) => {
    if (!confirm("Excluir comentário?")) return;
    const { error } = await supabase.from("lesson_admin_notes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };


  const resourcesBlock = (
    <div className="space-y-3">
          {resources.length === 0 && !isAdmin && <p className="text-sm text-muted-foreground">Nenhum material disponível.</p>}
          {resources.map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-lg border border-border/60 bg-card p-3">
              {r.kind === "file" ? <Paperclip className="h-4 w-4 text-primary" /> : <Link2 className="h-4 w-4 text-primary" />}
              <a href={r.url} target="_blank" rel="noreferrer" className="flex-1 truncate text-sm font-medium hover:underline">{r.title}</a>
              {isAdmin && <Button size="icon" variant="ghost" onClick={() => removeResource(r.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>}
            </div>
          ))}
          {isAdmin && (
            <div className="rounded-lg border border-primary/30 bg-card/50 p-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Adicionar material</p>
              <Input placeholder="Título" value={resTitle} onChange={(e) => setResTitle(e.target.value)} />
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex">
                  <input type="file" className="hidden" onChange={(e) => e.target.files && onFileUpload(e.target.files[0])} />
                  <Button asChild size="sm" disabled={uploading}><span><Upload className="mr-1 h-4 w-4" />{uploading ? "Enviando..." : "Enviar arquivo"}</span></Button>
                </label>
                <div className="flex flex-1 gap-2 min-w-[200px]">
                  <Input placeholder="https://..." value={resUrl} onChange={(e) => setResUrl(e.target.value)} />
                  <Button size="sm" onClick={addLink}><Plus className="mr-1 h-4 w-4" />Link</Button>
                </div>
              </div>
            </div>
          )}
    </div>
  );

  const notesBlock = (
    <div className="space-y-3">
          {isAdmin && (
            <div className="rounded-lg border border-primary/30 bg-card/50 p-3 space-y-2">
              <Textarea rows={2} placeholder="Escreva um comentário/aviso para os alunos..." value={noteBody} onChange={(e) => setNoteBody(e.target.value)} />
              <Button size="sm" onClick={addNote} className="bg-gradient-primary text-primary-foreground"><Send className="mr-1 h-4 w-4" />Publicar</Button>
            </div>
          )}
          {notes.length === 0 && <p className="text-sm text-muted-foreground">Nenhum comentário do instrutor.</p>}
          {notes.map((n) => (
            <div key={n.id} className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-start gap-2">
                <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="flex-1 whitespace-pre-line text-sm">{n.body}</p>
                {isAdmin && <Button size="icon" variant="ghost" onClick={() => removeNote(n.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>}
              </div>
            </div>
          ))}
    </div>
  );

  // Oculta para alunos enquanto carrega ou se não há conteúdo
  if (hideIfEmpty && !isAdmin && loaded && resources.length === 0 && notes.length === 0) return null;
  if (hideIfEmpty && !isAdmin && !loaded) return null;

  if (layout === "stacked") {
    return (
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center"><Paperclip className="mr-2 h-4 w-4" />Materiais</p>
          {resourcesBlock}
        </div>
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center"><Megaphone className="mr-2 h-4 w-4" />Comentário da Aula</p>
          {notesBlock}
        </div>
      </div>
    );
  }

  return (
    <Card className="mt-6 border-border/60 bg-gradient-card p-4 md:p-6">
      <Tabs defaultValue="resources">
        <TabsList>
          <TabsTrigger value="resources"><Paperclip className="mr-2 h-4 w-4" />Materiais</TabsTrigger>
          <TabsTrigger value="notes"><Megaphone className="mr-2 h-4 w-4" />Comentários</TabsTrigger>
        </TabsList>
        <TabsContent value="resources" className="mt-4">{resourcesBlock}</TabsContent>
        <TabsContent value="notes" className="mt-4">{notesBlock}</TabsContent>
      </Tabs>
    </Card>
  );
}