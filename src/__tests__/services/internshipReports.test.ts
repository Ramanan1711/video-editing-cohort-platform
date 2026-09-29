import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateInternshipReport,
  getStudentInternshipReport,
  listCohortInternshipReports,
  getCohortInternshipReportSummary,
  updateInternshipReport,
  publishInternshipReport,
  exportCohortInternshipReportsCSV,
} from '../../lib/internshipReportService';
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

describe('Formal Internship Reports Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateInternshipReport via RPC', () => {
    it('returns authoritative formal internship report when RPC succeeds', async () => {
      const mockReport = {
        id: 'report-uuid-1',
        cohort_id: 'cohort-1',
        student_id: 'student-1',
        student_name: 'Jordan Lee',
        student_email: 'jordan@example.com',
        cohort_name: '15-Day Kinetic Editing Sprint',
        title: 'Internship Performance & Evaluation Report',
        status: 'draft',
        composite_score: 91.5,
        grade: 'A+',
        attendance_rate_pct: 100.0,
        completed_drills_count: 15,
        total_drills_count: 15,
        technical_rating: 5,
        consistency_rating: 5,
        creative_rating: 4,
        summary_notes: 'Exceptional performance across all daily drills.',
        strengths: 'Fast turnaround and high audio fidelity.',
        growth_areas: 'Advanced colour grading.',
        recommendation: 'strongly_recommend',
        lor_eligible: true,
        telemetry_snapshot: {
          total_drills: 15,
          completed_drills: 15,
          drill_avg_score: 95,
          total_lessons: 10,
          completed_lessons: 10,
          total_assignments: 3,
          approved_assignments: 3,
          total_sessions: 4,
          attended_sessions: 4,
          drills_list: [],
        },
        generated_at: '2026-09-29T12:00:00Z',
      };

      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: mockReport,
        error: null,
      });

      const res = await generateInternshipReport('cohort-1', 'student-1', 'mentor-1');

      expect(supabase.rpc).toHaveBeenCalledWith('generate_internship_report', {
        p_cohort_id: 'cohort-1',
        p_student_id: 'student-1',
        p_evaluator_id: 'mentor-1',
      });
      expect(res.composite_score).toBe(91.5);
      expect(res.grade).toBe('A+');
      expect(res.lor_eligible).toBe(true);
      expect(res.completed_drills_count).toBe(15);
    });
  });

  describe('generateInternshipReport client fallback', () => {
    it('computes 4-pillar composite score, assigns grade and LOR eligibility correctly', async () => {
      // 1. RPC fails
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: null,
        error: { code: '42883', message: 'RPC not found' },
      });

      // 2. Query mocks
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'cohorts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 'cohort-1', name: 'Creative Sprint', sprint_duration_days: 2 },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 'student-1', full_name: 'Casey Morgan', email: 'casey@test.com' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'daily_challenges') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [
                    { id: 'dc1', day_number: 1, title: 'Day 1 Drill' },
                    { id: 'dc2', day_number: 2, title: 'Day 2 Drill' },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'daily_challenge_submissions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { challenge_id: 'dc1', status: 'accepted', score: 90 },
                  { challenge_id: 'dc2', status: 'accepted', score: 95 },
                ],
                error: null,
              }),
            }),
          };
        }
        if (table === 'modules') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ id: 'm1', lessons: [{ id: 'l1' }] }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'lesson_progress') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ lesson_id: 'l1', completed: true, watch_percentage: 100 }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'assignments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ id: 'a1' }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'submissions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ assignment_id: 'a1', status: 'approved' }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'live_sessions') {
          return {
            select: vi.fn().mockReturnValue({
              or: vi.fn().mockReturnValue({
                lte: vi.fn().mockResolvedValue({
                  data: [{ id: 's1' }],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'session_attendance') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ session_id: 's1', status: 'present' }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'internship_reports') {
          return {
            upsert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'report-saved-1',
                    cohort_id: 'cohort-1',
                    student_id: 'student-1',
                    composite_score: 100,
                    grade: 'A+',
                    lor_eligible: true,
                    completed_drills_count: 2,
                    total_drills_count: 2,
                    technical_rating: 5,
                    consistency_rating: 5,
                    creative_rating: 5,
                    status: 'draft',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      const res = await generateInternshipReport('cohort-1', 'student-1');

      expect(res.grade).toBe('A+');
      expect(res.lor_eligible).toBe(true);
      expect(res.student_name).toBe('Casey Morgan');
      expect(res.cohort_name).toBe('Creative Sprint');
    });
  });

  describe('updateInternshipReport and publishInternshipReport', () => {
    it('updates qualitative evaluation ratings and notes', async () => {
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'internship_reports') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: 'rep-1',
                      cohort_id: 'c1',
                      student_id: 's1',
                      technical_rating: 5,
                      consistency_rating: 4,
                      creative_rating: 5,
                      strengths: 'Outstanding cinematic flow',
                      profiles: { full_name: 'Sam' },
                      cohorts: { name: 'Cohort A' },
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      const updated = await updateInternshipReport('rep-1', {
        technical_rating: 5,
        consistency_rating: 4,
        creative_rating: 5,
        strengths: 'Outstanding cinematic flow',
      });

      expect(updated.technical_rating).toBe(5);
      expect(updated.strengths).toBe('Outstanding cinematic flow');
    });

    it('publishes report and transitions status', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { id: 'rep-1', status: 'published' },
        error: null,
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'internship_reports') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'rep-1',
                    status: 'published',
                    profiles: { full_name: 'Sam' },
                    cohorts: { name: 'Cohort A' },
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      const res = await publishInternshipReport('rep-1');
      expect(res.status).toBe('published');
    });
  });

  describe('exportCohortInternshipReportsCSV', () => {
    it('exports correctly structured CSV string with header row', () => {
      const mockReports = [
        {
          id: 'r1',
          cohort_id: 'c1',
          student_id: 's1',
          student_name: 'Alice Cooper',
          student_email: 'alice@test.com',
          cohort_name: 'Summer Cohort',
          title: 'Report',
          status: 'published' as const,
          composite_score: 95.0,
          grade: 'A+' as const,
          attendance_rate_pct: 100.0,
          completed_drills_count: 15,
          total_drills_count: 15,
          technical_rating: 5,
          consistency_rating: 5,
          creative_rating: 5,
          summary_notes: 'Great job',
          strengths: 'Quick pacing',
          growth_areas: 'Audio',
          recommendation: 'strongly_recommend' as const,
          lor_eligible: true,
          telemetry_snapshot: {
            total_drills: 15,
            completed_drills: 15,
            drill_avg_score: 95,
            total_lessons: 10,
            completed_lessons: 10,
            total_assignments: 3,
            approved_assignments: 3,
            total_sessions: 4,
            attended_sessions: 4,
            drills_list: [],
          },
          generated_at: '2026-09-29T10:00:00Z',
          published_at: '2026-09-29T11:00:00Z',
        },
      ];

      const csv = exportCohortInternshipReportsCSV('Summer Cohort', mockReports);

      expect(csv).toContain('Student Name,Student Email,Cohort,Report Status,Final Grade');
      expect(csv).toContain('"Alice Cooper"');
      expect(csv).toContain('"A+"');
      expect(csv).toContain('"YES"');
      expect(csv).toContain('"STRONGLY RECOMMEND"');
    });
  });
});
