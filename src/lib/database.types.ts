export type AccessTier = "free" | "basic" | "premium";
export type AppRole = "admin" | "student";

export interface Category {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  cover_url: string | null;
  access_tier: AccessTier;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Module {
  id: string;
  category_id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  access_tier: AccessTier;
  unlock_delay_days: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Lesson {
  id: string;
  category_id: string;
  module_id: string | null;
  title: string;
  description: string | null;
  panda_embed_url: string;
  duration_seconds: number | null;
  access_tier: AccessTier;
  published: boolean;
  sort_order: number;
  survey_gate_lesson_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface UserSubscription {
  id: string;
  user_id: string;
  tier: AccessTier;
  status: string;
  payment_provider: string | null;
  external_id: string | null;
  started_at: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AllowedEmail {
  id: string;
  email: string;
  tier: AccessTier;
  status: string;
  external_order_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LessonProgress {
  id: string;
  user_id: string;
  lesson_id: string;
  completed_at: string;
}

export interface LessonFavorite {
  id: string;
  user_id: string;
  lesson_id: string;
  created_at: string;
}

export interface LessonComment {
  id: string;
  user_id: string;
  lesson_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface LessonAdminNote {
  id: string;
  lesson_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface LessonResource {
  id: string;
  lesson_id: string;
  title: string;
  url: string;
  kind: string;
  sort_order: number;
  created_at: string;
}

export interface WebhookProduct {
  id: string;
  name: string;
  price: number;
  category_ids: string[];
  cackto_secret: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserCategoryAccess {
  id: string;
  user_id: string;
  category_id: string;
  product_id: string | null;
  external_order_id: string | null;
  granted_at: string;
}

type TableDef<T> = {
  Row: T;
  Insert: Partial<T> & Record<string, unknown>;
  Update: Partial<T> & Record<string, unknown>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      categories: TableDef<Category>;
      modules: TableDef<Module>;
      lessons: TableDef<Lesson>;
      profiles: TableDef<Profile>;
      user_roles: TableDef<UserRole>;
      user_subscriptions: TableDef<UserSubscription>;
      allowed_emails: TableDef<AllowedEmail>;
      lesson_progress: TableDef<LessonProgress>;
      lesson_favorites: TableDef<LessonFavorite>;
      lesson_comments: TableDef<LessonComment>;
      lesson_admin_notes: TableDef<LessonAdminNote>;
      lesson_resources: TableDef<LessonResource>;
      webhook_products: TableDef<WebhookProduct>;
      user_category_access: TableDef<UserCategoryAccess>;
    };
    Views: Record<string, never>;
    Enums: {
      access_tier: AccessTier;
      app_role: AppRole;
    };
    Functions: {
      has_role: { Args: { _user_id: string; _role: AppRole }; Returns: boolean };
      get_user_tier: { Args: { _user_id: string }; Returns: AccessTier };
      tier_allows: { Args: { _user_id: string; _required: AccessTier }; Returns: boolean };
      is_email_allowed: { Args: { _email: string }; Returns: boolean };
    };
    CompositeTypes: Record<string, never>;
  };
}
