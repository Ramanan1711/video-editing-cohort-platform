// src/lib/errorHandling.ts
// Standardized Database & Application Error Handling Suite

export type AppErrorCode =
  | 'NETWORK_ERROR'
  | 'PERMISSION_DENIED'
  | 'MIGRATION_MISSING'
  | 'STALE_AUTH'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNKNOWN_ERROR';

export interface AppError {
  code: AppErrorCode;
  title: string;
  message: string;
  rawMessage?: string;
  postgresCode?: string;
  actionHint?: string;
  canRetry: boolean;
  originalError?: unknown;
}

/**
 * Parses any unknown error thrown by Supabase, PostgREST, fetch, or app logic
 * into a typed, structured AppError object for consistent UI handling.
 */
export function parseDatabaseError(error: unknown): AppError {
  if (!error) {
    return {
      code: 'UNKNOWN_ERROR',
      title: 'An unexpected error occurred',
      message: 'An unknown system condition was encountered. Please refresh the page.',
      canRetry: true,
    };
  }

  // Already formatted AppError
  if (typeof error === 'object' && error !== null && 'code' in error && 'canRetry' in error) {
    return error as AppError;
  }

  const err = error as {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
    status?: number;
  };

  const rawMsg = err.message || (error instanceof Error ? error.message : String(error));
  const code = err.code || '';
  const lowerMsg = rawMsg.toLowerCase();

  // 1. Network / Offline Errors
  if (
    lowerMsg.includes('failed to fetch') ||
    lowerMsg.includes('networkerror') ||
    lowerMsg.includes('connection refused') ||
    lowerMsg.includes('network request failed') ||
    lowerMsg.includes('offline') ||
    (typeof navigator !== 'undefined' && !navigator.onLine)
  ) {
    return {
      code: 'NETWORK_ERROR',
      title: 'Network Connection Lost',
      message: 'Unable to reach the server. Please check your internet connection and retry.',
      rawMessage: rawMsg,
      canRetry: true,
      actionHint: 'Reconnect to Wi-Fi or cellular network and click Retry.',
      originalError: error,
    };
  }

  // 2. Stale / Expired Authentication
  if (
    lowerMsg.includes('jwt expired') ||
    lowerMsg.includes('invalid refresh token') ||
    lowerMsg.includes('session from session_id claim') ||
    lowerMsg.includes('token is expired') ||
    lowerMsg.includes('auth session missing') ||
    err.status === 401
  ) {
    return {
      code: 'STALE_AUTH',
      title: 'Session Expired',
      message: 'Your login credentials have expired or were signed out from another tab. Please sign in again.',
      rawMessage: rawMsg,
      canRetry: false,
      actionHint: 'Sign in again to continue working safely.',
      originalError: error,
    };
  }

  // 3. Permission Denied / RLS Policy Violations
  if (
    code === '42501' ||
    err.status === 403 ||
    lowerMsg.includes('permission denied') ||
    lowerMsg.includes('row-level security') ||
    lowerMsg.includes('unauthorized') ||
    lowerMsg.includes('policy')
  ) {
    return {
      code: 'PERMISSION_DENIED',
      title: 'Access Restricted',
      message: 'You do not hold the required permissions to perform this operation or view this resource.',
      rawMessage: rawMsg,
      postgresCode: code || '42501',
      canRetry: false,
      actionHint: 'Switch to an account with proper administrative or mentor privileges, or contact support.',
      originalError: error,
    };
  }

  // 4. Missing Database Migrations (Table or Function not found)
  if (
    code === '42P01' || // relation does not exist
    code === '42883' || // function does not exist
    lowerMsg.includes('relation') && lowerMsg.includes('does not exist') ||
    lowerMsg.includes('function') && lowerMsg.includes('does not exist')
  ) {
    return {
      code: 'MIGRATION_MISSING',
      title: 'Database Migration Required',
      message: `A required database table or procedure is missing from the database (${rawMsg}).`,
      rawMessage: rawMsg,
      postgresCode: code,
      canRetry: false,
      actionHint: 'Execute the latest SQL migration in the Supabase SQL Editor.',
      originalError: error,
    };
  }

  // 5. Validation & Business Logic Violations
  if (
    code === 'P0001' || // custom raise exception
    code === '22000' || // data exception
    code === '23514' || // check constraint
    code === '23505' || // unique violation
    code === '23503' || // foreign key violation
    lowerMsg.includes('capacity') ||
    lowerMsg.includes('suspended') ||
    lowerMsg.includes('validation')
  ) {
    return {
      code: 'VALIDATION_ERROR',
      title: 'Validation Error',
      message: rawMsg,
      rawMessage: rawMsg,
      postgresCode: code,
      canRetry: true,
      actionHint: 'Review input criteria or account state and try again.',
      originalError: error,
    };
  }

  // 6. Record Not Found
  if (code === 'P0002' || lowerMsg.includes('not found') || err.status === 404) {
    return {
      code: 'NOT_FOUND',
      title: 'Resource Not Found',
      message: rawMsg || 'The requested resource could not be found.',
      rawMessage: rawMsg,
      postgresCode: code,
      canRetry: false,
      originalError: error,
    };
  }

  // Fallback / Unknown
  return {
    code: 'UNKNOWN_ERROR',
    title: 'Operation Failed',
    message: rawMsg || 'An unexpected error occurred while processing your request.',
    rawMessage: rawMsg,
    postgresCode: code || undefined,
    canRetry: true,
    originalError: error,
  };
}

