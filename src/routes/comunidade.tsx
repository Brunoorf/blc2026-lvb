import { createFileRoute } from "@tanstack/react-router";
import type { RootRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Users, ChevronRight, Check, X, AlertCircle } from "lucide-react";
import AuthGate from "@/components/AuthGate";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import TeamFlag from "@/components/TeamFlag";

export const Route = (createFileRoute as any)("/comunidade")({
  component: () => <AuthGate><Comunidade /></AuthGate>,
});

function Comunidade() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedPhase, setSelectedPhase] = useState<"group" | "r32" | "r16" | "qf" | "sf" | "final">("group");

  const { data, isLoading } = useQuery({
    queryKey: ["comunidade"],
    queryFn: async () => {
      const [profiles, predictions, matches, teams, settings] = await Promise.all([
        supabase.from("profiles").select("id, display_name, avatar_url").order("display_name"),
        supabase.from("predictions").select("*"),
        supabase.from("matches").select("*"),
        supabase.from("teams").select("*"),
        supabase.from("tournament_settings").select("*").maybeSingle(),
      ]);

      return {
        profiles: profiles.data ?? [],
        predictions: predictions.data ?? [],
        matches: matches.data ?? [],
        teams: teams.data ?? [],
        settings: settings.data,
      };
    },
  });

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Carregando...</div>;

  if (!data?.settings?.community_predictions_visible) {
    return (
      <Card className="p-12 text-center max-w-2xl mx-auto border-amber-500/50 bg-amber-500/5">
        <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold mb-2">Visualização desabilitada</h2>
        <p className="text-muted-foreground mb-4">
          O admin desabilitou a visualização de palpites no momento.
        </p>
        <p className="text-sm text-muted-foreground">
          A visualização estará disponível em breve.
        </p>
      </Card>
    );
  }

  const teamsById = new Map((data?.teams ?? []).map((t) => [t.id, t]));
  const matchesById = new Map((data?.matches ?? []).map((m) => [m.id, m]));

  const selected = data?.profiles.find((p) => p.id === selectedUserId);
  const userPreds = selectedUserId
    ? (data?.predictions ?? []).filter((p) => p.user_id === selectedUserId)
    : [];

  const filteredPreds = userPreds
    .filter((p) => {
      const match = matchesById.get(p.match_id);
      return match?.phase === selectedPhase;
    })
    .sort((a, b) => {
      const matchA = matchesById.get(a.match_id);
      const matchB = matchesById.get(b.match_id);
      // Finalizados primeiro (true > false)
      const aFinished = matchA?.is_finished ? 1 : 0;
      const bFinished = matchB?.is_finished ? 1 : 0;
      return bFinished - aFinished;
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Users className="h-7 w-7 text-accent" /> Palpites da Comunidade</h1>
        <p className="text-muted-foreground text-sm">Veja os palpites de outros usuários separado por rodada.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Users list */}
        <Card className="p-4 border-border max-h-[600px] overflow-y-auto">
          <h3 className="font-bold mb-3">Usuários</h3>
          <div className="space-y-2">
            {(data?.profiles ?? []).map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedUserId(p.id)}
                className={`w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors ${
                  selectedUserId === p.id
                    ? "bg-primary/20 border border-primary"
                    : "hover:bg-muted/40"
                }`}
              >
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                    {p.display_name?.[0]?.toUpperCase()}
                  </div>
                )}
                <span className="text-sm flex-1 truncate">{p.display_name}</span>
                {selectedUserId === p.id && <ChevronRight className="h-4 w-4" />}
              </button>
            ))}
          </div>
        </Card>

        {/* Predictions */}
        <div className="md:col-span-2 space-y-4">
          {selected && (
            <>
              <div className="flex items-center gap-3 mb-4">
                {selected.avatar_url ? (
                  <img src={selected.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center font-bold text-lg">
                    {selected.display_name?.[0]?.toUpperCase()}
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-bold">{selected.display_name}</h2>
                  <p className="text-sm text-muted-foreground">Palpites por fase</p>
                </div>
              </div>

              {/* Phase filter */}
              <div className="flex flex-wrap gap-2">
                {(["group", "r32", "r16", "qf", "sf", "final"] as const).map((phase) => (
                  <Button
                    key={phase}
                    size="sm"
                    variant={selectedPhase === phase ? "default" : "outline"}
                    onClick={() => setSelectedPhase(phase)}
                  >
                    {phase === "group" && "Grupos"}
                    {phase === "r32" && "16-avos"}
                    {phase === "r16" && "Oitavas"}
                    {phase === "qf" && "Quartas"}
                    {phase === "sf" && "Semis"}
                    {phase === "final" && "Final"}
                  </Button>
                ))}
              </div>

              {/* Predictions list */}
              <div className="space-y-3">
                {filteredPreds.length === 0 ? (
                  <Card className="p-6 text-center text-muted-foreground">Nenhum palpite nesta fase</Card>
                ) : (
                  filteredPreds.map((pred) => {
                    const match = matchesById.get(pred.match_id);
                    if (!match || !match.home_team_id || !match.away_team_id) return null;

                    const homeTeam = teamsById.get(match.home_team_id);
                    const awayTeam = teamsById.get(match.away_team_id);
                    const isCorrect = pred.points_awarded > 0;

                    return (
                      <Card key={pred.id} className="p-4 border-border">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {homeTeam && <TeamFlag code={homeTeam.code} fallback={homeTeam.flag} size={24} />}
                            <span className="font-medium text-sm">{homeTeam?.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {isCorrect ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <X className="h-4 w-4 text-red-500" />
                            )}
                            <Badge variant={isCorrect ? "default" : "secondary"}>
                              {pred.points_awarded > 0 ? `+${pred.points_awarded}` : "0"}
                            </Badge>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center text-sm mb-3">
                          <div>
                            <p className="text-muted-foreground text-xs">Previsão</p>
                            <p className="font-bold">{pred.home_score}x{pred.away_score}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">Oficial</p>
                            <p className="font-bold">{match.home_score ?? "-"}x{match.away_score ?? "-"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">Status</p>
                            <p className="text-xs">{match.is_finished ? "Finalizado" : "Pendente"}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {awayTeam && <TeamFlag code={awayTeam.code} fallback={awayTeam.flag} size={24} />}
                          <span className="font-medium text-sm">{awayTeam?.name}</span>
                        </div>
                      </Card>
                    );
                  })
                )}
              </div>
            </>
          )}

          {!selected && (
            <Card className="p-12 text-center text-muted-foreground">
              Selecione um usuário para ver seus palpites
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
