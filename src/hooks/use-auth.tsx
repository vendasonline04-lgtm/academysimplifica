import { useEffect, useState, createContext, useContext, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { AccessTier, UserSubscription } from "@/lib/database.types";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

const Ctx = createContext<AuthCtx>({ user: null, session: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      qc.invalidateQueries();
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, [qc]);

  return (
    <Ctx.Provider value={{ user: session?.user ?? null, session, loading }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}

export function useCurrentUser() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["current-user", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return null;
      const [tierRes, adminRes, subRes] = await Promise.all([
        supabase.rpc("get_user_tier" as never, { _user_id: user.id } as never),
        supabase.rpc("has_role" as never, { _user_id: user.id, _role: "admin" } as never),
        supabase.from("user_subscriptions").select("*").eq("user_id", user.id).maybeSingle(),
      ]);
      return {
        user,
        tier: ((tierRes.data as AccessTier | null) ?? "free") as AccessTier,
        isAdmin: !!adminRes.data,
        subscription: (subRes.data ?? null) as UserSubscription | null,
      };
    },
  });
}

export function tierAllows(userTier: AccessTier, contentTier: AccessTier): boolean {
  const rank: Record<AccessTier, number> = { free: 0, basic: 1, premium: 2 };
  return rank[userTier] >= rank[contentTier];
}

export function isModuleUnlocked(subscriptionCreatedAt: string | null | undefined, delayDays: number): boolean {
  if (!delayDays || delayDays <= 0) return true;
  if (!subscriptionCreatedAt) return false;
  const start = new Date(subscriptionCreatedAt).getTime();
  return Date.now() - start >= delayDays * 86_400_000;
}