import { supabase } from './supabase';
import { User } from '../contexts/AuthContext';

// Simple SHA-256 hash function for the frontend
export async function hashPassword(password: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export async function loginWithCredentials(email: string, password: string): Promise<{ user: User | null, token: string | null, error: string | null }> {
  let timeoutId: any;
  try {
    console.log("Starting login attempt for:", email);
    
    // Clear any stale session locally before attempting fresh login
    localStorage.removeItem('sst-gestao-auth');

    // Create a safety timeout for the login attempt itself
    const loginPromise = supabase.auth.signInWithPassword({ 
      email, 
      password 
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error("Timeout de conexão com Supabase")), 15000);
    });

    // Race the login against a 15s timeout
    const { data: { session, user: authUser }, error: signInError } = await Promise.race([
      loginPromise,
      timeoutPromise as any
    ]);
    
    clearTimeout(timeoutId);

    if (signInError) {
      console.warn("Sign in error:", signInError);
      return { user: null, token: null, error: 'E-mail ou senha inválidos' };
    }

    if (!authUser) {
      console.error("No user returned after successful sign in");
      return { user: null, token: null, error: 'Usuário não encontrado após login.' };
    }

    console.log("Supabase Auth success, fetching profile for ID:", authUser.id);

    // Fetch profile data with its own timeout
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (profileError || !profile) {
      console.error("Profile not found or RLS error:", profileError);
      // Log more details about the profile error if it exists
      if (profileError) {
        console.error("Profile error details:", JSON.stringify(profileError));
      }
      return { user: null, token: null, error: 'Perfil de usuário não configurado no banco. O administrador precisa checar sua conta.' };
    }

    console.log("Profile fetched successfully, status:", profile.status);

    if (profile.status === 'pending_approval' && profile.access_expires_at && new Date(profile.access_expires_at) < new Date()) {
      return { user: null, token: null, error: 'Seu acesso temporário expirou. Aguarde a aprovação de um administrador.' };
    }

    // Small delay to ensure session is persisted
    await new Promise(resolve => setTimeout(resolve, 200));

    return { 
      user: {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        username: profile.username || profile.email,
        role: (profile.role || 'visualizador') as any,
        status: profile.status,
        access_expires_at: profile.access_expires_at
      }, 
      token: session?.access_token || null,
      error: null 
    };
  } catch (err: any) {
    if (timeoutId) clearTimeout(timeoutId);
    console.error('General login error:', err);
    return { user: null, token: null, error: `Erro técnico: ${err.message || 'Erro de rede ou conexão'}` };
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
