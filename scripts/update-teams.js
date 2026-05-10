import pkg from 'pg';
const { Client } = pkg;

const connectionString = "postgresql://postgres.uhdcdyfpowspufttkofl:1wLiBVUtEeymNYbd@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true";

// Grupos oficiais Copa 2026 (sorteio 05/dez/2025 + repescagens mar/2026)
const GROUPS = {
  A: [
    { code: 'MEX', name: 'México',           flag: '🇲🇽', rank: 17, top15: false },
    { code: 'RSA', name: 'África do Sul',     flag: '🇿🇦', rank: 56, top15: false },
    { code: 'KOR', name: 'Coreia do Sul',     flag: '🇰🇷', rank: 24, top15: false },
    { code: 'CZE', name: 'República Tcheca',  flag: '🇨🇿', rank: 35, top15: false },
  ],
  B: [
    { code: 'CAN', name: 'Canadá',            flag: '🇨🇦', rank: 28, top15: false },
    { code: 'BIH', name: 'Bósnia e Herzegóvina', flag: '🇧🇦', rank: 40, top15: false },
    { code: 'QAT', name: 'Catar',             flag: '🇶🇦', rank: 55, top15: false },
    { code: 'SUI', name: 'Suíça',             flag: '🇨🇭', rank: 20, top15: false },
  ],
  C: [
    { code: 'BRA', name: 'Brasil',            flag: '🇧🇷', rank: 5,  top15: true },
    { code: 'MAR', name: 'Marrocos',          flag: '🇲🇦', rank: 14, top15: true },
    { code: 'HAI', name: 'Haiti',             flag: '🇭🇹', rank: 83, top15: false },
    { code: 'SCO', name: 'Escócia',           flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', rank: 39, top15: false },
  ],
  D: [
    { code: 'USA', name: 'Estados Unidos',    flag: '🇺🇸', rank: 16, top15: false },
    { code: 'PAR', name: 'Paraguai',          flag: '🇵🇾', rank: 38, top15: false },
    { code: 'AUS', name: 'Austrália',         flag: '🇦🇺', rank: 26, top15: false },
    { code: 'TUR', name: 'Turquia',           flag: '🇹🇷', rank: 27, top15: false },
  ],
  E: [
    { code: 'GER', name: 'Alemanha',          flag: '🇩🇪', rank: 9,  top15: true },
    { code: 'CUW', name: 'Curaçao',           flag: '🇨🇼', rank: 88, top15: false },
    { code: 'CIV', name: 'Costa do Marfim',   flag: '🇨🇮', rank: 41, top15: false },
    { code: 'ECU', name: 'Equador',           flag: '🇪🇨', rank: 23, top15: false },
  ],
  F: [
    { code: 'NED', name: 'Holanda',           flag: '🇳🇱', rank: 6,  top15: true },
    { code: 'JPN', name: 'Japão',             flag: '🇯🇵', rank: 18, top15: false },
    { code: 'SWE', name: 'Suécia',            flag: '🇸🇪', rank: 31, top15: false },
    { code: 'TUN', name: 'Tunísia',           flag: '🇹🇳', rank: 45, top15: false },
  ],
  G: [
    { code: 'BEL', name: 'Bélgica',           flag: '🇧🇪', rank: 8,  top15: true },
    { code: 'EGY', name: 'Egito',             flag: '🇪🇬', rank: 32, top15: false },
    { code: 'IRN', name: 'Irã',               flag: '🇮🇷', rank: 22, top15: false },
    { code: 'NZL', name: 'Nova Zelândia',     flag: '🇳🇿', rank: 86, top15: false },
  ],
  H: [
    { code: 'ESP', name: 'Espanha',           flag: '🇪🇸', rank: 3,  top15: true },
    { code: 'CPV', name: 'Cabo Verde',        flag: '🇨🇻', rank: 70, top15: false },
    { code: 'SAU', name: 'Arábia Saudita',    flag: '🇸🇦', rank: 58, top15: false },
    { code: 'URU', name: 'Uruguai',           flag: '🇺🇾', rank: 15, top15: true },
  ],
  I: [
    { code: 'FRA', name: 'França',            flag: '🇫🇷', rank: 2,  top15: true },
    { code: 'SEN', name: 'Senegal',           flag: '🇸🇳', rank: 19, top15: false },
    { code: 'IRQ', name: 'Iraque',            flag: '🇮🇶', rank: 62, top15: false },
    { code: 'NOR', name: 'Noruega',           flag: '🇳🇴', rank: 30, top15: false },
  ],
  J: [
    { code: 'ARG', name: 'Argentina',         flag: '🇦🇷', rank: 1,  top15: true },
    { code: 'ALG', name: 'Argélia',           flag: '🇩🇿', rank: 36, top15: false },
    { code: 'AUT', name: 'Áustria',           flag: '🇦🇹', rank: 21, top15: false },
    { code: 'JOR', name: 'Jordânia',          flag: '🇯🇴', rank: 64, top15: false },
  ],
  K: [
    { code: 'POR', name: 'Portugal',          flag: '🇵🇹', rank: 7,  top15: true },
    { code: 'COL', name: 'Colômbia',          flag: '🇨🇴', rank: 13, top15: true },
    { code: 'UZB', name: 'Uzbequistão',       flag: '🇺🇿', rank: 57, top15: false },
    { code: 'COD', name: 'RD Congo',          flag: '🇨🇩', rank: 50, top15: false },
  ],
  L: [
    { code: 'ENG', name: 'Inglaterra',        flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', rank: 4,  top15: true },
    { code: 'CRO', name: 'Croácia',           flag: '🇭🇷', rank: 10, top15: true },
    { code: 'GHA', name: 'Gana',              flag: '🇬🇭', rank: 73, top15: false },
    { code: 'PAN', name: 'Panamá',            flag: '🇵🇦', rank: 33, top15: false },
  ],
};

async function updateTeams() {
  const client = new Client({ connectionString });
  await client.connect();
  console.log("✓ Conectado");

  try {
    // 1) Limpar dados dependentes
    await client.query("DELETE FROM public.predictions");
    await client.query("DELETE FROM public.knockout_predictions");
    await client.query("DELETE FROM public.special_predictions");
    await client.query("DELETE FROM public.team_official_results");
    await client.query("DELETE FROM public.matches");
    await client.query("DELETE FROM public.teams");
    console.log("✓ Dados antigos limpos");

    // 2) Inserir 48 times atualizados
    for (const [groupId, teams] of Object.entries(GROUPS)) {
      for (const t of teams) {
        await client.query(
          `INSERT INTO public.teams (code, name, flag, group_id, fifa_rank, is_top15) VALUES ($1, $2, $3, $4, $5, $6)`,
          [t.code, t.name, t.flag, groupId, t.rank, t.top15]
        );
      }
    }
    console.log("✓ 48 seleções inseridas");

    // 3) Gerar jogos da fase de grupos (6 por grupo = 72 jogos)
    let matchNum = 1;
    for (const groupId of Object.keys(GROUPS)) {
      const res = await client.query(
        "SELECT id FROM public.teams WHERE group_id = $1 ORDER BY name",
        [groupId]
      );
      const ids = res.rows.map(r => r.id);

      const fixtures = [
        // Rodada 1
        { label: 'Rodada 1', h: ids[0], a: ids[1] },
        { label: 'Rodada 1', h: ids[2], a: ids[3] },
        // Rodada 2
        { label: 'Rodada 2', h: ids[0], a: ids[2] },
        { label: 'Rodada 2', h: ids[3], a: ids[1] },
        // Rodada 3
        { label: 'Rodada 3', h: ids[0], a: ids[3] },
        { label: 'Rodada 3', h: ids[1], a: ids[2] },
      ];

      for (const f of fixtures) {
        await client.query(
          `INSERT INTO public.matches (phase, round_label, match_number, group_id, home_team_id, away_team_id)
           VALUES ('group', $1, $2, $3, $4, $5)`,
          [f.label, matchNum, groupId, f.h, f.a]
        );
        matchNum++;
      }
    }
    console.log(`✓ ${matchNum - 1} jogos da fase de grupos criados`);

    // 4) Verificar
    const teamCount = await client.query("SELECT count(*) FROM public.teams");
    const matchCount = await client.query("SELECT count(*) FROM public.matches");
    console.log(`\n✅ Total: ${teamCount.rows[0].count} seleções, ${matchCount.rows[0].count} jogos`);

  } catch (err) {
    console.error("Erro:", err.message);
  } finally {
    await client.end();
  }
}

updateTeams();
