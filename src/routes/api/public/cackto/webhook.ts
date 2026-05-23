import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });

function timingSafeEq(a: string, b: string) {
  if (a.length !== b.length) return false;
  let res = 0;
  for (let i = 0; i < a.length; i++) res |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return res === 0;
}

function mapStatus(event: string): "paid" | "refunded" | "canceled" | "pending" | null {
  const e = event.toLowerCase();
  if (e === "purchase_approved" || e === "subscription_renewed") return "paid";
  if (e === "refund" || e === "chargeback") return "refunded";
  if (e === "subscription_canceled" || e === "purchase_refused") return "canceled";
  if (["pix_gerado", "boleto_gerado", "initiate_checkout"].includes(e)) return "pending";
  return null;
}

async function getAuthUserByEmail(email: string) {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1_000 });
  if (error) {
    console.error("[webhook] auth users lookup error", error);
    return null;
  }
  return data.users.find((user) => user.email?.toLowerCase() === email) ?? null;
}

// Busca o produto pelo nome da oferta (match exato ou parcial)
async function findProductByOfferName(offerName: string | null): Promise<{ id: string; category_ids: string[] } | null> {
  if (!offerName) return null;
  const { data } = await supabaseAdmin
    .from("webhook_products")
    .select("id, category_ids")
    .ilike("name", offerName.trim());
  if (data && data.length > 0) return data[0] as { id: string; category_ids: string[] };
  return null;
}

// Concede acesso às categorias do produto para o usuário
async function grantCategoryAccess(userId: string, productId: string, categoryIds: string[], orderId: string) {
  if (!categoryIds.length) return;
  const rows = categoryIds.map((category_id) => ({
    user_id: userId,
    category_id,
    product_id: productId,
    external_order_id: orderId,
  }));
  const { error } = await supabaseAdmin
    .from("user_category_access")
    .upsert(rows, { onConflict: "user_id,category_id" });
  if (error) console.error("[webhook] user_category_access upsert error", error);
}

// Revoga acesso às categorias que vieram de um determinado produto
async function revokeCategoryAccess(userId: string, productId: string) {
  const { error } = await supabaseAdmin
    .from("user_category_access")
    .delete()
    .eq("user_id", userId)
    .eq("product_id", productId);
  if (error) console.error("[webhook] user_category_access delete error", error);
}

export const Route = createFileRoute("/api/public/cackto/webhook")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async () => json({ ok: true, message: "Cackto webhook — use POST" }),
      POST: async ({ request }) => {
        // 1) Validar secret
        const secrets = (process.env.CACKTO_WEBHOOK_SECRET ?? "")
          .split(",").map((s) => s.trim()).filter(Boolean);
        if (!secrets.length) return json({ error: "server misconfigured" }, 500);

        let payload: any;
        try { payload = await request.json(); } catch { return json({ error: "invalid json" }, 400); }

        const incoming: string = payload?.secret ?? payload?.fields?.secret ?? "";
        if (!incoming || !secrets.some((s) => timingSafeEq(incoming, s)))
          return json({ error: "invalid secret" }, 401);

        const event: string = payload?.event ?? "unknown";
        const data: any = payload?.data ?? {};
        const orderId: string = data?.id ?? `evt-${Date.now()}`;
        const customer = data?.customer ?? {};
        const email = customer?.email?.toLowerCase().trim() ?? null;
        const name = customer?.name ?? null;
        const phone = customer?.phone ? String(customer.phone) : null;
        const cpfRaw = customer?.docNumber ?? customer?.cpf ?? null;
        const cpf = cpfRaw ? String(cpfRaw).replace(/\D/g, "").slice(0, 11) : null;
        const offerId = data?.offer?.id ?? data?.product?.id ?? null;
        const offerName = data?.offer?.name ?? data?.product?.name ?? null;
        const amount = typeof data?.amount === "number" ? data.amount : null;
        const status = mapStatus(event);

        // 2) Idempotência
        const externalId = `${orderId}:${event}`;
        const { error: dupErr } = await supabaseAdmin
          .from("cackto_orders")
          .insert({ external_id: externalId, event, status: status ?? "unknown", email, name, phone, cpf, offer_id: offerId, offer_name: offerName, amount })
          .select("id").single();

        if (dupErr) {
          if ((dupErr as any).code === "23505") return json({ ok: true, duplicate: true });
          console.error("[webhook] cackto_orders insert error", dupErr);
        }

        if (!status) return json({ ok: true, skipped: "event_ignored", event });

        // 3) Sincroniza acesso
        if (email) {
          const shouldActivate = status === "paid";
          const shouldRevoke = status === "refunded" || status === "canceled";

          // Busca produto configurado no admin pelo nome da oferta
          const product = await findProductByOfferName(offerName);

          // Determina tier: pelo produto configurado → pelo mapa de env → default
          const offerMap = parseOfferMap(process.env.CACKTO_OFFER_MAP ?? "");
          const tier = offerMap[offerId ?? ""] ?? process.env.CACKTO_DEFAULT_TIER ?? "basic";

          if (shouldActivate) {
            await supabaseAdmin.from("allowed_emails").upsert(
              { email, tier, status: "active", external_order_id: orderId },
              { onConflict: "email" }
            );

            const authUser = await getAuthUserByEmail(email);
            if (authUser) {
              await supabaseAdmin.from("user_subscriptions").upsert(
                { user_id: authUser.id, tier, status: "active", payment_provider: "cackto", external_id: orderId },
                { onConflict: "user_id" }
              );

              // Concede acesso granular por categoria (via produto configurado no admin)
              if (product && product.category_ids.length > 0) {
                await grantCategoryAccess(authUser.id, product.id, product.category_ids, orderId);
              }
            }
          } else if (shouldRevoke) {
            await supabaseAdmin.from("allowed_emails")
              .update({ status: "canceled" }).eq("email", email);

            const authUser = await getAuthUserByEmail(email);
            if (authUser) {
              await supabaseAdmin.from("user_subscriptions")
                .update({ status: "canceled" }).eq("user_id", authUser.id);

              // Revoga acesso às categorias do produto
              if (product) {
                await revokeCategoryAccess(authUser.id, product.id);
              }
            }
          }
        }

        return json({ ok: true, status, event });
      },
    },
  },
});

function parseOfferMap(raw: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const pair of raw.split(",")) {
    const [k, v] = pair.split(":").map((s) => s.trim());
    if (k && v) map[k] = v;
  }
  return map;
}
