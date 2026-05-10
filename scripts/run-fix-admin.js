import pkg from 'pg';
const { Client } = pkg;

const connectionString = "postgresql://postgres.uhdcdyfpowspufttkofl:1wLiBVUtEeymNYbd@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true";

async function fixPermissions() {
  const client = new Client({ connectionString });
  await client.connect();
  console.log("✓ Conectado");

  try {
    // 1) Conceder permissões de tabela ao role authenticated e anon
    const tables = ['groups','teams','matches','predictions','knockout_predictions',
      'special_predictions','profiles','user_roles','scoring_rules',
      'tournament_settings','team_official_results'];
    
    for (const t of tables) {
      await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON public.${t} TO authenticated`);
      await client.query(`GRANT SELECT ON public.${t} TO anon`);
    }
    console.log("✓ Permissões de tabela concedidas a authenticated/anon");

    // 2) Garantir uso do schema
    await client.query("GRANT USAGE ON SCHEMA public TO authenticated, anon");
    console.log("✓ USAGE no schema público concedido");

    // 3) Garantir has_role acessível
    await client.query("GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, anon");
    console.log("✓ has_role acessível");

    // 4) Verificar admin
    const check = await client.query(`
      SELECT u.email, p.display_name, ur.role 
      FROM auth.users u 
      LEFT JOIN public.profiles p ON p.id = u.id
      LEFT JOIN public.user_roles ur ON ur.user_id = u.id
    `);
    console.log("\n=== Usuários ===");
    check.rows.forEach(r => console.log(`  ${r.email} | ${r.display_name} | ${r.role}`));

  } catch (err) {
    console.error("Erro:", err.message);
  } finally {
    await client.end();
  }
}

fixPermissions();
