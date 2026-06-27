// Função para criar cascata de fases (R32 -> R16 -> QF -> SF -> Final)
// Com referências automáticas entre fases

import { supabase } from "@/integrations/supabase/client";

export async function createFullKnockoutBracket() {
  // 1. Verificar se R32 já existe
  const { data: existingR32 } = await supabase
    .from("matches")
    .select("id, match_number")
    .eq("phase", "r32")
    .order("match_number");

  if (!existingR32 || existingR32.length === 0) {
    throw new Error("R32 não foi criado ainda. Clique em 'Gerar 16-Avos' primeiro.");
  }

  // 2. Criar R16 (Oitavas) com referências aos R32
  // Padrão Copa: R16-1 é vencedor (R32-1 vs R32-2), R16-2 é vencedor (R32-3 vs R32-4)
  const r16Matches = [
    { phase: "r16", round_label: "Oitavas 1", match_number: 17 },   // Winners R32-1 vs R32-2
    { phase: "r16", round_label: "Oitavas 2", match_number: 18 },   // Winners R32-3 vs R32-4
    { phase: "r16", round_label: "Oitavas 3", match_number: 19 },   // Winners R32-5 vs R32-6
    { phase: "r16", round_label: "Oitavas 4", match_number: 20 },   // Winners R32-7 vs R32-8
    { phase: "r16", round_label: "Oitavas 5", match_number: 21 },   // Winners R32-9 vs R32-10
    { phase: "r16", round_label: "Oitavas 6", match_number: 22 },   // Winners R32-11 vs R32-12
    { phase: "r16", round_label: "Oitavas 7", match_number: 23 },   // Winners R32-13 vs R32-14
    { phase: "r16", round_label: "Oitavas 8", match_number: 24 },   // Winners R32-15 vs R32-16
  ];

  // 3. Criar QF (Quartas) com referências aos R16
  const qfMatches = [
    { phase: "qf", round_label: "Quartas 1", match_number: 25 },    // Winners R16-1 vs R16-2
    { phase: "qf", round_label: "Quartas 2", match_number: 26 },    // Winners R16-3 vs R16-4
    { phase: "qf", round_label: "Quartas 3", match_number: 27 },    // Winners R16-5 vs R16-6
    { phase: "qf", round_label: "Quartas 4", match_number: 28 },    // Winners R16-7 vs R16-8
  ];

  // 4. Criar SF (Semis)
  const sfMatches = [
    { phase: "sf", round_label: "Semifinal 1", match_number: 29 },  // Winners QF-1 vs QF-2
    { phase: "sf", round_label: "Semifinal 2", match_number: 30 },  // Winners QF-3 vs QF-4
  ];

  // 5. Criar Final
  const finalMatches = [
    { phase: "final", round_label: "Final", match_number: 31 },     // Winners SF-1 vs SF-2
  ];

  const allMatches = [
    ...r16Matches.map(m => ({ ...m, is_draft: true })),
    ...qfMatches.map(m => ({ ...m, is_draft: true })),
    ...sfMatches.map(m => ({ ...m, is_draft: true })),
    ...finalMatches.map(m => ({ ...m, is_draft: true })),
  ];

  // TODO: Inserir com referências (complexo - requer stored procedure)
  const { data, error } = await supabase
    .from("matches")
    .insert(allMatches);

  if (error) throw error;
  
  return {
    r16: r16Matches.length,
    qf: qfMatches.length,
    sf: sfMatches.length,
    final: finalMatches.length,
  };
}

// Função para atualizar times conforme R32 termina
export async function updateR16TeamsWhenR32Finishes(r32MatchId: string, advancingTeamId: string) {
  // Quando R32-1 termina com time X avançando:
  // Atualizar R16-1 home_team_id ou away_team_id com X
  
  // Exemplo: se R32-1 (match_number=1) termina
  // R16-1 (match_number=17) recebe esse time
  
  const r32Match = await supabase
    .from("matches")
    .select("match_number")
    .eq("id", r32MatchId)
    .single();

  // Lógica: match_number 1 -> R16 home, match_number 2 -> R16 away, etc
  // match_number 1-2 -> R16-1
  // match_number 3-4 -> R16-2
  // ...
  
  // TODO: Implementar lógica de atualização
}

export async function checkAndPopulateR16() {
  // Verificar se todos R32 terminaram
  // Se sim, preencher R16 com times reais
  // Se não, avisar que ainda falta
  
  const { data: r32Unfinished } = await supabase
    .from("matches")
    .select("id")
    .eq("phase", "r32")
    .eq("is_finished", false);

  if (r32Unfinished && r32Unfinished.length > 0) {
    return {
      ready: false,
      message: `${r32Unfinished.length} jogos de R32 ainda não foram finalizados.`,
    };
  }

  return { ready: true };
}
