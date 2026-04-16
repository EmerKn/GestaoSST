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
  const isFetchingProfile = useRef(false);
  const lastFetchTime = useRef(0);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    
    let isMounted = true;

    const fetchProfile = async (userId: string): Promise<User | null> => {
      // Throttle and lock to prevent infinite loops
      if (isFetchingProfile.current) return null;
      
      const now = Date.now();
      if (now - lastFetchTime.current < 2000) return null;

      isFetchingProfile.current = true;
      lastFetchTime.current = now;

      try {
        console.log("AuthContext: Fetching profile for:", userId);
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (error || !profile) {
          console.error("AuthContext: Profile fetch error:", error);
          return null;
        }

        // Handle expired access
        if (profile.status === 'pending_approval' && profile.access_expires_at && new Date(profile.access_expires_at) < new Date()) {
          console.warn("AuthContext: Access expired");
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
        console.error("AuthContext: Exception in fetchProfile:", err);
        return null;
      } finally {
        isFetchingProfile.current = false;
      }
    };

    const initializeAuth = async () => {
      try {
        // Get initial session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.warn("AuthContext: Session error:", sessionError);
        }

        if (session?.user && isMounted) {
          const profile = await fetchProfile(session.user.id);
          if (isMounted) {
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
    }, 12000);

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
        const profile = await fetchProfile(session.user.id);
        if (isMounted && profile) {
          setUser(profile);
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
