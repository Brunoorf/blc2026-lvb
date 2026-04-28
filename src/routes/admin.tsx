import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Shield, Save, Calculator, AlertTriangle } from "lucide-react";
import AuthGate from "@/components/AuthGate";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { recomputeAllPoints } from "@/lib/recompute";
import { PHASE_LABEL, type MatchPhase } from "@/lib/scoring";

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
          <TabsTrigger value="rules">Regras de pontuação</TabsTrigger>
          <TabsTrigger value="results">Resultados oficiais</TabsTrigger>
          <TabsTrigger value="teams">Seleções</TabsTrigger>
          <TabsTrigger value="recompute">Recalcular pontos</TabsTrigger>
        </TabsList>

        <TabsContent value="tournament" className="mt-6"><TournamentTab /></TabsContent>
        <TabsContent value="rules" className="mt-6"><RulesTab /></TabsContent>
        <TabsContent value="results" className="mt-6"><ResultsTab /></TabsContent>
        <TabsContent value="teams" className="mt-6"><TeamsTab /></TabsContent>
        <TabsContent value="recompute" className="mt-6"><RecomputeTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function TournamentTab() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await supabase.from("tournament_settings").select("*").maybeSingle()).data,
  });
  const [phase, setPhase] = useState(data?.current_phase ?? "groups");
  const [groupLocked, setGroupLocked] = useState(data?.group_picks_locked ?? false);
  const [koLocked, setKoLocked] = useState(data?.knockout_picks_locked ?? false);

  useEffect(() => {
    if (data) {
      setPhase(data.current_phase);
      setGroupLocked(data.group_picks_locked);
      setKoLocked(data.knockout_picks_locked);
    }
  }, [data]);

  async function save() {
    const { error } = await supabase.from("tournament_settings").update({
      current_phase: phase, group_picks_locked: groupLocked, knockout_picks_locked: koLocked,
    }).eq("id", 1);
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
        <div>
          <p className="font-medium">Travar palpites de grupos</p>
          <p className="text-xs text-muted-foreground">Usuários não poderão mais editar.</p>
        </div>
        <Switch checked={groupLocked} onCheckedChange={setGroupLocked} />
      </div>
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
        <div>
          <p className="font-medium">Travar palpites do mata-mata</p>
          <p className="text-xs text-muted-foreground">Usuários não poderão mais editar.</p>
        </div>
        <Switch checked={koLocked} onCheckedChange={setKoLocked} />
      </div>
      <Button onClick={save} className="w-full"><Save className="h-4 w-4 mr-2" /> Salvar</Button>
    </Card>
  );
}

function RulesTab() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["scoring-rules"],
    queryFn: async () => (await supabase.from("scoring_rules").select("*").order("rule_key")).data ?? [],
  });
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [newRule, setNewRule] = useState({ rule_key: "", label: "", points: 0, description: "" });

  async function updatePoints(id: string) {
    const value = edits[id];
    if (value == null || Number.isNaN(value)) return;
    const { error } = await supabase.from("scoring_rules").update({ points: value }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Pontuação atualizada!");
    qc.invalidateQueries({ queryKey: ["scoring-rules"] });
  }

  async function addRule() {
    if (!newRule.rule_key || !newRule.label) return toast.error("Preencha chave e rótulo.");
    const { error } = await supabase.from("scoring_rules").insert(newRule);
    if (error) return toast.error(error.message);
    toast.success("Regra criada!");
    setNewRule({ rule_key: "", label: "", points: 0, description: "" });
    qc.invalidateQueries({ queryKey: ["scoring-rules"] });
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <Card className="p-5">
        <h3 className="font-bold mb-3">Regras existentes</h3>
        <div className="space-y-2">
          {(data ?? []).map((r) => (
            <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{r.label}</p>
                <p className="text-xs text-muted-foreground">{r.rule_key}</p>
              </div>
              <Input
                type="number"
                defaultValue={r.points}
                onChange={(e) => setEdits((s) => ({ ...s, [r.id]: parseInt(e.target.value) }))}
                className="w-24"
              />
              <Button size="sm" variant="secondary" onClick={() => updatePoints(r.id)}>Salvar</Button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-bold mb-3">Adicionar nova regra</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input placeholder="rule_key (ex: hat_trick)" value={newRule.rule_key} onChange={(e) => setNewRule({ ...newRule, rule_key: e.target.value })} />
          <Input placeholder="Rótulo visível" value={newRule.label} onChange={(e) => setNewRule({ ...newRule, label: e.target.value })} />
          <Input type="number" placeholder="Pontos" value={newRule.points} onChange={(e) => setNewRule({ ...newRule, points: parseInt(e.target.value) || 0 })} />
          <Input placeholder="Descrição" value={newRule.description} onChange={(e) => setNewRule({ ...newRule, description: e.target.value })} />
        </div>
        <Button onClick={addRule} className="mt-3 w-full">Adicionar regra</Button>
      </Card>
    </div>
  );
}

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
  const [scores, setScores] = useState<Record<string, { h: string; a: string; finished: boolean }>>({});

  useEffect(() => {
    if (data) {
      const m: typeof scores = {};
      data.matches.forEach((mt) => {
        m[mt.id] = {
          h: mt.home_score?.toString() ?? "",
          a: mt.away_score?.toString() ?? "",
          finished: mt.is_finished,
        };
      });
      setScores(m);
    }
  }, [data]);

  async function saveMatch(id: string) {
    const s = scores[id];
    const h = parseInt(s.h);
    const a = parseInt(s.a);
    const update: any = { is_finished: s.finished };
    if (!Number.isNaN(h) && !Number.isNaN(a)) {
      update.home_score = h; update.away_score = a;
    } else {
      update.home_score = null; update.away_score = null;
    }
    const { error } = await supabase.from("matches").update(update).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Resultado salvo!");
    qc.invalidateQueries({ queryKey: ["admin-matches"] });
  }

  return (
    <Card className="p-5 max-w-4xl">
      <h3 className="font-bold mb-3">Resultados oficiais</h3>
      <p className="text-sm text-muted-foreground mb-4">Após editar, vá em "Recalcular pontos" para distribuir as pontuações.</p>
      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
        {(data?.matches ?? []).map((mt) => {
          const home = teamsById.get(mt.home_team_id ?? "");
          const away = teamsById.get(mt.away_team_id ?? "");
          const s = scores[mt.id] ?? { h: "", a: "", finished: false };
          return (
            <div key={mt.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/40">
              <span className="text-xs text-muted-foreground w-24 shrink-0">{mt.round_label}</span>
              <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
                <span className="text-sm truncate">{home?.name ?? "—"}</span>
                <span>{home?.flag}</span>
              </div>
              <Input type="number" value={s.h} onChange={(e) => setScores((x) => ({ ...x, [mt.id]: { ...s, h: e.target.value } }))} className="w-12 text-center" />
              <span>x</span>
              <Input type="number" value={s.a} onChange={(e) => setScores((x) => ({ ...x, [mt.id]: { ...s, a: e.target.value } }))} className="w-12 text-center" />
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <span>{away?.flag}</span>
                <span className="text-sm truncate">{away?.name ?? "—"}</span>
              </div>
              <label className="flex items-center gap-1 text-xs">
                <Switch checked={s.finished} onCheckedChange={(v) => setScores((x) => ({ ...x, [mt.id]: { ...s, finished: v } }))} />
                final
              </label>
              <Button size="sm" variant="secondary" onClick={() => saveMatch(mt.id)}>OK</Button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

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

  return (
    <Card className="p-5 max-w-4xl">
      <h3 className="font-bold mb-1">Trajetória oficial das seleções</h3>
      <p className="text-sm text-muted-foreground mb-4">Marque até onde cada seleção chegou de fato. Necessário para calcular bônus de avanço, campeão e zebra.</p>
      <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-2">
        {(data?.teams ?? []).map((t) => {
          const r = resultsByTeam.get(t.id);
          return (
            <div key={t.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/40">
              <span className="w-7 text-center text-xs font-bold text-muted-foreground">{t.group_id}</span>
              <span>{t.flag}</span>
              <span className="flex-1 text-sm font-medium">{t.name}</span>
              {t.is_top15 && <span className="text-[10px] px-1.5 rounded bg-primary/20 text-primary font-bold">TOP15</span>}
              <Select value={r?.reached_phase ?? "none"} onValueChange={(v) => setReached(t.id, v as any, r?.group_position ?? undefined)}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Eliminada na fase de grupos</SelectItem>
                  <SelectItem value="r32">Chegou aos 16-avos</SelectItem>
                  <SelectItem value="r16">Chegou às oitavas</SelectItem>
                  <SelectItem value="qf">Chegou às quartas</SelectItem>
                  <SelectItem value="sf">Chegou às semis</SelectItem>
                  <SelectItem value="final">Chegou à final</SelectItem>
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
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function RecomputeTab() {
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string>("");

  async function run() {
    setRunning(true);
    setLog("Calculando...");
    try {
      const r = await recomputeAllPoints();
      setLog(`✓ Atualizadas ${r.matchUpdated} previsões de jogos, ${r.koUpdated} de mata-mata e ${r.specialUpdated} especiais.`);
      toast.success("Pontuação recalculada!");
    } catch (e: any) {
      setLog(`Erro: ${e.message}`);
      toast.error(e.message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card className="p-6 max-w-xl">
      <Calculator className="h-10 w-10 text-primary mb-3" />
      <h3 className="font-bold text-lg mb-2">Recalcular pontuação de todos</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Use após inserir resultados oficiais ou alterar regras. O cálculo varre todas as previsões e atualiza os pontos de cada usuário.
      </p>
      <Button onClick={run} disabled={running} className="w-full">{running ? "Processando..." : "Recalcular agora"}</Button>
      {log && <pre className="mt-4 p-3 bg-muted/40 rounded-md text-xs whitespace-pre-wrap">{log}</pre>}
    </Card>
  );
}