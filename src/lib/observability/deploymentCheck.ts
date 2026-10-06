// src/lib/observability/deploymentCheck.ts
// Environment-specific preflight deployment checklist & security auditor

import { parseSentryDsn } from './errorTracking';

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
  const razorpayKeyId = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_RAZORPAY_KEY_ID) || '';

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

  // 3. Razorpay Payment Gateway Configuration
  if (!razorpayKeyId) {
    items.push({
      id: 'env_razorpay_key',
      name: 'Razorpay Public Key Configured',
      category: 'env',
      status: 'warn',
      message: 'VITE_RAZORPAY_KEY_ID is missing in client build variables.',
      details: 'Frontend will receive keyId dynamically from the create-razorpay-order Edge Function at checkout. Define VITE_RAZORPAY_KEY_ID in hosting environment variables (Vercel/Netlify) as offline fallback.',
    });
  } else {
    const isLiveKey = razorpayKeyId.startsWith('rzp_live_');
    const isTestKey = razorpayKeyId.startsWith('rzp_test_');

    const allowTestInProd = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ALLOW_TEST_PAYMENTS_IN_PROD) === 'true';

    if (isProduction && isTestKey && !allowTestInProd) {
      items.push({
        id: 'env_razorpay_key',
        name: 'Razorpay Key Mode',
        category: 'security',
        status: 'fail',
        message: 'CRITICAL: Production build is configured with a test Razorpay key (rzp_test_...).',
        details: 'Switch to live key (rzp_live_...) before launching paid cohorts, or set VITE_ALLOW_TEST_PAYMENTS_IN_PROD=true for staging preview testing.',
      });
    } else if (isProduction && isTestKey && allowTestInProd) {
      items.push({
        id: 'env_razorpay_key',
        name: 'Razorpay Key Mode (Staging)',
        category: 'security',
        status: 'warn',
        message: 'Staging Mode: Test key (rzp_test_...) active via VITE_ALLOW_TEST_PAYMENTS_IN_PROD.',
        details: 'Test cards are accepted. Switch to rzp_live_... and remove this flag before public launch.',
      });
    } else {
      items.push({
        id: 'env_razorpay_key',
        name: 'Razorpay Public Key Configured',
        category: 'env',
        status: 'pass',
        message: isLiveKey ? 'Production live Razorpay key active.' : 'Valid Razorpay key configured.',
        details: `${razorpayKeyId.slice(0, 8)}...`,
      });
    }
  }

  // 4. Sentry / Error Telemetry Configuration
  if (!sentryDsn) {
    items.push({
      id: 'env_sentry_dsn',
      name: 'External Error Tracking (Sentry)',
      category: 'env',
      status: isProduction ? 'warn' : 'pass',
      message: isProduction
        ? 'VITE_SENTRY_DSN not set. Durable PostgreSQL database logging and local storage buffer active.'
        : 'Durable PostgreSQL database error logging and offline buffer active.',
      details: 'Configure VITE_SENTRY_DSN for dual-dispatch to remote Sentry if desired.',
    });
  } else {
    const parsedDsn = parseSentryDsn(sentryDsn);
    if (!parsedDsn) {
      items.push({
        id: 'env_sentry_dsn',
        name: 'External Error Tracking (Sentry)',
        category: 'env',
        status: 'warn',
        message: 'VITE_SENTRY_DSN is malformed. Expected https://<key>@<host>/<projectId>.',
        details: 'Durable database logging active as fallback.',
      });
    } else {
      items.push({
        id: 'env_sentry_dsn',
        name: 'External Error Tracking (Sentry)',
        category: 'env',
        status: 'pass',
        message: `Verified RFC-compliant Sentry DSN targeting host "${parsedDsn.host}" (Project ID: ${parsedDsn.projectId}).`,
        details: `Envelope endpoint: ${parsedDsn.envelopeUrl}`,
      });
    }
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
