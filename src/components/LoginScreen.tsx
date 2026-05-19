import { Trophy, Mail, LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import heroImg from "@/assets/hero-stadium.jpg";

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Preencha e-mail e senha.");
      return;
    }
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (isSignUp && !displayName.trim()) {
      toast.error("Preencha seu nome.");
      return;
    }

    setLoading(true);

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: displayName.trim() } },
      });
      if (error) {
        console.error("Erro no signup:", error);
        toast.error(error.message);
      } else {
        toast.success("Conta criada! Você já está logado.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        console.error("Erro no login:", error);
        if (error.message.includes("Invalid login")) {
          toast.error("E-mail ou senha incorretos.");
        } else {
          toast.error(error.message);
        }
      }
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 bg-background text-foreground overflow-hidden">
      <img src={heroImg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-25" width={1536} height={1024} />
      <div className="absolute inset-0" style={{ background: "var(--gradient-hero)" }} />

      <div className="relative z-10 w-full max-w-md text-center">
        <div className="mx-auto h-20 w-20 rounded-2xl flex items-center justify-center mb-6" style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}>
          <Trophy className="h-10 w-10 text-primary-foreground" />
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3">
          Bolão da <span className="text-primary">Copa 2026</span>
        </h1>
        <p className="text-muted-foreground mb-8">
          48 seleções. 12 grupos. Um campeão. Faça seus palpites e dispute o ranking.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <Input
              type="text"
              placeholder="Seu nome (ex: João Silva)"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="h-12 bg-background/50 backdrop-blur"
              required
              autoComplete="name"
            />
          )}
          <Input
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 bg-background/50 backdrop-blur"
            required
          />
          <Input
            type="password"
            placeholder="Senha (mínimo 6 caracteres)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 bg-background/50 backdrop-blur"
            required
            minLength={6}
          />
          <Button type="submit" disabled={loading} size="lg" className="w-full h-12 text-base font-semibold gap-3">
            {isSignUp ? <UserPlus className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
            {loading ? "Carregando..." : isSignUp ? "Criar conta" : "Entrar"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setIsSignUp(!isSignUp)}
          className="mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {isSignUp ? "Já tem conta? Entrar" : "Não tem conta? Criar agora"}
        </button>

        <p className="mt-4 text-xs text-muted-foreground">
          Bolão interno — peça o link de acesso ao organizador.
        </p>
      </div>
    </div>
  );
}