const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function run() {
  const { data: cols, error: colsErr } = await supabase.rpc('platform_authorize_team', { p_team_id: '123e4567-e89b-12d3-a456-426614174000', p_permission_key: 'test' });
  console.log('rpc:', cols, colsErr);
  
  const { data, error } = await supabase.from('platform_members').select('*').limit(1);
  console.log('platform_members:', data, error);
}
run();
