import pkg from 'pg';
const { Client } = pkg;

const connectionString = process.env.DATABASE_URL || "postgresql://postgres.[YOUR_PROJECT_ID]:[YOUR_PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres";

// Official FIFA 2026 World Cup group stage schedule
// Based on the official draw and fixture list
// Format: [home_code, away_code, date, round_label, group_id]
const OFFICIAL_MATCHES = [
  // ===== 1ª RODADA =====
  // 11/06
  { home: 'MEX', away: 'RSA', date: '2026-06-11T21:00:00Z', round: 'Rodada 1', group: 'A' },
  { home: 'KOR', away: 'CZE', date: '2026-06-11T18:00:00Z', round: 'Rodada 1', group: 'A' },
  // 12/06
  { home: 'CAN', away: 'BIH', date: '2026-06-12T18:00:00Z', round: 'Rodada 1', group: 'B' },
  { home: 'QAT', away: 'SUI', date: '2026-06-12T21:00:00Z', round: 'Rodada 1', group: 'B' },
  { home: 'USA', away: 'PAR', date: '2026-06-12T21:00:00Z', round: 'Rodada 1', group: 'D' },
  { home: 'AUS', away: 'TUR', date: '2026-06-12T18:00:00Z', round: 'Rodada 1', group: 'D' },
  // 13/06
  { home: 'BRA', away: 'MAR', date: '2026-06-13T21:00:00Z', round: 'Rodada 1', group: 'C' },
  { home: 'HAI', away: 'SCO', date: '2026-06-13T18:00:00Z', round: 'Rodada 1', group: 'C' },
  // 14/06
  { home: 'GER', away: 'CUW', date: '2026-06-14T18:00:00Z', round: 'Rodada 1', group: 'E' },
  { home: 'CIV', away: 'ECU', date: '2026-06-14T21:00:00Z', round: 'Rodada 1', group: 'E' },
  { home: 'NED', away: 'JPN', date: '2026-06-14T21:00:00Z', round: 'Rodada 1', group: 'F' },
  { home: 'SWE', away: 'TUN', date: '2026-06-14T18:00:00Z', round: 'Rodada 1', group: 'F' },
  // 15/06
  { home: 'ESP', away: 'CPV', date: '2026-06-15T18:00:00Z', round: 'Rodada 1', group: 'H' },
  { home: 'URU', away: 'SAU', date: '2026-06-15T21:00:00Z', round: 'Rodada 1', group: 'H' },
  { home: 'BEL', away: 'EGY', date: '2026-06-15T21:00:00Z', round: 'Rodada 1', group: 'G' },
  { home: 'IRN', away: 'NZL', date: '2026-06-15T18:00:00Z', round: 'Rodada 1', group: 'G' },
  // 16/06
  { home: 'FRA', away: 'SEN', date: '2026-06-16T21:00:00Z', round: 'Rodada 1', group: 'I' },
  { home: 'IRQ', away: 'NOR', date: '2026-06-16T18:00:00Z', round: 'Rodada 1', group: 'I' },
  { home: 'ARG', away: 'ALG', date: '2026-06-16T21:00:00Z', round: 'Rodada 1', group: 'J' },
  { home: 'AUT', away: 'JOR', date: '2026-06-16T18:00:00Z', round: 'Rodada 1', group: 'J' },
  // 17/06
  { home: 'POR', away: 'COD', date: '2026-06-17T18:00:00Z', round: 'Rodada 1', group: 'K' },
  { home: 'COL', away: 'UZB', date: '2026-06-17T21:00:00Z', round: 'Rodada 1', group: 'K' },
  { home: 'ENG', away: 'CRO', date: '2026-06-17T21:00:00Z', round: 'Rodada 1', group: 'L' },
  { home: 'GHA', away: 'PAN', date: '2026-06-17T18:00:00Z', round: 'Rodada 1', group: 'L' },

  // ===== 2ª RODADA =====
  // 18/06
  { home: 'MEX', away: 'KOR', date: '2026-06-18T18:00:00Z', round: 'Rodada 2', group: 'A' },
  { home: 'CZE', away: 'RSA', date: '2026-06-18T21:00:00Z', round: 'Rodada 2', group: 'A' },
  { home: 'CAN', away: 'QAT', date: '2026-06-18T21:00:00Z', round: 'Rodada 2', group: 'B' },
  { home: 'SUI', away: 'BIH', date: '2026-06-18T18:00:00Z', round: 'Rodada 2', group: 'B' },
  // 19/06
  { home: 'BRA', away: 'HAI', date: '2026-06-19T21:00:00Z', round: 'Rodada 2', group: 'C' },
  { home: 'MAR', away: 'SCO', date: '2026-06-19T18:00:00Z', round: 'Rodada 2', group: 'C' },
  { home: 'USA', away: 'AUS', date: '2026-06-19T21:00:00Z', round: 'Rodada 2', group: 'D' },
  { home: 'TUR', away: 'PAR', date: '2026-06-19T18:00:00Z', round: 'Rodada 2', group: 'D' },
  // 20/06
  { home: 'GER', away: 'CIV', date: '2026-06-20T18:00:00Z', round: 'Rodada 2', group: 'E' },
  { home: 'ECU', away: 'CUW', date: '2026-06-20T21:00:00Z', round: 'Rodada 2', group: 'E' },
  { home: 'NED', away: 'SWE', date: '2026-06-20T21:00:00Z', round: 'Rodada 2', group: 'F' },
  { home: 'JPN', away: 'TUN', date: '2026-06-20T18:00:00Z', round: 'Rodada 2', group: 'F' },
  // 21/06
  { home: 'ESP', away: 'SAU', date: '2026-06-21T18:00:00Z', round: 'Rodada 2', group: 'H' },
  { home: 'URU', away: 'CPV', date: '2026-06-21T21:00:00Z', round: 'Rodada 2', group: 'H' },
  { home: 'BEL', away: 'IRN', date: '2026-06-21T21:00:00Z', round: 'Rodada 2', group: 'G' },  
  { home: 'EGY', away: 'NZL', date: '2026-06-21T18:00:00Z', round: 'Rodada 2', group: 'G' },
  // 22/06
  { home: 'ARG', away: 'AUT', date: '2026-06-22T21:00:00Z', round: 'Rodada 2', group: 'J' },
  { home: 'ALG', away: 'JOR', date: '2026-06-22T18:00:00Z', round: 'Rodada 2', group: 'J' },
  { home: 'FRA', away: 'IRQ', date: '2026-06-22T21:00:00Z', round: 'Rodada 2', group: 'I' },
  { home: 'SEN', away: 'NOR', date: '2026-06-22T18:00:00Z', round: 'Rodada 2', group: 'I' },
  // 23/06
  { home: 'POR', away: 'UZB', date: '2026-06-23T18:00:00Z', round: 'Rodada 2', group: 'K' },
  { home: 'COD', away: 'COL', date: '2026-06-23T21:00:00Z', round: 'Rodada 2', group: 'K' },
  { home: 'ENG', away: 'GHA', date: '2026-06-23T21:00:00Z', round: 'Rodada 2', group: 'L' },
  { home: 'CRO', away: 'PAN', date: '2026-06-23T18:00:00Z', round: 'Rodada 2', group: 'L' },

  // ===== 3ª RODADA =====
  // 24/06
  { home: 'CZE', away: 'MEX', date: '2026-06-24T21:00:00Z', round: 'Rodada 3', group: 'A' },
  { home: 'RSA', away: 'KOR', date: '2026-06-24T21:00:00Z', round: 'Rodada 3', group: 'A' },
  { home: 'SUI', away: 'CAN', date: '2026-06-24T18:00:00Z', round: 'Rodada 3', group: 'B' },
  { home: 'BIH', away: 'QAT', date: '2026-06-24T18:00:00Z', round: 'Rodada 3', group: 'B' },
  { home: 'SCO', away: 'BRA', date: '2026-06-24T21:00:00Z', round: 'Rodada 3', group: 'C' },
  { home: 'MAR', away: 'HAI', date: '2026-06-24T21:00:00Z', round: 'Rodada 3', group: 'C' },
  // 25/06
  { home: 'TUR', away: 'USA', date: '2026-06-25T21:00:00Z', round: 'Rodada 3', group: 'D' },
  { home: 'PAR', away: 'AUS', date: '2026-06-25T21:00:00Z', round: 'Rodada 3', group: 'D' },
  { home: 'ECU', away: 'GER', date: '2026-06-25T21:00:00Z', round: 'Rodada 3', group: 'E' },
  { home: 'CUW', away: 'CIV', date: '2026-06-25T21:00:00Z', round: 'Rodada 3', group: 'E' },
  { home: 'TUN', away: 'NED', date: '2026-06-25T18:00:00Z', round: 'Rodada 3', group: 'F' },
  { home: 'JPN', away: 'SWE', date: '2026-06-25T18:00:00Z', round: 'Rodada 3', group: 'F' },
  // 26/06
  { home: 'URU', away: 'ESP', date: '2026-06-26T21:00:00Z', round: 'Rodada 3', group: 'H' },
  { home: 'SAU', away: 'CPV', date: '2026-06-26T21:00:00Z', round: 'Rodada 3', group: 'H' },
  { home: 'BEL', away: 'IRN', date: '2026-06-26T18:00:00Z', round: 'Rodada 3', group: 'G' },
  { home: 'NZL', away: 'EGY', date: '2026-06-26T18:00:00Z', round: 'Rodada 3', group: 'G' },
  { home: 'NOR', away: 'FRA', date: '2026-06-26T21:00:00Z', round: 'Rodada 3', group: 'I' },
  { home: 'IRQ', away: 'SEN', date: '2026-06-26T21:00:00Z', round: 'Rodada 3', group: 'I' },
  // 27/06
  { home: 'JOR', away: 'ARG', date: '2026-06-27T21:00:00Z', round: 'Rodada 3', group: 'J' },
  { home: 'AUT', away: 'ALG', date: '2026-06-27T21:00:00Z', round: 'Rodada 3', group: 'J' },
  { home: 'COL', away: 'POR', date: '2026-06-27T21:00:00Z', round: 'Rodada 3', group: 'K' },
  { home: 'UZB', away: 'COD', date: '2026-06-27T21:00:00Z', round: 'Rodada 3', group: 'K' },
  { home: 'PAN', away: 'ENG', date: '2026-06-27T21:00:00Z', round: 'Rodada 3', group: 'L' },
  { home: 'GHA', away: 'CRO', date: '2026-06-27T21:00:00Z', round: 'Rodada 3', group: 'L' },
];

async function fixMatches() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    // 1) Get all teams indexed by code
    const teamsResult = await client.query('SELECT id, code, name, group_id FROM public.teams');
    const teamsByCode = {};
    for (const t of teamsResult.rows) {
      teamsByCode[t.code] = t;
    }

    // Validate all codes exist
    for (const m of OFFICIAL_MATCHES) {
      if (!teamsByCode[m.home]) {
        console.error(`ERROR: Team code "${m.home}" not found in database!`);
        return;
      }
      if (!teamsByCode[m.away]) {
        console.error(`ERROR: Team code "${m.away}" not found in database!`);
        return;
      }
    }

    // 2) Delete existing group matches
    console.log('Deleting existing group-stage matches...');
    
    // First check if there are any predictions linked to these matches
    const predCheck = await client.query(`
      SELECT COUNT(*) as cnt FROM public.predictions p 
      JOIN public.matches m ON p.match_id = m.id 
      WHERE m.phase = 'group'
    `);
    console.log(`  Predictions linked to group matches: ${predCheck.rows[0].cnt}`);
    
    if (parseInt(predCheck.rows[0].cnt) > 0) {
      console.log('  WARNING: There are existing predictions. Deleting them first...');
      await client.query(`
        DELETE FROM public.predictions WHERE match_id IN (
          SELECT id FROM public.matches WHERE phase = 'group'
        )
      `);
      console.log('  Predictions deleted.');
    }

    await client.query("DELETE FROM public.matches WHERE phase = 'group'");
    console.log('  Old group matches deleted.');

    // 3) Insert new matches in correct order
    console.log('Inserting official matches...');
    let matchNumber = 1;
    
    for (const m of OFFICIAL_MATCHES) {
      const homeTeam = teamsByCode[m.home];
      const awayTeam = teamsByCode[m.away];
      
      await client.query(`
        INSERT INTO public.matches (phase, round_label, match_number, group_id, home_team_id, away_team_id, match_date)
        VALUES ('group', $1, $2, $3, $4, $5, $6)
      `, [m.round, matchNumber, m.group, homeTeam.id, awayTeam.id, m.date]);
      
      console.log(`  #${matchNumber} [${m.round}] ${m.group}: ${homeTeam.name} vs ${awayTeam.name} (${m.date.substring(0, 10)})`);
      matchNumber++;
    }

    console.log(`\nDone! ${matchNumber - 1} matches inserted with correct order and dates.`);

    // 4) Verify
    const verify = await client.query(`
      SELECT m.match_number, m.group_id, m.round_label, m.match_date,
             ht.name as home, at.name as away
      FROM public.matches m
      LEFT JOIN public.teams ht ON m.home_team_id = ht.id
      LEFT JOIN public.teams at ON m.away_team_id = at.id
      WHERE m.phase = 'group'
      ORDER BY m.match_number
      LIMIT 10
    `);
    console.log('\nFirst 10 matches (verification):');
    for (const r of verify.rows) {
      console.log(`  #${r.match_number} [${r.round_label}] ${r.group_id}: ${r.home} vs ${r.away} | ${r.match_date}`);
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

fixMatches();
