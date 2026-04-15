import React, { createContext, useContext, useState, useEffect } from 'react';
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
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  loading: boolean;
  canEdit: boolean;
  canPrint: boolean;
  isMaster: boolean;
  isProprietario: boolean;
  isMobile: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('sst_token'));
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

  useEffect(() => {
    let isMounted = true;

    const fetchProfile = async (userId: string): Promise<User | null> => {
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (error || !profile) {
          console.error("Error fetching profile:", error);
          return null;
        }

        // Check access expiration
        if (profile.status === 'pending_approval' && profile.access_expires_at && new Date(profile.access_expires_at) < new Date()) {
          await supabase.auth.signOut();
          return null;
        }

        return {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          username: profile.username || profile.email,
          role: (profile.role || 'visualizador') as Role,
          status: profile.status,
          access_expires_at: profile.access_expires_at
        };
      } catch (err) {
        console.error("Profile fetch error:", err);
        return null;
      }
    };

    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          const profile = await fetchProfile(session.user.id);
          if (isMounted) {
            setUser(profile);
          }
        } else {
          if (isMounted) setUser(null);
        }
      } catch (err) {
        console.error('Session error:', err);
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    // Safety timeout: if loading takes more than 8 seconds, stop loading
    const safetyTimeout = setTimeout(() => {
      if (isMounted && loading) {
        console.warn('Auth loading timeout reached, forcing load complete.');
        setLoading(false);
      }
    }, 8000);

    checkSession();

    // Listen for auth state changes (login/logout from other tabs, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      
      if (event === 'SIGNED_OUT') {
        setUser(null);
        return;
      }

      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        if (isMounted) {
          setUser(profile);
          setLoading(false);
        }
      } else {
        if (isMounted) {
          setUser(null);
          setLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const login = (newToken: string, newUser: User) => {
    setUser(newUser);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const isProprietario = user?.role === 'proprietario';
  const isMaster = user?.role === 'proprietario' || user?.role === 'master';
  const canEdit = isProprietario || user?.role === 'master';
  const canPrint = canEdit || user?.role === 'operador';

  return (
    <AuthContext.Provider value={{ user, token: null, login, logout, loading, canEdit, canPrint, isMaster, isProprietario, isMobile }}>
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
