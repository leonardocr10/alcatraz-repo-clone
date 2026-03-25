import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pmofvoekrrskgurydtnp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtb2Z2b2VrcnJza2d1cnlkdG5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MDk0NTMsImV4cCI6MjA4ODQ4NTQ1M30.a8SB38ryN9X06nhIFgSSDCLGYpB-vzD7eyZ8Z9PBV4I';

const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteVulnerableRecords() {
  const { error } = await supabase
    .from('users')
    .delete()
    .is('auth_id', null);

  if (error) {
    console.error('Error deleting data:', error);
    return;
  }

  console.log('Todos os perfis intrusos sem auth_id foram removidos com sucesso da tabela users!');
}

deleteVulnerableRecords();
