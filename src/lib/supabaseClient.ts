import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables in .env')
}

/**
 * Authoritative Supabase Client Configuration
 * - persistSession: true (persists session across page reloads and browser restarts)
 * - autoRefreshToken: true (refreshes tokens automatically to keep sessions valid up to 7 days)
 * - detectSessionInUrl: true (detects OAuth/recovery/magic-link sessions)
 * - flowType: 'pkce' (secure PKCE flow)
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
})