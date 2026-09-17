import React, { useEffect, useState, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { AuthContext, type Profile } from './authContextValue';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Missing-profile self-recovery logic
  const recoverProfile = useCallback(async (targetUser: User): Promise<Profile | null> => {
    // 1. Try secure RPC function
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('ensure_current_user_profile');
      if (!rpcError && rpcData) {
        const parsed = typeof rpcData === 'string' ? JSON.parse(rpcData) : rpcData;
        return parsed as Profile;
      }
    } catch (err) {
      console.warn('ensure_current_user_profile RPC failed, falling back to direct upsert:', err);
    }

    // 2. Direct fallback upsert if RPC is unavailable
    try {
      const metaRole = targetUser.user_metadata?.role;
      const role: 'student' | 'mentor' | 'admin' =
        metaRole === 'mentor' || metaRole === 'admin' ? metaRole : 'student';
      const fullName =
        targetUser.user_metadata?.full_name ||
        targetUser.email?.split('@')[0] ||
        'Editor';

      const { data: directData, error: directError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: targetUser.id,
            full_name: fullName,
            email: targetUser.email || '',
            role,
          },
          { onConflict: 'id' }
        )
        .select('*')
        .single();

      if (!directError && directData) {
        return directData as Profile;
      }
    } catch (err) {
      console.error('Direct profile recovery failed:', err);
    }

    return null;
  }, []);

  const fetchProfile = useCallback(async (userId: string, activeUser?: User | null): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!error && data) {
        setProfile(data);
        return data;
      }

      // Profile is missing; initiate recovery if we have user context
      const targetUser = activeUser ?? user;
      if (targetUser && targetUser.id === userId) {
        const recovered = await recoverProfile(targetUser);
        if (recovered) {
          setProfile(recovered);
          return recovered;
        }
      }

      setProfile(null);
      return null;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setProfile(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [recoverProfile, user]);

  const refreshProfile = useCallback(async (): Promise<Profile | null> => {
    if (!user) return null;
    return fetchProfile(user.id, user);
  }, [fetchProfile, user]);

  useEffect(() => {
    let isMounted = true;

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        void fetchProfile(currentUser.id, currentUser);
      } else {
        setLoading(false);
      }
    });

    // Listen to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        void fetchProfile(currentUser.id, currentUser);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
