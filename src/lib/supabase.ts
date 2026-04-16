import { createClient } from '@supabase/supabase-js';

// Trim env vars to prevent invisible characters (\r, spaces) from breaking the API key
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("⚠️ Supabase credentials are not set.");
}

// Ensure the storage key matches across the app
export const AUTH_STORAGE_KEY = 'sst-gestao-auth';

// Create a SINGLE instance to avoid "Lock broken" AbortErrors
// This is especially important during HMR and in StrictMode
const supabaseInstance = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: AUTH_STORAGE_KEY,
      storage: window.localStorage, // Explicitly use window.localStorage
    },
  }
);

export const supabase = supabaseInstance;
