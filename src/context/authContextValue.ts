import { createContext } from 'react';
import type { User } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: 'student' | 'mentor' | 'admin';
}

export interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<Profile | null>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => null,
});