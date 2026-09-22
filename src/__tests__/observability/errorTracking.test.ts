import { describe, it, expect, beforeEach, vi } from 'vitest';
import { errorTracker, initErrorTracking } from '../../lib/observability/errorTracking';

describe('Error Tracking Telemetry Engine', () => {
  beforeEach(() => {
    errorTracker.clearErrorBuffer();
    errorTracker.clearBreadcrumbs();
    errorTracker.clearUser();
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

  it('dispatches to fetch when DSN is configured', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    
    // Initialize with a mock Sentry DSN
    errorTracker.init({ dsn: 'https://pubkey@o12345.ingest.sentry.io/45678', environment: 'production' });
    errorTracker.captureException(new Error('Fatal outbound failure'));

    expect(fetchSpy).toHaveBeenCalled();
    const fetchUrl = fetchSpy.mock.calls[0][0] as string;
    expect(fetchUrl).toContain('sentry.io');

    fetchSpy.mockRestore();
  });
});

