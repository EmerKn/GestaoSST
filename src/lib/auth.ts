import { supabase } from './supabase';

// Simple SHA-256 hash function for the frontend
export async function hashPassword(password: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Simplified login: only authenticate with Supabase Auth.
 * Profile fetching is handled entirely by AuthContext's onAuthStateChange listener.
 * This prevents race conditions from concurrent profile queries.
 */
export async function loginWithCredentials(email: string, password: string): Promise<{ error: string | null }> {
  let timeoutId: any;
  try {
    console.log("Starting login attempt for:", email);
    
    // Clear any stale/corrupted session before attempting login
    // This prevents navigator.locks deadlocks from previous sessions
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // Ignore signOut errors — we just want to clear the lock
    }

    const loginPromise = supabase.auth.signInWithPassword({ 
      email, 
      password 
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error("Timeout de conexão com Supabase")), 20000);
    });

    // Race the login against a 20s timeout
    const { error: signInError } = await Promise.race([
      loginPromise,
      timeoutPromise as any
    ]);
    
    clearTimeout(timeoutId);

    if (signInError) {
      console.warn("Sign in error:", signInError);
      return { error: 'E-mail ou senha inválidos' };
    }

    console.log("Supabase Auth success — AuthContext will handle profile fetch via onAuthStateChange");
    
    // Don't fetch profile here! AuthContext's onAuthStateChange will handle it.
    // This prevents the race condition where two concurrent profile queries block each other.
    return { error: null };
  } catch (err: any) {
    if (timeoutId) clearTimeout(timeoutId);
    console.error('General login error:', err);
    return { error: `Erro técnico: ${err.message || 'Erro de rede ou conexão'}` };
  }
}

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin
    }
  });
  return { data, error };
}
