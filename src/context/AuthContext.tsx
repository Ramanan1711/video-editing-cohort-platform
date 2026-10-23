import React, { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { AuthContext, type Profile } from './authContextValue';
import {
  enforceSevenDaySessionPolicy,
  recordSessionEstablished,
  clearSessionEstablished,
} from '../lib/authSessionService';

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

      const userPhone =
        (currentUser.user_metadata?.whatsapp_number as string | undefined) ||
        (currentUser.user_metadata?.phone as string | undefined) ||
        (currentUser.user_metadata?.phone_number as string | undefined) ||
        null;

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
            whatsapp_number: userPhone,
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
          whatsapp_number: userPhone,
          role: 'student',
          status: 'active',
        });
        return;
      }

      // If profile exists but whatsapp_number is missing in DB and present in auth metadata, sync it
      if (data && !data.whatsapp_number && userPhone) {
        data.whatsapp_number = userPhone;
        supabase
          .from('profiles')
          .update({ whatsapp_number: userPhone })
          .eq('id', currentUser.id)
          .then(() => {}, () => {});
      }

      setProfile(data);
    } catch (error) {
      console.error('Error fetching authoritative user profile from database:', error);
      // Degraded fallback in case of transient network disruption:
      // SECURITY: Default strictly to 'student' role. NEVER escalate to 'mentor' or 'admin' from metadata.
      if (currentUser) {
        const userPhone =
          (currentUser.user_metadata?.whatsapp_number as string | undefined) ||
          (currentUser.user_metadata?.phone as string | undefined) ||
          (currentUser.user_metadata?.phone_number as string | undefined) ||
          null;
        setProfile((prev) => {
          // If we already had a valid verified profile, retain it
          if (prev && prev.id === currentUser.id) return prev;
          return {
            id: currentUser.id,
            email: currentUser.email ?? '',
            full_name: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Editor',
            whatsapp_number: userPhone,
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
    // Get initial session and enforce 7-day retention policy
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const isValid = await enforceSevenDaySessionPolicy(session);
      if (isValid && session?.user) {
        setUser(session.user);
        fetchProfile(session.user);
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    // Listen to auth changes (automatic refresh, sign in, sign out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN') {
        recordSessionEstablished();
      } else if (event === 'SIGNED_OUT') {
        clearSessionEstablished();
      }

      if (session) {
        const isValid = await enforceSevenDaySessionPolicy(session);
        if (!isValid) {
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }
      }

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
    clearSessionEstablished();
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
