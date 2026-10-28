import { supabase } from '../supabaseClient';

export interface UserRegistrationCheckResult {
  isRegistered: boolean;
  status: 'active' | 'suspended' | 'unregistered' | 'invalid_input' | 'error';
  role?: string;
  message: string;
}

/**
 * Checks whether an email address belongs to an actively registered user
 * or an unregistered user in the platform database.
 *
 * Used primarily for /forgot-password to ensure unregistered users do NOT
 * trigger 6-digit recovery OTP dispatch or enter the recovery verification flow.
 */
export async function checkUserRegistrationStatus(
  email: string
): Promise<UserRegistrationCheckResult> {
  const normalizedEmail = (email || '').trim().toLowerCase();

  // Basic email syntax validation
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return {
      isRegistered: false,
      status: 'invalid_input',
      message: 'Please enter a valid email address.',
    };
  }

  // 1. Authoritative check via Postgres RPC function
  try {
    if (typeof supabase?.rpc === 'function') {
      const { data, error } = await supabase.rpc('check_user_registration_status', {
        p_email: normalizedEmail,
      });

      if (!error && data && typeof data === 'object') {
        const rpcResult = data as {
          is_registered?: boolean;
          status?: 'active' | 'suspended' | 'unregistered' | 'invalid_input';
          role?: string;
          message?: string;
        };

        return {
          isRegistered: Boolean(rpcResult.is_registered),
          status: rpcResult.status || (rpcResult.is_registered ? 'active' : 'unregistered'),
          role: rpcResult.role,
          message: rpcResult.message || (rpcResult.is_registered ? 'User account verified.' : 'No account found with this email address.'),
        };
      }
    }
  } catch (rpcErr) {
    // Graceful fallback to client query if RPC is temporarily unavailable
    console.warn('RPC check_user_registration_status failed, trying fallback check:', rpcErr);
  }

  // 2. Client-side fallback check against public.profiles (e.g. for mock tests or dev environments)
  try {
    if (typeof supabase?.from === 'function') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, email, status, role')
        .ilike('email', normalizedEmail)
        .maybeSingle();

      if (profile) {
        if (profile.status === 'suspended') {
          return {
            isRegistered: true,
            status: 'suspended',
            role: profile.role || 'student',
            message: 'This account has been suspended. Please contact platform support.',
          };
        }

        return {
          isRegistered: true,
          status: 'active',
          role: profile.role || 'student',
          message: 'User account verified.',
        };
      }
    }
  } catch {
    // In production, unauthenticated SELECT on profiles may be blocked by RLS.
  }

  // 3. If neither check found a record, user is unregistered
  return {
    isRegistered: false,
    status: 'unregistered',
    message: 'No account found with this email address. Please check your email or register.',
  };
}

