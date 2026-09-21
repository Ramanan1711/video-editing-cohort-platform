import { createContext } from 'react';
import type { User } from '@supabase/supabase-js';

import type { AdminSubRole } from '../lib/adminPermissions';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: 'student' | 'mentor' | 'admin';
  status?: 'active' | 'suspended' | 'inactive';
  admin_role?: AdminSubRole;
}

export interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});