import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, X, Save, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

type LessonRef = { id: string; title: string };
type ProfileRef = { user_id: string; full_name: string | null };
type SurveyRow = { id: string; title: string; lesson_id: string | null; is_active: boolean; created_at: string };
type SurveyQuestion = { id: string; survey_id: string; question_text: string; question_type: string; options: string[] | null; sort_order: number };
type SurveyResponse = { id: string; survey_id: string; user_id: string; rating: string | null; created_at: string };
type SurveyAnswer = { id: string; response_id: string; question_id: string; answer_text: string | null };

const RATING_LABELS: Record<string, string> = {
  excellent_didactic: "Excelente didática",
  good_steps: "Bom passo a passo",
  done: "Consegui fazer",
  partial: "Consegui parcialmente",
  failed: "Não consegui",
};

export function SurveyAdmin({
  lessons,
  profiles,
}: {
  lessons: LessonRef[];
  profiles: ProfileRef[];
}) {
  const [surveys, setSurveys] = useState<SurveyRow[]>([]);
  const [questionsBySurvey, setQuestionsBySurvey] = useState<Record<string, SurveyQuestion[]>>({});
  const [responsesBySurvey, setResponsesBySurvey] = useState<Record<string, SurveyResponse[]>>({});
  const [answers, setAnswers] = useState<SurveyAnswer[]>([]);
  const [selectedSurvey, setSelectedSurvey] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ title: "", lesson_id: "" });
  const [saving, setSaving] = useState(false);
  const [newQ, setNewQ] = useState({ text: "", type: "text", options: "" });

  const reloadSurveys = useCallback(async () => {
    const { data } = await supabase.from("surveys").select("*").order("created_at", { ascending: false });
    setSurveys((data ?? []) as SurveyRow[]);
  }, []);

  useEffect(() => { reloadSurveys(); }, [reloadSurveys]);

  const loadSurveyDetail = useCallback(async (id: string) => {
    const [{ data: qs }, { data: rs }] = await Promise.all([
      supabase.from("survey_questions").select("*").eq("survey_id", id).order("sort_order"),
      supabase.from("survey_responses").select("*").eq("survey_id", id).order("created_at", { ascending: false }),
    ]);

    const parsedQs = (qs ?? []).map((q: any) => ({
      ...q,
      options: q.options as string[] | null,
    })) as SurveyQuestion[];
    const parsedRs = (rs ?? []) as SurveyResponse[];

    setQuestionsBySurvey((prev: Record<string, SurveyQuestion[]>) => ({ ...prev, [id]: parsedQs }));
    setResponsesBySurvey((prev: Record<string, SurveyResponse[]>) => ({ ...prev, [id]: parsedRs }));

    const respIds = parsedRs.map((r) => r.id);
    if (respIds.length > 0) {
      const { data: as } = await supabase.from("survey_answers").select("*").in("response_id", respIds);
      setAnswers((prev: SurveyAnswer[]) => {
        const filtered = prev.filter((a: SurveyAnswer) => !respIds.includes(a.response_id));
        return [...filtered, ...((as ?? []) as SurveyAnswer[])];
      });
    }
  }, []);

  const handleToggleSurvey = async (id: string) => {
    if (selectedSurvey === id) {
      setSelectedSurvey(null);
    } else {
      setSelectedSurvey(id);
      if (!questionsBySurvey[id]) await loadSurveyDetail(id);
    }
  };

  const createSurvey = async () => {
    if (!createForm.title.trim()) return toast.error("Informe o título da pesquisa");
    setSaving(true);
    const { error } = await supabase.from("surveys").insert({
      title: createForm.title,
      lesson_id: createForm.lesson_id || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Pesquisa criada!");
    setShowCreate(false);
    setCreateForm({ title: "", lesson_id: "" });
    await reloadSurveys();
  };

  const toggleActive = async (sv: SurveyRow) => {
    const { error } = await supabase.from("surveys").update({ is_active: !sv.is_active }).eq("id", sv.id);
    if (error) return toast.error(error.message);
    await reloadSurveys();
  };

  const deleteSurvey = async (id: string) => {
    if (!confirm("Excluir esta pesquisa e todas as respostas?")) return;
    const { error } = await supabase.from("surveys").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Pesquisa excluída");
    if (selectedSurvey === id) setSelectedSurvey(null);
    await reloadSurveys();
  };

  const addQuestion = async () => {
    if (!selectedSurvey) return;
    if (!newQ.text.trim()) return toast.error("Escreva o texto da pergunta");
    const opts =
      newQ.type === "choice"
        ? newQ.options.split(",").map((o: string) => o.trim()).filter(Boolean)
        : null;
    const currentQs = questionsBySurvey[selectedSurvey] ?? [];
    const { error } = await supabase.from("survey_questions").insert({
      survey_id: selectedSurvey,
      question_text: newQ.text,
      question_type: newQ.type,
      options: opts,
      sort_order: currentQs.length,
    });
    if (error) return toast.error(error.message);
    toast.success("Pergunta adicionada!");
    setNewQ({ text: "", type: "text", options: "" });
    await loadSurveyDetail(selectedSurvey);
  };

  const deleteQuestion = async (qId: string) => {
    if (!selectedSurvey) return;
    await supabase.from("survey_questions").delete().eq("id", qId);
    await loadSurveyDetail(selectedSurvey);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Pesquisas dos Alunos</h2>
        <Button
          size="sm"
          onClick={() => setShowCreate((v) => !v)}
          className="gradient-primary text-primary-foreground"
        >
          <Plus className="mr-1 h-4 w-4" />Nova Pesquisa
        </Button>
      </div>

      {showCreate && (
        <Card className="glass-card p-4">
          <div className="space-y-3">
            <div>
              <Label>Título da pesquisa</Label>
              <Input
                placeholder="Ex: Feedback Módulo 4 — Claude + Instagram"
                value={createForm.title}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div>
              <Label>Vincular à aula (opcional)</Label>
              <Select
                value={createForm.lesson_id}
                onValueChange={(v) => setCreateForm((prev) => ({ ...prev, lesson_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma aula" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma (pesquisa geral)</SelectItem>
                  {lessons.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={createSurvey}
                disabled={saving}
                className="gradient-primary text-primary-foreground"
              >
                <Save className="mr-1 h-4 w-4" />
                {saving ? "Salvando..." : "Criar pesquisa"}
              </Button>
              <Button variant="ghost" onClick={() => setShowCreate(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="glass-card p-4">
        {surveys.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma pesquisa criada ainda.</p>
        ) : (
          <div className="space-y-2">
            {surveys.map((sv) => {
              const linkedLesson = lessons.find((l) => l.id === sv.lesson_id);
              const svResponses = responsesBySurvey[sv.id] ?? [];
              const svQuestions = questionsBySurvey[sv.id] ?? [];
              const isSelected = selectedSurvey === sv.id;

              return (
                <div
                  key={sv.id}
                  className={`rounded-lg border transition-colors ${
                    isSelected ? "border-primary bg-primary/5" : "border-border/60 hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center gap-2 p-3">
                    <button
                      type="button"
                      className="flex flex-1 items-center gap-2 text-left"
                      onClick={() => handleToggleSurvey(sv.id)}
                    >
                      {isSelected ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-primary" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{sv.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {linkedLesson ? `Aula: ${linkedLesson.title}` : "Pesquisa geral"}
                          {isSelected && ` · ${svResponses.length} resposta${svResponses.length !== 1 ? "s" : ""}`}
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleActive(sv)}
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold transition-colors ${
                        sv.is_active
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {sv.is_active ? "Ativa" : "Inativa"}
                    </button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => deleteSurvey(sv.id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>

                  {isSelected && (
                    <div className="space-y-5 border-t border-border/40 px-4 pb-4 pt-3">
                      {/* Perguntas */}
                      <div>
                        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Perguntas ({svQuestions.length})
                        </p>
                        <div className="space-y-1.5">
                          {svQuestions.length === 0 && (
                            <p className="text-xs text-muted-foreground">Nenhuma pergunta ainda.</p>
                          )}
                          {svQuestions.map((q, i) => (
                            <div key={q.id} className="flex items-start gap-2 rounded-md bg-muted/40 px-3 py-2">
                              <span className="mt-0.5 text-xs font-bold text-primary">{i + 1}.</span>
                              <div className="min-w-0 flex-1">
                                <div className="text-sm">{q.question_text}</div>
                                <div className="text-xs text-muted-foreground">
                                  {q.question_type === "text"
                                    ? "Texto livre"
                                    : `Múltipla escolha: ${(q.options ?? []).join(", ")}`}
                                </div>
                              </div>
                              <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => deleteQuestion(q.id)}>
                                <X className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                          ))}
                        </div>

                        <div className="mt-3 space-y-2 rounded-lg border border-dashed border-border p-3">
                          <p className="text-xs font-semibold text-muted-foreground">+ Adicionar pergunta</p>
                          <div className="flex gap-2">
                            <Input
                              className="h-8 flex-1 text-sm"
                              placeholder="Texto da pergunta"
                              value={newQ.text}
                              onChange={(e) => setNewQ((prev) => ({ ...prev, text: e.target.value }))}
                            />
                            <Select value={newQ.type} onValueChange={(v) => setNewQ((prev) => ({ ...prev, type: v }))}>
                              <SelectTrigger className="h-8 w-36 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="text">Texto livre</SelectItem>
                                <SelectItem value="choice">Múltipla escolha</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {newQ.type === "choice" && (
                            <Input
                              className="h-8 text-sm"
                              placeholder="Opções separadas por vírgula: Sim, Parcialmente, Não"
                              value={newQ.options}
                              onChange={(e) => setNewQ((prev) => ({ ...prev, options: e.target.value }))}
                            />
                          )}
                          <Button size="sm" onClick={addQuestion} className="h-7 text-xs">
                            <Plus className="mr-1 h-3 w-3" />Adicionar
                          </Button>
                        </div>
                      </div>

                      {/* Respostas */}
                      <div>
                        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Respostas ({svResponses.length})
                        </p>
                        {svResponses.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Nenhuma resposta ainda.</p>
                        ) : (
                          <div className="max-h-96 space-y-2 overflow-y-auto">
                            {svResponses.map((resp) => {
                              const profile = profiles.find((p) => p.user_id === resp.user_id);
                              const respAnswers = answers.filter((a) => a.response_id === resp.id);
                              return (
                                <div key={resp.id} className="rounded-lg border border-border/60 p-3 text-sm">
                                  <div className="mb-2 flex items-center justify-between">
                                    <span className="font-semibold">
                                      {profile?.full_name ?? `${resp.user_id.slice(0, 8)}...`}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(resp.created_at).toLocaleDateString("pt-BR")}
                                    </span>
                                  </div>
                                  {svQuestions.map((q) => {
                                    const ans = respAnswers.find((a) => a.question_id === q.id);
                                    return (
                                      <div key={q.id} className="mb-1 text-xs">
                                        <span className="text-muted-foreground">{q.question_text}: </span>
                                        <span className="font-medium">{ans?.answer_text ?? "—"}</span>
                                      </div>
                                    );
                                  })}
                                  {resp.rating && (
                                    <div className="mt-1.5 text-xs">
                                      <span className="text-muted-foreground">Nota: </span>
                                      <span className="font-semibold text-primary">
                                        {RATING_LABELS[resp.rating] ?? resp.rating}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
