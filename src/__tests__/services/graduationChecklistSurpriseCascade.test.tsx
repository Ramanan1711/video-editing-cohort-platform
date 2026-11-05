import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { supabase } from '../../lib/supabaseClient';
import { verifyCertificateEligibility } from '../../lib/services/certificateService';
import { CertificateModal } from '../../components/CertificateModal';

describe('Graduation Checklist Surprise Requirements Cascade Fix', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('certificateService.verifyCertificateEligibility', () => {
    it('returns full 4-pillar counts even when lessons are incomplete (no short-circuit zeroing)', async () => {
      // Mock RPC failure to test client-side calculation fallback
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: null,
        error: { code: 'P0001', message: 'RPC not available' },
      } as any);

      const lessons = Array.from({ length: 16 }, (_, i) => ({
        id: `les-${i + 1}`,
        video_url: 'https://example.com/v.mp4',
      }));

      // Student has completed 14 of 16 lessons
      const progress = lessons.slice(0, 14).map((l) => ({
        lesson_id: l.id,
        completed: true,
        watch_percentage: 100,
      }));

      // 2 cohort assignments, student has 0 approved
      const assignments = [
        { id: 'assign-1', title: 'Rough Cut' },
        { id: 'assign-2', title: 'Color Grading' },
      ];

      // 15 sprint challenges, student has 0 accepted
      const challenges = Array.from({ length: 15 }, (_, i) => ({
        id: `challenge-${i + 1}`,
        day_number: i + 1,
      }));

      // 3 workshops scheduled, student has 0 attended
      const sessions = [
        { id: 'sess-1', cohort_id: 'cohort-1', starts_at: '2026-09-02T10:00:00Z' },
        { id: 'sess-2', cohort_id: 'cohort-1', starts_at: '2026-09-03T10:00:00Z' },
        { id: 'sess-3', cohort_id: 'cohort-1', starts_at: '2026-09-04T10:00:00Z' },
      ];

      vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
        if (table === 'enrollments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { enrolled_at: '2026-09-01T00:00:00Z', created_at: '2026-09-01T00:00:00Z' },
                    error: null,
                  }),
                }),
              }),
            }),
          } as any;
        }

        if (table === 'modules') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ id: 'mod-1', lessons }],
                error: null,
              }),
            }),
          } as any;
        }

        if (table === 'lesson_progress') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: progress,
                error: null,
              }),
            }),
          } as any;
        }

        if (table === 'assignments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: assignments,
                  error: null,
                }),
              }),
            }),
          } as any;
        }

        if (table === 'submissions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({
                  data: [], // 0 approved assignments
                  error: null,
                }),
              }),
            }),
          } as any;
        }

        if (table === 'cohorts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { sprint_duration_days: 15 },
                  error: null,
                }),
              }),
            }),
          } as any;
        }

        if (table === 'daily_challenges') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: challenges,
                error: null,
              }),
            }),
          } as any;
        }

        if (table === 'daily_challenge_submissions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [], // 0 accepted challenges
                  error: null,
                }),
              }),
            }),
          } as any;
        }

        if (table === 'live_sessions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                lte: vi.fn().mockResolvedValue({
                  data: sessions,
                  error: null,
                }),
              }),
            }),
          } as any;
        }

        if (table === 'session_attendance') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({
                  data: [], // 0 sessions attended
                  error: null,
                }),
              }),
            }),
          } as any;
        }

        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        } as any;
      });

      const res = await verifyCertificateEligibility('student-1', 'cohort-1');

      expect(res.eligible).toBe(false);
      expect(res.reason).toBe('2 required lesson(s) not completed (≥80% watch verification required).');
      // Must NOT be hardcoded to 0 for subsequent pillars
      expect(res.completed_lessons).toBe(14);
      expect(res.total_lessons).toBe(16);
      expect(res.approved_assignments).toBe(0);
      expect(res.total_assignments).toBe(2);
      expect(res.completed_challenges).toBe(0);
      expect(res.total_challenges).toBe(15);
      expect(res.attended_sessions).toBe(0);
      expect(res.total_sessions).toBe(3);
    });

    it('faithfully preserves all 4 pillars when RPC returns non-short-circuited ineligibility', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          eligible: false,
          reason: '2 of 16 required lessons incomplete (≥80% watch verification required).',
          completed_lessons: 14,
          total_lessons: 16,
          approved_assignments: 0,
          total_assignments: 2,
          completed_challenges: 0,
          total_challenges: 15,
          attended_sessions: 0,
          total_sessions: 3,
          attendance_rate_pct: 0.0,
          min_attendance_pct: 75.0,
        },
        error: null,
      } as any);

      const res = await verifyCertificateEligibility('student-1', 'cohort-1');

      expect(res.eligible).toBe(false);
      expect(res.completed_lessons).toBe(14);
      expect(res.total_lessons).toBe(16);
      expect(res.approved_assignments).toBe(0);
      expect(res.total_assignments).toBe(2);
      expect(res.completed_challenges).toBe(0);
      expect(res.total_challenges).toBe(15);
      expect(res.attended_sessions).toBe(0);
      expect(res.total_sessions).toBe(3);
    });
  });

  describe('CertificateModal Requirements Checklist Display', () => {
    it('displays true requirement counts for all 4 pillars without surprise zero masking', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          eligible: false,
          reason: '2 of 16 required lessons incomplete (≥80% watch verification required).',
          completed_lessons: 14,
          total_lessons: 16,
          approved_assignments: 0,
          total_assignments: 2,
          completed_challenges: 0,
          total_challenges: 15,
          attended_sessions: 0,
          total_sessions: 3,
          attendance_rate_pct: 0.0,
          min_attendance_pct: 75.0,
        },
        error: null,
      } as any);

      render(
        <CertificateModal
          isOpen={true}
          onClose={() => {}}
          studentName="Jane Doe"
          cohortName="Advanced Video Editing"
          cohortId="c1"
          studentId="s1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Certificate Requirements Incomplete')).toBeInTheDocument();
      });

      // Assert that actual counts are visible, eliminating surprise cascades
      expect(screen.getByText('14 / 16')).toBeInTheDocument();
      expect(screen.getByText('0 / 2')).toBeInTheDocument();
      expect(screen.getByText('0 / 15')).toBeInTheDocument();
      expect(screen.getByText('0/3 (0%)')).toBeInTheDocument();

      // Ensure that uncompleted assignments and challenges are NOT falsely reported as 0/0
      expect(screen.queryByText('0 / 0')).toBeNull();
    });

    it('marks optional pillars as satisfied when a cohort genuinely has 0 of that requirement', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          eligible: true,
          certificate_number: 'CC-202611-GENUINE',
          issued_at: '2026-11-05T00:00:00Z',
          completed_lessons: 5,
          total_lessons: 5,
          approved_assignments: 0,
          total_assignments: 0, // Cohort has no assignments
          completed_challenges: 0,
          total_challenges: 0, // Cohort has no challenges
          attended_sessions: 0,
          total_sessions: 0, // Cohort has no live sessions
          attendance_rate_pct: 100.0,
          min_attendance_pct: 75.0,
        },
        error: null,
      } as any);

      render(
        <CertificateModal
          isOpen={true}
          onClose={() => {}}
          studentName="Jane Doe"
          cohortName="Mini Masterclass"
          cohortId="c-mini"
          studentId="s1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('CC-202611-GENUINE')).toBeInTheDocument();
      });

      expect(screen.getByText('Certificate of Completion')).toBeInTheDocument();
    });
  });
});
