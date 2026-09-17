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
        // Self-healing recovery: If public.profiles row is missing, create it automatically
        const fallbackRole = (currentUser.user_metadata?.role as 'student' | 'mentor' | 'admin') || 'student';
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
            role: fallbackRole,
          })
          .select('*')
          .single();

        if (!insertError && inserted) {
          setProfile(inserted);
          return;
        }

        // In-memory fallback if insert fails
        setProfile({
          id: currentUser.id,
          email: currentUser.email ?? '',
          full_name: fallbackName,
          role: fallbackRole,
        });
        return;
      }

      setProfile(data);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      // Resilient fallback using metadata to prevent locking users out
      if (currentUser) {
        setProfile({
          id: currentUser.id,
          email: currentUser.email ?? '',
          full_name: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Editor',
          role: (currentUser.user_metadata?.role as 'student' | 'mentor' | 'admin') || 'student',
        });
      } else {
        setProfile(null);
      }
    } finally {
      setLoading(false);
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
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
