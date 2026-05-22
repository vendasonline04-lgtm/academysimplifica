export type Tier = "free" | "basic" | "premium";

export type Category = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  cover_url: string | null;
  sort_order: number;
  access_tier: Tier;
};

export type ModuleRow = {
  id: string;
  category_id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  sort_order: number;
  access_tier: Tier;
  unlock_delay_days: number;
};

export type Lesson = {
  id: string;
  module_id: string | null;
  category_id: string;
  title: string;
  description?: string | null;
  panda_embed_url: string;
  duration_seconds: number | null;
  sort_order: number;
  published: boolean;
  access_tier: Tier;
};

export type FlowNode = {
  id: string;
  kind: "category" | "module" | "lesson";
  label: string;
  tier: Tier;
  published?: boolean;
  childCount: number;
  orderIndex: number;
  unlockDelayDays?: number;
  x: number;
  y: number;
};

export type FlowEdge = { fromId: string; toId: string };

export type FormMode = "create" | "edit";

export type FormState = {
  mode: FormMode;
  kind: "category" | "module" | "lesson";
  recordId?: string;
  parentId?: string;
  categoryId?: string;
  title: string;
  tier: Tier;
  slug?: string;
  description?: string;
  cover_url?: string | null;
  sort_order?: number;
  panda_embed_url?: string;
  unlock_delay_days?: number;
};

export type CreatedPayload = {
  kind: "category" | "module" | "lesson";
  id: string;
  categoryId?: string;
  moduleId?: string;
};