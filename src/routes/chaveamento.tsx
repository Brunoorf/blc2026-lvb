import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { GitBranch } from "lucide-react";
import AuthGate from "@/components/AuthGate";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { computeGroupStandings } from "@/lib/group-table";

export const Route = createFileRoute("/chaveamento")({
  component: () => <AuthGate><Bracket /></AuthGate>,
});

// Official FIFA 2026 R32 pairings (groups -> seeds within group).
// 32 spots = 12 group winners (1) + 12 runners-up (2) + 8 best 3rd-place (3).
// Simplified pairing matrix for demo: pair adjacent groups.
const R32_PAIRS: Array<[string, string]> = [
  ["A1", "B2"], ["C1", "D2"], ["E1", "F2"], ["G1", "H2"],
  ["I1", "J2"], ["K1", "L2"], ["B1", "A2"], ["D1", "C2"],
  ["F1", "E2"], ["H1", "G2"], ["J1", "I2"], ["L1", "K2"],
  ["A3", "C3"], ["B3", "D3"], ["E3", "G3"], ["F3", "H3"],
];

function Bracket() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["bracket", user?.id],
    queryFn: async () => {
      const [teams, matches, preds] = await Promise.all([
        supabase.from("teams").select("*"),
        supabase.from("matches").select("*").eq("phase", "group"),
        supabase.from("predictions").select("*").eq("user_id", user!.id),
      ]);
      return { teams: teams.data ?? [], matches: matches.data ?? [], preds: preds.data ?? [] };
    },
    enabled: !!user,
  });

  const teamsById = useMemo(() => new Map((data?.teams ?? []).map((t) => [t.id, t])), [data?.teams]);

  // Build standings per group from user predictions
  const { groupStandings, bestThirds } = useMemo(() => {
    if (!data) return { groupStandings: {} as Record<string, any[]>, bestThirds: [] as any[] };
    const groupIds = ["A","B","C","D","E","F","G","H","I","J","K","L"];
    const standings: Record<string, any[]> = {};
    const thirds: any[] = [];
    for (const gid of groupIds) {
      const groupTeams = data.teams.filter((t) => t.group_id === gid).map((t) => t.id);
      const groupMatches = data.matches.filter((m) => m.group_id === gid);
      const filled = groupMatches.map((m) => {
        const p = data.preds.find((pp) => pp.match_id === m.id);
        if (!p) return null;
        return { home_team_id: m.home_team_id, away_team_id: m.away_team_id, home_score: p.home_score, away_score: p.away_score };
      }).filter(Boolean) as any[];
      const s = computeGroupStandings(groupTeams, filled);
      standings[gid] = s;
      if (s[2]) thirds.push({ group: gid, ...s[2] });
    }
    // Best 8 thirds
    thirds.sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
    const best = thirds.slice(0, 8).map((t) => t.group);
    return { groupStandings: standings, bestThirds: best };
  }, [data]);

  function teamFor(slot: string) {
    const group = slot[0];
    const seed = parseInt(slot[1]);
    if (seed === 3) {
      // only show if this group's third made it
      if (!bestThirds.includes(group)) return null;
      const s = groupStandings[group]?.[2];
      return s ? teamsById.get(s.team_id) : null;
    }
    const s = groupStandings[group]?.[seed - 1];
    return s ? teamsById.get(s.team_id) : null;
  }

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><GitBranch className="h-7 w-7 text-primary" /> Simulador de chaveamento</h1>
        <p className="text-muted-foreground text-sm">Os cruzamentos do mata-mata são preenchidos automaticamente com base nos seus palpites de grupos.</p>
      </div>

      <Card className="p-5 border-border">
        <h3 className="font-bold mb-3">Melhores 3º colocados</h3>
        {bestThirds.length === 0 ? (
          <p className="text-sm text-muted-foreground">Preencha os palpites da fase de grupos para ver os classificados.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {bestThirds.map((g) => {
              const t = teamsById.get(groupStandings[g][2].team_id);
              return (
                <span key={g} className="px-3 py-1.5 rounded-full bg-accent/15 border border-accent/40 text-sm font-medium">
                  Grupo {g}: {t?.flag} {t?.name}
                </span>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="p-5 border-border">
        <h3 className="font-bold mb-4">16-avos de final (Round of 32)</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {R32_PAIRS.map(([a, b], i) => {
            const ta = teamFor(a);
            const tb = teamFor(b);
            return (
              <div key={i} className="p-3 rounded-lg bg-muted/40 border border-border">
                <div className="text-xs text-muted-foreground mb-1">Jogo {i + 1}</div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs px-2 py-0.5 rounded bg-primary/15 text-primary font-bold">{a}</span>
                  <span className="flex-1 text-center text-sm font-medium">
                    {ta ? `${ta.flag} ${ta.name}` : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <span className="text-xs px-2 py-0.5 rounded bg-primary/15 text-primary font-bold">{b}</span>
                  <span className="flex-1 text-center text-sm font-medium">
                    {tb ? `${tb.flag} ${tb.name}` : "—"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}