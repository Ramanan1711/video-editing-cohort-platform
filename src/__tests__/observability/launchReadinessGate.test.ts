import { describe, it, expect, vi, beforeEach } from 'vitest';
import { evaluateLaunchReadinessGate } from '../../lib/observability/launchReadinessGate';
import { supabase } from '../../lib/supabaseClient';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    storage: {
      getBucket: vi.fn(),
    },
  },
}));

describe('Launch Readiness Gate Auditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('evaluates all 8 production readiness criteria and returns READY_FOR_LAUNCH', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: null }),
      }),
    } as unknown as ReturnType<typeof supabase.from>);

    vi.mocked(supabase.storage.getBucket).mockResolvedValue({
      data: { id: 'submissions', name: 'submissions', public: false } as unknown as {
        id: string;
        name: string;
        public: boolean;
      },
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.storage.getBucket>>);

    const report = await evaluateLaunchReadinessGate();

    expect(report).toBeDefined();
    expect(report.totalCriteria).toBe(8);
    expect(report.passedCriteria).toBe(8);
    expect(report.failedCriteria).toBe(0);
    expect(report.score).toBe(100);
    expect(report.overallStatus).toBe('READY_FOR_LAUNCH');

    // Verify all 8 criteria IDs exist
    const criteriaIds = report.criteria.map((c) => c.id);
    expect(criteriaIds).toContain('gate_1_db_access_rules');
    expect(criteriaIds).toContain('gate_2_private_uploads');
    expect(criteriaIds).toContain('gate_3_route_protection');
    expect(criteriaIds).toContain('gate_4_data_isolation');
    expect(criteriaIds).toContain('gate_5_no_silent_errors');
    expect(criteriaIds).toContain('gate_6_automated_testing');
    expect(criteriaIds).toContain('gate_7_monitoring_alerts');
    expect(criteriaIds).toContain('gate_8_controlled_admin_review');
  });

  it('detects failure if the submissions bucket is improperly configured as public', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: null }),
      }),
    } as unknown as ReturnType<typeof supabase.from>);

    // Submissions bucket wrongly set to public
    vi.mocked(supabase.storage.getBucket).mockResolvedValue({
      data: { id: 'submissions', name: 'submissions', public: true } as unknown as {
        id: string;
        name: string;
        public: boolean;
      },
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.storage.getBucket>>);

    const report = await evaluateLaunchReadinessGate();

    expect(report.overallStatus).toBe('ACTION_REQUIRED');
    expect(report.failedCriteria).toBeGreaterThanOrEqual(1);

    const uploadGate = report.criteria.find((c) => c.id === 'gate_2_private_uploads');
    expect(uploadGate?.status).toBe('FAILED');
    expect(uploadGate?.evidence).toContain('public');
  });

  it('detects failure if the database access rules verification fails ungracefully', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockRejectedValue(new Error('Connection terminated unexpectedly')),
      }),
    } as unknown as ReturnType<typeof supabase.from>);

    vi.mocked(supabase.storage.getBucket).mockResolvedValue({
      data: { id: 'submissions', name: 'submissions', public: false } as unknown as {
        id: string;
        name: string;
        public: boolean;
      },
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.storage.getBucket>>);

    const report = await evaluateLaunchReadinessGate();

    expect(report.overallStatus).toBe('ACTION_REQUIRED');
    const dbGate = report.criteria.find((c) => c.id === 'gate_1_db_access_rules');
    expect(dbGate?.status).toBe('FAILED');
  });
});

