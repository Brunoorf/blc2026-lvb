import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trophy, Medal, ChevronDown, ChevronUp } from "lucide-react";
import AuthGate from "@/components/AuthGate";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/ranking")({
  component: () => <AuthGate><Ranking /></AuthGate>,
});

interface RankingRow {
  id: string;
  display_name: string;
  avatar_url: string | null;
  total_pts: number;
}

function Ranking() {
  const { user } = useAuth();
  const [data, setData] = useState<RankingRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRanking = async () => {
    try {
      const { data: ranking, error } = await supabase.rpc("get_ranking");
      if (error) throw error;
      setData(ranking || []);
    } catch (e) {
      console.error("Erro:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRanking();
    const interval = setInterval(loadRanking, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="text-center py-12 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Trophy className="h-7 w-7 text-accent" /> Ranking global</h1>
        <p className="text-muted-foreground text-sm">Pontuação acumulada de todos os participantes.</p>
      </div>

      <Card className="border-border overflow-hidden">
        {data.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">Ninguém pontuou ainda.</div>
        ) : (
          <div className="divide-y divide-border">
            {data.map((row, idx) => (
              <RankingRow key={row.id} row={row} idx={idx} isMe={row.id === user?.id} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function RankingRow({ row, idx, isMe }: { row: RankingRow; idx: number; isMe: boolean }) {
  const medal = idx === 0 ? "text-yellow-400" : idx === 1 ? "text-gray-300" : idx === 2 ? "text-amber-600" : "";

  return (
    <div className={`${isMe ? "bg-primary/10" : ""}`}>
      <div className="flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors">
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
        </div>
        <div className="text-right">
          <p className="font-bold text-lg">{row.total_pts}</p>
          <p className="text-xs text-muted-foreground">pts</p>
        </div>
      </div>
    </div>
  );
}