import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cackto/diag")({
  server: {
    handlers: {
      GET: async () => {
        const s = process.env.CACKTO_WEBHOOK_SECRET ?? "";
        const list = s.split(",").map((x) => x.trim()).filter(Boolean);
        return new Response(
          JSON.stringify({
            configured: list.length > 0,
            count: list.length,
            supabase_url: process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "não configurado",
            service_role_key: process.env.SUPABASE_SERVICE_ROLE_KEY ? "configurado" : "AUSENTE",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
