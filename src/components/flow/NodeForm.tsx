import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CoverUpload } from "@/components/CoverUpload";
import { LessonExtras } from "@/components/LessonExtras";
import { X, Save, Loader2, Trash2 } from "lucide-react";
import type { FormState, Tier } from "./types";
import { KIND_STYLE, TIER_LABEL, TIER_COLOR, slugify } from "./helpers";

function LessonVideoField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const detected: "url" | "embed" = value.trim().startsWith("<") ? "embed" : "url";
  const [mode, setMode] = useState<"url" | "embed">(detected);
  return (
    <div style={{ marginBottom: 10 }}>
      <Label style={{ fontSize: 12, color: "#6b7280" }}>Vídeo da aula</Label>
      <div style={{ display: "flex", gap: 6, marginTop: 6, marginBottom: 6 }}>
        {(["url", "embed"] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)} style={{
            flex: 1, padding: "5px 0", borderRadius: 6,
            border: `1.5px solid ${mode === m ? "#16a34a" : "#e5e7eb"}`,
            background: mode === m ? "#16a34a18" : "#f9fafb",
            color: mode === m ? "#16a34a" : "#9ca3af",
            fontSize: 11, fontWeight: 600, cursor: "pointer",
          }}>{m === "url" ? "URL" : "Incorporar (Embed)"}</button>
        ))}
      </div>
      {mode === "url" ? (
        <Input value={value} onChange={(e) => onChange(e.target.value)}
          style={{ fontSize: 12 }} placeholder="https://player-vz-... ou https://youtube.com/..." />
      ) : (
        <Textarea rows={4} value={value} onChange={(e) => onChange(e.target.value)}
          style={{ fontSize: 11, fontFamily: "monospace" }}
          placeholder='<iframe src="..." allowfullscreen></iframe>' />
      )}
    </div>
  );
}

export function NodeForm({ form, onSave, onClose, onDelete, saving, currentUserId, isAdmin, embedded = false }: {
  form: FormState;
  onSave: (f: FormState) => void;
  onClose: () => void;
  onDelete?: () => void;
  saving: boolean;
  currentUserId: string;
  isAdmin: boolean;
  embedded?: boolean;
}) {
  const [local, setLocal] = useState(form);
  const s = KIND_STYLE[form.kind];
  const isEdit = form.mode === "edit";

  const containerStyle: React.CSSProperties = embedded
    ? {
        background: "#fff", border: `2px solid ${s.border}`,
        borderRadius: 14, padding: 18,
      }
    : {
        position: "absolute", top: 16, right: 16, width: 340,
        maxHeight: "calc(100% - 32px)", overflowY: "auto",
        background: "#fff", border: `2px solid ${s.border}`,
        borderRadius: 14, padding: 18,
        boxShadow: "0 8px 32px rgba(0,0,0,0.14)", zIndex: 100,
      };

  return (
    <div style={containerStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: s.accent, display: "flex", alignItems: "center", gap: 6 }}>
          {s.icon} {isEdit ? "Editar" : "Novo"} {s.label}
        </span>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>
          <X size={15} />
        </button>
      </div>

      <div style={{ marginBottom: 10 }}>
        <Label style={{ fontSize: 12, color: "#6b7280" }}>Título</Label>
        <Input autoFocus value={local.title}
          onChange={(e) => setLocal({ ...local, title: e.target.value, slug: local.kind === "category" && !isEdit ? slugify(e.target.value) : local.slug })}
          style={{ marginTop: 4, fontSize: 13 }}
          placeholder={`Nome do ${s.label.toLowerCase()}...`} />
      </div>

      {form.kind === "category" && (
        <div style={{ marginBottom: 10 }}>
          <Label style={{ fontSize: 12, color: "#6b7280" }}>Slug</Label>
          <Input value={local.slug ?? ""} onChange={(e) => setLocal({ ...local, slug: e.target.value })}
            style={{ marginTop: 4, fontSize: 12 }} placeholder="meu-tema" />
        </div>
      )}

      {(form.kind === "category" || form.kind === "module") && (
        <div style={{ marginBottom: 10 }}>
          <Label style={{ fontSize: 12, color: "#6b7280" }}>Descrição</Label>
          <Textarea rows={2} value={local.description ?? ""} onChange={(e) => setLocal({ ...local, description: e.target.value })}
            style={{ marginTop: 4, fontSize: 12 }} />
        </div>
      )}
      {(form.kind === "category" || form.kind === "module") && (
        <div style={{ marginBottom: 10 }}>
          <Label style={{ fontSize: 12, color: "#6b7280" }}>
            Capa {form.kind === "module" && <span style={{ color: "#9ca3af", fontWeight: 400 }}>(1080×1920)</span>}
          </Label>
          <div style={{ marginTop: 4 }}>
            <CoverUpload
              value={local.cover_url ?? null}
              onChange={(url) => setLocal({ ...local, cover_url: url })}
              folder={form.kind === "category" ? "categories" : "modules"}
            />
          </div>
        </div>
      )}

      {form.kind === "lesson" && (
        <LessonVideoField
          value={local.panda_embed_url ?? ""}
          onChange={(v) => setLocal({ ...local, panda_embed_url: v })}
        />
      )}

      <div style={{ marginBottom: 10 }}>
        <Label style={{ fontSize: 12, color: "#6b7280" }}>Ordem</Label>
        <Input type="number" value={local.sort_order ?? 0}
          onChange={(e) => setLocal({ ...local, sort_order: Number(e.target.value) })}
          style={{ marginTop: 4, fontSize: 12 }} />
      </div>

      {isEdit && form.kind === "lesson" && form.recordId && currentUserId && (
        <div style={{ marginBottom: 14, paddingTop: 6, borderTop: "1px solid #e5e7eb", paddingBottom: 6 }}>
          <LessonExtras lessonId={form.recordId} userId={currentUserId} isAdmin={isAdmin} layout="stacked" />
        </div>
      )}

      <div style={{ marginBottom: local.kind === "module" ? 10 : 14 }}>
        <Label style={{ fontSize: 12, color: "#6b7280" }}>Acesso</Label>
        <div style={{ display: "flex", gap: 5, marginTop: 6 }}>
          {(["free", "basic", "premium"] as Tier[]).map((t) => (
            <button key={t} onClick={() => setLocal({ ...local, tier: t })} style={{
              flex: 1, padding: "4px 0", borderRadius: 6,
              border: `1.5px solid ${local.tier === t ? TIER_COLOR[t] : "#e5e7eb"}`,
              background: local.tier === t ? `${TIER_COLOR[t]}18` : "#f9fafb",
              color: local.tier === t ? TIER_COLOR[t] : "#9ca3af",
              fontSize: 11, fontWeight: 600, cursor: "pointer",
            }}>
              {TIER_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      {local.kind === "module" && (
        <div style={{ marginBottom: 14 }}>
          <button
            type="button"
            onClick={() => setLocal({ ...local, unlock_delay_days: (local.unlock_delay_days ?? 0) > 0 ? 0 : 7 })}
            style={{
              display: "flex", alignItems: "center", gap: 8, width: "100%",
              padding: "8px 10px", borderRadius: 8, cursor: "pointer",
              border: `1.5px solid ${(local.unlock_delay_days ?? 0) > 0 ? "#f59e0b" : "#e5e7eb"}`,
              background: (local.unlock_delay_days ?? 0) > 0 ? "#fef9ee" : "#f9fafb",
            }}
          >
            <span style={{ fontSize: 15 }}>⏰</span>
            <div style={{ textAlign: "left", flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: (local.unlock_delay_days ?? 0) > 0 ? "#d97706" : "#6b7280" }}>
                Liberar somente após 7 dias
              </div>
              <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>
                {(local.unlock_delay_days ?? 0) > 0 ? "Ativado — aluno acessa no 8º dia após compra" : "Desativado — acesso imediato após compra"}
              </div>
            </div>
            <div style={{
              width: 32, height: 18, borderRadius: 9, transition: "background 0.2s",
              background: (local.unlock_delay_days ?? 0) > 0 ? "#f59e0b" : "#d1d5db",
              position: "relative", flexShrink: 0,
            }}>
              <div style={{
                position: "absolute", top: 2, width: 14, height: 14, borderRadius: "50%", background: "#fff",
                transition: "left 0.2s", left: (local.unlock_delay_days ?? 0) > 0 ? 16 : 2,
              }} />
            </div>
          </button>
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <Button onClick={() => onSave(local)} disabled={saving || !local.title.trim()}
          style={{ flex: 1, background: s.accent, color: "#fff", fontSize: 13 }}>
          {saving ? <Loader2 size={13} className="animate-spin mr-1" /> : <Save size={13} className="mr-1" />}
          Salvar
        </Button>
        {isEdit && onDelete && (
          <Button onClick={onDelete} disabled={saving} variant="outline"
            style={{ fontSize: 13, borderColor: "#fca5a5", color: "#dc2626" }}>
            <Trash2 size={13} />
          </Button>
        )}
      </div>
    </div>
  );
}