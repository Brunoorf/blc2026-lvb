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

/* ================================================================== */
/*  OFFICIAL FIFA 2026 BRACKET — Round of 32 pairings                 */
/*  Source: FIFA Match Schedule (Matches 73–88)                       */
/*  Each slot: ["pos", "group"]                                       */
/*    "1","A" = 1st of Group A                                        */
/*    "2","A" = 2nd of Group A                                        */
/*    "3","x" = 3rd-place placeholder (index x into bestThirds[])     */
/*                                                                    */
/*  The bracket is split into LEFT half and RIGHT half.                */
/*  LEFT leads to Semifinal 1 (M101); RIGHT leads to SF 2 (M102).    */
/*  LEFT: M73,M75 → M90; M74,M77 → M89; M89,M90 → M97              */
/*        M79,M80 → M92; M76,M78 → M91; M91,M92 → M99              */
/*        M97 → M101 (SF1); M99 → M101 (SF1) [wait, recalc]         */
/*                                                                    */
/*  Actually the bracket splits into 4 quarter-paths:                 */
/*  QF97 = W89 vs W90:  (W(74 vs 77) vs W(73 vs 75))                */
/*  QF99 = W91 vs W92:  (W(76 vs 78) vs W(79 vs 80))                */
/*  QF98 = W93 vs W94:  (W(83 vs 84) vs W(81 vs 82))                */
/*  QF100= W95 vs W96:  (W(86 vs 88) vs W(85 vs 87))                */
/*  SF101= W97 vs W98                                                 */
/*  SF102= W99 vs W100                                                */
/*  Final= W101 vs W102                                               */
/* ================================================================== */

// LEFT HALF of bracket (leads to SF M101 → Final)
// Left-Top quarter (QF M97): M74→M89←M77, M73→M90←M75
const LEFT_TOP_R32 = [
  { match: 74, home: ["1","E"], away: ["3","0"] },  // 1E vs 3rd(ABCDF)
  { match: 77, home: ["1","I"], away: ["3","1"] },  // 1I vs 3rd(CDFGH)
  { match: 73, home: ["2","A"], away: ["2","B"] },  // 2A vs 2B
  { match: 75, home: ["1","F"], away: ["2","C"] },  // 1F vs 2C
];

// Left-Bottom quarter (QF M99): M76→M91←M78, M79→M92←M80
const LEFT_BOTTOM_R32 = [
  { match: 76, home: ["1","C"], away: ["2","F"] },  // 1C vs 2F
  { match: 78, home: ["2","E"], away: ["2","I"] },  // 2E vs 2I
  { match: 79, home: ["1","A"], away: ["3","2"] },  // 1A vs 3rd(CEFHI)
  { match: 80, home: ["1","L"], away: ["3","3"] },  // 1L vs 3rd(EHIJK)
];

// RIGHT HALF of bracket (leads to SF M102 → Final)
// Right-Top quarter (QF M98): M83→M93←M84, M81→M94←M82
const RIGHT_TOP_R32 = [
  { match: 83, home: ["2","K"], away: ["2","L"] },  // 2K vs 2L
  { match: 84, home: ["1","H"], away: ["2","J"] },  // 1H vs 2J
  { match: 81, home: ["1","D"], away: ["3","4"] },  // 1D vs 3rd(BEFIJ)
  { match: 82, home: ["1","G"], away: ["3","5"] },  // 1G vs 3rd(AEHIJ)
];

// Right-Bottom quarter (QF M100): M86→M95←M88, M85→M96←M87
const RIGHT_BOTTOM_R32 = [
  { match: 86, home: ["1","J"], away: ["2","H"] },  // 1J vs 2H
  { match: 88, home: ["2","D"], away: ["2","G"] },  // 2D vs 2G
  { match: 85, home: ["1","B"], away: ["3","6"] },  // 1B vs 3rd(EFGIJ)
  { match: 87, home: ["1","K"], away: ["3","7"] },  // 1K vs 3rd(DEIJL)
];

interface TeamInfo { id: string; name: string; code: string; flag: string; }
type SlotPair = { home: TeamInfo | null; away: TeamInfo | null };

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
        if (!p || p.home_score == null || p.away_score == null) return null;
        return { home_team_id: m.home_team_id, away_team_id: m.away_team_id, home_score: p.home_score, away_score: p.away_score };
      }).filter(Boolean) as any[];
      const s = computeGroupStandings(groupTeams, filled);
      standings[gid] = s;
      if (s[2]) thirds.push({ group: gid, ...s[2] });
    }
    // Sort best 3rds by points, then GD, then GF
    thirds.sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
    const best = thirds.slice(0, 8).map((t) => t.group);
    return { groupStandings: standings, bestThirds: best };
  }, [data]);

  // Resolve a bracket slot to a team object
  function resolveSlot(pos: string, groupOrIdx: string): TeamInfo | null {
    if (pos === "3") {
      const idx = parseInt(groupOrIdx);
      if (isNaN(idx) || idx < 0 || idx >= bestThirds.length) return null;
      const groupId = bestThirds[idx];
      const standings = groupStandings[groupId];
      if (!standings || !standings[2]) return null;
      return teamsById.get(standings[2].team_id) ?? null;
    }
    const standings = groupStandings[groupOrIdx];
    if (!standings) return null;
    const idx = parseInt(pos) - 1;
    const entry = standings[idx];
    if (!entry) return null;
    return teamsById.get(entry.team_id) ?? null;
  }

  // Build the entire bracket with propagation
  const bracket = useMemo(() => {
    function resolveR32(slots: typeof LEFT_TOP_R32): SlotPair[] {
      return slots.map(s => ({
        home: resolveSlot(s.home[0], s.home[1]),
        away: resolveSlot(s.away[0], s.away[1]),
      }));
    }

    // Simulate: top seed (home) always wins
    function winner(pair: SlotPair): TeamInfo | null {
      return pair.home ?? pair.away ?? null;
    }

    // R32
    const ltR32 = resolveR32(LEFT_TOP_R32);     // M74, M77, M73, M75
    const lbR32 = resolveR32(LEFT_BOTTOM_R32);   // M76, M78, M79, M80
    const rtR32 = resolveR32(RIGHT_TOP_R32);     // M83, M84, M81, M82
    const rbR32 = resolveR32(RIGHT_BOTTOM_R32);  // M86, M88, M85, M87

    // R16: pair adjacent R32 matches
    // Left-top: M89=W74vsW77, M90=W73vsW75
    const lt_r16_0: SlotPair = { home: winner(ltR32[0]), away: winner(ltR32[1]) }; // M89
    const lt_r16_1: SlotPair = { home: winner(ltR32[2]), away: winner(ltR32[3]) }; // M90
    // Left-bottom: M91=W76vsW78, M92=W79vsW80
    const lb_r16_0: SlotPair = { home: winner(lbR32[0]), away: winner(lbR32[1]) }; // M91
    const lb_r16_1: SlotPair = { home: winner(lbR32[2]), away: winner(lbR32[3]) }; // M92
    // Right-top: M93=W83vsW84, M94=W81vsW82
    const rt_r16_0: SlotPair = { home: winner(rtR32[0]), away: winner(rtR32[1]) }; // M93
    const rt_r16_1: SlotPair = { home: winner(rtR32[2]), away: winner(rtR32[3]) }; // M94
    // Right-bottom: M95=W86vsW88, M96=W85vsW87
    const rb_r16_0: SlotPair = { home: winner(rbR32[0]), away: winner(rbR32[1]) }; // M95
    const rb_r16_1: SlotPair = { home: winner(rbR32[2]), away: winner(rbR32[3]) }; // M96

    // QF: M97=W89vsW90, M99=W91vsW92, M98=W93vsW94, M100=W95vsW96
    const qf_lt: SlotPair = { home: winner(lt_r16_0), away: winner(lt_r16_1) }; // M97
    const qf_lb: SlotPair = { home: winner(lb_r16_0), away: winner(lb_r16_1) }; // M99
    const qf_rt: SlotPair = { home: winner(rt_r16_0), away: winner(rt_r16_1) }; // M98
    const qf_rb: SlotPair = { home: winner(rb_r16_0), away: winner(rb_r16_1) }; // M100

    // SF: M101=W97vsW98, M102=W99vsW100
    const sf_left: SlotPair = { home: winner(qf_lt), away: winner(qf_rt) };  // M101
    const sf_right: SlotPair = { home: winner(qf_lb), away: winner(qf_rb) }; // M102

    // Final: M104=W101vsW102
    const final_: SlotPair = { home: winner(sf_left), away: winner(sf_right) };

    return {
      left: {
        r32Top: ltR32, r32Bottom: lbR32,
        r16: [lt_r16_0, lt_r16_1, lb_r16_0, lb_r16_1],
        qf: [qf_lt, qf_lb],
        sf: sf_left,
      },
      right: {
        r32Top: rtR32, r32Bottom: rbR32,
        r16: [rt_r16_0, rt_r16_1, rb_r16_0, rb_r16_1],
        qf: [qf_rt, qf_rb],
        sf: sf_right,
      },
      final_,
    };
  }, [groupStandings, bestThirds, teamsById]);

  function slotLabel(pos: string, groupOrIdx: string): string {
    if (pos === "3") {
      const idx = parseInt(groupOrIdx);
      if (idx >= 0 && idx < bestThirds.length) return `3º${bestThirds[idx]}`;
      return "3º";
    }
    return `${pos}º${groupOrIdx}`;
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
            ? "Simulação baseada nos seus palpites (formato oficial FIFA 2026). Preencha todos os grupos para chaveamento completo."
            : "Preencha seus palpites na fase de grupos para visualizar o chaveamento simulado."
          }
        </p>
      </div>

      <div className="bracket-scroll-container">
        <div className="bracket-wrapper">
          {/* LEFT HALF */}
          <div className="bracket-half bracket-left">
            {/* R32 */}
            <div className="bracket-round">
              <span className="bracket-phase-label">16-avos</span>
              {[...LEFT_TOP_R32, ...LEFT_BOTTOM_R32].map((s, i) => {
                const pairs = i < 4 ? bracket.left.r32Top : bracket.left.r32Bottom;
                const pair = pairs[i < 4 ? i : i - 4];
                return (
                  <MatchCard key={`l-r32-${i}`}
                    topTeam={pair.home} bottomTeam={pair.away}
                    topLabel={slotLabel(s.home[0], s.home[1])}
                    bottomLabel={slotLabel(s.away[0], s.away[1])}
                  />
                );
              })}
            </div>
            <div className="bracket-connectors c8">{renderConnectors(4)}</div>
            {/* R16 */}
            <div className="bracket-round">
              <span className="bracket-phase-label">Oitavas</span>
              {bracket.left.r16.map((m, i) => (
                <MatchCard key={`l-r16-${i}`} topTeam={m.home} bottomTeam={m.away} topLabel="—" bottomLabel="—" simulated />
              ))}
            </div>
            <div className="bracket-connectors c4">{renderConnectors(2)}</div>
            {/* QF */}
            <div className="bracket-round">
              <span className="bracket-phase-label">Quartas</span>
              {bracket.left.qf.map((m, i) => (
                <MatchCard key={`l-qf-${i}`} topTeam={m.home} bottomTeam={m.away} topLabel="—" bottomLabel="—" simulated />
              ))}
            </div>
            <div className="bracket-connectors c2">{renderConnectors(1)}</div>
            {/* SF */}
            <div className="bracket-round">
              <span className="bracket-phase-label">Semis</span>
              <MatchCard topTeam={bracket.left.sf.home} bottomTeam={bracket.left.sf.away} topLabel="—" bottomLabel="—" simulated />
            </div>
            <div className="bracket-connectors c1">{renderConnectors(1)}</div>
          </div>

          {/* FINAL */}
          <div className="bracket-final-col">
            <div className="bracket-trophy">
              <Trophy className="h-10 w-10 text-accent" />
            </div>
            <div className="bracket-match final-match">
              <TeamSlot team={bracket.final_.home} label="SF1" />
              <TeamSlot team={bracket.final_.away} label="SF2" />
            </div>
            <span className="bracket-phase-label">Final</span>
          </div>

          {/* RIGHT HALF (mirrored) */}
          <div className="bracket-half bracket-right">
            <div className="bracket-connectors c1">{renderConnectors(1)}</div>
            {/* SF */}
            <div className="bracket-round">
              <span className="bracket-phase-label">Semis</span>
              <MatchCard topTeam={bracket.right.sf.home} bottomTeam={bracket.right.sf.away} topLabel="—" bottomLabel="—" simulated />
            </div>
            <div className="bracket-connectors c2">{renderConnectors(1)}</div>
            {/* QF */}
            <div className="bracket-round">
              <span className="bracket-phase-label">Quartas</span>
              {bracket.right.qf.map((m, i) => (
                <MatchCard key={`r-qf-${i}`} topTeam={m.home} bottomTeam={m.away} topLabel="—" bottomLabel="—" simulated />
              ))}
            </div>
            <div className="bracket-connectors c4">{renderConnectors(2)}</div>
            {/* R16 */}
            <div className="bracket-round">
              <span className="bracket-phase-label">Oitavas</span>
              {bracket.right.r16.map((m, i) => (
                <MatchCard key={`r-r16-${i}`} topTeam={m.home} bottomTeam={m.away} topLabel="—" bottomLabel="—" simulated />
              ))}
            </div>
            <div className="bracket-connectors c8">{renderConnectors(4)}</div>
            {/* R32 */}
            <div className="bracket-round">
              <span className="bracket-phase-label">16-avos</span>
              {[...RIGHT_TOP_R32, ...RIGHT_BOTTOM_R32].map((s, i) => {
                const pairs = i < 4 ? bracket.right.r32Top : bracket.right.r32Bottom;
                const pair = pairs[i < 4 ? i : i - 4];
                return (
                  <MatchCard key={`r-r32-${i}`}
                    topTeam={pair.home} bottomTeam={pair.away}
                    topLabel={slotLabel(s.home[0], s.home[1])}
                    bottomLabel={slotLabel(s.away[0], s.away[1])}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground px-2">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-primary/30 border border-primary/50"></span>
          1º / 2º colocados
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-accent/30 border border-accent/50"></span>
          Melhores 3º colocados
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: 'var(--muted)', border: '1px dashed var(--border)' }}></span>
          Simulado (1º colocado avança)
        </span>
      </div>

      {/* Match reference */}
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer hover:text-foreground transition-colors">Ver cruzamentos oficiais (FIFA)</summary>
        <div className="mt-2 grid grid-cols-2 gap-x-8 gap-y-1 max-w-2xl">
          <span>M73: 2ºA vs 2ºB</span><span>M74: 1ºE vs 3º</span>
          <span>M75: 1ºF vs 2ºC</span><span>M76: 1ºC vs 2ºF</span>
          <span>M77: 1ºI vs 3º</span><span>M78: 2ºE vs 2ºI</span>
          <span>M79: 1ºA vs 3º</span><span>M80: 1ºL vs 3º</span>
          <span>M81: 1ºD vs 3º</span><span>M82: 1ºG vs 3º</span>
          <span>M83: 2ºK vs 2ºL</span><span>M84: 1ºH vs 2ºJ</span>
          <span>M85: 1ºB vs 3º</span><span>M86: 1ºJ vs 2ºH</span>
          <span>M87: 1ºK vs 3º</span><span>M88: 2ºD vs 2ºG</span>
        </div>
      </details>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MatchCard — a single match slot showing two teams                 */
/* ------------------------------------------------------------------ */
function MatchCard({ topTeam, bottomTeam, topLabel, bottomLabel, simulated }: {
  topTeam: TeamInfo | null;
  bottomTeam: TeamInfo | null;
  topLabel: string;
  bottomLabel: string;
  simulated?: boolean;
}) {
  return (
    <div className="bracket-match-wrapper">
      <div className={`bracket-match ${simulated ? 'bracket-match-simulated' : ''}`}>
        <TeamSlot team={topTeam} label={topLabel} />
        <TeamSlot team={bottomTeam} label={bottomLabel} />
      </div>
    </div>
  );
}

function TeamSlot({ team, label }: { team: TeamInfo | null; label: string }) {
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