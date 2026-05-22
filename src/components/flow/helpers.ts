import type { Category, FlowEdge, FlowNode, Lesson, ModuleRow, Tier } from "./types";

export const NODE_W = 210;
export const NODE_H = 76;
export const COL_X = [60, 340, 620];
export const ROW_GAP = 114;
const LAYOUT_KEY = "flow-layout-v1";

export const KIND_STYLE = {
  category: { bg: "#f5f3ff", border: "#7c3aed", accent: "#7c3aed", icon: "📚", label: "Tema" },
  module:   { bg: "#eff6ff", border: "#2563eb", accent: "#2563eb", icon: "📦", label: "Módulo" },
  lesson:   { bg: "#f0fdf4", border: "#16a34a", accent: "#16a34a", icon: "🎬", label: "Aula" },
} as const;

export const TIER_LABEL: Record<Tier, string> = { free: "Free", basic: "Básico", premium: "Premium" };
export const TIER_COLOR: Record<Tier, string> = { free: "#6b7280", basic: "#2563eb", premium: "#d97706" };

export type SavedPositions = Record<string, { x: number; y: number }>;

export function loadSavedPositions(): SavedPositions {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    return raw ? (JSON.parse(raw) as SavedPositions) : {};
  } catch { return {}; }
}
export function persistPositions(p: SavedPositions) {
  try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(p)); } catch {}
}
export function clearSavedPositions() {
  try { localStorage.removeItem(LAYOUT_KEY); } catch {}
}

export function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function buildLayout(cats: Category[], mods: ModuleRow[], lsns: Lesson[], saved: SavedPositions = {}) {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  let catY = 40;
  cats.forEach((cat, catIdx) => {
    const catMods = mods.filter((m) => m.category_id === cat.id);
    const totalRows = catMods.length === 0 ? 1 : catMods.reduce((acc, mod) => acc + Math.max(lsns.filter((l) => l.module_id === mod.id).length, 1), 0);
    const catId = `cat-${cat.id}`;
    const catPos = saved[catId];
    nodes.push({ id: catId, kind: "category", label: cat.title, tier: cat.access_tier, childCount: catMods.length, orderIndex: catIdx, x: catPos?.x ?? COL_X[0], y: catPos?.y ?? catY });
    let modY = catY;
    catMods.forEach((mod, modIdx) => {
      const ml = lsns.filter((l) => l.module_id === mod.id);
      const modId = `mod-${mod.id}`;
      const modPos = saved[modId];
      nodes.push({ id: modId, kind: "module", label: mod.title, tier: mod.access_tier, childCount: ml.length, orderIndex: modIdx, unlockDelayDays: mod.unlock_delay_days ?? 0, x: modPos?.x ?? COL_X[1], y: modPos?.y ?? modY });
      edges.push({ fromId: `cat-${cat.id}`, toId: `mod-${mod.id}` });
      let lsnY = modY;
      ml.forEach((lsn, lsnIdx) => {
        const lsnId = `lsn-${lsn.id}`;
        const lsnPos = saved[lsnId];
        nodes.push({ id: lsnId, kind: "lesson", label: lsn.title, tier: lsn.access_tier, published: lsn.published, childCount: 0, orderIndex: lsnIdx, x: lsnPos?.x ?? COL_X[2], y: lsnPos?.y ?? lsnY });
        edges.push({ fromId: `mod-${mod.id}`, toId: `lsn-${lsn.id}` });
        lsnY += ROW_GAP;
      });
      modY += Math.max(ml.length, 1) * ROW_GAP;
    });
    catY += totalRows * ROW_GAP;
  });
  return { nodes, edges };
}

export function curvePath(x1: number, y1: number, x2: number, y2: number) {
  const mx = (x1 + x2) / 2;
  return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
}