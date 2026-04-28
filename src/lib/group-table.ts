// Compute group standings from match predictions.
// Tiebreakers: points, goal difference, goals for, name (deterministic).

export interface PredictedMatch {
  home_team_id: string;
  away_team_id: string;
  home_score: number;
  away_score: number;
}

export interface TeamStanding {
  team_id: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

export function computeGroupStandings(teamIds: string[], matches: PredictedMatch[]): TeamStanding[] {
  const map = new Map<string, TeamStanding>();
  for (const id of teamIds) {
    map.set(id, { team_id: id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 });
  }
  for (const m of matches) {
    const h = map.get(m.home_team_id);
    const a = map.get(m.away_team_id);
    if (!h || !a) continue;
    h.played++; a.played++;
    h.gf += m.home_score; h.ga += m.away_score;
    a.gf += m.away_score; a.ga += m.home_score;
    if (m.home_score > m.away_score) { h.won++; h.points += 3; a.lost++; }
    else if (m.home_score < m.away_score) { a.won++; a.points += 3; h.lost++; }
    else { h.drawn++; a.drawn++; h.points++; a.points++; }
  }
  for (const s of map.values()) s.gd = s.gf - s.ga;
  return Array.from(map.values()).sort((x, y) =>
    y.points - x.points || y.gd - x.gd || y.gf - x.gf || x.team_id.localeCompare(y.team_id)
  );
}