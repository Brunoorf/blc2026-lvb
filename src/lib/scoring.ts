// Pure scoring helpers used both by client (preview) and admin recalculation.
import type { Database } from "@/integrations/supabase/types";

export type MatchPhase = Database["public"]["Enums"]["match_phase"];

export const PHASE_ORDER: MatchPhase[] = ["group", "r32", "r16", "qf", "sf", "final"];

export const PHASE_LABEL: Record<MatchPhase, string> = {
  group: "Fase de Grupos",
  r32: "16-avos de final",
  r16: "Oitavas",
  qf: "Quartas",
  sf: "Semifinais",
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
  top_scorer: number;
  best_goalkeeper: number;
  best_player: number;
  underdog_bonus: number;
}

export function scoreMatchPrediction(
  predHome: number,
  predAway: number,
  realHome: number,
  realAway: number,
  rules: RuleMap,
): number {
  if (predHome === realHome && predAway === realAway) return rules.exact_score;
  if (matchOutcome(predHome, predAway) === matchOutcome(realHome, realAway))
    return rules.correct_result;
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