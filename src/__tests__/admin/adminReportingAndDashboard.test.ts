import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getAdminStats,
  getAdminExecutiveMetrics,
  listMentorCohortAssignments,
  exportExecutiveReportCSV,
  exportAtRiskLearnersCSV,
} from '../../lib/adminService';
import { supabase } from '../../lib/supabaseClient';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe('Admin Dashboard & Reporting System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Schema Resilience in getAdminStats', () => {
    it('returns accurate statistics even when optional tables fail or return errors', async () => {
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 10, error: null }),
              // head query without eq
              then: (fn: any) => Promise.resolve({ count: 25, error: null }).then(fn),
            }),
          };
        }
        if (table === 'cohorts') {
          return {
            select: vi.fn().mockResolvedValue({ count: 3, error: null }),
          };
        }
        if (table === 'enrollments') {
          return {
            select: vi.fn().mockResolvedValue({ count: 20, error: null }),
          };
        }
        // Simulate unmigrated table error on live_sessions
        if (table === 'live_sessions') {
          return {
            select: vi.fn().mockResolvedValue({ count: null, error: { message: 'relation live_sessions does not exist', code: '42P01' } }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
          }),
        };
      });

      const stats = await getAdminStats();
      expect(stats).toBeDefined();
      expect(typeof stats.users).toBe('number');
      expect(typeof stats.cohorts).toBe('number');
      // live_sessions gracefully defaulted to 0 instead of throwing unhandled exception
      expect(stats.sessions).toBe(0);
    });

    it('calculates executive metrics and respects timeframe parameterization', async () => {
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'profiles') {
          return { select: vi.fn().mockResolvedValue({ data: [{ id: 'p1', role: 'admin' }], error: null }) };
        }
        if (table === 'cohorts') {
          return { select: vi.fn().mockResolvedValue({ data: [{ id: 'c1', title: 'Cohort 1', capacity: 30 }], error: null }) };
        }
        if (table === 'modules') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [{ id: 'm1', title: 'Intro', position: 1 }], error: null }),
            }),
          };
        }
        return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
      });

      const metrics = await getAdminExecutiveMetrics('7d');
      expect(metrics).toBeDefined();
      expect(metrics.timeframe).toBe('7d');
      expect(metrics.cohortComparisons).toHaveLength(1);
    });
  });

  describe('Mentor Cohort Schema Dual-Column Resilience', () => {
    it('handles created_at and assigned_at schema definitions without crashing', async () => {
      const mockAssignments = [
        { id: 'mc-1', mentor_id: 'm1', cohort_id: 'c1', created_at: '2026-09-20T00:00:00Z' },
      ];

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'mentor_cohorts') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockAssignments, error: null }),
            }),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [{ id: 'm1', full_name: 'Mentor Jordan', email: 'jordan@cutcraft.dev' }], error: null }),
            }),
          };
        }
        if (table === 'cohorts') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [{ id: 'c1', title: 'Action Cutting' }], error: null }),
            }),
          };
        }
        return { select: vi.fn() };
      });

      const assignments = await listMentorCohortAssignments();
      expect(assignments).toHaveLength(1);
      expect(assignments[0].mentor?.full_name).toBe('Mentor Jordan');
      expect(assignments[0].cohort?.name).toBe('Action Cutting');
    });
  });

  describe('Executive Reporting & Metric Exports', () => {
    const mockMetrics = {
      timeframe: '30d' as const,
      enrollmentConversionRate: 75,
      courseCompletionRate: 60,
      overallChurnRatePct: 8,
      reviewAging: {
        lessThan12h: 5,
        between12and24h: 3,
        between24and48h: 1,
        over48h: 0,
      },
      dropoutRiskCount: 2,
      avgMentorReviewHours: 14.5,
      activeUsers7d: 35,
      activeUsers30d: 50,
      activeUsers90d: 65,
      cohortComparisons: [
        {
          id: 'c-1',
          name: 'Commercial Mastery',
          capacity: 30,
          enrolledCount: 28,
          fillPct: 93,
          completionPct: 70,
          submissionRatePct: 85,
          status: 'published',
          visibility: 'public',
        },
      ],
      atRiskLearners: [
        {
          studentId: 's-1',
          studentName: 'Alex Mercer',
          studentEmail: 'alex@example.com',
          cohortId: 'c-1',
          cohortName: 'Commercial Mastery',
          daysInactive: 9,
          resubmissionsCount: 3,
          riskReason: 'multiple_resubmissions' as const,
        },
      ],
      cohortChurn: [
        {
          cohortId: 'c-1',
          cohortName: 'Commercial Mastery',
          totalEnrolled: 28,
          activeCount: 24,
          completedCount: 2,
          droppedCount: 2,
          churnRatePct: 7,
        },
      ],
      curriculumDropOff: [
        {
          moduleId: 'm-1',
          moduleTitle: 'Pacing Fundamentals',
          position: 1,
          lessonCount: 4,
          completionRatePct: 92,
          stalledStudentCount: 2,
        },
      ],
      mentorLeaderboard: [
        {
          mentorId: 'm-1',
          mentorName: 'David Fincher',
          mentorEmail: 'david@studio.com',
          reviewsCount: 15,
          avgTurnaroundHours: 8.2,
          resubmissionRatePct: 12,
        },
      ],
      escalationAlerts: [],
    };

    it('exports a complete, structured multi-section Executive Report CSV', () => {
      const csv = exportExecutiveReportCSV(mockMetrics);
      expect(csv).toContain('CUT / CRAFT — EXECUTIVE PLATFORM REPORT');
      expect(csv).toContain('--- EXECUTIVE KPI OVERVIEW ---');
      expect(csv).toContain('Enrollment Conversion Rate,75,%');
      expect(csv).toContain('Course Completion Rate,60,%');
      expect(csv).toContain('Overall Cohort Churn Rate,8,%');
      expect(csv).toContain('--- REVIEW SLA AGING BREAKDOWN ---');
      expect(csv).toContain('< 12 Hours,5');
      expect(csv).toContain('--- COHORT PERFORMANCE & CHURN ANALYSIS ---');
      expect(csv).toContain('"Commercial Mastery"');
      expect(csv).toContain('--- MENTOR PERFORMANCE & SLA AUDIT ---');
      expect(csv).toContain('"David Fincher"');
      expect(csv).toContain('--- CURRICULUM FUNNEL VELOCITY ---');
      expect(csv).toContain('"Pacing Fundamentals"');
    });

    it('exports actionable At-Risk Learner CSV roster', () => {
      const csv = exportAtRiskLearnersCSV(mockMetrics.atRiskLearners);
      expect(csv).toContain('Student Name,Email,Cohort,Days Inactive,Pending Revisions,Risk Factor');
      expect(csv).toContain('"Alex Mercer","alex@example.com","Commercial Mastery",9,3,"multiple resubmissions"');
    });
  });
});
