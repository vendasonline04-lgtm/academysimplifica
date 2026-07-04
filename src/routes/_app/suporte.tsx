import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";

export const Route = createFileRoute("/_app/suporte")({
  head: () => ({ meta: [{ title: "Suporte — Academy" }] }),
  component: Suporte,
});

function Suporte() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Suporte</h1>
      <div className="glass-card space-y-4 rounded-2xl p-8">
        <p className="text-muted-foreground">
          Precisa de ajuda? Nossa equipe responde em até 24h úteis. Envie sua dúvida ou solicitação por email e
          retornaremos o mais rápido possível.
        </p>
        <Button asChild className="gradient-primary text-primary-foreground shadow-glow">
          <a href="mailto:contato@simplifica-ai.com">
            <Mail className="mr-2 h-4 w-4" /> contato@simplifica-ai.com
          </a>
        </Button>
      </div>
    </div>
  );
}