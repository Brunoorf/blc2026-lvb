import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

export const Route = (createFileRoute as any)("/debug-ranking")({
  component: DebugRanking,
});

function DebugRanking() {
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    const debug = async () => {
      try {
        const logs: string[] = [];
        logs.push("=== DEBUG RANKING ===");

        // Load data
        const [preds, matches] = await Promise.all([
          supabase.from("predictions").select("*"),
          supabase.from("matches").select("*"),
        ]);

        const predictions = preds.data ?? [];
        const allMatches = matches.data ?? [];
        const matchesById = new Map(allMatches.map((m) => [m.id, m]));

        logs.push(`Total predictions: ${predictions.length}`);
        logs.push(`Total matches: ${allMatches.length}`);

        // Find Bruno and France match
        const bruno = predictions.filter((p) => p.user_id === "f546a477-6b30-4fb8-bf80-0fa08547666c");
        logs.push(`\nBruno's predictions: ${bruno.length}`);

        // Find France 3x1
        const france = bruno.find((p) => p.home_score === 3 && p.away_score === 1);
        if (france) {
          logs.push(`\nFrance 3x1 prediction found:`);
          logs.push(`  ID: ${france.id}`);
          logs.push(`  Predicted: ${france.home_score}x${france.away_score}`);
          logs.push(`  Match ID: ${france.match_id}`);

          const match = matchesById.get(france.match_id);
          if (match) {
            logs.push(`  Official: ${match.home_score}x${match.away_score}`);
            logs.push(`  Is finished: ${match.is_finished}`);

            if (match.is_finished && match.home_score !== null && match.away_score !== null) {
              const isExact = france.home_score === match.home_score && france.away_score === match.away_score;
              logs.push(`  Is exact: ${isExact}`);
              logs.push(`  Should get: ${isExact ? "25 pts" : "10 pts or 0 pts"}`);
            }
          } else {
            logs.push(`  Match NOT FOUND!`);
          }
        } else {
          logs.push(`\nFrance 3x1 prediction NOT FOUND for Bruno`);
          logs.push(`Bruno's 3x1 predictions: ${bruno.filter((p) => p.home_score === 3 && p.away_score === 1).length}`);
        }

        // Calculate all points for Bruno
        let totalBruno = 0;
        for (const p of bruno) {
          const m = matchesById.get(p.match_id);
          if (!m?.is_finished || m.home_score == null || m.away_score == null) continue;

          let pts = 0;
          if (p.home_score === m.home_score && p.away_score === m.away_score) {
            pts = 25;
          } else if (
            (p.home_score > p.away_score && m.home_score > m.away_score) ||
            (p.home_score < p.away_score && m.home_score < m.away_score) ||
            (p.home_score === p.away_score && m.home_score === m.away_score)
          ) {
            pts = 10;
          }
          totalBruno += pts;
        }

        logs.push(`\nBruno total calculated: ${totalBruno} pts`);

        setLog(logs);
      } catch (e: any) {
        setLog([`ERROR: ${e.message}`]);
      }
    };

    debug();
  }, []);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-3xl font-bold">🔍 Debug Ranking</h1>
      <Card className="p-4 bg-muted/20">
        <pre className="text-xs whitespace-pre-wrap font-mono">{log.join("\n")}</pre>
      </Card>
    </div>
  );
}
