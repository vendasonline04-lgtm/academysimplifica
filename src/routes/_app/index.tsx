import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ArrowRight, GraduationCap } from "lucide-react";

export const Route = createFileRoute("/_app/")({
  head: () => ({
    meta: [
      { title: "Academy — Sua área de membros em um só lugar" },
      { name: "description", content: "Acesso exclusivo a cursos em vídeo, módulos e aulas em uma plataforma moderna." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="bg-blob" style={{ width: 500, height: 500, background: "oklch(0.7 0.25 305)", top: -150, left: -150 }} />
      <div className="bg-blob" style={{ width: 600, height: 600, background: "oklch(0.65 0.22 280)", bottom: -200, right: -200 }} />
      <div className="bg-blob" style={{ width: 400, height: 400, background: "oklch(0.75 0.2 330)", top: "40%", left: "50%" }} />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 md:px-12">
        <div className="flex items-center gap-2 font-semibold text-lg">
          <div className="grid h-9 w-9 place-items-center rounded-xl gradient-primary text-primary-foreground shadow-glow">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="font-[Space_Grotesk]">Academy</span>
        </div>
        <Button asChild variant="ghost">
          <Link to="/auth">Entrar</Link>
        </Button>
      </header>

      <main className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-6 pt-16 pb-24 text-center md:pt-28">
        <Badge variant="secondary" className="glass-card mb-6 gap-1 rounded-full px-4 py-1.5 text-xs font-medium">
          <Sparkles className="h-3 w-3 text-primary" />
          Acesso Exclusivo
        </Badge>

        <h1 className="text-5xl font-bold tracking-tight md:text-7xl">
          Sua área de membros
          <br />
          <span className="bg-gradient-to-r from-primary to-[oklch(0.7_0.25_330)] bg-clip-text text-transparent">
            em um só lugar
          </span>
        </h1>

        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Cursos em vídeo, módulos organizados e progresso acompanhado. Tudo em uma experiência fluida e bonita.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="gradient-primary text-primary-foreground shadow-glow hover:opacity-95">
            <Link to="/auth">
              Acessar agora <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="glass-card">
            <Link to="/auth">Já sou aluno</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
