// src/lib/observability/deploymentCheck.ts
// Environment-specific preflight deployment checklist & security auditor

export type CheckStatus = 'pass' | 'warn' | 'fail';

export interface DeploymentCheckItem {
  id: string;
  name: string;
  category: 'env' | 'security' | 'network' | 'browser';
  status: CheckStatus;
  message: string;
  details?: string;
}

export interface DeploymentReport {
  environment: string;
  isProduction: boolean;
  status: CheckStatus;
  totalChecks: number;
  passedChecks: number;
  warnings: number;
  failures: number;
  items: DeploymentCheckItem[];
  timestamp: string;
}

export function runDeploymentCheck(): DeploymentReport {
  const items: DeploymentCheckItem[] = [];

  const envMode = (typeof import.meta !== 'undefined' && import.meta.env?.MODE) || 'development';
  const isProduction = envMode === 'production';
  const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || '';
  const supabaseKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || '';
  const sentryDsn = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SENTRY_DSN) || '';

  // 1. Supabase URL Configuration
  if (!supabaseUrl) {
    items.push({
      id: 'env_supabase_url',
      name: 'Supabase URL Configured',
      category: 'env',
      status: 'fail',
      message: 'VITE_SUPABASE_URL is missing in environment variables.',
      details: 'Define VITE_SUPABASE_URL in .env or hosting environment variables.',
    });
  } else {
    const isHttps = supabaseUrl.startsWith('https://');
    const isLocalhost = supabaseUrl.includes('localhost') || supabaseUrl.includes('127.0.0.1');

    if (isProduction && !isHttps) {
      items.push({
        id: 'env_supabase_url',
        name: 'Supabase URL Security',
        category: 'security',
        status: 'fail',
        message: 'Production Supabase URL must use secure HTTPS.',
        details: `Configured: ${supabaseUrl}`,
      });
    } else if (isProduction && isLocalhost) {
      items.push({
        id: 'env_supabase_url',
        name: 'Supabase URL Target',
        category: 'env',
        status: 'fail',
        message: 'Production environment is targeting localhost instead of remote Supabase.',
        details: `Configured: ${supabaseUrl}`,
      });
    } else {
      items.push({
        id: 'env_supabase_url',
        name: 'Supabase URL Configured',
        category: 'env',
        status: 'pass',
        message: 'Valid Supabase endpoint configured.',
        details: supabaseUrl.replace(/^(https:\/\/[^.]+)\..*$/, '$1.supabase.co'),
      });
    }
  }

  // 2. Supabase Anon Key Format
  if (!supabaseKey) {
    items.push({
      id: 'env_supabase_key',
      name: 'Supabase Anon Key',
      category: 'env',
      status: 'fail',
      message: 'VITE_SUPABASE_ANON_KEY is missing.',
      details: 'Define VITE_SUPABASE_ANON_KEY in .env or hosting secrets.',
    });
  } else {
    const parts = supabaseKey.split('.');
    if (parts.length !== 3) {
      items.push({
        id: 'env_supabase_key',
        name: 'Supabase Anon Key Structure',
        category: 'security',
        status: 'fail',
        message: 'Supabase Anon Key is not a valid 3-part JWT.',
        details: 'Expected Header.Payload.Signature format.',
      });
    } else {
      items.push({
        id: 'env_supabase_key',
        name: 'Supabase Anon Key Structure',
        category: 'security',
        status: 'pass',
        message: 'Valid JWT public anon key configured.',
      });
    }
  }

  // 3. Sentry / Error Telemetry Configuration
  if (!sentryDsn) {
    items.push({
      id: 'env_sentry_dsn',
      name: 'External Error Tracking (Sentry)',
      category: 'env',
      status: isProduction ? 'warn' : 'pass',
      message: isProduction
        ? 'VITE_SENTRY_DSN is not configured. Falling back to internal telemetry buffer.'
        : 'Internal in-memory error telemetry active.',
      details: 'Add VITE_SENTRY_DSN for external cloud error monitoring if desired.',
    });
  } else {
    items.push({
      id: 'env_sentry_dsn',
      name: 'External Error Tracking (Sentry)',
      category: 'env',
      status: 'pass',
      message: 'Sentry DSN configured for remote crash reporting.',
    });
  }

  // 4. Browser Capability Checks
  if (typeof window !== 'undefined') {
    // LocalStorage Check
    let lsAvailable = false;
    try {
      localStorage.setItem('__health_test__', '1');
      localStorage.removeItem('__health_test__');
      lsAvailable = true;
    } catch {
      // LocalStorage unavailable
    }

    items.push({
      id: 'browser_storage',
      name: 'Web Storage Availability',
      category: 'browser',
      status: lsAvailable ? 'pass' : 'fail',
      message: lsAvailable ? 'Local storage is available for session caching.' : 'Local storage is disabled or blocked by browser privacy.',
    });

    // Web Crypto API Check
    const cryptoAvailable = typeof window.crypto !== 'undefined' && typeof window.crypto.subtle !== 'undefined';
    items.push({
      id: 'browser_crypto',
      name: 'Web Cryptography API',
      category: 'security',
      status: cryptoAvailable ? 'pass' : 'warn',
      message: cryptoAvailable ? 'Hardware-accelerated cryptography available.' : 'SubtleCrypto unavailable (may require secure HTTPS origin).',
    });
  }

  // Calculate Overall Report Status
  const failures = items.filter((i) => i.status === 'fail').length;
  const warnings = items.filter((i) => i.status === 'warn').length;
  const passedChecks = items.filter((i) => i.status === 'pass').length;

  const status: CheckStatus = failures > 0 ? 'fail' : warnings > 0 ? 'warn' : 'pass';

  return {
    environment: envMode,
    isProduction,
    status,
    totalChecks: items.length,
    passedChecks,
    warnings,
    failures,
    items,
    timestamp: new Date().toISOString(),
  };
}
