import { createClient } from '@supabase/supabase-js';

// Trim env vars to prevent invisible characters (\r, spaces) from breaking the API key
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("⚠️ Supabase credentials are not set. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.");
}

// Clear any corrupted session data on startup
try {
  const storageKey = 'sst-gestao-auth';
  const stored = localStorage.getItem(storageKey);
  if (stored) {
    try {
      JSON.parse(stored);
    } catch {
      console.warn('Corrupted auth session detected, clearing...');
      localStorage.removeItem(storageKey);
    }
  }
} catch (e) {
  // localStorage not available
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'sst-gestao-auth',
    },
  }
);
