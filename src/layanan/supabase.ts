import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Buat client Supabase untuk query database & real-time GPS
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export default supabase;
