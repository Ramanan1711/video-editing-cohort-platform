/**
 * Cohort Checkout Persistence Utility
 * 
 * Ensures student cohort selection survives the entire onboarding lifecycle:
 * 1. Landing page cohort CTA -> /register?cohort=<id>
 * 2. Supabase registration with email confirmation (emailRedirectTo with cohort param)
 * 3. Client storage persistence (localStorage / sessionStorage fallback with TTL)
 * 4. Login flow (/login?cohort=<id> -> dashboard with checkout continuation)
 * 5. Student Dashboard & Enrollment Panel pre-selection & instant checkout initiation
 */

export const PENDING_COHORT_STORAGE_KEY = 'iunoware_pending_cohort_checkout';
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface PendingCohortCheckout {
  cohortId: string;
  cohortName?: string;
  priceInr?: number;
  currency?: string;
  timestamp: number;
}

function getSafeStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    const testKey = '__storage_test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch {
    try {
      return window.sessionStorage;
    } catch {
      return null;
    }
  }
}

/**
 * Persists selected cohort to client storage
 */
export function setPendingCohortCheckout(
  cohortId: string,
  cohortName?: string,
  priceInr?: number,
  currency?: string
): void {
  if (!cohortId || typeof cohortId !== 'string') return;
  const storage = getSafeStorage();
  if (!storage) return;

  const data: PendingCohortCheckout = {
    cohortId: cohortId.trim(),
    cohortName: cohortName?.trim(),
    priceInr,
    currency: currency || 'INR',
    timestamp: Date.now(),
  };

  try {
    storage.setItem(PENDING_COHORT_STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('Unable to persist pending cohort selection:', err);
  }
}

/**
 * Retrieves the currently pending cohort selection, respecting TTL
 */
export function getPendingCohortCheckout(): PendingCohortCheckout | null {
  const storage = getSafeStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(PENDING_COHORT_STORAGE_KEY);
    if (!raw) return null;

    const data: PendingCohortCheckout = JSON.parse(raw);
    if (!data || !data.cohortId) {
      storage.removeItem(PENDING_COHORT_STORAGE_KEY);
      return null;
    }

    // Check if expired (24h TTL)
    if (Date.now() - data.timestamp > DEFAULT_TTL_MS) {
      storage.removeItem(PENDING_COHORT_STORAGE_KEY);
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

/**
 * Clears the pending cohort selection upon successful enrollment or cancellation
 */
export function clearPendingCohortCheckout(): void {
  const storage = getSafeStorage();
  if (!storage) return;

  try {
    storage.removeItem(PENDING_COHORT_STORAGE_KEY);
  } catch {
    // Ignore storage clear errors
  }
}

/**
 * Resolves cohortId from URL search parameters or storage fallback
 */
export function resolveTargetCohortId(searchParams?: URLSearchParams): string | null {
  if (searchParams) {
    const fromParams = searchParams.get('cohort') || searchParams.get('cohortId') || searchParams.get('checkout');
    if (fromParams && fromParams !== 'true') {
      return fromParams.trim();
    }
  }

  const pending = getPendingCohortCheckout();
  return pending?.cohortId || null;
}

/**
 * Constructs a safe redirect URL that preserves cohort selection
 */
export function buildCohortRedirectUrl(
  basePath: string,
  cohortId?: string | null,
  autoCheckout: boolean = true
): string {
  if (!cohortId) return basePath;
  const url = new URL(basePath, typeof window !== 'undefined' ? window.location.origin : 'https://cutcraft.platform');
  url.searchParams.set('cohort', cohortId);
  if (autoCheckout) {
    url.searchParams.set('checkout', 'true');
  }
  return typeof window !== 'undefined' ? `${url.pathname}${url.search}` : url.toString();
}
