import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Lock, Save, Trophy, Users } from "lucide-react";
import AuthGate from "@/components/AuthGate";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { computeGroupStandings } from "@/lib/group-table";
import { PHASE_LABEL, type MatchPhase } from "@/lib/scoring";

export const Route = createFileRoute("/palpites")({
  component: () => <AuthGate><PalpitesPage /></AuthGate>,
});

function PalpitesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["palpites", user?.id],
    queryFn: async () => {
      const [groups, teams, matches, preds, settings, special] = await Promise.all([
        supabase.from("groups").select("*").order("id"),
        supabase.from("teams").select("*").order("name"),
        supabase.from("matches").select("*").order("match_number"),
        supabase.from("predictions").select("*").eq("user_id", user!.id),
        supabase.from("tournament_settings").select("*").maybeSingle(),
        supabase.from("special_predictions").select("*").eq("user_id", user!.id).maybeSingle(),
      ]);
      return {
        groups: groups.data ?? [],
        teams: teams.data ?? [],
        matches: matches.data ?? [],
        preds: preds.data ?? [],
        settings: settings.data,
        special: special.data,
      };
    },
    enabled: !!user,
  });

  const teamsById = useMemo(() => {
    const m = new Map<string, any>();
    (data?.teams ?? []).forEach((t) => m.set(t.id, t));
    return m;
  }, [data?.teams]);

  const groupLocked = data?.settings?.group_picks_locked ?? false;

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Meus palpites</h1>
          <p className="text-muted-foreground text-sm">Preencha placar de cada partida e suas previsões especiais.</p>
        </div>
        {groupLocked && (
          <Badge variant="destructive" className="gap-1"><Lock className="h-3 w-3" /> Palpites de grupo travados</Badge>
        )}
      </div>

      <Tabs defaultValue="groups">
        <TabsList className="w-full overflow-x-auto justify-start">
          <TabsTrigger value="groups">Fase de grupos</TabsTrigger>
          <TabsTrigger value="ko">Mata-mata</TabsTrigger>
          <TabsTrigger value="special">Especiais</TabsTrigger>
        </TabsList>

        <TabsContent value="groups" className="space-y-6 mt-6">
          {(data?.groups ?? []).map((g) => (
            <GroupBlock
              key={g.id}
              group={g}
              teams={(data?.teams ?? []).filter((t) => t.group_id === g.id)}
              matches={(data?.matches ?? []).filter((m) => m.group_id === g.id)}
              preds={data?.preds ?? []}
              teamsById={teamsById}
              locked={groupLocked}
              onSaved={() => qc.invalidateQueries({ queryKey: ["palpites"] })}
            />
          ))}
        </TabsContent>

        <TabsContent value="ko" className="mt-6">
          <KnockoutPanel
            matches={(data?.matches ?? []).filter((m) => m.phase !== "group")}
            preds={data?.preds ?? []}
            teamsById={teamsById}
            locked={data?.settings?.knockout_picks_locked ?? false}
            phaseOpen={data?.settings?.current_phase === "knockout"}
            onSaved={() => qc.invalidateQueries({ queryKey: ["palpites"] })}
          />
        </TabsContent>

        <TabsContent value="special" className="mt-6">
          <SpecialPanel teams={data?.teams ?? []} initial={data?.special} onSaved={() => qc.invalidateQueries({ queryKey: ["palpites"] })} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function GroupBlock({ group, teams, matches, preds, teamsById, locked, onSaved }: any) {
  // Build local form state for predictions
  const [scores, setScores] = useState<Record<string, { h: string; a: string }>>(() => {
    const m: Record<string, { h: string; a: string }> = {};
    matches.forEach((mt: any) => {
      const p = preds.find((x: any) => x.match_id === mt.id);
      m[mt.id] = { h: p ? String(p.home_score) : "", a: p ? String(p.away_score) : "" };
    });
    return m;
  });
  const [saving, setSaving] = useState(false);

  // Live preview standings
  const previewMatches = matches
    .map((mt: any) => {
      const s = scores[mt.id];
      const h = parseInt(s?.h ?? "");
      const a = parseInt(s?.a ?? "");
      if (Number.isNaN(h) || Number.isNaN(a)) return null;
      return { home_team_id: mt.home_team_id, away_team_id: mt.away_team_id, home_score: h, away_score: a };
    })
    .filter(Boolean);

  const standings = computeGroupStandings(teams.map((t: any) => t.id), previewMatches as any);

  async function handleSave() {
    setSaving(true);
    const rows = matches
      .map((mt: any) => {
        const s = scores[mt.id];
        const h = parseInt(s.h);
        const a = parseInt(s.a);
        if (Number.isNaN(h) || Number.isNaN(a)) return null;
        return { user_id: mt.user_id, match_id: mt.id, home_score: h, away_score: a };
      })
      .filter(Boolean);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = rows.map((r: any) => ({ ...r, user_id: user!.id }));
    if (payload.length === 0) {
      toast.info("Preencha pelo menos um placar.");
      setSaving(false);
      return;
    }
    const { error } = await supabase.from("predictions").upsert(payload, { onConflict: "user_id,match_id" });
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success(`Palpites do ${group.name} salvos!`);
    onSaved();
  }

  return (
    <Card className="p-5 border-border">
      <div className="flex items-center gap-2 mb-4">
        <span className="h-9 w-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center font-bold">
          {group.id}
        </span>
        <h3 className="font-bold text-lg">{group.name}</h3>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-2">
          {matches.sort((x: any, y: any) => x.match_number - y.match_number).map((mt: any) => {
            const home = teamsById.get(mt.home_team_id);
            const away = teamsById.get(mt.away_team_id);
            return (
              <div key={mt.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/40">
                <span className="text-xs text-muted-foreground w-16 shrink-0">{mt.round_label}</span>
                <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
                  <span className="font-medium text-sm truncate">{home?.name}</span>
                  <span className="text-lg shrink-0">{home?.flag}</span>
                </div>
                <Input
                  type="number" min={0} max={20} disabled={locked}
                  value={scores[mt.id]?.h ?? ""}
                  onChange={(e) => setScores((s) => ({ ...s, [mt.id]: { ...s[mt.id], h: e.target.value } }))}
                  className="w-12 text-center"
                />
                <span className="text-muted-foreground">x</span>
                <Input
                  type="number" min={0} max={20} disabled={locked}
                  value={scores[mt.id]?.a ?? ""}
                  onChange={(e) => setScores((s) => ({ ...s, [mt.id]: { ...s[mt.id], a: e.target.value } }))}
                  className="w-12 text-center"
                />
                <div className="flex-1 flex items-center gap-2 min-w-0">
                  <span className="text-lg shrink-0">{away?.flag}</span>
                  <span className="font-medium text-sm truncate">{away?.name}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div>
          <p className="text-xs uppercase text-muted-foreground font-semibold mb-2 flex items-center gap-1">
            <Users className="h-3 w-3" /> Tabela prevista
          </p>
          <div className="space-y-1">
            {standings.map((s, idx) => {
              const t = teamsById.get(s.team_id);
              const advances = idx < 2;
              const third = idx === 2;
              return (
                <div key={s.team_id} className={`flex items-center gap-2 p-2 rounded-md text-sm ${advances ? "bg-primary/10 border border-primary/30" : third ? "bg-accent/10 border border-accent/30" : "bg-muted/40"}`}>
                  <span className="w-5 text-center text-xs font-bold text-muted-foreground">{idx + 1}º</span>
                  <span>{t?.flag}</span>
                  <span className="flex-1 truncate font-medium">{t?.name}</span>
                  <span className="text-xs text-muted-foreground w-10 text-right">{s.gf}:{s.ga}</span>
                  <span className="font-bold w-6 text-right">{s.points}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-4">
        <Button onClick={handleSave} disabled={locked || saving}><Save className="h-4 w-4 mr-2" /> Salvar grupo</Button>
      </div>
    </Card>
  );
}

function KnockoutPanel({ matches, preds, teamsById, locked, phaseOpen, onSaved }: any) {
  // Match predictions for KO matches that already have teams set by admin
  const playable = matches.filter((m: any) => m.home_team_id && m.away_team_id);

  const [scores, setScores] = useState<Record<string, { h: string; a: string }>>(() => {
    const m: Record<string, { h: string; a: string }> = {};
    playable.forEach((mt: any) => {
      const p = preds.find((x: any) => x.match_id === mt.id);
      m[mt.id] = { h: p ? String(p.home_score) : "", a: p ? String(p.away_score) : "" };
    });
    return m;
  });

  if (!phaseOpen && playable.length === 0) {
    return (
      <Card className="p-12 text-center border-dashed">
        <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <h3 className="font-bold text-lg mb-1">Mata-mata ainda não liberado</h3>
        <p className="text-muted-foreground text-sm">Os jogos do mata-mata serão criados pelo administrador após a fase de grupos.</p>
      </Card>
    );
  }

  async function handleSave() {
    const { data: { user } } = await supabase.auth.getUser();
    const payload = playable
      .map((mt: any) => {
        const s = scores[mt.id];
        const h = parseInt(s?.h ?? "");
        const a = parseInt(s?.a ?? "");
        if (Number.isNaN(h) || Number.isNaN(a)) return null;
        return { user_id: user!.id, match_id: mt.id, home_score: h, away_score: a };
      })
      .filter(Boolean);
    if (payload.length === 0) return toast.info("Preencha algum palpite.");
    const { error } = await supabase.from("predictions").upsert(payload as any[], { onConflict: "user_id,match_id" });
    if (error) return toast.error(error.message);
    toast.success("Palpites do mata-mata salvos!");
    onSaved();
  }

  const byPhase: Record<string, any[]> = {};
  playable.forEach((m: any) => {
    (byPhase[m.phase] ??= []).push(m);
  });

  return (
    <div className="space-y-6">
      {Object.entries(byPhase).map(([phase, ms]) => (
        <Card key={phase} className="p-5 border-border">
          <h3 className="font-bold mb-3">{PHASE_LABEL[phase as MatchPhase]}</h3>
          <div className="space-y-2">
            {ms.map((mt: any) => {
              const home = teamsById.get(mt.home_team_id);
              const away = teamsById.get(mt.away_team_id);
              return (
                <div key={mt.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/40">
                  <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
                    <span className="font-medium text-sm truncate">{home?.name}</span>
                    <span className="text-lg shrink-0">{home?.flag}</span>
                  </div>
                  <Input type="number" min={0} max={20} disabled={locked}
                    value={scores[mt.id]?.h ?? ""}
                    onChange={(e) => setScores((s) => ({ ...s, [mt.id]: { ...s[mt.id], h: e.target.value } }))}
                    className="w-12 text-center" />
                  <span className="text-muted-foreground">x</span>
                  <Input type="number" min={0} max={20} disabled={locked}
                    value={scores[mt.id]?.a ?? ""}
                    onChange={(e) => setScores((s) => ({ ...s, [mt.id]: { ...s[mt.id], a: e.target.value } }))}
                    className="w-12 text-center" />
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <span className="text-lg shrink-0">{away?.flag}</span>
                    <span className="font-medium text-sm truncate">{away?.name}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ))}
      {playable.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={locked}><Save className="h-4 w-4 mr-2" /> Salvar mata-mata</Button>
        </div>
      )}
    </div>
  );
}

function SpecialPanel({ teams, initial, onSaved }: any) {
  const [champion, setChampion] = useState<string>(initial?.champion_team_id ?? "");
  const [topScorer, setTopScorer] = useState<string>(initial?.top_scorer ?? "");
  const [bestGk, setBestGk] = useState<string>(initial?.best_goalkeeper ?? "");
  const [bestPlayer, setBestPlayer] = useState<string>(initial?.best_player ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initial) {
      setChampion(initial.champion_team_id ?? "");
      setTopScorer(initial.top_scorer ?? "");
      setBestGk(initial.best_goalkeeper ?? "");
      setBestPlayer(initial.best_player ?? "");
    }
  }, [initial]);

  async function handleSave() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("special_predictions").upsert({
      user_id: user!.id,
      champion_team_id: champion || null,
      top_scorer: topScorer.trim() || null,
      best_goalkeeper: bestGk.trim() || null,
      best_player: bestPlayer.trim() || null,
    }, { onConflict: "user_id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Palpites especiais salvos!");
    onSaved();
  }

  return (
    <Card className="p-6 border-border max-w-xl">
      <h3 className="font-bold mb-4 flex items-center gap-2"><Trophy className="h-4 w-4 text-accent" /> Previsões especiais</h3>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-1 block">Campeão da Copa</label>
          <Select value={champion} onValueChange={setChampion}>
            <SelectTrigger><SelectValue placeholder="Escolha uma seleção" /></SelectTrigger>
            <SelectContent className="max-h-72">
              {teams.map((t: any) => (
                <SelectItem key={t.id} value={t.id}>{t.flag} {t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Artilheiro</label>
          <Input value={topScorer} onChange={(e) => setTopScorer(e.target.value)} placeholder="Nome do jogador" />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Melhor goleiro</label>
          <Input value={bestGk} onChange={(e) => setBestGk(e.target.value)} placeholder="Nome do goleiro" />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Melhor jogador</label>
          <Input value={bestPlayer} onChange={(e) => setBestPlayer(e.target.value)} placeholder="Nome do jogador" />
        </div>
        <Button onClick={handleSave} disabled={saving} className="w-full"><Save className="h-4 w-4 mr-2" /> Salvar especiais</Button>
      </div>
    </Card>
  );
}