import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { GitBranch, Trophy } from "lucide-react";
import AuthGate from "@/components/AuthGate";
import TeamFlag from "@/components/TeamFlag";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { computeGroupStandings } from "@/lib/group-table";

export const Route = createFileRoute("/chaveamento")({
  component: () => <AuthGate><BracketPage /></AuthGate>,
});

/* ------------------------------------------------------------------ */
/*  Official FIFA 2026 R32 bracket structure (from Globo simulator)   */
/*  Each slot: [position, groupId]  e.g. ["1","E"] = 1st of Group E   */
/*  "3" means best-3rd placeholder                                    */
/* ------------------------------------------------------------------ */

// Left bracket (8 R32 matches)
const LEFT_R32: [string, string][][] = [
  [["1","E"], ["3",""]],   // R32-L1
  [["1","H"], ["3",""]],   // R32-L2
  [["2","A"], ["2","B"]],  // R32-L3
  [["1","F"], ["2","C"]],  // R32-L4
  [["2","K"], ["2","L"]],  // R32-L5
  [["1","I"], ["2","J"]],  // R32-L6
  [["1","D"], ["3",""]],   // R32-L7
  [["1","G"], ["3",""]],   // R32-L8
];

// Right bracket (8 R32 matches) - mirrored
const RIGHT_R32: [string, string][][] = [
  [["1","C"], ["2","F"]],  // R32-R1
  [["2","E"], ["2","I"]],  // R32-R2
  [["1","A"], ["3",""]],   // R32-R3
  [["1","L"], ["3",""]],   // R32-R4
  [["1","J"], ["2","H"]],  // R32-R5
  [["2","D"], ["2","G"]],  // R32-R6
  [["1","B"], ["3",""]],   // R32-R7
  [["1","K"], ["3",""]],   // R32-R8
];

/* ------------------------------------------------------------------ */
/*  Main page component                                               */
/* ------------------------------------------------------------------ */
function BracketPage() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["bracket", user?.id],
    queryFn: async () => {
      const [teams, matches, preds] = await Promise.all([
        supabase.from("teams").select("*"),
        supabase.from("matches").select("*").order("match_number"),
        supabase.from("predictions").select("*").eq("user_id", user!.id),
      ]);
      return { teams: teams.data ?? [], matches: matches.data ?? [], preds: preds.data ?? [] };
    },
    enabled: !!user,
  });

  const teamsById = useMemo(() => new Map((data?.teams ?? []).map((t) => [t.id, t])), [data?.teams]);

  // Compute group standings from user predictions
  const { groupStandings, bestThirds } = useMemo(() => {
    if (!data) return { groupStandings: {} as Record<string, any[]>, bestThirds: [] as string[] };
    const groupIds = ["A","B","C","D","E","F","G","H","I","J","K","L"];
    const standings: Record<string, any[]> = {};
    const thirds: { group: string; points: number; gd: number; gf: number; team_id: string }[] = [];

    for (const gid of groupIds) {
      const groupTeams = data.teams.filter((t) => t.group_id === gid).map((t) => t.id);
      const groupMatches = data.matches.filter((m) => m.group_id === gid && m.phase === "group");
      const filled = groupMatches.map((m) => {
        const p = data.preds.find((pp) => pp.match_id === m.id);
        if (!p) return null;
        return { home_team_id: m.home_team_id, away_team_id: m.away_team_id, home_score: p.home_score, away_score: p.away_score };
      }).filter(Boolean) as any[];
      const s = computeGroupStandings(groupTeams, filled);
      standings[gid] = s;
      if (s[2]) thirds.push({ group: gid, ...s[2] });
    }
    thirds.sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
    const best = thirds.slice(0, 8).map((t) => t.group);
    return { groupStandings: standings, bestThirds: best };
  }, [data]);

  // Resolve a bracket slot to a team object (or null)
  function resolveSlot(pos: string, groupId: string): any | null {
    if (!groupId || pos === "3") {
      // 3rd place - we just show "3º" placeholder for now
      return null;
    }
    const standings = groupStandings[groupId];
    if (!standings) return null;
    const idx = parseInt(pos) - 1; // "1" → index 0, "2" → index 1
    const entry = standings[idx];
    if (!entry) return null;
    return teamsById.get(entry.team_id) ?? null;
  }

  function slotLabel(pos: string, groupId: string): string {
    if (pos === "3") return "3º";
    return `${pos}º${groupId}`;
  }

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Carregando...</div>;

  const hasPreds = (data?.preds ?? []).length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <GitBranch className="h-7 w-7 text-primary" /> Chaveamento
        </h1>
        <p className="text-muted-foreground text-sm">
          {hasPreds
            ? "Simulação baseada nos seus palpites. Preencha todos os grupos para ver o chaveamento completo."
            : "Preencha seus palpites na fase de grupos para visualizar o chaveamento simulado."
          }
        </p>
      </div>

      {/* Bracket */}
      <div className="bracket-scroll-container">
        <div className="bracket-wrapper">
          {/* LEFT HALF: R32 → R16 → QF → SF */}
          <BracketHalf
            side="left"
            r32Slots={LEFT_R32}
            resolveSlot={resolveSlot}
            slotLabel={slotLabel}
          />

          {/* FINAL (center) */}
          <div className="bracket-final-col">
            <div className="bracket-trophy">
              <Trophy className="h-10 w-10 text-accent" />
            </div>
            <div className="bracket-match final-match">
              <div className="bracket-team-slot empty">
                <span className="slot-placeholder">SF1</span>
              </div>
              <div className="bracket-team-slot empty">
                <span className="slot-placeholder">SF2</span>
              </div>
            </div>
            <span className="bracket-phase-label">Final</span>
          </div>

          {/* RIGHT HALF: SF → QF → R16 → R32 */}
          <BracketHalf
            side="right"
            r32Slots={RIGHT_R32}
            resolveSlot={resolveSlot}
            slotLabel={slotLabel}
          />
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground px-2">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-primary/30 border border-primary/50"></span>
          1º / 2º colocados (classificados)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-accent/30 border border-accent/50"></span>
          Melhores 3º colocados
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  BracketHalf — renders one side of the bracket (R32→SF)            */
/* ------------------------------------------------------------------ */
function BracketHalf({ side, r32Slots, resolveSlot, slotLabel }: {
  side: "left" | "right";
  r32Slots: [string, string][][];
  resolveSlot: (pos: string, gid: string) => any | null;
  slotLabel: (pos: string, gid: string) => string;
}) {
  const isLeft = side === "left";

  // Build R32 match elements
  const r32Matches = r32Slots.map((slot, i) => {
    const [top, bottom] = slot;
    const topTeam = resolveSlot(top[0], top[1]);
    const bottomTeam = resolveSlot(bottom[0], bottom[1]);
    return (
      <MatchCard
        key={`r32-${side}-${i}`}
        topTeam={topTeam}
        bottomTeam={bottomTeam}
        topLabel={slotLabel(top[0], top[1])}
        bottomLabel={slotLabel(bottom[0], bottom[1])}
      />
    );
  });

  // Empty placeholder matches for R16, QF, SF
  const r16Matches = Array.from({ length: 4 }, (_, i) => (
    <MatchCard key={`r16-${side}-${i}`} topTeam={null} bottomTeam={null} topLabel="—" bottomLabel="—" />
  ));
  const qfMatches = Array.from({ length: 2 }, (_, i) => (
    <MatchCard key={`qf-${side}-${i}`} topTeam={null} bottomTeam={null} topLabel="—" bottomLabel="—" />
  ));
  const sfMatch = (
    <MatchCard key={`sf-${side}`} topTeam={null} bottomTeam={null} topLabel="—" bottomLabel="—" />
  );

  // Column order depends on side
  const columns = isLeft ? (
    <>
      <div className="bracket-round bracket-r32" data-side={side}>
        <span className="bracket-phase-label">16-avos</span>
        {r32Matches}
      </div>
      <div className="bracket-connectors c8" data-side={side}>{renderConnectors(4)}</div>
      <div className="bracket-round bracket-r16" data-side={side}>
        <span className="bracket-phase-label">Oitavas</span>
        {r16Matches}
      </div>
      <div className="bracket-connectors c4" data-side={side}>{renderConnectors(2)}</div>
      <div className="bracket-round bracket-qf" data-side={side}>
        <span className="bracket-phase-label">Quartas</span>
        {qfMatches}
      </div>
      <div className="bracket-connectors c2" data-side={side}>{renderConnectors(1)}</div>
      <div className="bracket-round bracket-sf" data-side={side}>
        <span className="bracket-phase-label">Semis</span>
        {sfMatch}
      </div>
      <div className="bracket-connectors c1" data-side={side}>{renderConnectors(1)}</div>
    </>
  ) : (
    <>
      <div className="bracket-connectors c1" data-side={side}>{renderConnectors(1)}</div>
      <div className="bracket-round bracket-sf" data-side={side}>
        <span className="bracket-phase-label">Semis</span>
        {sfMatch}
      </div>
      <div className="bracket-connectors c2" data-side={side}>{renderConnectors(1)}</div>
      <div className="bracket-round bracket-qf" data-side={side}>
        <span className="bracket-phase-label">Quartas</span>
        {qfMatches}
      </div>
      <div className="bracket-connectors c4" data-side={side}>{renderConnectors(2)}</div>
      <div className="bracket-round bracket-r16" data-side={side}>
        <span className="bracket-phase-label">Oitavas</span>
        {r16Matches}
      </div>
      <div className="bracket-connectors c8" data-side={side}>{renderConnectors(4)}</div>
      <div className="bracket-round bracket-r32" data-side={side}>
        <span className="bracket-phase-label">16-avos</span>
        {r32Matches}
      </div>
    </>
  );

  return <div className={`bracket-half bracket-${side}`}>{columns}</div>;
}

/* ------------------------------------------------------------------ */
/*  MatchCard — a single match slot showing two teams                 */
/* ------------------------------------------------------------------ */
function MatchCard({ topTeam, bottomTeam, topLabel, bottomLabel }: {
  topTeam: any | null;
  bottomTeam: any | null;
  topLabel: string;
  bottomLabel: string;
}) {
  return (
    <div className="bracket-match-wrapper">
      <div className="bracket-match">
        <TeamSlot team={topTeam} label={topLabel} />
        <TeamSlot team={bottomTeam} label={bottomLabel} />
      </div>
    </div>
  );
}

function TeamSlot({ team, label }: { team: any | null; label: string }) {
  if (!team) {
    return (
      <div className="bracket-team-slot empty">
        <span className="slot-placeholder">{label}</span>
      </div>
    );
  }
  return (
    <div className="bracket-team-slot filled">
      <TeamFlag code={team.code} fallback={team.flag} size={16} />
      <span className="slot-team-name" title={team.name}>{team.name}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Connector helpers                                                  */
/* ------------------------------------------------------------------ */
function renderConnectors(count: number) {
  return Array.from({ length: count }, (_, i) => (
    <div key={i} className="bracket-connector-pair-wrapper">
      <div className="bracket-connector-pair" />
    </div>
  ));
}