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

  it('detects payment safety failure if a free or zero-priced cohort exists in database', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'cohorts') {
        return {
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [{ id: 'cohort_free_1', name: 'Free Bypass Cohort', price_inr: 0 }],
              error: null,
            }),
          }),
        } as unknown as ReturnType<typeof supabase.from>;
      }
      return {
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: null }),
        }),
      } as unknown as ReturnType<typeof supabase.from>;
    });

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
    const paymentGate = report.criteria.find((c) => c.id === 'gate_6_automated_testing');
    expect(paymentGate?.status).toBe('FAILED');
    expect(paymentGate?.evidence).toContain('Payment safety violation');
    expect(paymentGate?.evidence).toContain('Zero-priced or free cohort');
  });

  it('detects payment safety failure if atomic checkout RPC is missing from database catalog', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({
          data: [{ id: 'cohort_1', name: 'Pro Editing', price_inr: 4999 }],
          error: null,
        }),
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

    // Mock supabase.rpc to return code 42883 (undefined function)
    (supabase as { rpc?: unknown }).rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '42883', message: 'function create_cohort_checkout_order does not exist' },
    });

    const report = await evaluateLaunchReadinessGate();

    expect(report.overallStatus).toBe('ACTION_REQUIRED');
    const paymentGate = report.criteria.find((c) => c.id === 'gate_6_automated_testing');
    expect(paymentGate?.status).toBe('FAILED');
    expect(paymentGate?.evidence).toContain('create_cohort_checkout_order');
  });

  it('detects payment data isolation leak if foreign payment records are returned', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'payments') {
        return {
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [{ id: 'pay_1', user_id: 'victim_user_123', amount: 499900 }],
              error: null,
            }),
          }),
        } as unknown as ReturnType<typeof supabase.from>;
      }
      return {
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: [{ id: '1', price_inr: 4999 }],
            error: null,
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>;
    });

    vi.mocked(supabase.storage.getBucket).mockResolvedValue({
      data: { id: 'submissions', name: 'submissions', public: false } as unknown as {
        id: string;
        name: string;
        public: boolean;
      },
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.storage.getBucket>>);

    // Mock unauthenticated auth.getUser
    (supabase as { auth?: unknown }).auth = {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    };

    const report = await evaluateLaunchReadinessGate();

    expect(report.overallStatus).toBe('ACTION_REQUIRED');
    const dataGate = report.criteria.find((c) => c.id === 'gate_4_data_isolation');
    expect(dataGate?.status).toBe('FAILED');
    expect(dataGate?.evidence).toContain('CRITICAL: Public/private data mismatch detected');
  });
});

