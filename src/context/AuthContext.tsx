import React, { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { AuthContext, type Profile } from './authContextValue';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (currentUser: User) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        // Self-healing recovery: If public.profiles row is missing, create it automatically.
        // SECURITY: Under no circumstances should client-controlled user_metadata be trusted
        // for role authority. Newly self-healed profiles must always be least-privileged ('student').
        const fallbackName =
          currentUser.user_metadata?.full_name ||
          currentUser.email?.split('@')[0] ||
          'Editor';

        const { data: inserted, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: currentUser.id,
            email: currentUser.email ?? '',
            full_name: fallbackName,
            role: 'student',
            status: 'active',
          })
          .select('*')
          .single();

        if (!insertError && inserted) {
          setProfile(inserted);
          return;
        }

        // In-memory fallback if insert fails: strictly least privilege
        setProfile({
          id: currentUser.id,
          email: currentUser.email ?? '',
          full_name: fallbackName,
          role: 'student',
          status: 'active',
        });
        return;
      }

      setProfile(data);
    } catch (error) {
      console.error('Error fetching authoritative user profile from database:', error);
      // Degraded fallback in case of transient network disruption:
      // SECURITY: Default strictly to 'student' role. NEVER escalate to 'mentor' or 'admin' from metadata.
      if (currentUser) {
        setProfile((prev) => {
          // If we already had a valid verified profile, retain it
          if (prev && prev.id === currentUser.id) return prev;
          return {
            id: currentUser.id,
            email: currentUser.email ?? '',
            full_name: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Editor',
            role: 'student',
            status: 'active',
          };
        });
      } else {
        setProfile(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (!error && data) {
        setProfile(data);
      }
    } catch (err) {
      console.warn('Silent profile revalidation failure:', err);
    }
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user);
      } else {
        setLoading(false);
      }
    });

    // Listen to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
