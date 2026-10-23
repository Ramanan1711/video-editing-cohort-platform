/**
 * AuthSessionService - 7-Day Session Lifecycle & Refresh Management
 *
 * Implements authoritative session persistence and refresh policy:
 * 1. Leverages Supabase-managed tokens (JWT access_token + secure refresh_token) in client storage.
 * 2. Strictly forbids storing plaintext passwords or raw credentials in browser storage.
 * 3. Enforces a maximum 7-day session lifetime policy. Re-authenticates or clears when 7 days elapse.
 * 4. Ensures session persistence survives browser restarts and page refreshes.
 * 5. Cleanses session state completely on explicit sign out.
 */

import { supabase } from './supabaseClient';

export const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60; // 604,800 seconds
export const SEVEN_DAYS_MS = SEVEN_DAYS_SECONDS * 1000; // 604,800,000 milliseconds
export const SESSION_TIMESTAMP_KEY = 'iunoware_session_established_at_v1';

/**
 * Record the exact moment an authenticated session was established or restored.
 */
export function recordSessionEstablished(timestamp: number = Date.now()): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(SESSION_TIMESTAMP_KEY, timestamp.toString());
  } catch (err) {
    console.warn('[AuthSession] Unable to record session timestamp:', err);
  }
}

/**
 * Retrieve the timestamp when the active session was established.
 */
export function getSessionEstablishedAt(): number | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(SESSION_TIMESTAMP_KEY);
    if (!raw) return null;
    const parsed = parseInt(raw, 10);
    return isNaN(parsed) ? null : parsed;
  } catch {
    return null;
  }
}

/**
 * Check if the active session has exceeded the 7-day retention limit.
 */
export function isSessionExpired(maxAgeMs: number = SEVEN_DAYS_MS): boolean {
  const establishedAt = getSessionEstablishedAt();
  if (!establishedAt) return false;
  return Date.now() - establishedAt > maxAgeMs;
}

/**
 * Clear session tracking metadata upon sign out.
 */
export function clearSessionEstablished(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(SESSION_TIMESTAMP_KEY);
  } catch {
    // Ignore environments with restricted storage
  }
}

/**
 * Validate active session against the 7-day policy.
 * If the session is older than 7 days, it terminates the session via Supabase signOut.
 * Returns true if session is valid and within the 7-day window.
 */
export async function enforceSevenDaySessionPolicy(
  session: { user?: unknown; expires_at?: number } | null
): Promise<boolean> {
  if (!session || !session.user) {
    clearSessionEstablished();
    return false;
  }

  // Check if session has exceeded 7 days
  if (isSessionExpired()) {
    console.warn('[AuthSession] Session exceeded 7-day maximum lifetime. Terminating active session.');
    clearSessionEstablished();
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[AuthSession] Error during 7-day expiry signout:', err);
    }
    return false;
  }

  // If session is active and no timestamp was recorded yet, record current time
  if (!getSessionEstablishedAt()) {
    recordSessionEstablished();
  }

  return true;
}

/**
 * Telemetry details about the active session lifetime
 */
export function getSessionTelemetry() {
  const establishedAt = getSessionEstablishedAt();
  if (!establishedAt) {
    return {
      active: false,
      establishedAt: null,
      remainingMs: 0,
      remainingDays: 0,
    };
  }

  const elapsedMs = Date.now() - establishedAt;
  const remainingMs = Math.max(0, SEVEN_DAYS_MS - elapsedMs);
  const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));

  return {
    active: remainingMs > 0,
    establishedAt: new Date(establishedAt).toISOString(),
    remainingMs,
    remainingDays,
  };
}

