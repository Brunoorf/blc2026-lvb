import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Lock, Save, Trophy, Users, Check, AlertCircle, Circle } from "lucide-react";
import AuthGate from "@/components/AuthGate";
import TeamFlag from "@/components/TeamFlag";
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

function ScoreInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const num = value === "" ? null : parseInt(value);
  const set = (v: number) => onChange(String(Math.max(0, Math.min(20, v))));
  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-background overflow-hidden shadow-sm">
      <button type="button" disabled={disabled || num === 0} onClick={() => set((num ?? 1) - 1)} className="h-11 w-10 sm:h-10 sm:w-9 md:h-9 md:w-8 flex items-center justify-center text-lg font-bold text-muted-foreground hover:bg-muted active:bg-muted/80 disabled:opacity-30 transition-colors select-none" aria-label="Diminuir">−</button>
      <input type="number" inputMode="numeric" pattern="[0-9]*" min={0} max={20} disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-11 sm:h-10 sm:w-10 md:h-9 md:w-10 text-center text-lg font-bold bg-transparent outline-none border-x border-border disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="–" />
      <button type="button" disabled={disabled} onClick={() => set((num ?? -1) + 1)} className="h-11 w-10 sm:h-10 sm:w-9 md:h-9 md:w-8 flex items-center justify-center text-lg font-bold text-muted-foreground hover:bg-muted active:bg-muted/80 disabled:opacity-30 transition-colors select-none" aria-label="Aumentar">+</button>
    </div>
  );
}

type GroupSaveStatus = "empty" | "partial" | "complete";

function getGroupStatus(groupMatches: any[], preds: any[]): GroupSaveStatus {
  const predIds = new Set(preds.filter(p => p.home_score != null && p.away_score != null).map(p => p.match_id));
  let filled = 0;
  for (const m of groupMatches) { if (predIds.has(m.id)) filled++; }
  if (filled === 0) return "empty";
  if (filled === groupMatches.length) return "complete";
  return "partial";
}

function GroupStatusBadge({ status }: { status: GroupSaveStatus }) {
  if (status === "complete") return (<span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/30"><Check className="h-3 w-3" /> Salvo</span>);
  if (status === "partial") return (<span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30"><AlertCircle className="h-3 w-3" /> Incompleto</span>);
  return (<span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border"><Circle className="h-3 w-3" /> Pendente</span>);
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
      return { groups: groups.data ?? [], teams: teams.data ?? [], matches: matches.data ?? [], preds: preds.data ?? [], settings: settings.data, special: special.data };
    },
    enabled: !!user,
  });

  const teamsById = useMemo(() => { const m = new Map<string, any>(); (data?.teams ?? []).forEach((t) => m.set(t.id, t)); return m; }, [data?.teams]);
  const groupLocked = data?.settings?.group_picks_locked ?? false;
  const specialLocked = data?.settings?.special_picks_locked ?? false;
  const totalGroupMatches = (data?.matches ?? []).filter(m => m.phase === "group").length;
  const filledPreds = (data?.preds ?? []).filter(p => { const m = (data?.matches ?? []).find(mt => mt.id === p.match_id); return m?.phase === "group" && p.home_score != null && p.away_score != null; }).length;
  const progressPct = totalGroupMatches > 0 ? Math.round((filledPreds / totalGroupMatches) * 100) : 0;
  const groupStatuses = useMemo(() => {
    const statuses: Record<string, GroupSaveStatus> = {};
    for (const g of data?.groups ?? []) {
      const gMatches = (data?.matches ?? []).filter(m => m.group_id === g.id && m.phase === "group");
      const gPreds = (data?.preds ?? []).filter(p => gMatches.some(m => m.id === p.match_id));
      statuses[g.id] = getGroupStatus(gMatches, gPreds);
    }
    return statuses;
  }, [data]);

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Carregando...</div>;
  if (error) return <div className="text-center py-12 text-red-500 font-bold">Erro ao carregar dados: {error.message}</div>;

  const completeCount = Object.values(groupStatuses).filter(s => s === "complete").length;
  const totalGroups = Object.keys(groupStatuses).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Meus palpites</h1>
          <p className="text-muted-foreground text-sm">Preencha o placar de cada partida e salve por grupo.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Progresso</p>
            <p className="text-sm font-bold">{filledPreds}/{totalGroupMatches} jogos · {completeCount}/{totalGroups} grupos</p>
          </div>
          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progressPct}%`, background: progressPct === 100 ? 'var(--primary)' : 'var(--accent)' }} />
          </div>
          {groupLocked && <Badge variant="destructive" className="gap-1"><Lock className="h-3 w-3" /> Travados</Badge>}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(data?.groups ?? []).map((g) => {
          const status = groupStatuses[g.id];
          const bgClass = status === "complete" ? "bg-green-500/20 border-green-500/40 text-green-400" : status === "partial" ? "bg-amber-500/20 border-amber-500/40 text-amber-400" : "bg-muted/50 border-border text-muted-foreground";
          return (
            <a key={g.id} href={`#grupo-${g.id}`} className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-all hover:scale-105 ${bgClass}`}>
              {status === "complete" && <Check className="h-3 w-3" />}
              {status === "partial" && <AlertCircle className="h-3 w-3" />}
              {g.id}
            </a>
          );
        })}
      </div>

      <Tabs defaultValue="groups">
        <TabsList className="w-full overflow-x-auto justify-start">
          <TabsTrigger value="groups">Fase de grupos</TabsTrigger>
          <TabsTrigger value="ko">Mata-mata</TabsTrigger>
          <TabsTrigger value="special">Especiais</TabsTrigger>
        </TabsList>
        <TabsContent value="groups" className="space-y-6 mt-6">
          {(data?.groups ?? []).map((g) => (
            <GroupBlock key={g.id} group={g} teams={(data?.teams ?? []).filter((t) => t.group_id === g.id)} matches={(data?.matches ?? []).filter((m) => m.group_id === g.id)} preds={data?.preds ?? []} teamsById={teamsById} locked={groupLocked} status={groupStatuses[g.id]} onSaved={() => { qc.invalidateQueries({ queryKey: ["palpites"] }); qc.invalidateQueries({ queryKey: ["bracket"] }); }} />
          ))}
        </TabsContent>
        <TabsContent value="ko" className="mt-6">
          <KnockoutPanel matches={(data?.matches ?? []).filter((m) => m.phase !== "group")} preds={data?.preds ?? []} teamsById={teamsById} locked={data?.settings?.knockout_picks_locked ?? false} phaseOpen={data?.settings?.current_phase === "knockout"} onSaved={() => { qc.invalidateQueries({ queryKey: ["palpites"] }); qc.invalidateQueries({ queryKey: ["bracket"] }); }} />
        </TabsContent>
        <TabsContent value="special" className="mt-6">
          <SpecialPanel teams={data?.teams ?? []} initial={data?.special} locked={specialLocked} onSaved={() => qc.invalidateQueries({ queryKey: ["palpites"] })} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function GroupBlock({ group, teams, matches, preds, teamsById, locked, status, onSaved }: any) {
  const [scores, setScores] = useState<Record<string, { h: string; a: string }>>(() => {
    const m: Record<string, { h: string; a: string }> = {};
    matches.forEach((mt: any) => { const p = preds.find((x: any) => x.match_id === mt.id); m[mt.id] = { h: p?.home_score != null ? String(p.home_score) : "", a: p?.away_score != null ? String(p.away_score) : "" }; });
    return m;
  });
  const [saving, setSaving] = useState(false);
  const groupMatches = matches.filter((m: any) => m.phase === "group");
  const hasUnsaved = useMemo(() => {
    for (const mt of groupMatches) {
      const s = scores[mt.id]; const p = preds.find((x: any) => x.match_id === mt.id);
      if ((s?.h ?? "") !== (p?.home_score != null ? String(p.home_score) : "") || (s?.a ?? "") !== (p?.away_score != null ? String(p.away_score) : "")) return true;
    }
    return false;
  }, [scores, preds, groupMatches]);
  const previewMatches = matches.map((mt: any) => { const s = scores[mt.id]; const h = parseInt(s?.h ?? ""); const a = parseInt(s?.a ?? ""); if (Number.isNaN(h) || Number.isNaN(a)) return null; return { home_team_id: mt.home_team_id, away_team_id: mt.away_team_id, home_score: h, away_score: a }; }).filter(Boolean);
  const standings = computeGroupStandings(teams.map((t: any) => t.id), previewMatches as any);

  async function handleSave() {
    setSaving(true);
    const rows = matches.map((mt: any) => { const s = scores[mt.id]; const h = parseInt(s.h); const a = parseInt(s.a); if (Number.isNaN(h) || Number.isNaN(a)) return null; return { user_id: mt.user_id, match_id: mt.id, home_score: h, away_score: a }; }).filter(Boolean);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = rows.map((r: any) => ({ ...r, user_id: user!.id }));
    if (payload.length === 0) { toast.info("Preencha pelo menos um placar."); setSaving(false); return; }
    const { error } = await supabase.from("predictions").upsert(payload, { onConflict: "user_id,match_id" });
    setSaving(false);
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    toast.success(`Palpites do ${group.name} salvos!`);
    onSaved();
  }

  const filledCount = Object.values(scores).filter(s => s.h !== "" && s.a !== "").length;
  const totalMatches = groupMatches.length;

  return (
    <Card id={`grupo-${group.id}`} className="p-4 sm:p-5 border-border scroll-mt-20">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <span className="h-9 w-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center font-bold shrink-0">{group.id}</span>
        <h3 className="font-bold text-lg">{group.name}</h3>
        <GroupStatusBadge status={status} />
        <span className="ml-auto text-xs text-muted-foreground">{filledCount}/{totalMatches} jogos</span>
      </div>
      <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
        <div className="space-y-2">
          {matches.sort((x: any, y: any) => x.match_number - y.match_number).map((mt: any) => {
            const home = teamsById.get(mt.home_team_id);
            const away = teamsById.get(mt.away_team_id);
            const isFilled = scores[mt.id]?.h !== "" && scores[mt.id]?.a !== "";
            return (
              <div key={mt.id} className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg transition-colors ${isFilled ? "bg-primary/5 border border-primary/15" : "bg-muted/30 hover:bg-muted/50"}`}>
                <div className="shrink-0 w-14 sm:w-16">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold block">{mt.round_label}</span>
                  {mt.match_date && <span className="text-[9px] text-muted-foreground/70">{new Date(mt.match_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>}
                </div>
                <div className="flex-1 flex items-center justify-end gap-1.5 min-w-0">
                  <span className="font-medium text-xs sm:text-sm truncate">{home?.name}</span>
                  <TeamFlag code={home?.code} fallback={home?.flag} size={18} className="shrink-0" />
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <ScoreInput disabled={locked || mt.is_locked} value={scores[mt.id]?.h ?? ""} onChange={(v) => setScores((s) => ({ ...s, [mt.id]: { ...s[mt.id], h: v } }))} />
                  <span className="text-xs sm:text-sm text-muted-foreground">×</span>
                  <ScoreInput disabled={locked || mt.is_locked} value={scores[mt.id]?.a ?? ""} onChange={(v) => setScores((s) => ({ ...s, [mt.id]: { ...s[mt.id], a: v } }))} />
                </div>
                <div className="flex-1 flex items-center gap-1.5 min-w-0">
                  <TeamFlag code={away?.code} fallback={away?.flag} size={18} className="shrink-0" />
                  <span className="font-medium text-xs sm:text-sm truncate">{away?.name}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground font-semibold mb-2 flex items-center gap-1"><Users className="h-3 w-3" /> Tabela prevista</p>
          <div className="space-y-2">
            {standings.map((s, idx) => {
              const t = teamsById.get(s.team_id);
              const advances = idx < 2; const third = idx === 2;
              return (
                <div key={s.team_id} className={`flex items-center gap-3 p-2.5 rounded-md text-sm ${advances ? "bg-primary/10 border border-primary/30" : third ? "bg-accent/10 border border-accent/30" : "bg-muted/40"}`}>
                  <span className="w-6 sm:w-5 text-center text-xs font-bold text-muted-foreground">{idx + 1}º</span>
                  <TeamFlag code={t?.code} fallback={t?.flag} size={18} />
                  <span className="flex-1 truncate font-medium">{t?.name}</span>
                  <span className="text-xs text-muted-foreground w-14 sm:w-12 text-right">{s.gf}:{s.ga}</span>
                  <span className="font-bold w-8 sm:w-7 text-right">{s.points}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end mt-4 gap-3">
        {hasUnsaved && <span className="text-xs text-amber-400 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Alterações não salvas</span>}
        <Button onClick={handleSave} disabled={locked || saving} className={hasUnsaved ? "animate-pulse" : ""}><Save className="h-4 w-4 mr-2" /> Salvar grupo</Button>
      </div>
    </Card>
  );
}

const KO_PHASES: MatchPhase[] = ["r32", "r16", "qf", "sf", "third", "final"];

function KnockoutPanel({ matches, preds, teamsById, locked, phaseOpen, onSaved }: any) {
  const byPhase = useMemo(() => {
    const bp: Record<string, any[]> = {};
    for (const phase of KO_PHASES) { bp[phase] = matches.filter((m: any) => m.phase === phase).sort((a: any, b: any) => a.match_number - b.match_number); }
    return bp;
  }, [matches]);

  const hasAnyMatches = matches.length > 0;

  const [scores, setScores] = useState<Record<string, { h: string; a: string; adv: string }>>(() => {
    const s: Record<string, { h: string; a: string; adv: string }> = {};
    for (const mt of matches) { const p = preds.find((x: any) => x.match_id === mt.id); s[mt.id] = { h: p ? String(p.home_score) : "", a: p ? String(p.away_score) : "", adv: p?.advancing_team_id || "" }; }
    return s;
  });

  useEffect(() => {
    setScores(() => {
      const s: Record<string, { h: string; a: string; adv: string }> = {};
      for (const mt of matches) {
        const p = preds.find((x: any) => x.match_id === mt.id);
        s[mt.id] = { h: p ? String(p.home_score) : "", a: p ? String(p.away_score) : "", adv: p?.advancing_team_id || "" };
      }
      return s;
    });
  }, [preds]);

  const BRACKET_FEED: Partial<Record<MatchPhase, [number, number][]>> = {
    r16:   [[0,1],[2,3],[4,5],[6,7],[8,9],[10,11],[12,13],[14,15]],
    qf:    [[0,1],[2,3],[4,5],[6,7]],
    sf:    [[0,1],[2,3]],
    third: [[0,1]],
    final: [[0,1]],
  };

  // third place and final both source from sf; third uses losers, final uses winners
  const BRACKET_SOURCE: Partial<Record<MatchPhase, MatchPhase>> = { third: "sf", final: "sf" };
  const BRACKET_USE_LOSER = new Set<MatchPhase>(["third"]);

  const cascadeTeams = useMemo(() => {
    const result: Record<string, { home: string | null; away: string | null; fromCascade: boolean }> = {};
    function predictedWinner(matchId: string): string | null {
      const s = scores[matchId];
      if (!s || s.h === "" || s.a === "") return null;
      const h = parseInt(s.h); const a = parseInt(s.a);
      if (Number.isNaN(h) || Number.isNaN(a)) return null;
      const t = result[matchId];
      if (!t) return null;
      if (h > a) return t.home;
      if (a > h) return t.away;
      return s.adv || null;
    }
    function predictedLoser(matchId: string): string | null {
      const s = scores[matchId];
      if (!s || s.h === "" || s.a === "") return null;
      const h = parseInt(s.h); const a = parseInt(s.a);
      if (Number.isNaN(h) || Number.isNaN(a)) return null;
      const t = result[matchId];
      if (!t) return null;
      if (h > a) return t.away;
      if (a > h) return t.home;
      if (s.adv) return s.adv === t.home ? t.away : t.home;
      return null;
    }
    for (let pi = 0; pi < KO_PHASES.length; pi++) {
      const phase = KO_PHASES[pi];
      const srcPhase = BRACKET_SOURCE[phase] ?? (pi > 0 ? KO_PHASES[pi - 1] : null);
      const useLoser = BRACKET_USE_LOSER.has(phase);
      const phaseMatches = byPhase[phase] ?? [];
      const prevMatches = srcPhase ? (byPhase[srcPhase] ?? []) : [];
      for (let i = 0; i < phaseMatches.length; i++) {
        const m = phaseMatches[i];
        if (m.home_team_id && m.away_team_id) { result[m.id] = { home: m.home_team_id, away: m.away_team_id, fromCascade: false }; continue; }
        const feed = BRACKET_FEED[phase as MatchPhase];
        const [homeIdx, awayIdx] = feed?.[i] ?? [i * 2, i * 2 + 1];
        const prevHome = prevMatches[homeIdx]; const prevAway = prevMatches[awayIdx];
        const getTeam = useLoser ? predictedLoser : predictedWinner;
        result[m.id] = { home: m.home_team_id || (prevHome ? getTeam(prevHome.id) : null), away: m.away_team_id || (prevAway ? getTeam(prevAway.id) : null), fromCascade: true };
      }
    }
    return result;
  }, [byPhase, scores]);

  if (!phaseOpen && !hasAnyMatches) {
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
    for (const mt of matches) {
      const s = scores[mt.id];
      if (s?.h !== "" && s?.a !== "" && s?.h === s?.a && !s?.adv) return toast.error("Por favor, selecione quem avança nos jogos empatados.");
    }
    const payload = matches.map((mt: any) => { const s = scores[mt.id]; const h = parseInt(s?.h ?? ""); const a = parseInt(s?.a ?? ""); if (Number.isNaN(h) || Number.isNaN(a)) return null; return { user_id: user!.id, match_id: mt.id, home_score: h, away_score: a, advancing_team_id: h === a ? (s.adv || null) : null }; }).filter(Boolean);
    if (payload.length === 0) return toast.info("Preencha algum palpite.");
    const { error } = await supabase.from("predictions").upsert(payload as any[], { onConflict: "user_id,match_id" });
    if (error) return toast.error(error.message);
    toast.success("Palpites do mata-mata salvos!");
    onSaved();
  }

  return (
    <div className="space-y-6">
      {locked && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
          <Lock className="h-4 w-4 text-destructive shrink-0" />
          <span className="text-sm text-destructive font-medium">Palpites do mata-mata travados pelo administrador.</span>
        </div>
      )}
      {KO_PHASES.map((phase) => {
        const phaseMatches = byPhase[phase] ?? [];
        if (phaseMatches.length === 0) return null;
        return (
          <Card key={phase} className="p-5 border-border">
            <h3 className="font-bold mb-3">{PHASE_LABEL[phase]}</h3>
            <div className="space-y-3">
              {phaseMatches.map((mt: any) => {
                const cascade = cascadeTeams[mt.id];
                const home = cascade?.home ? teamsById.get(cascade.home) : null;
                const away = cascade?.away ? teamsById.get(cascade.away) : null;
                const teamsReady = !!home && !!away;
                const s = scores[mt.id] ?? { h: "", a: "", adv: "" };
                const isDraw = s.h !== "" && s.a !== "" && s.h === s.a;
                return (
                  <div key={mt.id} className="flex flex-col gap-2 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    {cascade?.fromCascade && (home || away) && <p className="text-[10px] text-accent/70 font-medium">↳ times do seu chaveamento</p>}
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="flex-1 flex items-center justify-end gap-1.5 sm:gap-2 min-w-0">
                        {home ? (<><span className={`font-medium text-xs sm:text-sm truncate ${cascade?.fromCascade ? "text-accent" : ""}`}>{home.name}</span><TeamFlag code={home.code} fallback={home.flag} size={20} /></>) : (<span className="text-xs text-muted-foreground italic">A definir</span>)}
                      </div>
                      <ScoreInput disabled={locked || !teamsReady} value={s.h} onChange={(v) => setScores((prev) => ({ ...prev, [mt.id]: { ...prev[mt.id], h: v } }))} />
                      <span className="text-muted-foreground text-xs">×</span>
                      <ScoreInput disabled={locked || !teamsReady} value={s.a} onChange={(v) => setScores((prev) => ({ ...prev, [mt.id]: { ...prev[mt.id], a: v } }))} />
                      <div className="flex-1 flex items-center gap-1.5 sm:gap-2 min-w-0">
                        {away ? (<><TeamFlag code={away.code} fallback={away.flag} size={20} /><span className={`font-medium text-xs sm:text-sm truncate ${cascade?.fromCascade ? "text-accent" : ""}`}>{away.name}</span></>) : (<span className="text-xs text-muted-foreground italic">A definir</span>)}
                      </div>
                    </div>
                    {isDraw && teamsReady && (
                      <div className="bg-primary/5 p-2 rounded border border-primary/20 flex flex-col items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">Quem avança?</span>
                        <div className="flex items-center justify-center gap-4">
                          <button disabled={locked} onClick={() => setScores((prev) => ({ ...prev, [mt.id]: { ...prev[mt.id], adv: cascade?.home ?? "" } }))} className={`px-3 py-1 text-xs rounded-full border transition-colors flex items-center gap-2 ${s.adv === cascade?.home ? "bg-primary text-primary-foreground border-primary font-bold" : "bg-background hover:bg-muted"}`}><TeamFlag code={home!.code} fallback={home!.flag} size={14} /> {home!.name}</button>
                          <button disabled={locked} onClick={() => setScores((prev) => ({ ...prev, [mt.id]: { ...prev[mt.id], adv: cascade?.away ?? "" } }))} className={`px-3 py-1 text-xs rounded-full border transition-colors flex items-center gap-2 ${s.adv === cascade?.away ? "bg-primary text-primary-foreground border-primary font-bold" : "bg-background hover:bg-muted"}`}><TeamFlag code={away!.code} fallback={away!.flag} size={14} /> {away!.name}</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
      {hasAnyMatches && (<div className="flex justify-end"><Button onClick={handleSave} disabled={locked}><Save className="h-4 w-4 mr-2" /> Salvar mata-mata</Button></div>)}
    </div>
  );
}

function SpecialPanel({ teams, initial, locked, onSaved }: any) {
  const [champion, setChampion] = useState<string>(initial?.champion_team_id ?? "");
  const [underdog, setUnderdog] = useState<string>(initial?.underdog_team_id ?? "");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (initial) { setChampion(initial.champion_team_id ?? ""); setUnderdog(initial.underdog_team_id ?? ""); } }, [initial]);
  async function handleSave() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("special_predictions").upsert({ user_id: user!.id, champion_team_id: champion || null, underdog_team_id: underdog || null }, { onConflict: "user_id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Palpites especiais salvos!");
    onSaved();
  }
  return (
    <Card className="p-6 border-border max-w-xl">
      <h3 className="font-bold mb-4 flex items-center gap-2"><Trophy className="h-4 w-4 text-accent" /> Previsões especiais {locked && <Badge variant="destructive" className="gap-1"><Lock className="h-3 w-3" /> Travadas</Badge>}</h3>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-1 block">Campeão da Copa</label>
          <Select value={champion} onValueChange={setChampion} disabled={locked}>
            <SelectTrigger disabled={locked}><SelectValue placeholder="Escolha uma seleção" /></SelectTrigger>
            <SelectContent className="max-h-72">{teams.map((t: any) => (<SelectItem key={t.id} value={t.id}><TeamFlag code={t.code} fallback={t.flag} size={16} className="mr-1" /> {t.name}</SelectItem>))}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Seleção Zebra <span className="text-xs text-muted-foreground">(fora do Top 15)</span></label>
          <Select value={underdog} onValueChange={setUnderdog} disabled={locked}>
            <SelectTrigger disabled={locked}><SelectValue placeholder="Escolha sua aposta de zebra" /></SelectTrigger>
            <SelectContent className="max-h-72">{teams.filter((t: any) => !t.is_top15).map((t: any) => (<SelectItem key={t.id} value={t.id}><TeamFlag code={t.code} fallback={t.flag} size={16} className="mr-1" /> {t.name}</SelectItem>))}</SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">Apenas seleções fora do Top 15 do ranking FIFA. Se chegar às quartas, você ganha bônus!</p>
        </div>
        <Button onClick={handleSave} disabled={saving || locked} className="w-full"><Save className="h-4 w-4 mr-2" /> Salvar especiais</Button>
      </div>
    </Card>
  );
}