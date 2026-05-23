import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS webhook_products (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text        NOT NULL,
  price        integer     NOT NULL DEFAULT 0,
  category_ids uuid[]      NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE webhook_products ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'webhook_products' AND policyname = 'admin_manage_webhook_products'
  ) THEN
    CREATE POLICY "admin_manage_webhook_products" ON webhook_products FOR ALL
      USING (EXISTS (
        SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
      ));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS user_category_access (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id       uuid        NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  product_id        uuid        REFERENCES webhook_products(id) ON DELETE SET NULL,
  external_order_id text,
  granted_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category_id)
);

ALTER TABLE user_category_access ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_category_access' AND policyname = 'users_read_own_category_access'
  ) THEN
    CREATE POLICY "users_read_own_category_access" ON user_category_access FOR SELECT
      USING (user_id = auth.uid());
    CREATE POLICY "admin_manage_category_access" ON user_category_access FOR ALL
      USING (EXISTS (
        SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
      ));
  END IF;
END $$;
`;

export const Route = createFileRoute("/api/admin/run-migration")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        }),

      POST: async ({ request }) => {
        // 1) Verificar admin via JWT
        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.replace("Bearer ", "").trim();
        if (!token) return json({ error: "unauthorized" }, 401);

        const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
        if (authErr || !user) return json({ error: "unauthorized" }, 401);

        const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
          _user_id: user.id,
          _role: "admin",
        } as any);
        if (!isAdmin) return json({ error: "forbidden" }, 403);

        // 2) PAT enviado no body
        let body: any;
        try { body = await request.json(); } catch { return json({ error: "invalid json" }, 400); }
        const pat: string = body?.pat ?? "";
        if (!pat) return json({ error: "pat_required", message: "Envie seu Supabase Personal Access Token no campo 'pat'." }, 400);

        // 3) Descobrir project ref via URL do Supabase
        const supabaseUrl: string = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
        const projectRef = supabaseUrl.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] ?? "";
        if (!projectRef) return json({ error: "Não foi possível determinar o project ref do Supabase." }, 500);

        // 4) Chamar Management API
        const mgmtRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${pat}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: MIGRATION_SQL }),
        });

        if (!mgmtRes.ok) {
          const detail = await mgmtRes.text();
          return json({ error: "Migration falhou", detail }, 500);
        }

        return json({ ok: true });
      },
    },
  },
});
