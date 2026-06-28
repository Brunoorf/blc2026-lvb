// Pure scoring helpers used both by client (preview) and admin recalculation.
import type { Database } from "@/integrations/supabase/types";

export type MatchPhase = Database["public"]["Enums"]["match_phase"];

export const PHASE_ORDER: MatchPhase[] = ["group", "r32", "r16", "qf", "sf", "third", "final"];

export const PHASE_LABEL: Record<MatchPhase, string> = {
  group: "Fase de Grupos",
  r32: "16-avos de final",
  r16: "Oitavas",
  qf: "Quartas",
  sf: "Semifinais",
  third: "3º Lugar",
  final: "Final",
};

export function reachedAtLeast(actual: MatchPhase | null | undefined, min: MatchPhase): boolean {
  if (!actual) return false;
  return PHASE_ORDER.indexOf(actual) >= PHASE_ORDER.indexOf(min);
}

export function matchOutcome(home: number, away: number): "H" | "D" | "A" {
  if (home > away) return "H";
  if (home < away) return "A";
  return "D";
}

export interface RuleMap {
  exact_score: number;
  correct_result: number;
  team_advances: number;
  group_order: number;
  advance_r16: number;
  advance_qf: number;
  advance_sf: number;
  advance_final: number;
  champion: number;
  underdog_bonus: number;
}

export function scoreMatchPrediction(
  predHome: number,
  predAway: number,
  realHome: number,
  realAway: number,
  rules: RuleMap,
  predAdvancing?: string | null,
  realAdvancing?: string | null
): number {
  const isExactScore = predHome === realHome && predAway === realAway;
  const isCorrectResult = matchOutcome(predHome, predAway) === matchOutcome(realHome, realAway);
  const isDraw = matchOutcome(realHome, realAway) === "D";

  // For group stage draws: realAdvancing is NULL, only the score matters
  // For knockout draws: realAdvancing is set, must match predAdvancing
  const requiresAdvancing = isDraw && realAdvancing != null;
  const isAdvancingCorrect = !requiresAdvancing || (!!predAdvancing && predAdvancing === realAdvancing);

  if (isExactScore) {
    if (!isDraw) return rules.exact_score;
    if (isAdvancingCorrect) return rules.exact_score;
    return 0;
  }

  if (isCorrectResult) {
    if (!isDraw) return rules.correct_result;
    if (isAdvancingCorrect) return rules.correct_result;
    return 0;
  }

  return 0;
}

export function knockoutPointsForPhase(phase: MatchPhase, rules: RuleMap): number {
  switch (phase) {
    case "r16":
      return rules.advance_r16;
    case "qf":
      return rules.advance_qf;
    case "sf":
      return rules.advance_sf;
    case "final":
      return rules.advance_final;
    default:
      return 0;
  }
}