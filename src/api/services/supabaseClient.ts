import { config as dotenvConfig } from 'dotenv';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Ensure .env and .env.local are loaded when running the API
const cwd = process.cwd();
const dotEnvPath = path.join(cwd, '.env');
const dotEnvLocalPath = path.join(cwd, '.env.local');
dotenvConfig({ path: dotEnvPath });
if (fs.existsSync(dotEnvLocalPath)) dotenvConfig({ path: dotEnvLocalPath });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

console.log('Supabase URL present:', Boolean(supabaseUrl));
console.log('Supabase service role key present:', Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY));

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase credentials missing. Check .env or .env.local.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);