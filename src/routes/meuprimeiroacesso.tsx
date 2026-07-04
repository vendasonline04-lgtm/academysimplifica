import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GraduationCap, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/meuprimeiroacesso")({
  head: () => ({ meta: [{ title: "Primeiro Acesso — Academy Simplifica-AI" }] }),
  component: MeuPrimeiroAcessoPage,
});

function PasswordInput({
  id, value, onChange, placeholder, autoComplete,
}: {
  id: string; value: string; onChange: (v: string) => void;
  placeholder?: string; autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        required
        minLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? ""}
        autoComplete={autoComplete ?? "new-password"}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        tabIndex={-1}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function translateError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("user already registered")) return "Este email já possui uma conta. Use a tela de login ou redefina sua senha.";
  if (m.includes("password should be at least")) return "A senha deve ter pelo menos 6 caracteres.";
  if (m.includes("invalid email")) return "Email inválido. Verifique e tente novamente.";
  if (m.includes("rate limit")) return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  return msg;
}

function MeuPrimeiroAcessoPage() {
  const navigate = useNavigate();
  const [isInviteFlow, setIsInviteFlow] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  useEffect(() => {
    // Detecta se o aluno chegou pelo link do email de convite
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "USER_UPDATED") && session?.user) {
        setIsInviteFlow(true);
        setInviteEmail(session.user.email ?? "");
      }
    });

    // Verifica erro no hash (ex: link expirado)
    const hash = window.location.hash;
    if (hash.includes("error=")) {
      const params = new URLSearchParams(hash.replace(/^#/, ""));
      const desc = params.get("error_description");
      if (desc) toast.error(decodeURIComponent(desc.replace(/\+/g, " ")));
      window.history.replaceState(null, "", window.location.pathname);
    }

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInlineError(null);

    if (password !== confirm) {
      toast.error("As senhas não coincidem");
      return;
    }
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setLoading(true);
    try {
      if (isInviteFlow) {
        // Aluno veio pelo link do email — só precisa definir a senha
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
      } else {
        // Acesso direto — cria conta com o email da compra
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      }

      setDone(true);
      toast.success("Conta criada! Entrando na plataforma...");
      setTimeout(() => { window.location.href = "/dashboard"; }, 1500);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Erro inesperado";
      const msg = translateError(raw);
      setInlineError(msg);
      toast.error(msg, { duration: 6000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div
        className="bg-blob"
        style={{ width: 500, height: 500, background: "oklch(0.7 0.25 305)", top: -150, right: -150 }}
      />
      <div
        className="bg-blob"
        style={{ width: 500, height: 500, background: "oklch(0.65 0.22 280)", bottom: -200, left: -100 }}
      />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center justify-center gap-2 font-semibold">
            <div className="grid h-9 w-9 place-items-center rounded-xl gradient-primary text-primary-foreground shadow-glow">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="text-lg">Academy Simplifica-AI</span>
          </div>

          <div className="glass-card rounded-2xl p-8 shadow-glow">
            {done ? (
              <div className="flex flex-col items-center gap-5 py-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-xl font-bold">Tudo pronto!</h2>
                  <p className="text-sm text-muted-foreground">Entrando na plataforma...</p>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <h1 className="text-2xl font-bold">Bem-vindo(a)!</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {isInviteFlow
                      ? "Sua compra foi confirmada! Crie sua senha para acessar a plataforma."
                      : "Faça seu primeiro acesso. Use o mesmo email da sua compra."}
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {isInviteFlow ? (
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input value={inviteEmail} disabled className="opacity-70" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="email">Email da compra</Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="voce@email.com"
                        autoComplete="email"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="password">Crie sua senha</Label>
                    <PasswordInput
                      id="password"
                      value={password}
                      onChange={setPassword}
                      placeholder="Mínimo 6 caracteres"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm">Confirme a senha</Label>
                    <PasswordInput
                      id="confirm"
                      value={confirm}
                      onChange={setConfirm}
                      placeholder="Repita a senha"
                    />
                  </div>

                  {inlineError && (
                    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      <span className="mt-0.5 shrink-0">⚠️</span>
                      <span>{inlineError}</span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full gradient-primary text-primary-foreground shadow-glow"
                  >
                    {loading ? "Criando sua conta..." : "Criar conta e entrar"}
                  </Button>
                </form>

                <p className="mt-6 text-center text-xs text-muted-foreground">
                  Já tem conta?{" "}
                  <a href="/auth" className="font-medium text-primary hover:underline">
                    Fazer login
                  </a>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
