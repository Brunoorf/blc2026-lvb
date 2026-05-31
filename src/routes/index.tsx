import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Trophy, ListChecks, BarChart3, ArrowRight, Calendar, Lock } from "lucide-react";
import AuthGate from "@/components/AuthGate";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/")({
  component: () => <AuthGate><Home /></AuthGate>,
});

function Home() {
  const { user, profile } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["home-stats", user?.id],
    queryFn: async () => {
      const [preds, settings, totalMatches, myPoints] = await Promise.all([
        supabase.from("predictions").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
        supabase.from("tournament_settings").select("*").maybeSingle(),
        supabase.from("matches").select("id", { count: "exact", head: true }),
        supabase.from("predictions").select("points_awarded").eq("user_id", user!.id),
      ]);
      const total = (myPoints.data ?? []).reduce((s, r) => s + (r.points_awarded ?? 0), 0);
      return {
        myPredictions: preds.count ?? 0,
        totalMatches: totalMatches.count ?? 0,
        currentPhase: settings.data?.current_phase ?? "groups",
        groupLocked: settings.data?.group_picks_locked ?? false,
        koLocked: settings.data?.knockout_picks_locked ?? false,
        myPoints: total,
      };
    },
    enabled: !!user,
  });

  const phaseLabel = stats?.currentPhase === "groups" ? "Fase de Grupos"
    : stats?.currentPhase === "knockout" ? "Mata-mata"
    : "Encerrado";

  return (
    <div className="space-y-8">
      <section className="rounded-2xl p-8 md:p-12 relative overflow-hidden border border-border" style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-card)" }}>
        <div className="relative z-10 max-w-2xl">
          <p className="text-primary-foreground/80 text-sm font-semibold tracking-wider uppercase mb-2">
            <Calendar className="inline h-4 w-4 mr-1.5" /> Fase atual: {phaseLabel}
          </p>
          <h1 className="text-3xl md:text-5xl font-bold text-primary-foreground mb-3">
            Bem-vindo, {profile?.display_name ?? "jogador"}!
          </h1>
          <p className="text-primary-foreground/90 mb-6 max-w-lg">
            Faça seus palpites na fase de grupos. Quando o admin liberar o mata-mata, complete suas previsões para 16-avos, oitavas, quartas, semis e final.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" variant="secondary">
              <Link to="/palpites">Fazer palpites <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="bg-transparent border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10">
              <Link to="/ranking">Ver ranking</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Trophy} label="Meus pontos" value={stats?.myPoints ?? 0} accent />
        <StatCard icon={ListChecks} label="Palpites enviados" value={`${stats?.myPredictions ?? 0}/${stats?.totalMatches ?? 0}`} />
        <StatCard icon={Lock} label="Grupos travados" value={stats?.groupLocked ? "Sim" : "Não"} />
        <StatCard icon={BarChart3} label="Mata-mata travado" value={stats?.koLocked ? "Sim" : "Não"} />
      </section>

      <section className="grid md:grid-cols-2 gap-4">
        <ActionCard to="/palpites" icon={ListChecks} title="Palpites" desc="Placar das 72 partidas da fase de grupos e jogos do mata-mata." />
        <ActionCard to="/ranking" icon={BarChart3} title="Ranking global" desc="Compare sua pontuação com os demais participantes." />
      </section>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string | number; accent?: boolean }) {
  return (
    <Card className="p-4 flex items-center gap-3 border-border">
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${accent ? "bg-accent text-accent-foreground" : "bg-muted text-foreground"}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold truncate">{value}</p>
      </div>
    </Card>
  );
}

function ActionCard({ to, icon: Icon, title, desc }: { to: string; icon: any; title: string; desc: string }) {
  return (
    <Link to={to}>
      <Card className="p-6 h-full border-border hover:border-primary transition-colors group">
        <Icon className="h-8 w-8 text-primary mb-4" />
        <h3 className="font-bold text-lg mb-1 group-hover:text-primary transition-colors">{title}</h3>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </Card>
    </Link>
  );
}
