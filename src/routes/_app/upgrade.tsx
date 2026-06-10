import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/_app/upgrade")({
  head: () => ({ meta: [{ title: "Em Breve — Academy" }] }),
  component: Upgrade,
});

function Upgrade() {
  return (
    <div className="flex flex-1 items-center justify-center min-h-[60vh]">
      <div className="glass-card rounded-2xl p-12 text-center max-w-xl space-y-5 shadow-glow">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full gradient-primary shadow-glow">
          <Sparkles className="h-8 w-8 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold leading-snug">
          Muito em breve, todos os cursos estarão aqui pra você acessar!
        </h1>
        <p className="text-muted-foreground text-lg font-medium">Fique de olho!</p>
      </div>
    </div>
  );
}
