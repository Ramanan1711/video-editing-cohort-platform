import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPlatformAnalytics } from '../../lib/observability/analytics';
import { supabase } from '../../lib/supabaseClient';
import { queryCache } from '../../lib/queryCache';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('Platform Telemetry & Analytics Aggregator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryCache.clear();
  });

  it('aggregates user roles, lesson progress, submissions, and SLA turnaround', async () => {
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
});
