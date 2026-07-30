require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function run() {
  const { data, error } = await supabase.from('platform_members').select('*, platform_roles(*)').limit(1);
  console.log('platform_members with role:', data, error);
}
run();
