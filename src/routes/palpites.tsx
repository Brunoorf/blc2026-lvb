import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Lock, Save, Trophy, Users } from "lucide-react";
import AuthGate from "@/components/AuthGate";
import TeamFlag from "@/components/TeamFlag";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Minus, Plus } from "lucide-react";
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

function ScoreInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const num = value === "" ? null : parseInt(value);
  const set = (v: number) => onChange(String(Math.max(0, Math.min(20, v))));
  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-background overflow-hidden shadow-sm">
      <button
        type="button"
        disabled={disabled}
        onClick={() => set((num ?? 0) - 1)}
        className="h-9 w-7 flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
        aria-label="Diminuir"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={20}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-10 text-center text-lg font-bold bg-transparent outline-none border-x border-border disabled:opacity-50"
        placeholder="-"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => set((num ?? 0) + 1)}
        className="h-9 w-7 flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
        aria-label="Aumentar"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function PalpitesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
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

      if (groups.error) throw groups.error;
      if (teams.error) throw teams.error;
      if (matches.error) throw matches.error;

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
  if (error) return <div className="text-center py-12 text-red-500 font-bold">Erro ao carregar dados: {error.message}</div>;

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
              onSaved={() => {
                qc.invalidateQueries({ queryKey: ["palpites"] });
                qc.invalidateQueries({ queryKey: ["bracket"] });
              }}
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
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ["palpites"] });
              qc.invalidateQueries({ queryKey: ["bracket"] });
            }}
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
              <div key={mt.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground w-14 shrink-0 font-semibold">{mt.round_label}</span>
                <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
                  <span className="font-medium text-sm truncate">{home?.name}</span>
                  <TeamFlag code={home?.code} fallback={home?.flag} size={24} />
                </div>
                <ScoreInput
                  disabled={locked}
                  value={scores[mt.id]?.h ?? ""}
                  onChange={(v) => setScores((s) => ({ ...s, [mt.id]: { ...s[mt.id], h: v } }))}
                />
                <span className="text-muted-foreground text-xs">×</span>
                <ScoreInput
                  disabled={locked}
                  value={scores[mt.id]?.a ?? ""}
                  onChange={(v) => setScores((s) => ({ ...s, [mt.id]: { ...s[mt.id], a: v } }))}
                />
                <div className="flex-1 flex items-center gap-2 min-w-0">
                  <TeamFlag code={away?.code} fallback={away?.flag} size={24} />
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
                  <TeamFlag code={t?.code} fallback={t?.flag} size={20} />
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

  const [scores, setScores] = useState<Record<string, { h: string; a: string; adv: string }>>(() => {
    const m: Record<string, { h: string; a: string; adv: string }> = {};
    playable.forEach((mt: any) => {
      const p = preds.find((x: any) => x.match_id === mt.id);
      m[mt.id] = { h: p ? String(p.home_score) : "", a: p ? String(p.away_score) : "", adv: p?.advancing_team_id || "" };
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
    
    // Check if any draw is missing advancing team
    for (const mt of playable) {
      const s = scores[mt.id];
      if (s?.h !== "" && s?.a !== "" && s?.h === s?.a && !s?.adv) {
         return toast.error("Por favor, selecione quem avança nos jogos empatados.");
      }
    }

    const payload = playable
      .map((mt: any) => {
        const s = scores[mt.id];
        const h = parseInt(s?.h ?? "");
        const a = parseInt(s?.a ?? "");
        if (Number.isNaN(h) || Number.isNaN(a)) return null;
        return { 
          user_id: user!.id, 
          match_id: mt.id, 
          home_score: h, 
          away_score: a,
          advancing_team_id: h === a ? (s.adv || null) : null
        };
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
                <div key={mt.id} className="flex flex-col gap-2 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
                      <span className="font-medium text-sm truncate">{home?.name}</span>
                      <TeamFlag code={home?.code} fallback={home?.flag} size={24} />
                    </div>
                    <ScoreInput disabled={locked}
                      value={scores[mt.id]?.h ?? ""}
                      onChange={(v) => setScores((s) => ({ ...s, [mt.id]: { ...s[mt.id], h: v } }))} />
                    <span className="text-muted-foreground text-xs">×</span>
                    <ScoreInput disabled={locked}
                      value={scores[mt.id]?.a ?? ""}
                      onChange={(v) => setScores((s) => ({ ...s, [mt.id]: { ...s[mt.id], a: v } }))} />
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      <TeamFlag code={away?.code} fallback={away?.flag} size={24} />
                      <span className="font-medium text-sm truncate">{away?.name}</span>
                    </div>
                  </div>
                  
                  {scores[mt.id]?.h !== "" && scores[mt.id]?.a !== "" && scores[mt.id]?.h === scores[mt.id]?.a && (
                    <div className="bg-primary/5 p-2 rounded border border-primary/20 flex flex-col items-center gap-2 mt-1">
                      <span className="text-xs font-medium text-muted-foreground">Quem avança?</span>
                      <div className="flex items-center justify-center gap-4">
                        <button 
                           onClick={() => setScores((s) => ({ ...s, [mt.id]: { ...s[mt.id], adv: home?.id } }))}
                           className={`px-3 py-1 text-xs rounded-full border transition-colors flex items-center gap-2 ${scores[mt.id]?.adv === home?.id ? 'bg-primary text-primary-foreground border-primary font-bold' : 'bg-background hover:bg-muted'}`}>
                          <TeamFlag code={home?.code} fallback={home?.flag} size={14} /> {home?.name}
                        </button>
                        <button 
                           onClick={() => setScores((s) => ({ ...s, [mt.id]: { ...s[mt.id], adv: away?.id } }))}
                           className={`px-3 py-1 text-xs rounded-full border transition-colors flex items-center gap-2 ${scores[mt.id]?.adv === away?.id ? 'bg-primary text-primary-foreground border-primary font-bold' : 'bg-background hover:bg-muted'}`}>
                          <TeamFlag code={away?.code} fallback={away?.flag} size={14} /> {away?.name}
                        </button>
                      </div>
                    </div>
                  )}
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
  const [underdog, setUnderdog] = useState<string>(initial?.underdog_team_id ?? "");
  const [topScorer, setTopScorer] = useState<string>(initial?.top_scorer ?? "");
  const [bestGk, setBestGk] = useState<string>(initial?.best_goalkeeper ?? "");
  const [bestPlayer, setBestPlayer] = useState<string>(initial?.best_player ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initial) {
      setChampion(initial.champion_team_id ?? "");
      setUnderdog(initial.underdog_team_id ?? "");
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
      underdog_team_id: underdog || null,
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
                <SelectItem key={t.id} value={t.id}><TeamFlag code={t.code} fallback={t.flag} size={16} className="mr-1" /> {t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Seleção Zebra</label>
          <Select value={underdog} onValueChange={setUnderdog}>
            <SelectTrigger><SelectValue placeholder="Escolha sua aposta de zebra" /></SelectTrigger>
            <SelectContent className="max-h-72">
              {teams.map((t: any) => (
                <SelectItem key={t.id} value={t.id}><TeamFlag code={t.code} fallback={t.flag} size={16} className="mr-1" /> {t.name}</SelectItem>
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