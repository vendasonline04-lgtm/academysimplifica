import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Check, Crown } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/upgrade")({
  head: () => ({ meta: [{ title: "Planos — Academy" }] }),
  component: Upgrade,
});

const plans = [
  {
    tier: "free" as const,
    name: "Free",
    price: "Grátis",
    features: ["Acesso ao conteúdo introdutório", "Comunidade pública", "Suporte por email"],
  },
  {
    tier: "basic" as const,
    name: "Básico",
    price: "R$ 49/mês",
    features: ["Tudo do Free", "Acesso aos módulos básicos", "Recursos para download", "Certificados"],
    highlighted: true,
  },
  {
    tier: "premium" as const,
    name: "Premium",
    price: "R$ 99/mês",
    features: ["Tudo do Básico", "Acesso a todo conteúdo premium", "Mentorias em grupo", "Suporte prioritário"],
  },
];

function Upgrade() {
  const { data } = useCurrentUser();
  const current = data?.tier ?? "free";

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold">Escolha seu plano</h1>
        <p className="mt-2 text-muted-foreground">Desbloqueie todo o conteúdo da Academy.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((p) => {
          const isCurrent = p.tier === current;
          return (
            <div
              key={p.tier}
              className={`glass-card relative rounded-2xl p-8 transition ${p.highlighted ? "shadow-glow ring-2 ring-primary" : ""}`}
            >
              {p.highlighted && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 gradient-primary text-primary-foreground">
                  <Crown className="mr-1 h-3 w-3" /> Popular
                </Badge>
              )}
              <h3 className="text-xl font-bold">{p.name}</h3>
              <p className="mt-2 text-3xl font-bold">{p.price}</p>
              <ul className="mt-6 space-y-3 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                disabled={isCurrent}
                className={`mt-8 w-full ${p.highlighted ? "gradient-primary text-primary-foreground shadow-glow" : ""}`}
                variant={p.highlighted ? "default" : "outline"}
              >
                {isCurrent ? "Plano atual" : "Assinar"}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}