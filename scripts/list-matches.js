import pkg from 'pg';
const { Client } = pkg;

const connectionString = "postgresql://postgres.uhdcdyfpowspufttkofl:1wLiBVUtEeymNYbd@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true";

async function listMatches() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const result = await client.query(`
      SELECT m.match_number, m.group_id, m.round_label, m.match_date,
             ht.name as home_team, ht.code as home_code,
             at.name as away_team, at.code as away_code
      FROM public.matches m
      LEFT JOIN public.teams ht ON m.home_team_id = ht.id
      LEFT JOIN public.teams at ON m.away_team_id = at.id
      WHERE m.phase = 'group'
      ORDER BY m.group_id, m.match_number
    `);
    
    let currentGroup = '';
    for (const row of result.rows) {
      if (row.group_id !== currentGroup) {
        currentGroup = row.group_id;
        console.log(`\n=== GRUPO ${currentGroup} ===`);
      }
      console.log(`  #${row.match_number} [${row.round_label}] ${row.home_team} (${row.home_code}) vs ${row.away_team} (${row.away_code}) | date: ${row.match_date || 'null'}`);
    }

    // Also list teams per group
    const teams = await client.query(`
      SELECT code, name, group_id FROM public.teams ORDER BY group_id, name
    `);
    console.log('\n\n=== TEAMS BY GROUP ===');
    let cg = '';
    for (const t of teams.rows) {
      if (t.group_id !== cg) {
        cg = t.group_id;
        console.log(`\nGrupo ${cg}:`);
      }
      console.log(`  ${t.code} - ${t.name}`);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

listMatches();
