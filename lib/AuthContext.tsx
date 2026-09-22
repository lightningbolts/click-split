'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  /** Display name from public.users table. */
  displayName: string | null;
  /** Profile image URL from public.users table. */
  profileImageUrl: string | null;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  displayName: null,
  profileImageUrl: null,
  signOut: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);

  const loadProfileFromUsersTable = useCallback(async (userId: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('users')
        .select('name, image')
        .eq('id', userId)
        .maybeSingle();
      if (!error && data) {
        setDisplayName(typeof data.name === 'string' && data.name.length > 0 ? data.name : null);
        setProfileImageUrl(typeof data.image === 'string' && data.image.length > 0 ? data.image : null);
      }
    } catch (e) {
      console.error('Error loading profile:', e);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    try {
      const { data: { user: freshUser }, error } = await supabase.auth.getUser();
      if (!error && freshUser) {
        setUser(freshUser);
        await loadProfileFromUsersTable(freshUser.id);
      }
    } catch (err) {
      console.error('Error refreshing user:', err);
    }
  }, [loadProfileFromUsersTable]);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      setLoading(false);
      if (u?.id) {
        void loadProfileFromUsersTable(u.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const next = session?.user ?? null;
      setUser(next);
      setLoading(false);
      if (next?.id) {
        void loadProfileFromUsersTable(next.id);
      } else {
        setDisplayName(null);
        setProfileImageUrl(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfileFromUsersTable]);

  const signOut = async () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await Promise.race([
          fetch('/api/auth/signout', { method: 'POST' }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000)),
        ]);
        await Promise.race([
          supabase.auth.signOut(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000)),
        ]);
      } catch (error) {
        console.error('Sign out error:', error);
      } finally {
        setUser(null);
        setDisplayName(null);
        setProfileImageUrl(null);
        router.replace('/');
        router.refresh();
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, displayName, profileImageUrl, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
