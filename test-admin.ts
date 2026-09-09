import { createClient } from '@supabase/supabase-js';
import { loadEnvConfig } from '@next/env';
import path from 'path';

loadEnvConfig(process.cwd());

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const { data, error } = await supabaseAdmin
    .from('tim_kunjungan')
    .select('*, profiles:user_id(full_name, email)')
    .order('created_at', { ascending: false });
    
  console.log('Result:', { data, error });
}

run();
