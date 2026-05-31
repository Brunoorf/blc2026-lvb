import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://uhdcdyfpowspufttkofl.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVoZGNkeWZwb3dzcHVmdHRrb2ZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NDQ1MzIsImV4cCI6MjA5MzQyMDUzMn0.Sz7_ZsuH68D3zsMx1kmjRKMo2Rglyhpk_1EPVmm8r6Q";

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanup() {
  console.log('🗑️  Deletando regras obsoletas...');
  
  const { data: deleted, error: deleteError } = await supabase
    .from('scoring_rules')
    .delete()
    .in('rule_key', ['top_scorer', 'best_goalkeeper', 'best_player'])
    .select();
  
  if (deleteError) {
    console.error('❌ Erro:', deleteError.message);
    process.exit(1);
  }
  
  console.log(`✅ ${deleted.length} regras deletadas!`);
  
  console.log('\n📋 Regras restantes:');
  const { data: remaining, error: readError } = await supabase
    .from('scoring_rules')
    .select('rule_key, label, points')
    .order('rule_key');
  
  if (readError) {
    console.error('❌ Erro:', readError.message);
    process.exit(1);
  }
  
  remaining.forEach(r => {
    console.log(`  ${r.rule_key.padEnd(20)} | ${r.label.padEnd(35)} | +${r.points}`);
  });
  
  console.log(`\n✅ Total: ${remaining.length} regras ativas`);
}

cleanup().catch(e => {
  console.error('❌', e.message);
  process.exit(1);
});
