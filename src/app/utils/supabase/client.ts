import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './info';

// We rebuild the URL here using the ID you copied
const supabaseUrl = `https://${projectId}.supabase.co`;

// Export the ready-to-use Supabase client
export const supabase = createClient(supabaseUrl, publicAnonKey);