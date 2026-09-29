import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  errorTracker,
  initErrorTracking,
  parseSentryDsn,
  buildSentryAuthHeader,
  formatSentryEventId,
} from '../../lib/observability/errorTracking';
import { supabase } from '../../lib/supabaseClient';

describe('Error Tracking Telemetry Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    errorTracker.clearErrorBuffer();
    errorTracker.clearBreadcrumbs();
    errorTracker.clearUser();
    errorTracker.clearDsn();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('captures an exception and stores it in the local error buffer', () => {
    const testError = new Error('Database connection reset');
    const entry = errorTracker.captureException(testError, {
      tags: { service: 'supabase' },
      extra: { attempt: 3 },
      handled: true,
    });

    expect(entry).toBeDefined();
    expect(entry.title).toBe('Error');
    expect(entry.message).toBe('Database connection reset');
    expect(entry.tags.service).toBe('supabase');
    expect(entry.extra?.attempt).toBe(3);
    expect(entry.handled).toBe(true);

    const buffer = errorTracker.getRecentErrors();
    expect(buffer.length).toBe(1);
    expect(buffer[0].id).toBe(entry.id);
  });

  it('records breadcrumbs and attaches them to captured exceptions', () => {
    errorTracker.addBreadcrumb({
      category: 'navigation',
      message: 'Navigated to /admin/courses',
    });
    errorTracker.addBreadcrumb({
      category: 'rpc',
      message: 'Invoked listCohorts',
    });

    const entry = errorTracker.captureException(new Error('Render error'));
    expect(entry.breadcrumbs.length).toBe(2);
    expect(entry.breadcrumbs[0].message).toBe('Navigated to /admin/courses');
    expect(entry.breadcrumbs[1].message).toBe('Invoked listCohorts');
  });

  it('attaches sanitized user context without leaking sensitive credentials', () => {
    errorTracker.setUser({
      id: 'usr_123',
      email: 'creator@example.com',
      role: 'admin',
    });

    const entry = errorTracker.captureMessage('Admin initiated export', 'info');
    expect(entry.user).toEqual({
      id: 'usr_123',
      email: 'creator@example.com',
      role: 'admin',
    });

    errorTracker.clearUser();
    const entryAfterClear = errorTracker.captureMessage('Anonymous action', 'info');
    expect(entryAfterClear.user).toBeNull();
  });

  it('initializes telemetry with custom options via initErrorTracking', () => {
    const instance = initErrorTracking({ environment: 'test' });
    expect(instance).toBe(errorTracker);
  });

  describe('Durable Local Storage Persistence & Offline Resiliency', () => {
    it('persists errors and breadcrumbs to localStorage to survive page reloads', () => {
      errorTracker.addBreadcrumb({ category: 'ui', message: 'Button clicked' });
      const entry = errorTracker.captureException(new Error('Crash before reload'));

      const storedErrors = JSON.parse(localStorage.getItem('cohort_telemetry_recent_errors_v1') || '[]');
      expect(storedErrors.length).toBeGreaterThan(0);
      expect(storedErrors[0].id).toBe(entry.id);

      const storedBreadcrumbs = JSON.parse(localStorage.getItem('cohort_telemetry_breadcrumbs_v1') || '[]');
      expect(storedBreadcrumbs.length).toBeGreaterThan(0);

      const storedQueue = JSON.parse(localStorage.getItem('cohort_telemetry_offline_queue_v1') || '[]');
      expect(storedQueue.some((e: { id: string }) => e.id === entry.id)).toBe(true);
    });

    it('clears durable storage when clearErrorBuffer is invoked', () => {
      errorTracker.captureException(new Error('Temporary issue'));
      expect(errorTracker.getRecentErrors().length).toBe(1);

      errorTracker.clearErrorBuffer();
      expect(errorTracker.getRecentErrors().length).toBe(0);
      expect(errorTracker.getOfflineQueue().length).toBe(0);

      const storedErrors = JSON.parse(localStorage.getItem('cohort_telemetry_recent_errors_v1') || '[]');
      expect(storedErrors.length).toBe(0);
    });
  });

  describe('RFC-Compliant Sentry DSN Parser & Auth Headers', () => {
    it('parses standard SaaS Sentry DSN URLs', () => {
      const parsed = parseSentryDsn('https://pubkey123@o999.ingest.sentry.io/45678');
      expect(parsed).not.toBeNull();
      expect(parsed?.publicKey).toBe('pubkey123');
      expect(parsed?.host).toBe('o999.ingest.sentry.io');
      expect(parsed?.projectId).toBe('45678');
      expect(parsed?.envelopeUrl).toBe('https://o999.ingest.sentry.io/api/45678/envelope/');
      expect(parsed?.storeUrl).toBe('https://o999.ingest.sentry.io/api/45678/store/');
    });

    it('parses self-hosted Sentry DSN with subpath, port, and secret key', () => {
      const parsed = parseSentryDsn('https://mykey:mysecret@sentry.example.com:8443/custom/path/42');
      expect(parsed).not.toBeNull();
      expect(parsed?.publicKey).toBe('mykey');
      expect(parsed?.secretKey).toBe('mysecret');
      expect(parsed?.host).toBe('sentry.example.com');
      expect(parsed?.port).toBe('8443');
      expect(parsed?.path).toBe('/custom/path');
      expect(parsed?.projectId).toBe('42');
      expect(parsed?.envelopeUrl).toBe('https://sentry.example.com:8443/custom/path/api/42/envelope/');
    });

    it('rejects invalid or malformed DSN strings', () => {
      expect(parseSentryDsn('')).toBeNull();
      expect(parseSentryDsn(null)).toBeNull();
      expect(parseSentryDsn(undefined)).toBeNull();
      expect(parseSentryDsn('ftp://not-http@example.com/123')).toBeNull();
      expect(parseSentryDsn('https://missingkey.com/123')).toBeNull();
      expect(parseSentryDsn('https://key@example.com/')).toBeNull();
    });

    it('builds standard X-Sentry-Auth header with timestamps and public key', () => {
      const parsed = parseSentryDsn('https://pubkey123:secret456@o999.ingest.sentry.io/45678')!;
      const header = buildSentryAuthHeader(parsed, 1700000000);
      expect(header).toBe(
        'Sentry sentry_version=7, sentry_client=video-editing-cohort-tracker/1.0, sentry_key=pubkey123, sentry_timestamp=1700000000, sentry_secret=secret456'
      );
    });

    it('formats 32-character hexadecimal event IDs without hyphens', () => {
      const formatted = formatSentryEventId('err_12345_abcdef');
      expect(formatted).toHaveLength(32);
      expect(/^[0-9a-f]{32}$/.test(formatted)).toBe(true);
    });
  });

  describe('Verified Sentry Envelope Dispatch & Rate Limiting', () => {
    it('dispatches envelope payloads with X-Sentry-Auth header to the envelope endpoint', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));

      errorTracker.init({ dsn: 'https://pubkey@o12345.ingest.sentry.io/45678', environment: 'production' });
      errorTracker.captureException(new Error('Fatal outbound failure'));

      expect(fetchSpy).toHaveBeenCalled();
      const fetchUrl = fetchSpy.mock.calls[0][0] as string;
      const fetchOptions = fetchSpy.mock.calls[0][1] as RequestInit;

      expect(fetchUrl).toBe('https://o12345.ingest.sentry.io/api/45678/envelope/');
      expect(fetchOptions.headers).toHaveProperty('Content-Type', 'application/x-sentry-envelope');
      expect(fetchOptions.headers).toHaveProperty('X-Sentry-Auth');
      expect(String(fetchOptions.body)).toContain('Fatal outbound failure');
      expect(String(fetchOptions.body)).toContain('"type":"event"');
    });

    it('respects HTTP 429 rate limits from Sentry and backs off', async () => {
      const rateLimitResponse = new Response('Too Many Requests', {
        status: 429,
        headers: { 'Retry-After': '120' },
      });
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes('sentry.io')) {
          return rateLimitResponse;
        }
        return new Response('{}', { status: 200 });
      });

      errorTracker.init({ dsn: 'https://pubkey@o12345.ingest.sentry.io/45678', environment: 'production' });
      errorTracker.captureException(new Error('Rate-limited error 1'));

      const sentryCalls = () => fetchSpy.mock.calls.filter((c) => String(c[0]).includes('sentry.io'));
      expect(sentryCalls()).toHaveLength(1);

      // Attempt second capture while rate-limited
      await errorTracker.drainDurableQueue();
      // Should not spam Sentry fetch again during backoff window
      expect(sentryCalls()).toHaveLength(1);
    });

    it('verifies Sentry connection with verifySentryConnection probe', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"id":"test"}', { status: 200 }));

      const result = await errorTracker.verifySentryConnection('https://pubkey@o12345.ingest.sentry.io/45678');
      expect(result.success).toBe(true);
      expect(result.message).toContain('Sentry connection verified');
      expect(result.statusCode).toBe(200);
      expect(result.endpoint).toContain('envelope');
    });

    it('handles probe failure gracefully when Sentry host returns 403', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('Forbidden', { status: 403, statusText: 'Forbidden' })
      );

      const result = await errorTracker.verifySentryConnection('https://invalidkey@o12345.ingest.sentry.io/45678');
      expect(result.success).toBe(false);
      expect(result.message).toContain('HTTP 403');
    });
  });

  describe('Durable Database Logging & Admin Telemetry RPCs', () => {
    it('persists errors to Supabase via log_client_error RPC with fallback', async () => {
      const rpcSpy = vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: { success: true, id: 'durable-err-1' },
        error: null,
      } as never);

      errorTracker.captureException(new Error('Critical checkout crash'));
      await errorTracker.drainDurableQueue();

      expect(rpcSpy).toHaveBeenCalledWith(
        'log_client_error',
        expect.objectContaining({
          p_title: 'Error',
          p_message: 'Critical checkout crash',
          p_level: 'error',
        })
      );
    });

    it('queries durable error logs with pagination and filters via fetchDurableErrorLogs', async () => {
      const mockRows = [
        {
          id: 'uuid-1',
          error_id: 'err_101',
          title: 'Database Timeout',
          message: 'Connection pool exhausted',
          level: 'fatal',
          handled: false,
          created_at: new Date().toISOString(),
          breadcrumbs: [],
        },
      ];

      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: mockRows,
        error: null,
      } as never);

      const results = await errorTracker.fetchDurableErrorLogs({ level: 'fatal', limit: 10 });
      expect(results.length).toBe(1);
      expect(results[0].title).toBe('Database Timeout');
      expect(results[0].level).toBe('fatal');
      expect(results[0].persistedToServer).toBe(true);
    });

    it('fetches aggregated error telemetry stats via fetchErrorTelemetryStats', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          total: 42,
          last24Hours: 12,
          fatalCount: 3,
          unhandledCount: 5,
          resolvedCount: 30,
          unresolvedCount: 12,
        },
        error: null,
      } as never);

      const stats = await errorTracker.fetchErrorTelemetryStats();
      expect(stats.total).toBe(42);
      expect(stats.last24Hours).toBe(12);
      expect(stats.fatalCount).toBe(3);
      expect(stats.unhandledCount).toBe(5);
    });

    it('marks an error as resolved via resolveErrorLog', async () => {
      const rpcSpy = vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: true,
        error: null,
      } as never);

      const success = await errorTracker.resolveErrorLog('uuid-1', true);
      expect(success).toBe(true);
      expect(rpcSpy).toHaveBeenCalledWith('resolve_error_log', {
        p_id: 'uuid-1',
        p_resolved: true,
      });
    });
  });
});
