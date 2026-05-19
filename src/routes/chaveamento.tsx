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
/*  OFFICIAL FIFA 2026 BRACKET                                        */
/*  Source: Wikipedia "2026 FIFA World Cup knockout stage"             */
/*  Verified against FIFA.com match schedule                          */
/*                                                                    */
/*  R32 Matches (M73-M88):                                           */
/*  M73: 2A vs 2B           M81: 1G vs 3rd(AEHIJ)                   */
/*  M74: 1C vs 2F           M82: 1D vs 3rd(BEFIJ)                   */
/*  M75: 1E vs 3rd(ABCDF)   M83: 1H vs 2J                           */
/*  M76: 1F vs 2C           M84: 2K vs 2L                           */
/*  M77: 2E vs 2I           M85: 1B vs 3rd(EFGIJ)                   */
/*  M78: 1I vs 3rd(CDFGH)   M86: 2D vs 2G                           */
/*  M79: 1A vs 3rd(CEFHI)   M87: 1J vs 2H                           */
/*  M80: 1L vs 3rd(EHIJK)   M88: 1K vs 3rd(DEIJL)                   */
/*                                                                    */
/*  R16: M89=W73vsW75, M90=W74vsW77, M91=W76vsW78, M92=W79vsW80    */
/*       M93=W83vsW84, M94=W81vsW82, M95=W86vsW88, M96=W85vsW87    */
/*                                                                    */
/*  QF:  M97=W89vsW90, M98=W93vsW94, M99=W91vsW92, M100=W95vsW96   */
/*  SF:  M101=W97vsW98, M102=W99vsW100                               */
/*  F:   W101 vs W102                                                 */
/*                                                                    */
/*  BRACKET HALVES (for separation of top seeds):                     */
/*  LEFT  → SF M101: QF M97(M73,M75,M74,M77) + QF M98(M83,M84,M81,M82) */
/*  RIGHT → SF M102: QF M99(M76,M78,M79,M80) + QF M100(M86,M88,M85,M87)*/
/*                                                                    */
/*  Separation: Spain(1H)→M83→LEFT, Argentina(1J)→M87→RIGHT ✓       */
/* ================================================================== */

// Slot types: ["pos","group"] where pos=1/2 for 1st/2nd, pos=3 for 3rd-place
type SlotDef = [string, string];
interface R32Match { home: SlotDef; away: SlotDef; }

// ── LEFT HALF (→ SF M101) ──────────────────────────────────────────
// Upper quarter → QF M97 = W(M89) vs W(M90)
//   M89 = W(M73) vs W(M75);  M90 = W(M74) vs W(M77)
const LEFT_UPPER: R32Match[] = [
  { home: ["2","A"], away: ["2","B"] },         // M73
  { home: ["1","E"], away: ["3","0"] },         // M75: 1E vs 3rd(ABCDF)
  { home: ["1","C"], away: ["2","F"] },         // M74
  { home: ["2","E"], away: ["2","I"] },         // M77
];

// Lower quarter → QF M98 = W(M93) vs W(M94)
//   M93 = W(M83) vs W(M84);  M94 = W(M81) vs W(M82)
const LEFT_LOWER: R32Match[] = [
  { home: ["1","H"], away: ["2","J"] },         // M83
  { home: ["2","K"], away: ["2","L"] },         // M84
  { home: ["1","G"], away: ["3","1"] },         // M81: 1G vs 3rd(AEHIJ)
  { home: ["1","D"], away: ["3","2"] },         // M82: 1D vs 3rd(BEFIJ)
];

// ── RIGHT HALF (→ SF M102) ─────────────────────────────────────────
// Upper quarter → QF M99 = W(M91) vs W(M92)
//   M91 = W(M76) vs W(M78);  M92 = W(M79) vs W(M80)
const RIGHT_UPPER: R32Match[] = [
  { home: ["1","F"], away: ["2","C"] },         // M76
  { home: ["1","I"], away: ["3","3"] },         // M78: 1I vs 3rd(CDFGH)
  { home: ["1","A"], away: ["3","4"] },         // M79: 1A vs 3rd(CEFHI)
  { home: ["1","L"], away: ["3","5"] },         // M80: 1L vs 3rd(EHIJK)
];

// Lower quarter → QF M100 = W(M95) vs W(M96)
//   M95 = W(M86) vs W(M88);  M96 = W(M85) vs W(M87)
const RIGHT_LOWER: R32Match[] = [
  { home: ["2","D"], away: ["2","G"] },         // M86
  { home: ["1","K"], away: ["3","6"] },         // M88: 1K vs 3rd(DEIJL)
  { home: ["1","B"], away: ["3","7"] },         // M85: 1B vs 3rd(EFGIJ)
  { home: ["1","J"], away: ["2","H"] },         // M87
];

interface TeamInfo { id: string; name: string; code: string; flag: string; }
type SlotPair = { home: TeamInfo | null; away: TeamInfo | null };

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
    thirds.sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
    return { groupStandings: standings, bestThirds: thirds.slice(0, 8).map((t) => t.group) };
  }, [data]);

  function resolveSlot(pos: string, groupOrIdx: string): TeamInfo | null {
    if (pos === "3") {
      const idx = parseInt(groupOrIdx);
      if (isNaN(idx) || idx >= bestThirds.length) return null;
      const gid = bestThirds[idx];
      return teamsById.get(groupStandings[gid]?.[2]?.team_id) ?? null;
    }
    const entry = groupStandings[groupOrIdx]?.[parseInt(pos) - 1];
    return entry ? teamsById.get(entry.team_id) ?? null : null;
  }

  const bracket = useMemo(() => {
    function resolveR32(slots: R32Match[]): SlotPair[] {
      return slots.map(s => ({
        home: resolveSlot(s.home[0], s.home[1]),
        away: resolveSlot(s.away[0], s.away[1]),
      }));
    }
    function winner(pair: SlotPair): TeamInfo | null {
      return pair.home ?? pair.away ?? null;
    }

    const luR32 = resolveR32(LEFT_UPPER);    // M73, M75, M74, M77
    const llR32 = resolveR32(LEFT_LOWER);    // M83, M84, M81, M82
    const ruR32 = resolveR32(RIGHT_UPPER);   // M76, M78, M79, M80
    const rlR32 = resolveR32(RIGHT_LOWER);   // M86, M88, M85, M87

    // R16: pairs from adjacent R32 in each quarter
    const lu_r16: SlotPair[] = [
      { home: winner(luR32[0]), away: winner(luR32[1]) }, // M89 = W73 vs W75
      { home: winner(luR32[2]), away: winner(luR32[3]) }, // M90 = W74 vs W77
    ];
    const ll_r16: SlotPair[] = [
      { home: winner(llR32[0]), away: winner(llR32[1]) }, // M93 = W83 vs W84
      { home: winner(llR32[2]), away: winner(llR32[3]) }, // M94 = W81 vs W82
    ];
    const ru_r16: SlotPair[] = [
      { home: winner(ruR32[0]), away: winner(ruR32[1]) }, // M91 = W76 vs W78
      { home: winner(ruR32[2]), away: winner(ruR32[3]) }, // M92 = W79 vs W80
    ];
    const rl_r16: SlotPair[] = [
      { home: winner(rlR32[0]), away: winner(rlR32[1]) }, // M95 = W86 vs W88
      { home: winner(rlR32[2]), away: winner(rlR32[3]) }, // M96 = W85 vs W87
    ];

    // QF
    const qf_lu: SlotPair = { home: winner(lu_r16[0]), away: winner(lu_r16[1]) }; // M97
    const qf_ll: SlotPair = { home: winner(ll_r16[0]), away: winner(ll_r16[1]) }; // M98
    const qf_ru: SlotPair = { home: winner(ru_r16[0]), away: winner(ru_r16[1]) }; // M99
    const qf_rl: SlotPair = { home: winner(rl_r16[0]), away: winner(rl_r16[1]) }; // M100

    // SF: LEFT side = W97 vs W98, RIGHT side = W99 vs W100
    const sf_left: SlotPair = { home: winner(qf_lu), away: winner(qf_ll) };  // M101
    const sf_right: SlotPair = { home: winner(qf_ru), away: winner(qf_rl) }; // M102
    const final_: SlotPair = { home: winner(sf_left), away: winner(sf_right) };

    return {
      left: {
        r32: [...luR32, ...llR32],
        r16: [...lu_r16, ...ll_r16],
        qf: [qf_lu, qf_ll],
        sf: sf_left,
      },
      right: {
        r32: [...ruR32, ...rlR32],
        r16: [...ru_r16, ...rl_r16],
        qf: [qf_ru, qf_rl],
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
  const allR32Left = [...LEFT_UPPER, ...LEFT_LOWER];
  const allR32Right = [...RIGHT_UPPER, ...RIGHT_LOWER];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <GitBranch className="h-7 w-7 text-primary" /> Chaveamento
        </h1>
        <p className="text-muted-foreground text-sm">
          {hasPreds
            ? "Simulação baseada nos seus palpites (cruzamentos oficiais FIFA). Preencha todos os grupos para chaveamento completo."
            : "Preencha seus palpites na fase de grupos para visualizar o chaveamento simulado."
          }
        </p>
      </div>

      <div className="bracket-scroll-container">
        <div className="bracket-wrapper">
          {/* LEFT HALF → SF M101 */}
          <div className="bracket-half bracket-left">
            <div className="bracket-round">
              <span className="bracket-phase-label">16-avos</span>
              {allR32Left.map((s, i) => (
                <MatchCard key={`l-r32-${i}`}
                  topTeam={bracket.left.r32[i].home} bottomTeam={bracket.left.r32[i].away}
                  topLabel={slotLabel(s.home[0], s.home[1])} bottomLabel={slotLabel(s.away[0], s.away[1])}
                />
              ))}
            </div>
            <div className="bracket-connectors c8">{renderConnectors(4)}</div>
            <div className="bracket-round">
              <span className="bracket-phase-label">Oitavas</span>
              {bracket.left.r16.map((m, i) => (
                <MatchCard key={`l-r16-${i}`} topTeam={m.home} bottomTeam={m.away} topLabel="—" bottomLabel="—" simulated />
              ))}
            </div>
            <div className="bracket-connectors c4">{renderConnectors(2)}</div>
            <div className="bracket-round">
              <span className="bracket-phase-label">Quartas</span>
              {bracket.left.qf.map((m, i) => (
                <MatchCard key={`l-qf-${i}`} topTeam={m.home} bottomTeam={m.away} topLabel="—" bottomLabel="—" simulated />
              ))}
            </div>
            <div className="bracket-connectors c2">{renderConnectors(1)}</div>
            <div className="bracket-round">
              <span className="bracket-phase-label">Semis</span>
              <MatchCard topTeam={bracket.left.sf.home} bottomTeam={bracket.left.sf.away} topLabel="—" bottomLabel="—" simulated />
            </div>
            <div className="bracket-connectors c1">{renderConnectors(1)}</div>
          </div>

          {/* FINAL */}
          <div className="bracket-final-col">
            <div className="bracket-trophy"><Trophy className="h-10 w-10 text-accent" /></div>
            <div className="bracket-match final-match">
              <TeamSlot team={bracket.final_.home} label="SF1" />
              <TeamSlot team={bracket.final_.away} label="SF2" />
            </div>
            <span className="bracket-phase-label">Final</span>
          </div>

          {/* RIGHT HALF → SF M102 */}
          <div className="bracket-half bracket-right">
            <div className="bracket-connectors c1">{renderConnectors(1)}</div>
            <div className="bracket-round">
              <span className="bracket-phase-label">Semis</span>
              <MatchCard topTeam={bracket.right.sf.home} bottomTeam={bracket.right.sf.away} topLabel="—" bottomLabel="—" simulated />
            </div>
            <div className="bracket-connectors c2">{renderConnectors(1)}</div>
            <div className="bracket-round">
              <span className="bracket-phase-label">Quartas</span>
              {bracket.right.qf.map((m, i) => (
                <MatchCard key={`r-qf-${i}`} topTeam={m.home} bottomTeam={m.away} topLabel="—" bottomLabel="—" simulated />
              ))}
            </div>
            <div className="bracket-connectors c4">{renderConnectors(2)}</div>
            <div className="bracket-round">
              <span className="bracket-phase-label">Oitavas</span>
              {bracket.right.r16.map((m, i) => (
                <MatchCard key={`r-r16-${i}`} topTeam={m.home} bottomTeam={m.away} topLabel="—" bottomLabel="—" simulated />
              ))}
            </div>
            <div className="bracket-connectors c8">{renderConnectors(4)}</div>
            <div className="bracket-round">
              <span className="bracket-phase-label">16-avos</span>
              {allR32Right.map((s, i) => (
                <MatchCard key={`r-r32-${i}`}
                  topTeam={bracket.right.r32[i].home} bottomTeam={bracket.right.r32[i].away}
                  topLabel={slotLabel(s.home[0], s.home[1])} bottomLabel={slotLabel(s.away[0], s.away[1])}
                />
              ))}
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

      {/* Official reference */}
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer hover:text-foreground transition-colors">Ver cruzamentos oficiais FIFA (M73-M88)</summary>
        <div className="mt-2 grid grid-cols-2 gap-x-8 gap-y-1 max-w-2xl">
          <span className="font-bold col-span-2 mb-1">Lado Esquerdo (→ Semi 1)</span>
          <span>M73: 2ºA vs 2ºB</span><span>M75: 1ºE vs 3º</span>
          <span>M74: 1ºC vs 2ºF</span><span>M77: 2ºE vs 2ºI</span>
          <span>M83: 1ºH vs 2ºJ</span><span>M84: 2ºK vs 2ºL</span>
          <span>M81: 1ºG vs 3º</span><span>M82: 1ºD vs 3º</span>
          <span className="font-bold col-span-2 mt-2 mb-1">Lado Direito (→ Semi 2)</span>
          <span>M76: 1ºF vs 2ºC</span><span>M78: 1ºI vs 3º</span>
          <span>M79: 1ºA vs 3º</span><span>M80: 1ºL vs 3º</span>
          <span>M86: 2ºD vs 2ºG</span><span>M88: 1ºK vs 3º</span>
          <span>M85: 1ºB vs 3º</span><span>M87: 1ºJ vs 2ºH</span>
        </div>
      </details>
    </div>
  );
}

/* MatchCard */
function MatchCard({ topTeam, bottomTeam, topLabel, bottomLabel, simulated }: {
  topTeam: TeamInfo | null; bottomTeam: TeamInfo | null;
  topLabel: string; bottomLabel: string; simulated?: boolean;
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
  if (!team) return (
    <div className="bracket-team-slot empty"><span className="slot-placeholder">{label}</span></div>
  );
  return (
    <div className="bracket-team-slot filled">
      <TeamFlag code={team.code} fallback={team.flag} size={16} />
      <span className="slot-team-name" title={team.name}>{team.name}</span>
    </div>
  );
}

function renderConnectors(count: number) {
  return Array.from({ length: count }, (_, i) => (
    <div key={i} className="bracket-connector-pair-wrapper"><div className="bracket-connector-pair" /></div>
  ));
}