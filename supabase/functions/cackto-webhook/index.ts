import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SB_SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const MASTER_SECRET = Deno.env.get("CACKTO_SECRET") ?? "";

const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), {
    status: s,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });

function timingSafeEq(a: string, b: string) {
  if (a.length !== b.length) return false;
  let res = 0;
  for (let i = 0; i < a.length; i++) res |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return res === 0;
}

function mapStatus(event: string) {
  const e = event.toLowerCase();
  if (e === "purchase_approved" || e === "subscription_renewed") return "paid";
  if (e === "refund" || e === "chargeback") return "refunded";
  if (e === "subscription_canceled" || e === "purchase_refused") return "canceled";
  if (["pix_gerado", "boleto_gerado", "initiate_checkout", "abandono_de_checkout"].includes(e))
    return "pending";
  return null;
}

async function findProduct(sb: ReturnType<typeof createClient>, incomingSecret: string, offerName: string | null) {
  if (incomingSecret) {
    const { data } = await sb.from("webhook_products").select("id, category_ids").eq("cackto_secret", incomingSecret).limit(1);
    if (data?.length) return data[0];
  }
  if (!offerName) return null;
  const { data } = await sb.from("webhook_products").select("id, category_ids").ilike("name", offerName.trim());
  if (data?.length) return data[0];
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });

  if (req.method !== "POST")
    return json({ ok: true, message: "Cackto webhook endpoint. Use POST." });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const incoming = (body.secret as string) ?? "";
  if (!MASTER_SECRET || !timingSafeEq(incoming, MASTER_SECRET)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const sb = createClient(SB_URL, SB_SVC, { auth: { autoRefreshToken: false, persistSession: false } });

  const event = (body.event as string) ?? "unknown";

  // Cakto envia body.data como array — suporta tanto array quanto objeto
  const rawData = body.data ?? {};
  const data = (Array.isArray(rawData) ? (rawData[0] ?? {}) : rawData) as Record<string, unknown>;

  const customer = (data.customer as Record<string, unknown>) ?? {};
  const offer = (data.offer as Record<string, unknown>) ?? {};
  const email = (customer.email as string)?.toLowerCase();
  const offerId = (offer.id ?? (data.product as Record<string, unknown>)?.id ?? null) as string | null;
  const offerName = (offer.name ?? (data.product as Record<string, unknown>)?.name ?? null) as string | null;
  const orderId = (data.id as string) ?? `evt-${Date.now()}`;
  const status = mapStatus(event);

  // Comissão do produtor (já líquida da taxa da Cakto) — array em data.commissions
  const commissions = Array.isArray(data.commissions) ? (data.commissions as Record<string, unknown>[]) : [];
  const producerCommission = commissions.find((c) => c.type === "producer") ?? commissions[0];
  const netAmount = typeof producerCommission?.totalAmount === "number"
    ? Math.round((producerCommission.totalAmount as number) * 100)
    : null;

  if (!email) return json({ error: "No customer email" }, 400);

  // Idempotência — salva evento bruto
  const externalId = `${orderId}:${event}`;
  const { error: dupErr } = await sb.from("cackto_orders").insert({
    external_id: externalId,
    event,
    status: status ?? "unknown",
    email,
    name: (customer.name as string) ?? null,
    phone: customer.phone ? String(customer.phone) : null,
    cpf: customer.docNumber ? String(customer.docNumber).replace(/\D/g, "").slice(0, 11) : null,
    offer_id: offerId,
    offer_name: offerName,
    amount: typeof data.amount === "number" ? Math.round(data.amount * 100) : null,
    net_amount: netAmount,
  }).select("id").single();

  if (dupErr) {
    if (dupErr.code === "23505") return json({ ok: true, duplicate: true });
    console.error("[webhook] cackto_orders insert error", dupErr);
  }

  if (!status) return json({ ok: true, skipped: "event_ignored", event });

  const product = await findProduct(sb, incoming, offerName);
  const shouldActivate = status === "paid";
  const shouldRevoke = status === "refunded" || status === "canceled";

  if (shouldActivate) {
    await sb.from("allowed_emails").upsert(
      { email, tier: "basic", status: "active", external_order_id: orderId },
      { onConflict: "email" }
    );

    const { data: users } = await sb.auth.admin.listUsers({ perPage: 1000 });
    const authUser = users?.users?.find((u) => u.email?.toLowerCase() === email);

    if (authUser) {
      await sb.from("user_subscriptions").upsert(
        {
          user_id: authUser.id,
          tier: "basic",
          status: "active",
          payment_provider: "cackto",
          external_id: orderId,
          started_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      if (product && (product.category_ids as string[]).length > 0) {
        const rows = (product.category_ids as string[]).map((cid) => ({
          user_id: authUser.id,
          category_id: cid,
          product_id: product.id,
          external_order_id: orderId,
        }));
        await sb.from("user_category_access").upsert(rows, { onConflict: "user_id,category_id" });
      }
    } else {
      // Aluno ainda não tem conta — envia email de convite para criar acesso
      try {
        await sb.auth.admin.inviteUserByEmail(email, {
          data: { full_name: (customer.name as string) ?? "" },
          redirectTo: "https://academy.simplifica-ai.com/meuprimeiroacesso",
        });
      } catch (inviteErr) {
        console.error("[webhook] invite email error", inviteErr);
      }
    }

    return json({ ok: true, processed: true, status, event, product_matched: !!product });
  }

  if (shouldRevoke) {
    await sb.from("allowed_emails").update({ status: "canceled" }).eq("email", email);

    const { data: users } = await sb.auth.admin.listUsers({ perPage: 1000 });
    const authUser = users?.users?.find((u) => u.email?.toLowerCase() === email);

    if (authUser) {
      await sb.from("user_subscriptions")
        .update({ status: "canceled", expires_at: new Date().toISOString() })
        .eq("user_id", authUser.id);

      if (product) {
        await sb.from("user_category_access").delete().eq("user_id", authUser.id).eq("product_id", product.id);
      }
    }

    return json({ ok: true, processed: true, status, event });
  }

  return json({ ok: true, skipped: "unhandled_event", event });
});
