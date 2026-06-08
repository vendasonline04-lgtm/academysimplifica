import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GraduationCap, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — Academy Simplifica-AI" }] }),
  component: AuthPage,
});

type Mode = "login" | "signup" | "reset" | "new-password";

function PasswordInput({ id, value, onChange, placeholder, required, minLength, autoComplete }: {
  id: string; value: string; onChange: (v: string) => void;
  placeholder?: string; required?: boolean; minLength?: number; autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        required={required}
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? ""}
        autoComplete={autoComplete ?? "current-password"}
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

function AuthPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  // Detect expired/invalid link errors from Supabase hash
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("error=")) {
      const params = new URLSearchParams(hash.replace(/^#/, ""));
      const desc = params.get("error_description");
      if (desc) toast.error(decodeURIComponent(desc.replace(/\+/g, " ")));
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  // Detect PASSWORD_RECOVERY event (Supabase clears the hash before useEffect sees it)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("new-password");
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (mode !== "new-password" && user) navigate({ to: "/dashboard" });
  }, [user, navigate, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === "signup" && password !== confirm) {
      toast.error("As senhas não coincidem");
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bem-vindo(a) de volta!");
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        });
        if (error) throw error;
        toast.success("Cadastro realizado! Verifique seu email se necessário.");
      } else if (mode === "new-password") {
        if (password !== confirm) {
          toast.error("As senhas não coincidem");
          return;
        }
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        toast.success("Senha atualizada! Entrando na plataforma...");
        // Reload completo para garantir que o Supabase reconheça a nova sessão
        setTimeout(() => { window.location.href = "/dashboard"; }, 1200);
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (error) throw error;
        toast.success("Email de redefinição enviado! Verifique sua caixa de entrada.");
        setMode("login");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  };

  const titles: Record<Mode, string> = {
    login: "Bem-vindo(a) de volta",
    signup: "Criar conta",
    reset: "Redefinir senha",
    "new-password": "Criar nova senha",
  };

  const subtitles: Record<Mode, string> = {
    login: "Entre com seu email e senha",
    signup: "Comece sua jornada na Academy Simplifica-AI",
    reset: "Informe seu email e enviaremos um link para redefinir sua senha",
    "new-password": "Digite e confirme sua nova senha",
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="bg-blob" style={{ width: 500, height: 500, background: "oklch(0.7 0.25 305)", top: -150, right: -150 }} />
      <div className="bg-blob" style={{ width: 500, height: 500, background: "oklch(0.65 0.22 280)", bottom: -200, left: -100 }} />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 flex items-center justify-center gap-2 font-semibold">
            <div className="grid h-9 w-9 place-items-center rounded-xl gradient-primary text-primary-foreground shadow-glow">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="text-lg">Academy Simplifica-AI</span>
          </Link>

          <div className="glass-card rounded-2xl p-8 shadow-glow">
            <h1 className="mb-1 text-2xl font-bold">{titles[mode]}</h1>
            <p className="mb-6 text-sm text-muted-foreground">{subtitles[mode]}</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode !== "new-password" && (
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@email.com"
                  />
                </div>
              )}

              {mode !== "reset" && (
                <div className="space-y-2">
                  <Label htmlFor="password">{mode === "new-password" ? "Nova senha" : "Senha"}</Label>
                  <PasswordInput
                    id="password"
                    value={password}
                    onChange={setPassword}
                    required
                    minLength={6}
                    autoComplete={mode === "new-password" ? "new-password" : "current-password"}
                  />
                </div>
              )}

              {(mode === "signup" || mode === "new-password") && (
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirme a senha</Label>
                  <PasswordInput
                    id="confirm"
                    value={confirm}
                    onChange={setConfirm}
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
              )}

              {mode === "login" && (
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => setMode("reset")}
                    className="text-xs text-primary hover:underline"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full gradient-primary text-primary-foreground shadow-glow"
              >
                {loading
                  ? "Aguarde..."
                  : mode === "login"
                  ? "Entrar"
                  : mode === "signup"
                  ? "Cadastrar"
                  : mode === "new-password"
                  ? "Salvar nova senha"
                  : "Enviar link de redefinição"}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground space-y-2">
              {mode === "login" ? (
                <>
                  Não tem conta?{" "}
                  <button onClick={() => setMode("signup")} className="font-medium text-primary hover:underline">
                    Cadastre-se
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setMode("login")} className="font-medium text-primary hover:underline">
                    ← Voltar para o login
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
