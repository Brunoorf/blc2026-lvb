import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Trophy, Medal, Star, ChevronDown, ChevronUp } from "lucide-react";
import AuthGate from "@/components/AuthGate";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/ranking")({
  component: () => <AuthGate><Ranking /></AuthGate>,
});

function Ranking() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["ranking"],
    queryFn: async () => {
      const [profiles, preds, ko, special, teams] = await Promise.all([
        supabase.from("profiles").select("id, display_name, avatar_url"),
        supabase.from("predictions").select("user_id, points_awarded"),
        supabase.from("knockout_predictions").select("user_id, points_awarded"),
        supabase.from("special_predictions").select("*"),
        supabase.from("teams").select("*"),
      ]);

      // Compute detailed breakdowns per user
      const matchPts = new Map<string, number>();
      const koPts = new Map<string, number>();
      const specialPts = new Map<string, number>();

      (preds.data ?? []).forEach((r) => matchPts.set(r.user_id, (matchPts.get(r.user_id) ?? 0) + (r.points_awarded ?? 0)));
      (ko.data ?? []).forEach((r) => koPts.set(r.user_id, (koPts.get(r.user_id) ?? 0) + (r.points_awarded ?? 0)));
      (special.data ?? []).forEach((r) => specialPts.set(r.user_id, (specialPts.get(r.user_id) ?? 0) + (r.points_awarded ?? 0)));

      const specialByUserId = new Map((special.data ?? []).map((s) => [s.user_id, s]));
      const teamsById = new Map((teams.data ?? []).map((t) => [t.id, t]));

      return (profiles.data ?? []).map((p) => {
        const sp = specialByUserId.get(p.id);
        const champion = sp?.champion_team_id ? teamsById.get(sp.champion_team_id) : null;
        const underdog = sp?.underdog_team_id ? teamsById.get(sp.underdog_team_id) : null;
        const mp = matchPts.get(p.id) ?? 0;
        const kp = koPts.get(p.id) ?? 0;
        const spp = specialPts.get(p.id) ?? 0;
        return {
          ...p,
          points: mp + kp + spp,
          breakdown: { match: mp, knockout: kp, special: spp },
          special: {
            champion: champion?.name ?? "",
            underdog: underdog?.name ?? "",
            topScorer: sp?.top_scorer ?? ""
          }
        };
      }).sort((a, b) => b.points - a.points);
    },
  });

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Trophy className="h-7 w-7 text-accent" /> Ranking global</h1>
        <p className="text-muted-foreground text-sm">Pontuação acumulada de todos os participantes.</p>
      </div>

      <Card className="border-border overflow-hidden">
        {(data ?? []).length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">Ninguém pontuou ainda.</div>
        ) : (
          <div className="divide-y divide-border">
            {data!.map((row, idx) => (
              <RankingRow key={row.id} row={row} idx={idx} isMe={row.id === user?.id} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function RankingRow({ row, idx, isMe }: { row: any; idx: number; isMe: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const medal = idx === 0 ? "text-yellow-400" : idx === 1 ? "text-gray-300" : idx === 2 ? "text-amber-600" : "";

  return (
    <div className={`${isMe ? "bg-primary/10" : ""}`}>
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-8 text-center font-bold">
          {idx < 3 ? <Medal className={`h-5 w-5 mx-auto ${medal}`} /> : <span className="text-muted-foreground">{idx + 1}</span>}
        </div>
        {row.avatar_url ? (
          <img src={row.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center font-bold text-sm">
            {row.display_name?.[0]?.toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{row.display_name} {isMe && <span className="text-xs text-primary">(você)</span>}</p>
          {(row.special.champion || row.special.underdog) && (
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              {row.special.champion && <span title="Aposta de Campeão" className="flex items-center gap-1"><Trophy className="h-3 w-3 text-accent" /> {row.special.champion}</span>}
              {row.special.underdog && <span title="Aposta de Zebra" className="flex items-center gap-1"><Star className="h-3 w-3" /> {row.special.underdog}</span>}
            </div>
          )}
        </div>
        <div className="text-right flex items-center gap-2">
          <div>
            <p className="font-bold text-lg">{row.points}</p>
            <p className="text-xs text-muted-foreground">pts</p>
          </div>
          {row.points > 0 && (
            expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Breakdown expandido */}
      {expanded && row.points > 0 && (
        <div className="px-4 pb-4 pt-0 ml-11">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-md bg-muted/40">
              <p className="text-xs text-muted-foreground">Jogos</p>
              <p className="text-sm font-bold">{row.breakdown.match}</p>
            </div>
            <div className="p-2 rounded-md bg-muted/40">
              <p className="text-xs text-muted-foreground">Mata-mata</p>
              <p className="text-sm font-bold">{row.breakdown.knockout}</p>
            </div>
            <div className="p-2 rounded-md bg-muted/40">
              <p className="text-xs text-muted-foreground">Especiais</p>
              <p className="text-sm font-bold">{row.breakdown.special}</p>
            </div>
          </div>
          {row.special.topScorer && (
            <p className="text-xs text-muted-foreground mt-2">Artilheiro: {row.special.topScorer}</p>
          )}
        </div>
      )}
    </div>
  );
}