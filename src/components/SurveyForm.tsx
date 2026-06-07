import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ClipboardList, CheckCircle2 } from "lucide-react";

type Question = {
  id: string;
  question_text: string;
  question_type: string;
  options: string[] | null;
  sort_order: number;
};

const RATINGS = [
  { value: "excellent_didactic", label: "Excelente didática" },
  { value: "good_steps", label: "Bom passo a passo" },
  { value: "done", label: "Consegui fazer" },
  { value: "partial", label: "Consegui parcialmente" },
  { value: "failed", label: "Não consegui" },
];

export function SurveyForm({
  surveyId,
  lessonId,
  userId,
}: {
  surveyId: string;
  lessonId: string;
  userId: string;
}) {
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answered, setAnswered] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [rating, setRating] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [{ data: sv }, { data: qs }, { data: resp }] = await Promise.all([
        supabase.from("surveys").select("id, title").eq("id", surveyId).maybeSingle(),
        supabase.from("survey_questions").select("*").eq("survey_id", surveyId).order("sort_order"),
        supabase
          .from("survey_responses")
          .select("id")
          .eq("survey_id", surveyId)
          .eq("user_id", userId)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      if (sv) setTitle((sv as any).title ?? "");
      setQuestions(
        (qs ?? []).map((q: any) => ({ ...q, options: q.options as string[] | null }))
      );
      setAnswered(!!resp);
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [surveyId, userId]);

  const handleSubmit = async () => {
    if (!rating) { toast.error("Selecione uma nota para a aula"); return; }
    const missing = questions.filter((q) => !answers[q.id]?.trim());
    if (missing.length) { toast.error("Responda todas as perguntas antes de enviar"); return; }

    setSubmitting(true);
    try {
      const { data: resp, error: respErr } = await supabase
        .from("survey_responses")
        .insert({ survey_id: surveyId, user_id: userId, lesson_id: lessonId, rating })
        .select("id")
        .single();
      if (respErr) throw respErr;

      if (questions.length > 0) {
        const rows = questions.map((q) => ({
          response_id: (resp as any).id,
          question_id: q.id,
          answer_text: answers[q.id] ?? "",
        }));
        const { error: ansErr } = await supabase.from("survey_answers").insert(rows);
        if (ansErr) throw ansErr;
      }

      setAnswered(true);
      toast.success("Obrigada pelo seu feedback!");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao enviar pesquisa");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !title) return null;

  if (answered) {
    return (
      <Card className="glass-card p-6 text-center">
        <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-primary" />
        <p className="font-semibold">Feedback enviado! Obrigada por responder.</p>
      </Card>
    );
  }

  return (
    <Card className="glass-card p-6">
      <div className="mb-5 flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-bold">{title}</h3>
      </div>

      <div className="space-y-5">
        {questions.map((q, i) => (
          <div key={q.id}>
            <p className="mb-2 text-sm font-semibold">
              {i + 1}. {q.question_text}
            </p>
            {q.question_type === "text" ? (
              <Textarea
                placeholder="Sua resposta..."
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                rows={2}
                className="resize-none"
              />
            ) : q.question_type === "choice" && q.options ? (
              <div className="flex flex-wrap gap-2">
                {q.options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      answers[q.id] === opt
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:border-primary/60"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ))}

        <div>
          <p className="mb-2 text-sm font-semibold">Como você avalia esta aula?</p>
          <div className="flex flex-wrap gap-2">
            {RATINGS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRating(r.value)}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  rating === r.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:border-primary/60"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="gradient-primary text-primary-foreground w-full sm:w-auto"
        >
          {submitting ? "Enviando..." : "Enviar feedback"}
        </Button>
      </div>
    </Card>
  );
}
