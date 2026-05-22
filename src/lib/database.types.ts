export type AccessTier = "free" | "basic" | "premium";
export type AppRole = "admin" | "student";
export type SubscriptionStatus = "active" | "cancelled" | "expired";

export interface Category {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  order_index: number;
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
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface Lesson {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  panda_embed_url: string | null;
  access_tier: AccessTier;
  published: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export interface UserSubscription {
  id: string;
  user_id: string;
  tier: AccessTier;
  status: SubscriptionStatus;
  created_at: string;
  updated_at: string;
}

export interface AllowedEmail {
  id: string;
  email: string;
  tier: AccessTier;
  status: SubscriptionStatus;
  created_at: string;
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
  content: string;
  created_at: string;
}

export interface LessonAdminNote {
  id: string;
  lesson_id: string;
  content: string;
  created_at: string;
}

export interface LessonResource {
  id: string;
  lesson_id: string;
  title: string;
  file_path: string;
  created_at: string;
}

type Row<T> = { Row: T; Insert: Partial<T>; Update: Partial<T> };

export interface Database {
  public: {
    Tables: {
      categories: Row<Category>;
      modules: Row<Module>;
      lessons: Row<Lesson>;
      profiles: Row<Profile>;
      user_roles: Row<UserRole>;
      user_subscriptions: Row<UserSubscription>;
      allowed_emails: Row<AllowedEmail>;
      lesson_progress: Row<LessonProgress>;
      lesson_favorites: Row<LessonFavorite>;
      lesson_comments: Row<LessonComment>;
      lesson_admin_notes: Row<LessonAdminNote>;
      lesson_resources: Row<LessonResource>;
    };
    Enums: {
      access_tier: AccessTier;
      app_role: AppRole;
    };
    Functions: {
      has_role: { Args: { _user_id: string; _role: AppRole }; Returns: boolean };
      get_user_tier: { Args: { _user_id: string }; Returns: AccessTier };
      tier_allows: { Args: { _user_tier: AccessTier; _content_tier: AccessTier }; Returns: boolean };
      is_email_allowed: { Args: { _email: string }; Returns: boolean };
    };
  };
}