import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';
import { supabase } from '../lib/supabase';

export type Role = 'proprietario' | 'master' | 'operador' | 'visualizador';

export interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  role: Role;
  status?: string;
  access_expires_at?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  canEdit: boolean;
  canPrint: boolean;
  isMaster: boolean;
  isProprietario: boolean;
  isMobile: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();
  
  // Ref to prevent mounting/initializing multiple times
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    
    let isMounted = true;

    /**
     * Fetch user profile with a hard timeout.
     * Uses a fresh fetch to avoid Supabase JS client lock issues.
     */
    const fetchProfile = async (userId: string, accessToken: string): Promise<User | null> => {
      try {
        console.log("AuthContext: Fetching profile for:", userId);
        
        const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
        const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

        // Use native fetch with AbortController for reliable timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(
          `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=*`,
          {
            headers: {
              'apikey': supabaseAnonKey,
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json',
              'Accept-Profile': 'public',
            },
            signal: controller.signal,
          }
        );
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          console.error("AuthContext: Profile fetch HTTP error:", response.status);
          return null;
        }

        const data = await response.json();
        const profile = Array.isArray(data) ? data[0] : null;

        if (!profile) {
          console.error("AuthContext: Profile not found for user:", userId);
          return null;
        }

        // Handle expired access
        if (profile.status === 'pending_approval' && profile.access_expires_at && new Date(profile.access_expires_at) < new Date()) {
          console.warn("AuthContext: Access expired");
          await supabase.auth.signOut();
          return null;
        }

        console.log("AuthContext: Profile loaded successfully:", profile.name);

        return {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          username: profile.username || profile.email,
          role: (profile.role || 'visualizador') as Role,
          status: profile.status,
          access_expires_at: profile.access_expires_at
        };
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.error("AuthContext: Profile fetch timed out after 8s");
        } else {
          console.error("AuthContext: Exception in fetchProfile:", err);
        }
        return null;
      }
    };

    const initializeAuth = async () => {
      try {
        // Get initial session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.warn("AuthContext: Session error:", sessionError);
        }

        if (session?.user && session?.access_token && isMounted) {
          const profile = await fetchProfile(session.user.id, session.access_token);
          // Only update user if we got a valid profile — don't overwrite with null
          if (isMounted && profile) {
            setUser(profile);
          }
        }
      } catch (err) {
        console.error('AuthContext: Initialization error:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    // Safety timeout to ensure app doesn't stay on loading forever
    const safetyTimeout = setTimeout(() => {
      if (isMounted && loading) {
        console.warn('AuthContext: Loading safety timeout triggered');
        setLoading(false);
      }
    }, 10000);

    initializeAuth();

    // Set up singleton listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      
      console.log("AuthContext: Auth event:", event);

      if (event === 'SIGNED_OUT' || !session?.user) {
        setUser(null);
        setLoading(false);
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (!session.access_token) {
          console.error("AuthContext: No access token in session");
          setLoading(false);
          return;
        }
        
        const profile = await fetchProfile(session.user.id, session.access_token);
        if (isMounted) {
          if (profile) {
            setUser(profile);
          }
          setLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
      initialized.current = false;
    };
  }, []);

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const isProprietario = user?.role === 'proprietario';
  const isMaster = user?.role === 'proprietario' || user?.role === 'master';
  const canEdit = isProprietario || user?.role === 'master';
  const canPrint = canEdit || user?.role === 'operador';

  const value = {
    user,
    loading,
    canEdit,
    canPrint,
    isMaster,
    isProprietario,
    isMobile,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
