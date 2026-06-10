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

function translateSupabaseError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("new password should be different")) return "A nova senha deve ser diferente da senha anterior. Por favor, escolha uma senha diferente.";
  if (m.includes("password should be at least")) return "A senha deve ter pelo menos 6 caracteres.";
  if (m.includes("invalid login credentials") || m.includes("invalid email or password")) return "Email ou senha incorretos. Verifique seus dados.";
  if (m.includes("email not confirmed")) return "Email não confirmado. Verifique sua caixa de entrada.";
  if (m.includes("user already registered")) return "Este email já está cadastrado. Faça login ou redefina sua senha.";
  if (m.includes("rate limit")) return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  if (m.includes("token") && m.includes("expired")) return "O link expirou. Solicite um novo link de redefinição de senha.";
  return msg;
}

function AuthPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [subscriptionBlocked] = useState(
    () => new URLSearchParams(window.location.search).get("acesso") === "bloqueado"
  );

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("error=")) {
      const params = new URLSearchParams(hash.replace(/^#/, ""));
      const desc = params.get("error_description");
      if (desc) toast.error(decodeURIComponent(desc.replace(/\+/g, " ")));
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("new-password");
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (subscriptionBlocked) {
      // Desloga o usuário bloqueado para evitar navegação direta
      supabase.auth.signOut();
      return;
    }
    if (mode !== "new-password" && user) navigate({ to: "/dashboard" });
  }, [user, navigate, mode, subscriptionBlocked]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInlineError(null);

    if (mode === "signup" && password !== confirm) {
      toast.error("As senhas não coincidem");
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        const { error, data: loginData } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Registra último acesso
        if (loginData.user) {
          supabase.rpc("record_user_event" as never, { p_user_id: loginData.user.id, p_event: "login" } as never).then(() => {});
        }
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
        const { error, data: updData } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        // Registra que conseguiu resetar a senha
        if (updData.user) {
          supabase.rpc("record_user_event" as never, { p_user_id: updData.user.id, p_event: "password_reset" } as never).then(() => {});
        }
        toast.success("Senha atualizada! Entrando na plataforma...");
        setTimeout(() => { window.location.href = "/dashboard"; }, 1200);
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (error) throw error;
        setResetSent(true);
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Erro inesperado";
      const translated = translateSupabaseError(raw);
      setInlineError(translated);
      toast.error(translated, { duration: 6000 });
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
            {subscriptionBlocked && (
              <div className="mb-6 rounded-xl border border-orange-200 bg-orange-50 p-4 text-center space-y-2">
                <p className="text-2xl">🔒</p>
                <p className="font-bold text-orange-800 text-base">Acesso bloqueado</p>
                <p className="text-sm text-orange-700 leading-relaxed">
                  Sua assinatura está inativa ou cancelada.<br />
                  Para acessar a plataforma, renove seu acesso e faça login novamente.
                </p>
              </div>
            )}
            {resetSent ? (
              <div className="flex flex-col items-center gap-5 py-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-bold text-foreground">Email enviado!</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Enviamos um link de redefinição para<br />
                    <strong className="text-foreground">{email}</strong>
                  </p>
                </div>
                <div className="w-full rounded-xl border border-green-200 bg-green-50 p-4 text-left space-y-2">
                  <p className="text-sm font-semibold text-green-800">O que fazer agora:</p>
                  <ol className="text-sm text-green-700 space-y-1 list-decimal list-inside">
                    <li>Abra seu email</li>
                    <li>Procure o email da Academy Simplifica-AI</li>
                    <li>Clique no botão <strong>"Redefinir senha"</strong></li>
                    <li>Crie sua nova senha</li>
                  </ol>
                </div>
                <p className="text-xs text-muted-foreground">
                  Não recebeu? Verifique a pasta de spam ou{" "}
                  <button
                    type="button"
                    onClick={() => { setResetSent(false); setEmail(""); }}
                    className="font-medium text-primary hover:underline"
                  >
                    tente com outro email
                  </button>
                </p>
              </div>
            ) : (
              <div>
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
                    <span>
                      Não tem conta?{" "}
                      <button onClick={() => setMode("signup")} className="font-medium text-primary hover:underline">
                        Cadastre-se
                      </button>
                    </span>
                  ) : (
                    <button onClick={() => setMode("login")} className="font-medium text-primary hover:underline">
                      ← Voltar para o login
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
