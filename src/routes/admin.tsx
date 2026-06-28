import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Shield, Save, Calculator, AlertTriangle, Users, Plus, Trash2, GitBranch, Trophy } from "lucide-react";
import AuthGate from "@/components/AuthGate";
import TeamFlag from "@/components/TeamFlag";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { recomputeAllPoints } from "@/lib/recompute";
import { PHASE_LABEL, type MatchPhase } from "@/lib/scoring";
import { computeGroupStandings } from "@/lib/group-table";

export const Route = createFileRoute("/admin")({
  component: () => <AuthGate><AdminGate /></AuthGate>,
});

function AdminGate() {
  const { isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isAdmin) {
    return (
      <Card className="p-12 text-center max-w-md mx-auto">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-3" />
        <h2 className="text-xl font-bold mb-2">Acesso restrito</h2>
        <p className="text-muted-foreground text-sm mb-4">Apenas administradores podem acessar esta página.</p>
        <Button asChild><Link to="/">Voltar ao início</Link></Button>
      </Card>
    );
  }
  return <AdminPanel />;
}

function AdminPanel() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Shield className="h-7 w-7 text-accent" /> Painel administrativo</h1>
        <p className="text-muted-foreground text-sm">Gerencie o torneio, regras, resultados e recalcule pontuações.</p>
      </div>
      <Tabs defaultValue="tournament">
        <TabsList className="w-full overflow-x-auto justify-start">
          <TabsTrigger value="tournament">Torneio</TabsTrigger>
          <TabsTrigger value="rules">Pontuação</TabsTrigger>
          <TabsTrigger value="results">Resultados</TabsTrigger>
          <TabsTrigger value="knockout">Montar Mata-Mata</TabsTrigger>
          <TabsTrigger value="teams">Seleções</TabsTrigger>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="recompute">Recalcular</TabsTrigger>
        </TabsList>
        <TabsContent value="tournament" className="mt-6"><TournamentTab /></TabsContent>
        <TabsContent value="rules" className="mt-6"><RulesTab /></TabsContent>
        <TabsContent value="results" className="mt-6"><ResultsTab /></TabsContent>
        <TabsContent value="knockout" className="mt-6"><KnockoutBuilderTab /></TabsContent>
        <TabsContent value="teams" className="mt-6"><TeamsTab /></TabsContent>
        <TabsContent value="users" className="mt-6"><UsersTab /></TabsContent>
        <TabsContent value="recompute" className="mt-6"><RecomputeTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ── Tournament Settings ── */
function TournamentTab() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await supabase.from("tournament_settings").select("*").maybeSingle()).data,
  });
  const [phase, setPhase] = useState(data?.current_phase ?? "groups");
  const [groupLocked, setGroupLocked] = useState(data?.group_picks_locked ?? false);
  const [koLocked, setKoLocked] = useState(data?.knockout_picks_locked ?? false);
  const [specialLocked, setSpecialLocked] = useState(data?.special_picks_locked ?? false);
  const [communityVisible, setCommunityVisible] = useState(data?.community_predictions_visible ?? false);

  useEffect(() => {
    if (data) {
      setPhase(data.current_phase);
      setGroupLocked(data.group_picks_locked);
      setKoLocked(data.knockout_picks_locked);
      setSpecialLocked(data.special_picks_locked);
      setCommunityVisible(data.community_predictions_visible);
    }
  }, [data]);

  async function save() {
    const { error } = await supabase.from("tournament_settings").update({
      current_phase: phase,
      group_picks_locked: groupLocked,
      knockout_picks_locked: koLocked,
      special_picks_locked: specialLocked,
      community_predictions_visible: communityVisible,
    } as any).eq("id", 1);
    if (error) return toast.error(error.message);
    toast.success("Configurações atualizadas!");
    qc.invalidateQueries({ queryKey: ["settings"] });
  }

  return (
    <Card className="p-6 max-w-xl space-y-5">
      <div>
        <label className="text-sm font-medium mb-1 block">Fase atual</label>
        <Select value={phase} onValueChange={(v) => setPhase(v as any)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="groups">Fase de grupos</SelectItem>
            <SelectItem value="knockout">Mata-mata</SelectItem>
            <SelectItem value="finished">Encerrado</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
        <div><p className="font-medium">Travar palpites de grupos</p><p className="text-xs text-muted-foreground">Usuários não poderão mais editar.</p></div>
        <Switch checked={groupLocked} onCheckedChange={setGroupLocked} />
      </div>
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
        <div><p className="font-medium">Travar palpites do mata-mata</p><p className="text-xs text-muted-foreground">Usuários não poderão mais editar.</p></div>
        <Switch checked={koLocked} onCheckedChange={async (v) => {
          setKoLocked(v);
          const { error } = await supabase.from("tournament_settings").update({ knockout_picks_locked: v } as any).eq("id", 1);
          if (error) { toast.error(error.message); setKoLocked(!v); }
          else { toast.success(v ? "Palpites do mata-mata bloqueados!" : "Palpites do mata-mata liberados!"); qc.invalidateQueries({ queryKey: ["settings"] }); }
        }} />
      </div>
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
        <div><p className="font-medium">Travar palpites especiais</p><p className="text-xs text-muted-foreground">Usuários não poderão editar campeão e zebra.</p></div>
        <Switch checked={specialLocked} onCheckedChange={setSpecialLocked} />
      </div>
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
        <div><p className="font-medium">Permitir visualização de palpites</p><p className="text-xs text-muted-foreground">Mostrar palpites na página "Comunidade".</p></div>
        <Switch checked={communityVisible} onCheckedChange={setCommunityVisible} />
      </div>

      <Button onClick={save} className="w-full"><Save className="h-4 w-4 mr-2" /> Salvar</Button>
    </Card>
  );
}

/* ── Scoring Rules ── */
function RulesTab() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["scoring-rules"],
    queryFn: async () => (await supabase.from("scoring_rules").select("*").order("rule_key")).data ?? [],
  });
  const [edits, setEdits] = useState<Record<string, number>>({});

  async function updatePoints(id: string) {
    const value = edits[id];
    if (value == null || Number.isNaN(value)) return;
    const { error } = await supabase.from("scoring_rules").update({ points: value }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Pontuação atualizada!");
    qc.invalidateQueries({ queryKey: ["scoring-rules"] });
  }

  return (
    <Card className="p-5 max-w-3xl">
      <h3 className="font-bold mb-3">Regras de pontuação</h3>
      <div className="space-y-2">
        {(data ?? []).map((r) => (
          <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{r.label}</p>
              <p className="text-xs text-muted-foreground">{r.description}</p>
            </div>
            <Input type="number" defaultValue={r.points} onChange={(e) => setEdits((s) => ({ ...s, [r.id]: parseInt(e.target.value) }))} className="w-24" />
            <Button size="sm" variant="secondary" onClick={() => updatePoints(r.id)}>Salvar</Button>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ── Official Results ── */
function ResultsTab() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-matches"],
    queryFn: async () => {
      const [matches, teams] = await Promise.all([
        supabase.from("matches").select("*").order("match_number"),
        supabase.from("teams").select("*"),
      ]);
      return { matches: matches.data ?? [], teams: teams.data ?? [] };
    },
  });
  const teamsById = new Map((data?.teams ?? []).map((t) => [t.id, t]));
  const [scores, setScores] = useState<Record<string, { h: string; a: string; adv: string; finished: boolean }>>({});

  useEffect(() => {
    if (data) {
      const m: typeof scores = {};
      data.matches.forEach((mt) => { m[mt.id] = { h: mt.home_score?.toString() ?? "", a: mt.away_score?.toString() ?? "", adv: mt.advancing_team_id ?? "", finished: mt.is_finished }; });
      setScores(m);
    }
  }, [data]);

  async function saveMatch(id: string) {
    const s = scores[id];
    const mt = data?.matches.find((x) => x.id === id);
    const h = parseInt(s.h); const a = parseInt(s.a);
    const isKO = mt?.phase && mt.phase !== "group";

    if (isKO && h === a && s.finished && !s.adv) {
      return toast.error("Se o jogo do mata-mata terminou empatado, selecione quem avança!");
    }

    const update: any = { 
      is_finished: s.finished,
      advancing_team_id: (isKO && h === a) ? (s.adv || null) : null
    };
    if (!Number.isNaN(h) && !Number.isNaN(a)) { update.home_score = h; update.away_score = a; }
    else { update.home_score = null; update.away_score = null; }
    const { error } = await supabase.from("matches").update(update).eq("id", id);
    if (error) return toast.error(error.message);

    toast.success("Resultado salvo!");
    // Points are applied automatically by the DB trigger (trg_auto_score_on_finish).
    qc.invalidateQueries({ queryKey: ["admin-matches"] });
  }

  return (
    <Card className="p-5 max-w-4xl">
      <h3 className="font-bold mb-3">Resultados oficiais</h3>
      <p className="text-sm text-muted-foreground mb-4">Após editar, vá em "Recalcular" para distribuir as pontuações.</p>
      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
        {(data?.matches ?? []).map((mt) => {
          const home = teamsById.get(mt.home_team_id ?? "");
          const away = teamsById.get(mt.away_team_id ?? "");
          const s = scores[mt.id] ?? { h: "", a: "", adv: "", finished: false };
          return (
            <div key={mt.id} className="flex flex-col gap-2 p-3 rounded-md bg-muted/40">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-24 shrink-0">{mt.round_label}</span>
                <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
                  <span className="text-sm truncate">{home?.name ?? "—"}</span>
                  <TeamFlag code={home?.code} fallback={home?.flag} size={20} />
                </div>
                <Input type="number" value={s.h} onChange={(e) => setScores((x) => ({ ...x, [mt.id]: { ...s, h: e.target.value } }))} className="w-12 text-center" />
                <span>x</span>
                <Input type="number" value={s.a} onChange={(e) => setScores((x) => ({ ...x, [mt.id]: { ...s, a: e.target.value } }))} className="w-12 text-center" />
                <div className="flex-1 flex items-center gap-2 min-w-0">
                  <TeamFlag code={away?.code} fallback={away?.flag} size={20} />
                  <span className="text-sm truncate">{away?.name ?? "—"}</span>
                </div>
                <label className="flex items-center gap-1 text-xs">
                  <Switch checked={s.finished} onCheckedChange={(v) => setScores((x) => ({ ...x, [mt.id]: { ...s, finished: v } }))} />
                  final
                </label>
                <Button size="sm" variant="secondary" onClick={() => saveMatch(mt.id)}>OK</Button>
              </div>

              {mt.phase !== "group" && s.h !== "" && s.a !== "" && s.h === s.a && (
                <div className="flex justify-center items-center gap-3 bg-background p-2 rounded border">
                  <span className="text-xs text-muted-foreground font-medium">Quem avança de fase?</span>
                  <button onClick={() => setScores((x) => ({ ...x, [mt.id]: { ...s, adv: home?.id ?? "" } }))} className={`px-3 py-1 text-xs border rounded-full transition-colors flex items-center gap-2 ${s.adv === home?.id ? 'bg-primary text-primary-foreground font-bold' : 'hover:bg-muted'}`}> 
                    <TeamFlag code={home?.code} fallback={home?.flag} size={14} /> {home?.name ?? "Casa"} 
                  </button>
                  <button onClick={() => setScores((x) => ({ ...x, [mt.id]: { ...s, adv: away?.id ?? "" } }))} className={`px-3 py-1 text-xs border rounded-full transition-colors flex items-center gap-2 ${s.adv === away?.id ? 'bg-primary text-primary-foreground font-bold' : 'hover:bg-muted'}`}> 
                    <TeamFlag code={away?.code} fallback={away?.flag} size={14} /> {away?.name ?? "Fora"} 
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ── Knockout Builder (NEW) ── */
function KnockoutBuilderTab() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["ko-builder"],
    queryFn: async () => {
      const [teams, matches] = await Promise.all([
        supabase.from("teams").select("*").order("name"),
        supabase.from("matches").select("*").order("match_number"),
      ]);
      return { teams: teams.data ?? [], matches: matches.data ?? [] };
    },
  });

  const koMatches = (data?.matches ?? []).filter((m) => m.phase !== "group");
  const teamsById = new Map((data?.teams ?? []).map((t) => [t.id, t]));
  const nextMatchNum = Math.max(0, ...(data?.matches ?? []).map((m) => m.match_number)) + 1;

  const [newMatch, setNewMatch] = useState({ phase: "r32" as string, home: "", away: "", label: "" });

  async function createMatch() {
    if (!newMatch.home || !newMatch.away) return toast.error("Selecione os dois times.");
    if (newMatch.home === newMatch.away) return toast.error("Selecione times diferentes.");
    const { error } = await supabase.from("matches").insert({
      phase: newMatch.phase as any,
      round_label: newMatch.label || PHASE_LABEL[newMatch.phase as MatchPhase] || newMatch.phase,
      match_number: nextMatchNum,
      home_team_id: newMatch.home,
      away_team_id: newMatch.away,
    });
    if (error) return toast.error(error.message);
    toast.success("Jogo criado!");
    setNewMatch({ phase: "r32", home: "", away: "", label: "" });
    qc.invalidateQueries({ queryKey: ["ko-builder"] });
  }

  async function deleteMatch(id: string) {
    const { error } = await supabase.from("matches").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Jogo removido!");
    qc.invalidateQueries({ queryKey: ["ko-builder"] });
  }

  async function autoGenerateR32() {
    if (!confirm("Isso irá gerar os 16 jogos de 16-avos baseados na classificação atual dos grupos (resultados oficiais). Continuar?")) return;
    
    const teams = data?.teams ?? [];
    const groupMatches = (data?.matches ?? []).filter(m => m.phase === 'group');
    
    const groupIds = ["A","B","C","D","E","F","G","H","I","J","K","L"];
    const standings: Record<string, any[]> = {};
    const thirds: { group: string; points: number; gd: number; gf: number; team_id: string }[] = [];

    for (const gid of groupIds) {
      const groupTeams = teams.filter((t) => t.group_id === gid).map((t) => t.id);
      const mForGroup = groupMatches
        .filter((m) => m.group_id === gid && m.home_team_id && m.away_team_id && m.home_score !== null && m.away_score !== null)
        .map(m => ({
          home_team_id: m.home_team_id as string,
          away_team_id: m.away_team_id as string,
          home_score: m.home_score as number,
          away_score: m.away_score as number
        }));
      const s = computeGroupStandings(groupTeams, mForGroup);
      standings[gid] = s;
      if (s[2]) thirds.push({ group: gid, ...s[2] });
    }
    thirds.sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
    const bestThirds = thirds.slice(0, 8).map((t) => t.group);

    function getTeam(pos: string, gidOrIndex: string) {
      if (pos === "3") {
         const idx = parseInt(gidOrIndex);
         const g = bestThirds[idx];
         return standings[g]?.[2]?.team_id ?? null;
      }
      return standings[gidOrIndex]?.[parseInt(pos)-1]?.team_id ?? null;
    }

    const PAIRINGS = [
      { h: ["1","E"], a: ["2","D"], lbl: "16-avos 1" },   // Alemanha vs Paraguai
      { h: ["1","I"], a: ["3","0"], lbl: "16-avos 2" },   // França vs melhor 3º
      { h: ["2","A"], a: ["1","B"], lbl: "16-avos 3" },   // África do Sul vs Canadá
      { h: ["1","F"], a: ["2","C"], lbl: "16-avos 4" },   // Holanda vs Marrocos
      { h: ["1","K"], a: ["2","L"], lbl: "16-avos 5" },   // Portugal vs Croácia
      { h: ["1","H"], a: ["2","J"], lbl: "16-avos 6" },   // Espanha vs Áustria
      { h: ["1","D"], a: ["3","3"], lbl: "16-avos 7" },   // EUA vs 4º melhor 3º
      { h: ["1","G"], a: ["3","4"], lbl: "16-avos 8" },   // Bélgica vs 5º melhor 3º
      { h: ["1","C"], a: ["2","F"], lbl: "16-avos 9" },   // Brasil vs Japão
      { h: ["2","I"], a: ["2","E"], lbl: "16-avos 10" },  // Noruega vs Costa do Marfim
      { h: ["1","A"], a: ["3","1"], lbl: "16-avos 11" },  // México vs 2º melhor 3º
      { h: ["1","L"], a: ["3","2"], lbl: "16-avos 12" },  // Inglaterra vs 3º melhor 3º
      { h: ["1","J"], a: ["2","H"], lbl: "16-avos 13" },  // Argentina vs Cabo Verde
      { h: ["3","7"], a: ["2","G"], lbl: "16-avos 14" },  // 8º melhor 3º vs Egito
      { h: ["2","B"], a: ["3","5"], lbl: "16-avos 15" },  // Suíça vs 6º melhor 3º
      { h: ["2","K"], a: ["3","6"], lbl: "16-avos 16" },  // Colômbia vs 7º melhor 3º
    ];

    const toInsert = PAIRINGS.map((p, i) => ({
      phase: "r32" as const,
      round_label: p.lbl,
      match_number: nextMatchNum + i,
      home_team_id: getTeam(p.h[0], p.h[1]),
      away_team_id: getTeam(p.a[0], p.a[1])
    })).filter(m => m.home_team_id && m.away_team_id);

    if (toInsert.length !== 16) {
       toast.error(`Foram encontrados apenas ${toInsert.length} cruzamentos possíveis. Confira se os resultados dos grupos estão completos.`);
       if (toInsert.length === 0) return;
    }

    const { error } = await supabase.from("matches").insert(toInsert);
    if (error) return toast.error(error.message);
    toast.success(`${toInsert.length} jogos de 16-avos gerados com sucesso!`);
    qc.invalidateQueries({ queryKey: ["ko-builder"] });
  }

  async function autoGeneratePlaceholders() {
    const existing: Record<string, any[]> = {};
    koMatches.forEach((m) => { (existing[m.phase] ??= []).push(m); });
    const toCreate: { phase: MatchPhase; round_label: string; match_number: number; home_team_id: null; away_team_id: null }[] = [];
    let num = nextMatchNum;

    const slots: { phase: MatchPhase; count: number; label: (i: number) => string }[] = [
      { phase: "r16", count: 8, label: (i) => `Oitavas ${i + 1}` },
      { phase: "qf",  count: 4, label: (i) => `Quartas ${i + 1}` },
      { phase: "sf",  count: 2, label: (i) => `Semi ${i + 1}` },
      { phase: "third", count: 1, label: () => "3º Lugar" },
      { phase: "final", count: 1, label: () => "Final" },
    ];

    for (const slot of slots) {
      const already = (existing[slot.phase] ?? []).length;
      const needed = slot.count - already;
      if (needed <= 0) continue;
      for (let i = already; i < slot.count; i++) {
        toCreate.push({ phase: slot.phase, round_label: slot.label(i), match_number: num++, home_team_id: null, away_team_id: null });
      }
    }

    if (toCreate.length === 0) return toast.info("Todos os placeholders já existem.");
    if (!confirm(`Criar ${toCreate.length} partidas placeholder (R16/QF/SF/3ºLugar/Final) com times a definir? Isso habilita a cascata nos palpites.`)) return;

    const { error } = await supabase.from("matches").insert(toCreate as any[]);
    if (error) return toast.error(error.message);
    toast.success(`${toCreate.length} partidas placeholder criadas!`);
    qc.invalidateQueries({ queryKey: ["ko-builder"] });
  }

  const phases: MatchPhase[] = ["r32", "r16", "qf", "sf", "third", "final"];
  const byPhase: Record<string, any[]> = {};
  koMatches.forEach((m) => { (byPhase[m.phase] ??= []).push(m); });

  return (
    <div className="space-y-6 max-w-4xl">
      <Card className="p-5 border-primary/50 bg-primary/5">
        <h3 className="font-bold mb-2 flex items-center gap-2 text-primary">Simulação do Chaveamento Oficial</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Gere os 16 cruzamentos iniciais automaticamente com base na classificação dos 12 grupos. Depois, crie os placeholders para R16, QF, SF, 3º Lugar e Final — isso habilita a cascata nos palpites dos usuários.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button onClick={autoGenerateR32} className="w-full sm:w-auto"><GitBranch className="h-4 w-4 mr-2" /> Gerar 16-Avos Automaticamente</Button>
          <Button onClick={autoGeneratePlaceholders} variant="secondary" className="w-full sm:w-auto"><GitBranch className="h-4 w-4 mr-2" /> Gerar Placeholders R16→Final</Button>
        </div>
      </Card>
      
      <Card className="p-5">
        <h3 className="font-bold mb-1">Criar jogo do mata-mata</h3>
        <p className="text-sm text-muted-foreground mb-4">Após a fase de grupos, adicione os jogos manualmente selecionando os times classificados.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium mb-1 block">Fase</label>
            <Select value={newMatch.phase} onValueChange={(v) => setNewMatch((s) => ({ ...s, phase: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {phases.map((p) => <SelectItem key={p} value={p}>{PHASE_LABEL[p]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Rótulo (opcional)</label>
            <Input placeholder="Ex: Jogo 1" value={newMatch.label} onChange={(e) => setNewMatch((s) => ({ ...s, label: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Time da casa</label>
            <Select value={newMatch.home} onValueChange={(v) => setNewMatch((s) => ({ ...s, home: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {(data?.teams ?? []).map((t) => <SelectItem key={t.id} value={t.id}><TeamFlag code={t.code} fallback={t.flag} size={16} className="mr-1" /> {t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Time visitante</label>
            <Select value={newMatch.away} onValueChange={(v) => setNewMatch((s) => ({ ...s, away: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {(data?.teams ?? []).map((t) => <SelectItem key={t.id} value={t.id}><TeamFlag code={t.code} fallback={t.flag} size={16} className="mr-1" /> {t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={createMatch} className="mt-4 w-full"><Plus className="h-4 w-4 mr-2" /> Criar jogo</Button>
      </Card>

      {phases.map((phase) => {
        const ms = byPhase[phase];
        if (!ms || ms.length === 0) return null;
        return (
          <Card key={phase} className="p-5">
            <h3 className="font-bold mb-3 flex items-center gap-2">
              {PHASE_LABEL[phase]}
              <Badge variant="secondary">{ms.length} jogos</Badge>
            </h3>
            <div className="space-y-2">
              {ms.map((mt: any, idx: number) => {
                const home = teamsById.get(mt.home_team_id);
                const away = teamsById.get(mt.away_team_id);
                const prevLabel: Record<string, string> = { r16: "16-avos", qf: "Oitavas", sf: "Quartas", final: "Semi", third: "Semi" };
                const prev = prevLabel[phase];
                const homeName = home?.name ?? (prev ? `Venc. ${prev} ${idx * 2 + 1}` : "—");
                const awayName = away?.name ?? (prev ? `Venc. ${prev} ${idx * 2 + 2}` : "—");
                return (
                  <div key={mt.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
                    <span className="text-xs text-muted-foreground w-20 shrink-0">{mt.round_label}</span>
                    <span className="flex-1 text-sm text-right flex items-center justify-end gap-1"><TeamFlag code={home?.code} fallback={home?.flag} size={16} /> {homeName}</span>
                    <span className="text-xs text-muted-foreground">vs</span>
                    <span className="flex-1 text-sm flex items-center gap-1"><TeamFlag code={away?.code} fallback={away?.flag} size={16} /> {awayName}</span>
                    {mt.is_finished && <Badge variant="outline" className="text-xs">Finalizado</Badge>}
                    <Button size="sm" variant="ghost" onClick={() => deleteMatch(mt.id)} title="Remover">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}

      {koMatches.length === 0 && (
        <Card className="p-12 text-center border-dashed">
          <p className="text-muted-foreground">Nenhum jogo do mata-mata criado ainda. Use o formulário acima para adicionar.</p>
        </Card>
      )}
    </div>
  );
}

/* ── Teams / Official Results ── */
function TeamsTab() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-team-results"],
    queryFn: async () => {
      const [teams, results] = await Promise.all([
        supabase.from("teams").select("*").order("group_id").order("name"),
        supabase.from("team_official_results").select("*"),
      ]);
      return { teams: teams.data ?? [], results: results.data ?? [] };
    },
  });
  const resultsByTeam = new Map((data?.results ?? []).map((r) => [r.team_id, r]));

  async function setReached(teamId: string, phase: MatchPhase | "none", pos?: number) {
    if (phase === "none") {
      await supabase.from("team_official_results").delete().eq("team_id", teamId);
    } else {
      await supabase.from("team_official_results").upsert({ team_id: teamId, reached_phase: phase, group_position: pos ?? null });
    }
    qc.invalidateQueries({ queryKey: ["admin-team-results"] });
  }

  async function toggleChampion(teamId: string) {
    const currentResults = data?.results ?? [];
    for (const r of currentResults) {
      if ((r as any).is_champion && r.team_id !== teamId) {
        await supabase.from("team_official_results").update({ is_champion: false } as any).eq("team_id", r.team_id);
      }
    }
    const current = resultsByTeam.get(teamId);
    const isCurrentlyChampion = (current as any)?.is_champion;
    await supabase.from("team_official_results").upsert({
      team_id: teamId,
      reached_phase: current?.reached_phase ?? "final",
      is_champion: !isCurrentlyChampion,
    } as any);
    toast.success(!isCurrentlyChampion ? "Campeão definido!" : "Campeão removido");
    qc.invalidateQueries({ queryKey: ["admin-team-results"] });
  }

  return (
    <Card className="p-5 max-w-4xl">
      <h3 className="font-bold mb-1">Trajetória oficial das seleções</h3>
      <p className="text-sm text-muted-foreground mb-4">Marque até onde cada seleção chegou. Necessário para calcular bônus.</p>
      <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-2">
        {(data?.teams ?? []).map((t) => {
          const r = resultsByTeam.get(t.id);
          const isChampion = (r as any)?.is_champion;
          return (
            <div key={t.id} className={`flex items-center gap-2 p-2 rounded-md ${isChampion ? 'bg-accent/20 border border-accent/40' : 'bg-muted/40'}`}>
              <span className="w-7 text-center text-xs font-bold text-muted-foreground">{t.group_id}</span>
              <TeamFlag code={t.code} fallback={t.flag} size={20} />
              <span className="flex-1 text-sm font-medium">{t.name}</span>
              {t.is_top15 && <span className="text-[10px] px-1.5 rounded bg-primary/20 text-primary font-bold">TOP15</span>}
              {isChampion && <span className="text-[10px] px-1.5 rounded bg-accent/30 text-accent font-bold">🏆 Campeão</span>}
              <Select value={r?.reached_phase ?? "none"} onValueChange={(v) => setReached(t.id, v as any, r?.group_position ?? undefined)}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Eliminada nos grupos</SelectItem>
                  <SelectItem value="r32">16-avos</SelectItem>
                  <SelectItem value="r16">Oitavas</SelectItem>
                  <SelectItem value="qf">Quartas</SelectItem>
                  <SelectItem value="sf">Semis</SelectItem>
                  <SelectItem value="third">3º Lugar</SelectItem>
                  <SelectItem value="final">Final</SelectItem>
                </SelectContent>
              </Select>
              <Select value={String(r?.group_position ?? 0)} onValueChange={(v) => setReached(t.id, (r?.reached_phase ?? "r32") as any, parseInt(v) || undefined)}>
                <SelectTrigger className="w-24"><SelectValue placeholder="Pos." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">—</SelectItem>
                  <SelectItem value="1">1º</SelectItem>
                  <SelectItem value="2">2º</SelectItem>
                  <SelectItem value="3">3º</SelectItem>
                  <SelectItem value="4">4º</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant={isChampion ? "default" : "ghost"} onClick={() => toggleChampion(t.id)} title="Marcar como campeão">
                <Trophy className={`h-4 w-4 ${isChampion ? 'text-accent-foreground' : 'text-muted-foreground'}`} />
              </Button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ── Users Management ── */
function UsersTab() {
  const qc = useQueryClient();
  const { user: currentUser } = useAuth();
  const { data } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [profiles, roles] = await Promise.all([
        supabase.from("profiles").select("*").order("display_name"),
        supabase.from("user_roles").select("*"),
      ]);
      return { profiles: profiles.data ?? [], roles: roles.data ?? [] };
    },
  });

  const rolesByUser = new Map<string, string>();
  (data?.roles ?? []).forEach((r) => rolesByUser.set(r.user_id, r.role));

  async function toggleAdmin(userId: string, currentRole: string) {
    const newRole = currentRole === "admin" ? "user" : "admin";
    const { error } = await supabase.from("user_roles").update({ role: newRole }).eq("user_id", userId);
    if (error) return toast.error("Erro: " + error.message);
    toast.success(newRole === "admin" ? "Usuário promovido a admin!" : "Admin rebaixado a usuário.");
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  }

  return (
    <Card className="p-5 max-w-3xl">
      <h3 className="font-bold mb-1 flex items-center gap-2"><Users className="h-5 w-5" /> Gerenciar usuários</h3>
      <p className="text-sm text-muted-foreground mb-4">Promova ou remova administradores.</p>
      <div className="space-y-2">
        {(data?.profiles ?? []).map((p) => {
          const role = rolesByUser.get(p.id) ?? "user";
          const isMe = p.id === currentUser?.id;
          return (
            <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
              {p.avatar_url ? (
                <img src={p.avatar_url} alt="" className="h-9 w-9 rounded-full" />
              ) : (
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center font-bold text-sm">
                  {p.display_name?.[0]?.toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{p.display_name} {isMe && <span className="text-xs text-primary">(você)</span>}</p>
              </div>
              <Badge variant={role === "admin" ? "default" : "secondary"}>{role}</Badge>
              {!isMe && (
                <Button size="sm" variant="outline" onClick={() => toggleAdmin(p.id, role)}>
                  {role === "admin" ? "Remover admin" : "Promover"}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ── Recompute Points ── */
function RecomputeTab() {
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string>("");

  async function run() {
    setRunning(true);
    setLog("Carregando matches e predictions...");
    try {
      const [matchesRes, predsRes] = await Promise.all([
        supabase.from("matches").select("*"),
        supabase.from("predictions").select("*"),
      ]);

      const matches = matchesRes.data ?? [];
      const predictions = predsRes.data ?? [];

      setLog(`Processando ${predictions.length} predictions...`);

      const updates: Array<{ id: string; pts: number }> = [];
      for (const p of predictions) {
        const m = matches.find((mt) => mt.id === p.match_id && mt.is_finished);
        if (!m || m.home_score == null || m.away_score == null) continue;

        let pts = 0;
        if (p.home_score === m.home_score! && p.away_score === m.away_score!) {
          pts = 25;
        } else if (
          (p.home_score > p.away_score && m.home_score! > m.away_score!) ||
          (p.home_score < p.away_score && m.home_score! < m.away_score!) ||
          (p.home_score === p.away_score && m.home_score! === m.away_score!)
        ) {
          pts = 10;
        }

        if (pts !== p.points_awarded) {
          updates.push({ id: p.id, pts });
        }
      }

      if (updates.length > 0) {
        for (let i = 0; i < updates.length; i += 50) {
          const batch = updates.slice(i, i + 50);
          await Promise.all(batch.map((u) => supabase.from("predictions").update({ points_awarded: u.pts }).eq("id", u.id)));
        }
        setLog(`✓ ${updates.length} predictions atualizadas!`);
        toast.success(`Pontuação atualizada! ${updates.length} predictions corrigidas.`);
        qc.invalidateQueries({ queryKey: ["ranking"] });
      } else {
        setLog(`✓ Todas as predictions já estão corretas!`);
        toast.info("Nenhuma atualização necessária.");
      }
    } catch (e: any) {
      setLog(`❌ Erro: ${e.message}`);
      toast.error(e.message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card className="p-6 max-w-xl">
      <AlertTriangle className="h-6 w-6 text-amber-500 mb-3" />
      <h3 className="font-bold text-lg mb-2">Recalcular pontuação (SQL-safe)</h3>
      <p className="text-xs text-muted-foreground mb-4">
        ⚠️ O sistema anterior tinha bugs. Agora usa SQL puro para evitar erros.
      </p>
      <Button onClick={run} disabled={running} className="w-full">{running ? "Processando..." : "Atualizar via SQL"}</Button>
      {log && <pre className="text-xs bg-muted p-2 rounded mt-3 overflow-auto max-h-40">{log}</pre>}
    </Card>
  );
}
