// Script para deletar usuários não-admin usando Supabase JS Client
// Precisa da SERVICE_ROLE_KEY para usar auth.admin
// 
// Como a anon key não tem permissão para deletar usuários do auth,
// este script lista quem precisa ser deletado. A deleção deve ser feita
// via Dashboard do Supabase ou via service_role key.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://uhdcdyfpowspufttkofl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVoZGNkeWZwb3dzcHVmdHRrb2ZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NDQ1MzIsImV4cCI6MjA5MzQyMDUzMn0.Sz7_ZsuH68D3zsMx1kmjRKMo2Rglyhpk_1EPVmm8r6Q";

// If you have a service_role key, set it here to enable deletion:
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

async function main() {
  // Use service role if available, otherwise anon key
  const key = SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
  const isServiceRole = !!SERVICE_ROLE_KEY;
  
  const supabase = createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  console.log(`Usando ${isServiceRole ? 'service_role key' : 'anon key (somente leitura)'}...\n`);

  // 1) List all profiles and roles
  const { data: profiles, error: pErr } = await supabase.from("profiles").select("*").order("display_name");
  const { data: roles, error: rErr } = await supabase.from("user_roles").select("*");

  if (pErr) { console.error("Erro ao carregar perfis:", pErr.message); return; }

  const roleMap = new Map((roles || []).map(r => [r.user_id, r.role]));

  console.log("=== Todos os usuários ===");
  const nonAdmins = [];
  for (const p of profiles || []) {
    const role = roleMap.get(p.id) || "sem_role";
    const isAdmin = role === "admin";
    console.log(`  ${p.display_name} | role: ${role} | id: ${p.id}`);
    if (!isAdmin) nonAdmins.push(p);
  }

  if (nonAdmins.length === 0) {
    console.log("\n✓ Nenhum usuário não-admin encontrado.");
    return;
  }

  console.log(`\n=== ${nonAdmins.length} usuários não-admin para deletar ===`);
  for (const u of nonAdmins) {
    console.log(`  - ${u.display_name} (${u.id})`);
  }

  if (!isServiceRole) {
    console.log("\n⚠️  Sem service_role key. Para deletar, use uma das opções:");
    console.log("  1. Dashboard Supabase → Authentication → Users → deletar manualmente");
    console.log("  2. Defina SUPABASE_SERVICE_ROLE_KEY e execute novamente:");
    console.log("     set SUPABASE_SERVICE_ROLE_KEY=sua_key_aqui && node scripts/delete-non-admin-users.js");
    
    // Still clean up any orphan data from public tables
    console.log("\n🧹 Limpando dados de tabelas públicas dos usuários não-admin...");
    for (const u of nonAdmins) {
      const dels = await Promise.all([
        supabase.from("predictions").delete().eq("user_id", u.id),
        supabase.from("knockout_predictions").delete().eq("user_id", u.id),
        supabase.from("special_predictions").delete().eq("user_id", u.id),
        supabase.from("user_roles").delete().eq("user_id", u.id),
        supabase.from("profiles").delete().eq("id", u.id),
      ]);
      const errors = dels.filter(d => d.error);
      if (errors.length > 0) {
        console.log(`  ⚠️ ${u.display_name}: alguns deletes falharam (RLS pode bloquear)`);
        errors.forEach(e => console.log(`     ${e.error.message}`));
      } else {
        console.log(`  ✓ ${u.display_name}: dados limpos das tabelas públicas`);
      }
    }
    console.log("\n📌 Agora vá ao Dashboard do Supabase e delete os usuários do auth manualmente.");
    return;
  }

  // With service_role: delete from auth + data
  for (const u of nonAdmins) {
    console.log(`\nDeletando ${u.display_name}...`);
    
    // Clean related data
    await supabase.from("predictions").delete().eq("user_id", u.id);
    await supabase.from("knockout_predictions").delete().eq("user_id", u.id);
    await supabase.from("special_predictions").delete().eq("user_id", u.id);
    await supabase.from("user_roles").delete().eq("user_id", u.id);
    await supabase.from("profiles").delete().eq("id", u.id);
    
    // Delete from auth
    const { error: authErr } = await supabase.auth.admin.deleteUser(u.id);
    if (authErr) {
      console.log(`  ⚠️ Erro ao deletar do auth: ${authErr.message}`);
    } else {
      console.log(`  ✓ Deletado com sucesso`);
    }
  }

  console.log("\n✓ Concluído!");
}

main().catch(console.error);
