import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getPlatformAnalytics,
  getCohortReportingBaseline,
  getAtRiskStudentsReport,
  type PlatformAnalytics,
  type CohortReportingBaseline,
} from '../../lib/observability/analytics';
import { supabase } from '../../lib/supabaseClient';
import { queryCache } from '../../lib/queryCache';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe('Platform Telemetry & Analytics Aggregator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryCache.clear();
  });

  it('prefers authoritative RPC get_authoritative_platform_analytics when available', async () => {
    const mockRpcAnalytics: PlatformAnalytics = {
      activeUsers: { total: 10, students: 8, mentors: 1, admins: 1, suspended: 0 },
      lessonCompletion: { totalEnrollments: 8, completedLessons: 32, completionRatePct: 80, avgWatchPercentage: 85 },
      assignmentSubmissions: {
        totalSubmissions: 16,
        pendingCount: 2,
        reviewedCount: 14,
        resubmitCount: 0,
        onTimeSubmissions: 15,
        lateSubmissions: 1,
        onTimeRatePct: 94,
      },
      reviewTurnaround: { totalGraded: 14, pendingQueue: 2, avgTurnaroundHours: 6.5, slaComplianceRatePct: 93 },
      cohortConversion: {
        totalCohorts: 2,
        activeCohorts: 2,
        totalEnrolledStudents: 8,
        completedEnrollments: 4,
        droppedEnrollments: 0,
        waitlistedStudents: 1,
        retentionRatePct: 100,
      },
      computedAt: new Date().toISOString(),
    };

    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: mockRpcAnalytics,
      error: null,
    } as any);

    const result = await getPlatformAnalytics(true);
    expect(supabase.rpc).toHaveBeenCalledWith('get_authoritative_platform_analytics', {
      p_cohort_id: null,
      p_timeframe: '30d',
    });
    expect(result).toEqual(mockRpcAnalytics);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('aggregates user roles, lesson progress, submissions, and SLA turnaround via direct fallback', async () => {
    vi.mocked(supabase.rpc).mockRejectedValueOnce(new Error('RPC function not found'));

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockResolvedValue({
            data: [
              { id: '1', role: 'student', status: 'active' },
              { id: '2', role: 'student', status: 'active' },
              { id: '3', role: 'mentor', status: 'active' },
              { id: '4', role: 'admin', status: 'active' },
              { id: '5', role: 'student', status: 'suspended' },
            ],
            error: null,
          }),
        } as unknown as ReturnType<typeof supabase.from>;
      }
      if (table === 'enrollments') {
        return {
          select: vi.fn().mockResolvedValue({
            data: [
              { user_id: '1', cohort_id: 'c1', status: 'enrolled' },
              { user_id: '2', cohort_id: 'c1', status: 'completed' },
            ],
            error: null,
          }),
        } as unknown as ReturnType<typeof supabase.from>;
      }
      if (table === 'lesson_progress') {
        return {
          select: vi.fn().mockResolvedValue({
            data: [
              { user_id: '1', lesson_id: 'l1', completed: true, watch_percentage: 100 },
              { user_id: '1', lesson_id: 'l2', completed: false, watch_percentage: 40 },
            ],
            error: null,
          }),
        } as unknown as ReturnType<typeof supabase.from>;
      }
      if (table === 'submissions') {
        const pastDate = new Date(Date.now() - 3600000).toISOString();
        const reviewDate = new Date(Date.now()).toISOString();
        return {
          select: vi.fn().mockResolvedValue({
            data: [
              {
                id: 's1',
                status: 'reviewed',
                is_late: false,
                created_at: pastDate,
                updated_at: reviewDate,
              },
              {
                id: 's2',
                status: 'pending',
                is_late: true,
                created_at: pastDate,
                updated_at: pastDate,
              },
            ],
            error: null,
          }),
        } as unknown as ReturnType<typeof supabase.from>;
      }
      if (table === 'cohorts') {
        return {
          select: vi.fn().mockResolvedValue({
            data: [
              { id: 'c1', status: 'published' },
            ],
            error: null,
          }),
        } as unknown as ReturnType<typeof supabase.from>;
      }
      return { select: vi.fn().mockResolvedValue({ data: [], error: null }) } as unknown as ReturnType<typeof supabase.from>;
    });

    const analytics = await getPlatformAnalytics(true);

    expect(analytics).toBeDefined();
    // User breakdown
    expect(analytics.activeUsers.total).toBe(4);
    expect(analytics.activeUsers.students).toBe(2);
    expect(analytics.activeUsers.mentors).toBe(1);
    expect(analytics.activeUsers.admins).toBe(1);
    expect(analytics.activeUsers.suspended).toBe(1);

    // Curriculum Completion
    expect(analytics.lessonCompletion.completedLessons).toBe(1);
    expect(analytics.lessonCompletion.completionRatePct).toBe(50);

    // Assignment Submissions
    expect(analytics.assignmentSubmissions.totalSubmissions).toBe(2);
    expect(analytics.assignmentSubmissions.onTimeSubmissions).toBe(1);
    expect(analytics.assignmentSubmissions.lateSubmissions).toBe(1);
    expect(analytics.assignmentSubmissions.onTimeRatePct).toBe(50);

    // Review SLA
    expect(analytics.reviewTurnaround.totalGraded).toBe(1);
    expect(analytics.reviewTurnaround.pendingQueue).toBe(1);
    expect(analytics.reviewTurnaround.slaComplianceRatePct).toBe(100);

    // Cohort Conversion
    expect(analytics.cohortConversion.totalCohorts).toBe(1);
    expect(analytics.cohortConversion.activeCohorts).toBe(1);
    expect(analytics.cohortConversion.retentionRatePct).toBe(100);
  });

  it('avoids misleading 100% defaults when tables are empty or failed', async () => {
    vi.mocked(supabase.rpc).mockRejectedValueOnce(new Error('RPC function not found'));

    vi.mocked(supabase.from).mockImplementation(() => {
      return {
        select: vi.fn().mockRejectedValue(new Error('Database offline')),
      } as unknown as ReturnType<typeof supabase.from>;
    });

    const analytics = await getPlatformAnalytics(true);

    expect(analytics).toBeDefined();
    expect(analytics.activeUsers.total).toBe(0);
    // Verified: No fake 100% defaulted values when no data exists
    expect(analytics.assignmentSubmissions.onTimeRatePct).toBe(0);
    expect(analytics.reviewTurnaround.slaComplianceRatePct).toBe(0);
    expect(analytics.cohortConversion.retentionRatePct).toBe(0);
  });

  it('fetches authoritative CohortReportingBaseline via RPC', async () => {
    const mockBaseline: CohortReportingBaseline = {
      cohortId: 'cohort-123',
      cohortName: 'Cinematic Editing Sprint',
      status: 'active',
      capacity: 30,
      startDate: '2026-09-01T00:00:00Z',
      endDate: '2026-09-30T00:00:00Z',
      enrollment: {
        totalEnrolled: 25,
        activeCount: 22,
        completedCount: 2,
        droppedCount: 1,
        waitlistedCount: 0,
        retentionRatePct: 96,
        churnRatePct: 4,
        fillRatePct: 83.3,
      },
      curriculum: {
        totalModules: 4,
        totalLessons: 16,
        completedLessons: 300,
        completionRatePct: 75,
        avgWatchPercentage: 82,
      },
      submissions: {
        totalAssignments: 3,
        expectedSubmissions: 75,
        actualSubmissions: 68,
        submissionRatePct: 90.7,
        pendingSubmissions: 4,
        reviewedSubmissions: 60,
        resubmitSubmissions: 4,
        onTimeSubmissions: 62,
        lateSubmissions: 6,
        onTimeRatePct: 91.2,
      },
      reviewSla: {
        totalGraded: 64,
        pendingQueue: 4,
        avgTurnaroundHours: 11.2,
        slaComplianceRatePct: 95.3,
      },
      attendance: {
        liveSessionsCount: 4,
        attendanceRatePct: 88,
      },
      atRiskStudentsCount: 2,
      computedAt: new Date().toISOString(),
    };

    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: mockBaseline,
      error: null,
    } as any);

    const baseline = await getCohortReportingBaseline('cohort-123', true);
    expect(supabase.rpc).toHaveBeenCalledWith('get_cohort_reporting_baseline', {
      p_cohort_id: 'cohort-123',
    });
    expect(baseline).toEqual(mockBaseline);
  });

  it('identifies at-risk students with grounded risk attribution', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: [
        {
          student_id: 's-1',
          student_name: 'Casey Miller',
          student_email: 'casey@example.com',
          cohort_id: 'c-1',
          cohort_name: 'Documentary Masterclass',
          days_inactive: 10,
          resubmissions_count: 3,
          watch_percentage: 25,
          risk_reason: 'multiple_resubmissions',
          enrolled_at: '2026-09-01T00:00:00Z',
        },
      ],
      error: null,
    } as any);

    const atRisk = await getAtRiskStudentsReport('c-1', true);
    expect(atRisk).toHaveLength(1);
    expect(atRisk[0].studentName).toBe('Casey Miller');
    expect(atRisk[0].riskReason).toBe('multiple_resubmissions');
    expect(atRisk[0].daysInactive).toBe(10);
  });
});
