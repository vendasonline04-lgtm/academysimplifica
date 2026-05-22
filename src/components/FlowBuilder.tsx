import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Maximize2, RotateCcw, Plus, Save, GitBranch, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Category, FlowEdge, FlowNode, FormState, Lesson, ModuleRow } from "./flow/types";
import {
  KIND_STYLE, TIER_LABEL, TIER_COLOR,
  NODE_W, NODE_H, COL_X,
  buildLayout, curvePath,
  loadSavedPositions, persistPositions, clearSavedPositions,
  type SavedPositions,
} from "./flow/helpers";
import { NodeForm } from "./flow/NodeForm";

type FlowBuilderProps = {
  cats: Category[];
  mods: ModuleRow[];
  lsns: Lesson[];
  form: FormState | null;
  saving: boolean;
  onOpenCreate: (kind: FormState["kind"], parentId?: string, categoryId?: string) => void;
  onOpenEdit: (kind: FormState["kind"], recordId: string) => void;
  onCloseForm: () => void;
  onSave: (f: FormState) => void;
  onDelete: () => void;
};

export function FlowBuilder({
  cats, mods, lsns, form, saving,
  onOpenCreate, onOpenEdit, onCloseForm, onSave, onDelete,
}: FlowBuilderProps) {
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<FlowEdge[]>([]);
  const [pan, setPan] = useState({ x: 40, y: 20 });
  const [zoom, setZoom] = useState(1);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const dragging = useRef<{ id: string; ox: number; oy: number; mx: number; my: number } | null>(null);
  const panning = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Rebuild layout whenever data changes (preserving saved positions)
  useEffect(() => {
    const saved = loadSavedPositions();
    const { nodes: n, edges: e } = buildLayout(cats, mods, lsns, saved);
    setNodes(n); setEdges(e); setDirty(false);
  }, [cats, mods, lsns]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? ""));
  }, []);

  const resetLayout = useCallback(() => {
    clearSavedPositions();
    const { nodes: n, edges: e } = buildLayout(cats, mods, lsns);
    setNodes(n); setEdges(e); setPan({ x: 40, y: 20 }); setZoom(1); setDirty(false);
    toast.success("Layout reorganizado");
  }, [cats, mods, lsns]);

  const saveLayout = useCallback(() => {
    const positions: SavedPositions = {};
    nodes.forEach((n) => { positions[n.id] = { x: n.x, y: n.y }; });
    persistPositions(positions);
    setDirty(false);
    toast.success("Layout salvo!");
  }, [nodes]);

  const fitView = useCallback(() => {
    if (!nodes.length || !svgRef.current) return;
    const W = svgRef.current.clientWidth, H = svgRef.current.clientHeight;
    const minX = Math.min(...nodes.map((n) => n.x)) - 20;
    const maxX = Math.max(...nodes.map((n) => n.x + NODE_W)) + 50;
    const minY = Math.min(...nodes.map((n) => n.y)) - 20;
    const maxY = Math.max(...nodes.map((n) => n.y + NODE_H)) + 20;
    const z = Math.min(W / (maxX - minX), H / (maxY - minY), 1.4);
    setZoom(z);
    setPan({ x: -minX * z + (W - (maxX - minX) * z) / 2, y: -minY * z + (H - (maxY - minY) * z) / 2 });
  }, [nodes]);

  const rawId = (nodeId: string) => nodeId.replace(/^(cat|mod|lsn)-/, "");

  // ── Drag ──
  const onNodeDown = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const node = nodes.find((n) => n.id === id)!;
    dragging.current = { id, ox: node.x, oy: node.y, mx: e.clientX, my: e.clientY };
  }, [nodes]);

  const onSvgDown = useCallback((e: React.MouseEvent) => {
    panning.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y };
  }, [pan]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging.current) {
      const dx = (e.clientX - dragging.current.mx) / zoom;
      const dy = (e.clientY - dragging.current.my) / zoom;
      setNodes((prev) => prev.map((n) => n.id === dragging.current!.id ? { ...n, x: dragging.current!.ox + dx, y: dragging.current!.oy + dy } : n));
    } else if (panning.current) {
      setPan({ x: panning.current.px + (e.clientX - panning.current.sx), y: panning.current.py + (e.clientY - panning.current.sy) });
    }
  }, [zoom]);

  const onMouseUp = useCallback(() => {
    if (dragging.current) setDirty(true);
    dragging.current = null; panning.current = null;
  }, []);
  const onWheel = useCallback((e: React.WheelEvent) => { e.preventDefault(); setZoom((z) => Math.min(2, Math.max(0.3, z - e.deltaY * 0.001))); }, []);

  const nodeMap = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 14, padding: "6px 14px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12, color: "#6b7280" }}>
          {(["category", "module", "lesson"] as const).map((k) => (
            <span key={k} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: KIND_STYLE[k].accent, display: "inline-block" }} />
              {KIND_STYLE[k].label}s: <strong style={{ color: "#374151", marginLeft: 2 }}>{k === "category" ? cats.length : k === "module" ? mods.length : lsns.length}</strong>
            </span>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <Button size="sm" variant="outline" onClick={() => onOpenCreate("category")}>
            <Plus size={13} className="mr-1" style={{ color: KIND_STYLE.category.accent }} /> Novo Tema
          </Button>
          <Button size="sm" variant="outline" onClick={resetLayout}><RotateCcw size={13} className="mr-1" /> Reorganizar</Button>
          <Button size="sm" variant="outline" onClick={fitView}><Maximize2 size={13} className="mr-1" /> Ajustar tela</Button>
        </div>
      </div>

      {/* Column headers */}
      <div style={{ display: "flex", paddingLeft: pan.x + 4 }}>
        {(["category", "module", "lesson"] as const).map((k, i) => (
          <div key={k} style={{ width: NODE_W * zoom, marginLeft: i === 0 ? 0 : (COL_X[i] - COL_X[i - 1] - NODE_W) * zoom, fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: KIND_STYLE[k].accent, textTransform: "uppercase" }}>
            {KIND_STYLE[k].label}s
          </div>
        ))}
      </div>

      {/* Canvas */}
      <div style={{ position: "relative", height: 560, background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 16, overflow: "hidden", cursor: "grab" }}>
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
          <defs>
            <pattern id="dotgrid2" x={pan.x % (24 * zoom)} y={pan.y % (24 * zoom)} width={24 * zoom} height={24 * zoom} patternUnits="userSpaceOnUse">
              <circle cx={1.5} cy={1.5} r={1.2} fill="#cbd5e1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dotgrid2)" />
        </svg>

        <svg ref={svgRef} style={{ width: "100%", height: "100%", userSelect: "none" }}
          onMouseDown={onSvgDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp} onWheel={onWheel}>
          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
            {edges.map((edge, i) => {
              const from = nodeMap[edge.fromId]; const to = nodeMap[edge.toId];
              if (!from || !to) return null;
              const x1 = from.x + NODE_W + 24, y1 = from.y + NODE_H / 2;
              const x2 = to.x, y2 = to.y + NODE_H / 2;
              const color = KIND_STYLE[to.kind].border;
              return (
                <g key={i}>
                  <path d={curvePath(x1, y1, x2, y2)} fill="none" stroke={color} strokeWidth={1.8} strokeOpacity={0.4} />
                  <polygon points={`${x2},${y2} ${x2 - 8},${y2 - 4} ${x2 - 8},${y2 + 4}`} fill={color} opacity={0.55} />
                </g>
              );
            })}

            {nodes.map((node) => {
              const s = KIND_STYLE[node.kind];
              const rid = rawId(node.id);
              const isHovered = hoveredId === node.id;
              const bx = node.x + NODE_W + 2;
              const by = node.y + (NODE_H - 24) / 2;
              const ex = node.x + NODE_W - 26;
              const ey = node.y + 6;

              return (
                <g key={node.id}
                  onMouseEnter={() => setHoveredId(node.id)}
                  onMouseLeave={() => setHoveredId(null)}>
                  <g onMouseDown={(e) => onNodeDown(e, node.id)} style={{ cursor: "grab" }}>
                    <rect x={node.x + 2} y={node.y + 3} width={NODE_W} height={NODE_H} rx={10} fill="rgba(0,0,0,0.05)" />
                    <rect x={node.x} y={node.y} width={NODE_W} height={NODE_H} rx={10} fill={s.bg} stroke={isHovered ? s.accent : s.border} strokeWidth={isHovered ? 2 : 1.5} />
                    <rect x={node.x} y={node.y} width={5} height={NODE_H} rx={2} fill={s.accent} />
                    <text x={node.x + 18} y={node.y + NODE_H / 2 + 1} fontSize={17} dominantBaseline="middle" textAnchor="middle">{s.icon}</text>
                    <foreignObject x={node.x + 32} y={node.y + 7} width={NODE_W - 66} height={36}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b", lineHeight: "1.3", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", fontFamily: "Space Grotesk, sans-serif" }}>
                        {node.label}
                      </div>
                    </foreignObject>
                    <rect x={node.x + 32} y={node.y + NODE_H - 21} width={46} height={13} rx={4} fill={`${TIER_COLOR[node.tier]}20`} stroke={`${TIER_COLOR[node.tier]}55`} strokeWidth={0.8} />
                    <text x={node.x + 55} y={node.y + NODE_H - 12} fontSize={8.5} textAnchor="middle" fill={TIER_COLOR[node.tier]} fontWeight={700} fontFamily="Space Grotesk, sans-serif">{TIER_LABEL[node.tier]}</text>
                    {node.kind === "lesson" && (
                      <circle cx={node.x + NODE_W - 10} cy={node.y + NODE_H - 12} r={4.5} fill={node.published ? "#16a34a" : "#dc2626"} opacity={0.85} />
                    )}
                    {node.kind === "module" && (node.unlockDelayDays ?? 0) > 0 && (
                      <g>
                        <rect x={node.x + NODE_W - 38} y={node.y + NODE_H - 21} width={28} height={13} rx={4} fill="#f59e0b20" stroke="#f59e0b55" strokeWidth={0.8} />
                        <text x={node.x + NODE_W - 24} y={node.y + NODE_H - 12} fontSize={8} textAnchor="middle" fill="#d97706" fontWeight={700} fontFamily="Space Grotesk, sans-serif">⏰7d</text>
                      </g>
                    )}
                    {/* Número de ordem no canto superior direito */}
                    <rect x={node.x + NODE_W - 22} y={node.y + 4} width={18} height={16} rx={4} fill={s.accent} opacity={0.15} />
                    <text x={node.x + NODE_W - 13} y={node.y + 13} fontSize={9} textAnchor="middle" dominantBaseline="middle" fill={s.accent} fontWeight={900} fontFamily="monospace">{node.orderIndex + 1}</text>
                    {/* Contador de filhos pequeno abaixo do número */}
                    {node.kind !== "lesson" && node.childCount > 0 && (
                      <text x={node.x + NODE_W - 13} y={node.y + 26} fontSize={7.5} textAnchor="middle" dominantBaseline="middle" fill={s.accent} opacity={0.5} fontFamily="monospace">{node.childCount}↓</text>
                    )}
                  </g>

                  {isHovered && (
                    <g onClick={(e) => { e.stopPropagation(); onOpenEdit(node.kind, rid); }} style={{ cursor: "pointer" }}>
                      <rect x={ex} y={ey} width={22} height={22} rx={6} fill={s.accent} opacity={0.9} />
                      <text x={ex + 11} y={ey + 12} fontSize={11} textAnchor="middle" dominantBaseline="middle" fill="#fff">✏</text>
                    </g>
                  )}

                  {node.kind !== "lesson" && (() => {
                    const childKind = node.kind === "category" ? "module" : "lesson";
                    const catId = node.kind === "category" ? rid : mods.find((m) => m.id === rid)?.category_id ?? "";
                    return (
                      <g onClick={(e) => { e.stopPropagation(); onOpenCreate(childKind as FormState["kind"], rid, catId); }} style={{ cursor: "pointer" }}>
                        <rect x={bx} y={by} width={24} height={24} rx={7} fill={s.accent} />
                        <text x={bx + 12} y={by + 13} fontSize={17} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontWeight={300}>+</text>
                      </g>
                    );
                  })()}
                </g>
              );
            })}
          </g>
        </svg>

        {form && (
          <NodeForm
            form={form}
            saving={saving}
            onSave={onSave}
            onClose={onCloseForm}
            onDelete={form.mode === "edit" ? onDelete : undefined}
            currentUserId={currentUserId}
            isAdmin={true}
          />
        )}

        {nodes.length === 0 && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#94a3b8", gap: 10, pointerEvents: "none" }}>
            <GitBranch size={34} opacity={0.4} />
            <p style={{ fontSize: 15, fontWeight: 600, color: "#64748b" }}>Nenhum conteúdo ainda</p>
            <p style={{ fontSize: 13 }}>Clique em "Novo Tema" para começar</p>
          </div>
        )}

        <div style={{ position: "absolute", bottom: 12, right: 12, background: "rgba(255,255,255,0.92)", border: "1px solid #e2e8f0", borderRadius: 6, padding: "3px 9px", fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>
          {Math.round(zoom * 100)}%
        </div>

        <div style={{ position: "absolute", top: 12, right: 12, zIndex: 50 }}>
          <Button size="sm" onClick={saveLayout} disabled={!dirty}
            style={{
              background: dirty ? "#7c3aed" : "#e5e7eb",
              color: dirty ? "#fff" : "#9ca3af",
              boxShadow: dirty ? "0 4px 14px rgba(124,58,237,0.35)" : "none",
              fontWeight: 600,
            }}>
            <Save size={14} className="mr-1" />
            {dirty ? "Salvar layout •" : "Layout salvo"}
          </Button>
        </div>

        <div style={{ position: "absolute", bottom: 12, left: 12, background: "rgba(255,255,255,0.92)", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 10px", fontSize: 10, color: "#94a3b8", display: "flex", gap: 10 }}>
          <span>✏️ hover = editar</span>
          <span>+ = adicionar filho</span>
          <span>scroll = zoom</span>
        </div>
      </div>
    </div>
  );
}
