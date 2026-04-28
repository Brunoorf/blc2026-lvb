import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import AuthGate from "@/components/AuthGate";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/regras")({
  component: () => <AuthGate><Regras /></AuthGate>,
});

function Regras() {
  const { data } = useQuery({
    queryKey: ["scoring-rules-public"],
    queryFn: async () => (await supabase.from("scoring_rules").select("*")).data ?? [],
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Star className="h-7 w-7 text-accent" /> Regras de pontuação</h1>
        <p className="text-muted-foreground text-sm">Como você ganha pontos no bolão.</p>
      </div>

      <Card className="p-6 border-border">
        <div className="grid gap-3">
          {(data ?? []).map((r) => (
            <div key={r.id} className="flex items-start justify-between gap-4 p-3 rounded-lg bg-muted/40">
              <div className="min-w-0">
                <p className="font-semibold">{r.label}</p>
                {r.description && <p className="text-sm text-muted-foreground">{r.description}</p>}
              </div>
              <span className="text-2xl font-bold text-primary shrink-0">+{r.points}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6 border-border bg-accent/5">
        <h3 className="font-bold mb-2">Como funciona o bônus Zebra</h3>
        <p className="text-sm text-muted-foreground">
          Se você palpitar que uma seleção fora do Top 15 do ranking FIFA chegará pelo menos às quartas de final, e isso de fato acontecer, você ganha +50 pontos por seleção zebra.
        </p>
      </Card>
    </div>
  );
}