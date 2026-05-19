import { supabase } from "@/integrations/supabase/client";
import { computeGroupStandings } from "./group-table";
import { knockoutPointsForPhase, reachedAtLeast, scoreMatchPrediction, type RuleMap, type MatchPhase } from "./scoring";

// Batch updates in chunks to avoid overwhelming Supabase
async function batchUpdatePredictions(updates: Array<{ id: string; points_awarded: number }>, chunkSize = 50) {
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize);
    await Promise.all(chunk.map((u) => supabase.from("predictions").update({ points_awarded: u.points_awarded }).eq("id", u.id)));
  }
}

async function batchUpdateKO(updates: Array<{ id: string; points_awarded: number }>, chunkSize = 50) {
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize);
    await Promise.all(chunk.map((u) => supabase.from("knockout_predictions").update({ points_awarded: u.points_awarded }).eq("id", u.id)));
  }
}

async function batchUpdateSpecial(updates: Array<{ id: string; points_awarded: number }>, chunkSize = 50) {
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize);
    await Promise.all(chunk.map((u) => supabase.from("special_predictions").update({ points_awarded: u.points_awarded }).eq("id", u.id)));
  }
}

export async function recomputeAllPoints() {
  const [rulesRes, matchesRes, predsRes, koRes, specialRes, teamsRes, officialRes, settingsRes] = await Promise.all([
    supabase.from("scoring_rules").select("*"),
    supabase.from("matches").select("*"),
    supabase.from("predictions").select("*"),
    supabase.from("knockout_predictions").select("*"),
    supabase.from("special_predictions").select("*"),
    supabase.from("teams").select("*"),
    supabase.from("team_official_results").select("*"),
    supabase.from("tournament_settings").select("*").maybeSingle(),
  ]);

  const rulesMap: any = {};
  (rulesRes.data ?? []).forEach((r) => { rulesMap[r.rule_key] = r.points; });
  const rules = rulesMap as RuleMap;

  const matches = matchesRes.data ?? [];
  const teams = teamsRes.data ?? [];
  const officials = officialRes.data ?? [];
  const settings = settingsRes.data;
  const teamsById = new Map(teams.map((t) => [t.id, t]));
  const officialByTeam = new Map(officials.map((o) => [o.team_id, o]));

  // 1) Match predictions (group + KO with finished real result)
  const finishedMatches = matches.filter((m) => m.is_finished && m.home_score != null && m.away_score != null);
  const finishedById = new Map(finishedMatches.map((m) => [m.id, m]));

  const predUpdates: Array<{ id: string; points_awarded: number }> = [];
  for (const p of predsRes.data ?? []) {
    const m = finishedById.get(p.match_id);
    const pts = m ? scoreMatchPrediction(p.home_score, p.away_score, m.home_score!, m.away_score!, rules, p.advancing_team_id, m.advancing_team_id) : 0;
    predUpdates.push({ id: p.id, points_awarded: pts });
  }

  // 2) Build official group order from team_official_results.group_position
  const userIds = Array.from(new Set([...(predsRes.data ?? []).map((p) => p.user_id), ...(koRes.data ?? []).map((p) => p.user_id), ...(specialRes.data ?? []).map((p) => p.user_id)]));

  const officialOrderByGroup: Record<string, string[]> = {};
  for (const t of teams) {
    const o = officialByTeam.get(t.id);
    if (o?.group_position) {
      (officialOrderByGroup[t.group_id] ??= [])[o.group_position - 1] = t.id;
    }
  }

  // 3) Knockout predictions points
  const koUpdates: Array<{ id: string; points_awarded: number }> = [];
  for (const k of koRes.data ?? []) {
    const o = officialByTeam.get(k.team_id);
    const reached = o?.reached_phase as MatchPhase | undefined;
    let pts = 0;
    if (reached && reachedAtLeast(reached, k.reached_phase)) {
      pts = knockoutPointsForPhase(k.reached_phase, rules);
    }
    koUpdates.push({ id: k.id, points_awarded: pts });
  }

  // 4) Special predictions — Champion + Individual Awards
  // Champion: identified by is_champion flag on team_official_results
  const champion = teams.find((t) => {
    const o = officialByTeam.get(t.id) as any;
    return o?.is_champion === true;
  });
  // Fallback to old logic if is_champion not set: reached_phase='final' + group_position=1
  const championFallback = !champion
    ? teams.find((t) => officialByTeam.get(t.id)?.reached_phase === "final" && (officialByTeam.get(t.id) as any)?.group_position === 1)
    : null;
  const championTeam = champion ?? championFallback;

  // Official individual awards from tournament_settings
  const officialTopScorer = (settings as any)?.official_top_scorer?.trim().toLowerCase() ?? "";
  const officialBestGk = (settings as any)?.official_best_goalkeeper?.trim().toLowerCase() ?? "";
  const officialBestPlayer = (settings as any)?.official_best_player?.trim().toLowerCase() ?? "";

  const specialUpdates: Array<{ id: string; points_awarded: number }> = [];
  for (const sp of specialRes.data ?? []) {
    let pts = 0;
    // Champion
    if (championTeam && sp.champion_team_id === championTeam.id) pts += rules.champion;
    // Top scorer
    if (officialTopScorer && sp.top_scorer?.trim().toLowerCase() === officialTopScorer) pts += rules.top_scorer;
    // Best goalkeeper
    if (officialBestGk && sp.best_goalkeeper?.trim().toLowerCase() === officialBestGk) pts += rules.best_goalkeeper;
    // Best player
    if (officialBestPlayer && sp.best_player?.trim().toLowerCase() === officialBestPlayer) pts += rules.best_player;

    specialUpdates.push({ id: sp.id, points_awarded: pts });
  }

  // 5) Group order bonuses + advance bonuses + underdog bonus
  for (const userId of userIds) {
    const userMatchPreds = (predsRes.data ?? []).filter((p) => p.user_id === userId);
    const matchPredById = new Map(userMatchPreds.map((p) => [p.match_id, p]));

    let bonus = 0;
    // Per group: build user's predicted standings from group matches; compare with official order
    const groupIds = Array.from(new Set(teams.map((t) => t.group_id)));
    for (const gid of groupIds) {
      const groupTeams = teams.filter((t) => t.group_id === gid).map((t) => t.id);
      const groupMatches = matches.filter((m) => m.group_id === gid && m.phase === "group");
      const filled = groupMatches.map((m) => {
        const p = matchPredById.get(m.id);
        if (!p) return null;
        return { home_team_id: m.home_team_id!, away_team_id: m.away_team_id!, home_score: p.home_score, away_score: p.away_score };
      }).filter(Boolean) as any[];
      if (filled.length === 0) continue;
      const standings = computeGroupStandings(groupTeams, filled);

      // team_advances: top 2 predicted vs official (any team that officially advanced past groups)
      const officialOrder = officialOrderByGroup[gid] ?? [];
      if (officialOrder.length === 4) {
        const officialTop2 = new Set(officialOrder.slice(0, 2));
        const predTop2 = standings.slice(0, 2).map((s) => s.team_id);
        for (const teamId of predTop2) {
          if (officialTop2.has(teamId)) bonus += rules.team_advances;
        }
        // group_order full match
        const predOrder = standings.map((s) => s.team_id);
        if (predOrder[0] === officialOrder[0] && predOrder[1] === officialOrder[1] && predOrder[2] === officialOrder[2] && predOrder[3] === officialOrder[3]) {
          bonus += rules.group_order;
        }
      }
    }

    // Underdog bonus: the single team selected in special_predictions
    const sp = (specialRes.data ?? []).find((x) => x.user_id === userId);
    if (sp && sp.underdog_team_id) {
      const t = teamsById.get(sp.underdog_team_id);
      if (t && !t.is_top15) {
        const o = officialByTeam.get(sp.underdog_team_id);
        if (o && reachedAtLeast(o.reached_phase as MatchPhase, "qf")) {
          bonus += rules.underdog_bonus;
        }
      }
    }

    if (bonus > 0) {
      // Store bonus on special_predictions (create empty if missing)
      const existing = specialUpdates.find((s) => {
        const sp = (specialRes.data ?? []).find((x) => x.id === s.id);
        return sp?.user_id === userId;
      });
      if (existing) {
        existing.points_awarded += bonus;
      } else {
        // upsert empty special row to hold bonus
        await supabase.from("special_predictions").upsert({ user_id: userId, points_awarded: bonus }, { onConflict: "user_id" });
      }
    }
  }

  // Persist updates using batched chunks
  await batchUpdatePredictions(predUpdates);
  await batchUpdateKO(koUpdates);
  await batchUpdateSpecial(specialUpdates);

  return {
    matchUpdated: predUpdates.length,
    koUpdated: koUpdates.length,
    specialUpdated: specialUpdates.length,
  };
}