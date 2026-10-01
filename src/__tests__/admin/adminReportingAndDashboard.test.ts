import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getAdminStats,
  getAdminExecutiveMetrics,
  getCourseDemandReport,
  listMentorCohortAssignments,
  exportExecutiveReportCSV,
  exportAtRiskLearnersCSV,
} from '../../lib/adminService';
import { supabase } from '../../lib/supabaseClient';
import { queryCache } from '../../lib/queryCache';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe('Admin Dashboard & Reporting System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryCache.clear();
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

    it('exports Course Demand & Enrollment Distribution section when courseDemand metrics exist', () => {
      const metricsWithDemand = {
        ...mockMetrics,
        courseDemand: [
          {
            courseId: 'c-web',
            title: 'Full Stack React & Node',
            trackType: 'coding' as const,
            cohortsCount: 3,
            enrolledStudentsCount: 50,
            status: 'published',
            popularitySharePct: 71,
          },
          {
            courseId: 'c-edit',
            title: 'Commercial Video Editing',
            trackType: 'non_coding' as const,
            cohortsCount: 1,
            enrolledStudentsCount: 20,
            status: 'published',
            popularitySharePct: 29,
          },
          {
            courseId: 'c-sound',
            title: 'Audio Foley Engineering',
            trackType: 'non_coding' as const,
            cohortsCount: 0,
            enrolledStudentsCount: 0,
            status: 'draft',
            popularitySharePct: 0,
          },
        ],
      };

      const csv = exportExecutiveReportCSV(metricsWithDemand);
      expect(csv).toContain('--- COURSE DEMAND & ENROLLMENT DISTRIBUTION ---');
      expect(csv).toContain('Rank,Course Title,Track Type,Cohorts Count,Enrolled Students,Popularity Share %,Status');
      expect(csv).toContain('1,"Full Stack React & Node","coding",3,50,71%,"published"');
      expect(csv).toContain('2,"Commercial Video Editing","non_coding",1,20,29%,"published"');
      expect(csv).toContain('3,"Audio Foley Engineering","non_coding",0,0,0%,"draft"');
    });
  });

  describe('Course Demand & Enrollment Popularity Reporting', () => {
    it('ranks courses by active student enrollment count descending from courses_overview', async () => {
      const mockOverviewData = [
        {
          id: 'course-1',
          title: 'Color Grading Masterclass',
          slug: 'color-grading',
          track_type: 'non_coding',
          status: 'published',
          cohorts_count: 2,
          total_active_students: 45,
        },
        {
          id: 'course-2',
          title: 'TypeScript Full Stack',
          slug: 'typescript-full-stack',
          track_type: 'coding',
          status: 'published',
          cohorts_count: 4,
          total_active_students: 120, // highest demand
        },
        {
          id: 'course-3',
          title: 'Davinci Resolve Audio Foley',
          slug: 'audio-foley',
          track_type: 'non_coding',
          status: 'draft',
          cohorts_count: 0,
          total_active_students: 0, // lowest / zero enrollment
        },
      ];

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'courses_overview') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockOverviewData, error: null }),
            }),
          };
        }
        return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
      });

      const report = await getCourseDemandReport();
      expect(report).toHaveLength(3);

      // Most demanded course should be ranked #1
      expect(report[0].courseId).toBe('course-2');
      expect(report[0].title).toBe('TypeScript Full Stack');
      expect(report[0].enrolledStudentsCount).toBe(120);
      expect(report[0].popularitySharePct).toBe(Math.round((120 / (120 + 45)) * 100)); // 73%

      // Medium demanded course
      expect(report[1].courseId).toBe('course-1');
      expect(report[1].enrolledStudentsCount).toBe(45);

      // Lowest / zero enrollment course ranked at the bottom
      expect(report[2].courseId).toBe('course-3');
      expect(report[2].enrolledStudentsCount).toBe(0);
      expect(report[2].popularitySharePct).toBe(0);
    });

    it('falls back to synthesized courses, cohorts, and enrollments when courses_overview fails', async () => {
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'courses_overview') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: null, error: { message: 'View not found', code: '42P01' } }),
            }),
          };
        }
        if (table === 'courses') {
          return {
            select: vi.fn().mockResolvedValue({
              data: [
                { id: 'c-python', title: 'Python Backend', track_type: 'coding', status: 'published' },
                { id: 'c-premiere', title: 'Premiere Pro Timeline', track_type: 'non_coding', status: 'published' },
              ],
              error: null,
            }),
          };
        }
        if (table === 'cohorts') {
          return {
            select: vi.fn().mockResolvedValue({
              data: [
                { id: 'cohort-py-1', course_id: 'c-python', title: 'Python Fall 2026' },
                { id: 'cohort-py-2', course_id: 'c-python', title: 'Python Winter 2026' },
                { id: 'cohort-prem-1', course_id: 'c-premiere', title: 'Premiere Pro Sept' },
              ],
              error: null,
            }),
          };
        }
        if (table === 'enrollments') {
          return {
            select: vi.fn().mockResolvedValue({
              data: [
                { user_id: 'u-1', cohort_id: 'cohort-py-1', status: 'enrolled' },
                { user_id: 'u-2', cohort_id: 'cohort-py-1', status: 'active' },
                { user_id: 'u-3', cohort_id: 'cohort-py-2', status: 'active' },
                { user_id: 'u-4', cohort_id: 'cohort-prem-1', status: 'enrolled' },
                { user_id: 'u-5', cohort_id: 'cohort-prem-1', status: 'dropped' }, // dropped should not count as active
              ],
              error: null,
            }),
          };
        }
        return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
      });

      const report = await getCourseDemandReport();
      expect(report).toHaveLength(2);

      // Python has 3 active enrolled students across 2 cohorts
      expect(report[0].courseId).toBe('c-python');
      expect(report[0].enrolledStudentsCount).toBe(3);
      expect(report[0].cohortsCount).toBe(2);

      // Premiere has 1 active enrolled student (u-5 is dropped)
      expect(report[1].courseId).toBe('c-premiere');
      expect(report[1].enrolledStudentsCount).toBe(1);
      expect(report[1].cohortsCount).toBe(1);
    });
  });
});
