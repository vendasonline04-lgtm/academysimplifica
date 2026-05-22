import { createClient } from "@supabase/supabase-js";

function createAdminClient() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) {
    console.error("[supabase-admin] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados");
    throw new Error("Supabase admin credentials missing");
  }
  return createClient(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

let _admin: ReturnType<typeof createAdminClient> | undefined;

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createAdminClient>, {
  get(_, prop, receiver) {
    if (!_admin) _admin = createAdminClient();
    return Reflect.get(_admin, prop, receiver);
  },
});
