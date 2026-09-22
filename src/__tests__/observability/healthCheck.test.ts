import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkDatabaseHealth,
  checkStorageHealth,
  checkAuthHealth,
  runSystemHealthCheck,
} from '../../lib/observability/healthCheck';
import { supabase } from '../../lib/supabaseClient';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    storage: {
      getBucket: vi.fn(),
      listBuckets: vi.fn(),
    },
    auth: {
      getSession: vi.fn(),
    },
  },
}));

describe('System Health Check Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Database Health Probe', () => {
    it('returns healthy when database query succeeds promptly', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: null }),
        }),
      } as unknown as ReturnType<typeof supabase.from>);

      const health = await checkDatabaseHealth();
      expect(health.name).toBe('database');
      expect(health.status).toBe('healthy');
      expect(health.message).toContain('Active connection verified');
    });

    it('returns degraded when database table is missing (migration pending)', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: null, error: { code: '42P01', message: 'relation does not exist' } }),
        }),
      } as unknown as ReturnType<typeof supabase.from>);

      const health = await checkDatabaseHealth();
      expect(health.status).toBe('degraded');
      expect(health.message).toContain('migration pending');
    });

    it('returns down when database throws an unhandled connection error', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
        }),
      } as unknown as ReturnType<typeof supabase.from>);

      const health = await checkDatabaseHealth();
      expect(health.status).toBe('down');
      expect(health.message).toContain('ECONNREFUSED');
    });
  });

  describe('Storage Health Probe', () => {
    it('returns healthy when submissions bucket exists', async () => {
      vi.mocked(supabase.storage.getBucket).mockResolvedValue({
        data: { id: 'submissions', name: 'submissions', public: true },
        error: null,
      } as unknown as Awaited<ReturnType<typeof supabase.storage.getBucket>>);

      const health = await checkStorageHealth();
      expect(health.name).toBe('storage');
      expect(health.status).toBe('healthy');
      expect(health.message).toContain('Public bucket verified');
    });

    it('returns degraded when submissions bucket is missing but storage is up', async () => {
      vi.mocked(supabase.storage.getBucket).mockResolvedValue({
        data: null,
        error: { message: 'Bucket not found', name: 'StorageApiError' },
      } as unknown as Awaited<ReturnType<typeof supabase.storage.getBucket>>);
      vi.mocked(supabase.storage.listBuckets).mockResolvedValue({
        data: [{ id: 'avatars', name: 'avatars', public: true }],
        error: null,
      } as unknown as Awaited<ReturnType<typeof supabase.storage.listBuckets>>);

      const health = await checkStorageHealth();
      expect(health.status).toBe('degraded');
      expect(health.message).toContain('submissions');
    });
  });

  describe('Auth Health Probe', () => {
    it('returns healthy when auth session endpoint responds', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const health = await checkAuthHealth();
      expect(health.name).toBe('auth');
      expect(health.status).toBe('healthy');
      expect(health.message).toContain('Authentication service active');
    });

    it('returns degraded if session check returns an error', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: { message: 'Auth token invalid', name: 'AuthApiError' },
      } as unknown as Awaited<ReturnType<typeof supabase.auth.getSession>>);

      const health = await checkAuthHealth();
      expect(health.status).toBe('degraded');
      expect(health.message).toBe('Auth token invalid');
    });
  });

  describe('Composite System Health Check', () => {
    it('computes composite healthy status when all services are healthy', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: null }),
        }),
      } as unknown as ReturnType<typeof supabase.from>);

      vi.mocked(supabase.storage.getBucket).mockResolvedValue({
        data: { id: 'submissions', name: 'submissions', public: true },
        error: null,
      } as unknown as Awaited<ReturnType<typeof supabase.storage.getBucket>>);

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const report = await runSystemHealthCheck();
      expect(report.status).toBe('healthy');
      expect(report.services.database.status).toBe('healthy');
      expect(report.services.storage.status).toBe('healthy');
      expect(report.services.auth.status).toBe('healthy');
    });

    it('computes composite degraded status when one service is degraded', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: null }),
        }),
      } as unknown as ReturnType<typeof supabase.from>);

      vi.mocked(supabase.storage.getBucket).mockResolvedValue({
        data: null,
        error: { message: 'Storage error', name: 'StorageApiError' },
      } as unknown as Awaited<ReturnType<typeof supabase.storage.getBucket>>);
      vi.mocked(supabase.storage.listBuckets).mockResolvedValue({
        data: null,
        error: { message: 'List failed', name: 'StorageApiError' },
      } as unknown as Awaited<ReturnType<typeof supabase.storage.listBuckets>>);

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const report = await runSystemHealthCheck();
      expect(report.status).toBe('degraded');
    });
  });
});
