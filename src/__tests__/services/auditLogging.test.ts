import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  logAuditEvent,
  listAuditLogs,
  listAuditLogsPaged,
  getAuditLogStats,
} from '../../lib/adminService';
import { supabase } from '../../lib/supabaseClient';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

describe('Canonical Hardened Audit Logging & Forensic Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logAuditEvent', () => {
    it('dispatches to authoritative security definer RPC log_audit_event', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: 'audit-log-uuid-1',
        error: null,
      });

      await logAuditEvent({
        actorId: 'admin-uuid-1',
        action: 'user.role_changed',
        entityType: 'user',
        entityId: 'target-student-1',
        metadata: { old_role: 'student', new_role: 'mentor' },
      });

      expect(supabase.rpc).toHaveBeenCalledWith('log_audit_event', {
        p_action: 'user.role_changed',
        p_entity_type: 'user',
        p_entity_id: 'target-student-1',
        p_metadata: { old_role: 'student', new_role: 'mentor' },
        p_actor_id: 'admin-uuid-1',
      });
    });

    it('falls back to direct table insertion if RPC fails or is unavailable', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: null,
        error: { code: '42883', message: 'function log_audit_event does not exist' },
      });

      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        insert: mockInsert,
      });

      await logAuditEvent({
        actorId: 'admin-uuid-2',
        action: 'certificate.issued',
        entityType: 'certificate',
        entityId: 'cert-123',
        metadata: { grade: 'A+' },
      });

      expect(supabase.from).toHaveBeenCalledWith('audit_logs');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          actor_id: 'admin-uuid-2',
          action: 'certificate.issued',
          entity_type: 'certificate',
          entity_id: 'cert-123',
        })
      );
    });
  });

  describe('listAuditLogs via RPC & Fallback', () => {
    it('fetches populated audit logs via get_security_audit_logs RPC', async () => {
      const mockRpcLogs = [
        {
          id: 'log-1',
          actor_id: 'admin-1',
          actor_name: 'Lead Admin',
          actor_email: 'admin@procut.internal',
          actor_role: 'super_admin',
          action: 'cohort.created',
          entity_type: 'cohort',
          entity_id: 'cohort-1',
          metadata: { title: 'Autumn Cohort' },
          ip_address: '192.168.1.1',
          user_agent: 'Mozilla/5.0',
          created_at: '2026-09-29T10:00:00Z',
          total_count: 1,
        },
      ];

      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: mockRpcLogs,
        error: null,
      });

      const logs = await listAuditLogs(20, 'cohort.created');

      expect(supabase.rpc).toHaveBeenCalledWith('get_security_audit_logs', {
        p_limit: 20,
        p_offset: 0,
        p_action: 'cohort.created',
      });
      expect(logs).toHaveLength(1);
      expect(logs[0].actor_name).toBe('Lead Admin');
      expect(logs[0].actor_role).toBe('super_admin');
      expect(logs[0].ip_address).toBe('192.168.1.1');
    });

    it('falls back to table query with profile joins when RPC is unavailable', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: null,
        error: { code: '42883', message: 'function get_security_audit_logs does not exist' },
      });

      const mockLogs = [
        {
          id: 'log-tbl-1',
          actor_id: 'user-1',
          action: 'enrollment.created',
          entity_type: 'enrollment',
          entity_id: 'enr-1',
          metadata: { cohort_id: 'c-1' },
          created_at: '2026-09-29T09:00:00Z',
        },
      ];

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'audit_logs') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: mockLogs, error: null }),
              }),
            }),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [{ id: 'user-1', full_name: 'Alex Rivera', email: 'alex@example.com' }],
                error: null,
              }),
            }),
          };
        }
        return { select: vi.fn() };
      });

      const logs = await listAuditLogs(50);
      expect(logs).toHaveLength(1);
      expect(logs[0].actor_name).toBe('Alex Rivera');
      expect(logs[0].action).toBe('enrollment.created');
    });
  });

  describe('listAuditLogsPaged', () => {
    it('returns paged audit logs with total counts from RPC', async () => {
      const mockPaged = [
        {
          id: 'log-page-1',
          actor_id: 'admin-1',
          actor_name: 'Super Admin',
          actor_email: 'super@procut.internal',
          actor_role: 'super_admin',
          action: 'submission.evaluated',
          entity_type: 'submission',
          entity_id: 'sub-1',
          metadata: { score: 95 },
          created_at: '2026-09-29T11:00:00Z',
          total_count: 55,
        },
      ];

      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: mockPaged,
        error: null,
      });

      const res = await listAuditLogsPaged({ page: 2, pageSize: 10 });
      expect(supabase.rpc).toHaveBeenCalledWith('get_security_audit_logs', {
        p_limit: 10,
        p_offset: 10,
        p_action: null,
      });
      expect(res.data).toHaveLength(1);
      expect(res.totalCount).toBe(55);
      expect(res.totalPages).toBe(6);
      expect(res.page).toBe(2);
    });
  });

  describe('getAuditLogStats', () => {
    it('aggregates platform audit statistics via RPC', async () => {
      const mockStats = {
        total_events: 1250,
        today_events: 42,
        action_breakdown: {
          user: 350,
          enrollment: 400,
          certificate: 120,
          submission: 280,
          moderation: 100,
        },
      };

      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: mockStats,
        error: null,
      });

      const stats = await getAuditLogStats();
      expect(supabase.rpc).toHaveBeenCalledWith('get_audit_log_stats');
      expect(stats.total_events).toBe(1250);
      expect(stats.today_events).toBe(42);
      expect(stats.action_breakdown.certificate).toBe(120);
    });
  });
});
