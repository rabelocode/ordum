import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

const supabaseUrl =
  (import.meta as any).env.VITE_SUPABASE_URL ||
  (import.meta as any).env.VITE_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  (import.meta as any).env.VITE_SUPABASE_ANON_KEY ||
  (import.meta as any).env.VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  (import.meta as any).env.VITE_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
