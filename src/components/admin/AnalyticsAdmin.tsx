import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Users, BookOpen, ClipboardList, Star, TrendingUp, RefreshCw } from "lucide-react";

type KpiData = {
  total_students: number;
  active_subs: number;
  lessons_done: number;
  survey_responses: number;
};

type SurveyRow = { id: string; title: string };
type SurveyQuestion = { id: string; question_text: string; question_type: string; options: string[] | null };
type AnswerDist = { label: string; count: number };
type SurveyChart = { survey: SurveyRow; questions: { q: SurveyQuestion; dist: AnswerDist[] }[] };

const COLORS = ["#a78bfa", "#ec4899", "#22d3ee", "#f59e0b", "#34d399", "#f87171", "#60a5fa"];

function today() {
  return new Date().toISOString().slice(0, 10);
}
function monthStart() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function KpiCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: number | string; sub?: string; color: string;
}) {
  return (
    <Card className="glass-card p-5 flex items-center gap-4">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </Card>
  );
}

function StarDistChart({ dist }: { dist: AnswerDist[] }) {
  const full = [1, 2, 3, 4, 5].map((n) => ({
    label: `${n}⭐`,
    count: dist.find((d) => d.label === String(n))?.count ?? 0,
  }));
  const total = full.reduce((s, d) => s + d.count, 0);
  const avg = total > 0 ? (full.reduce((s, d) => s + parseInt(d.label) * d.count, 0) / total).toFixed(1) : "—";
  return (
    <div>
      <p className="mb-1 text-xs text-muted-foreground">Média: <span className="font-bold text-primary">{avg} ⭐</span></p>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={full} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="count" name="Respostas" radius={[4, 4, 0, 0]}>
            {full.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChoiceChart({ dist }: { dist: AnswerDist[] }) {
  if (dist.length === 0) return <p className="text-xs text-muted-foreground">Sem respostas ainda.</p>;
  return (
    <ResponsiveContainer width="100%" height={Math.max(100, dist.length * 36)}>
      <BarChart data={dist} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="label" width={160} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="count" name="Respostas" radius={[0, 4, 4, 0]}>
          {dist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AnalyticsAdmin() {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [charts, setCharts] = useState<SurveyChart[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const fromTs = `${from}T00:00:00`;
    const toTs = `${to}T23:59:59`;

    const [
      { count: totalStudents },
      { count: activeSubs },
      { count: lessonsDone },
      { count: surveyResp },
      { data: surveys },
    ] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("user_subscriptions").select("*", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("lesson_progress").select("*", { count: "exact", head: true }).gte("created_at", fromTs).lte("created_at", toTs),
      supabase.from("survey_responses").select("*", { count: "exact", head: true }).gte("created_at", fromTs).lte("created_at", toTs),
      supabase.from("surveys").select("id, title").eq("is_active", true),
    ]);

    setKpi({
      total_students: totalStudents ?? 0,
      active_subs: activeSubs ?? 0,
      lessons_done: lessonsDone ?? 0,
      survey_responses: surveyResp ?? 0,
    });

    // Gráficos das pesquisas
    const svList = (surveys ?? []) as SurveyRow[];
    const chartData: SurveyChart[] = [];

    for (const sv of svList) {
      const { data: qs } = await supabase
        .from("survey_questions")
        .select("*")
        .eq("survey_id", sv.id)
        .order("sort_order");

      const questions: { q: SurveyQuestion; dist: AnswerDist[] }[] = [];

      for (const q of (qs ?? []) as SurveyQuestion[]) {
        const { data: responses } = await supabase
          .from("survey_responses")
          .select("id")
          .eq("survey_id", sv.id)
          .gte("created_at", fromTs)
          .lte("created_at", toTs);

        const respIds = (responses ?? []).map((r: any) => r.id);
        let dist: AnswerDist[] = [];

        if (respIds.length > 0) {
          const { data: answers } = await supabase
            .from("survey_answers")
            .select("answer_text")
            .eq("question_id", q.id)
            .in("response_id", respIds);

          const counts: Record<string, number> = {};
          for (const a of (answers ?? []) as { answer_text: string | null }[]) {
            const key = a.answer_text ?? "—";
            counts[key] = (counts[key] ?? 0) + 1;
          }
          dist = Object.entries(counts).map(([label, count]) => ({ label, count }));
        }

        questions.push({ q: q as SurveyQuestion, dist });
      }

      // Distribuição da avaliação final (rating = estrelas)
      const { data: ratings } = await supabase
        .from("survey_responses")
        .select("rating")
        .eq("survey_id", sv.id)
        .gte("created_at", fromTs)
        .lte("created_at", toTs);

      if (ratings && ratings.length > 0) {
        const ratingCounts: Record<string, number> = {};
        for (const r of ratings as { rating: string | null }[]) {
          if (r.rating) ratingCounts[r.rating] = (ratingCounts[r.rating] ?? 0) + 1;
        }
        const ratingDist = Object.entries(ratingCounts).map(([label, count]) => ({ label, count }));
        questions.push({
          q: { id: "rating", question_text: "Avaliação geral da aula", question_type: "stars", options: null },
          dist: ratingDist,
        });
      }

      chartData.push({ survey: sv, questions });
    }

    setCharts(chartData);
    setLoading(false);
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      {/* Filtro de período */}
      <Card className="glass-card p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Data início</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-40 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Data fim</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 w-40 text-sm" />
          </div>
          <Button size="sm" onClick={load} disabled={loading} className="gradient-primary text-primary-foreground h-8">
            <RefreshCw className={`mr-1 h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Carregando..." : "Atualizar"}
          </Button>
          <div className="flex gap-2 ml-auto flex-wrap">
            {[
              { label: "Hoje", f: today(), t: today() },
              { label: "Este mês", f: monthStart(), t: today() },
              { label: "Últimos 7 dias", f: (() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10); })(), t: today() },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => { setFrom(p.f); setTo(p.t); }}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${from === p.f && to === p.t ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/50 hover:bg-primary/10 hover:text-primary"}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* KPIs */}
      {kpi && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            icon={<Users className="h-6 w-6 text-white" />}
            label="Total de alunos"
            value={kpi.total_students}
            color="bg-violet-500"
          />
          <KpiCard
            icon={<TrendingUp className="h-6 w-6 text-white" />}
            label="Assinaturas ativas"
            value={kpi.active_subs}
            color="bg-pink-500"
          />
          <KpiCard
            icon={<BookOpen className="h-6 w-6 text-white" />}
            label="Aulas concluídas"
            value={kpi.lessons_done}
            sub="no período"
            color="bg-cyan-500"
          />
          <KpiCard
            icon={<ClipboardList className="h-6 w-6 text-white" />}
            label="Respostas de pesquisa"
            value={kpi.survey_responses}
            sub="no período"
            color="bg-amber-500"
          />
        </div>
      )}

      {/* Gráficos de pesquisas */}
      {charts.length === 0 && !loading && (
        <Card className="glass-card p-6 text-center text-muted-foreground text-sm">
          Nenhuma pesquisa ativa para exibir dados.
        </Card>
      )}

      {charts.map(({ survey, questions }) => (
        <Card key={survey.id} className="glass-card p-5 space-y-5">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary shrink-0" />
            <h3 className="font-bold text-base">{survey.title}</h3>
          </div>

          {questions.length === 0 && (
            <p className="text-sm text-muted-foreground">Sem respostas ainda no período selecionado.</p>
          )}

          <div className="grid gap-5 md:grid-cols-2">
            {questions.map(({ q, dist }) => (
              <div key={q.id} className="rounded-xl border border-border/60 p-4">
                <p className="mb-3 text-sm font-semibold leading-snug">{q.question_text}</p>
                {q.question_type === "stars" ? (
                  <StarDistChart dist={dist} />
                ) : q.question_type === "choice" ? (
                  <ChoiceChart dist={dist} />
                ) : (
                  /* Texto livre — lista das últimas respostas */
                  dist.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sem respostas ainda.</p>
                  ) : (
                    <ul className="space-y-1 max-h-36 overflow-y-auto">
                      {dist.map((d, i) => (
                        <li key={i} className="text-xs rounded-md bg-muted/40 px-3 py-1.5 leading-relaxed">
                          {d.label}
                        </li>
                      ))}
                    </ul>
                  )
                )}
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
