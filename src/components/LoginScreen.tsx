import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import { useState } from "react";
import heroImg from "@/assets/hero-stadium.jpg";

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);

  async function handleGoogle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Não foi possível entrar. Tente novamente.");
      setLoading(false);
      return;
    }
    if (result.redirected) return;
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

        <Button onClick={handleGoogle} disabled={loading} size="lg" className="w-full h-12 text-base font-semibold gap-3">
          <svg className="h-5 w-5" viewBox="0 0 24 24"><path fill="currentColor" d="M21.35 11.1H12v3.2h5.35c-.23 1.5-1.66 4.4-5.35 4.4-3.22 0-5.85-2.66-5.85-5.95s2.63-5.95 5.85-5.95c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.79 4.18 14.6 3.2 12 3.2 6.94 3.2 2.85 7.29 2.85 12.35S6.94 21.5 12 21.5c6.93 0 9.5-4.86 9.5-7.4 0-.5-.05-.88-.15-1.27z"/></svg>
          {loading ? "Entrando..." : "Entrar com Google"}
        </Button>

        <p className="mt-6 text-xs text-muted-foreground">
          O primeiro usuário a entrar se torna administrador.
        </p>
      </div>
    </div>
  );
}