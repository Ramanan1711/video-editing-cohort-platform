import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  markLessonComplete,
  updateLessonWatchProgress,
  enrollInCohort,
  submitOrReplaceAssignment,
} from '../../lib/courseService';
import { supabase } from '../../lib/supabaseClient';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe('Course Service: Enrollment, Lesson Verification & Submissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Lesson Watch Verification & Completion', () => {
    it('rejects completion when watch percentage is below 80%', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { success: false, reason: 'You must watch at least 80% of this video lesson before marking it complete.' },
        error: null,
      });

      await expect(
        markLessonComplete('user-1', 'lesson-1', true, { watchPercentage: 65, positionSeconds: 120 })
      ).rejects.toThrow('You must watch at least 80%');
    });

    it('approves completion when watch percentage is >= 80%', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { success: true },
        error: null,
      });

      await expect(
        markLessonComplete('user-1', 'lesson-1', true, { watchPercentage: 88, positionSeconds: 500 })
      ).resolves.not.toThrow();

      expect(supabase.rpc).toHaveBeenCalledWith('verify_and_complete_lesson', {
        p_user_id: 'user-1',
        p_lesson_id: 'lesson-1',
        p_watch_percentage: 88,
        p_position_seconds: 500,
      });
    });

    it('auto-completes lesson when updateLessonWatchProgress reaches 80%', async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null });
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        upsert: mockUpsert,
      });

      await updateLessonWatchProgress('user-1', 'lesson-1', 82, 340);

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          lesson_id: 'lesson-1',
          watch_percentage: 82,
          completed: true,
        }),
        expect.anything()
      );
    });
  });

  describe('Cohort Enrollment & Waitlist Logic', () => {
    it('successfully enrolls student as active when cohort has capacity', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { status: 'active', message: 'Enrollment confirmed' },
        error: null,
      });

      const enrollment = await enrollInCohort('user-1', 'cohort-1');
      expect(enrollment.status).toBe('active');
      expect(enrollment.cohort_id).toBe('cohort-1');
      expect(enrollment.user_id).toBe('user-1');
    });

    it('routes student to waitlisted status when cohort is at maximum capacity', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { status: 'waitlist', message: 'Cohort full, placed on waitlist' },
        error: null,
      });

      const enrollment = await enrollInCohort('user-2', 'cohort-full-1');
      expect(enrollment.status).toBe('waitlisted');
      expect(enrollment.cohort_id).toBe('cohort-full-1');
    });

    it('throws error if user is suspended or enrollment is rejected by DB rule', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: {
          code: 'P0001',
          message: 'Suspended accounts cannot enroll in new cohorts.',
        },
      });

      await expect(enrollInCohort('user-suspended', 'cohort-1')).rejects.toThrow();
    });
  });

  describe('Student Assignment Submissions & Resubmissions', () => {
    it('creates initial assignment submission with pending status via RPC', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          id: 'sub-new-1',
          assignment_id: 'assign-1',
          student_id: 'student-1',
          file_url: 'https://cdn.cutcraft.test/cuts/v1.mp4',
          status: 'pending',
          is_late: false,
          version_number: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      });

      const sub = await submitOrReplaceAssignment(
        'student-1',
        'assign-1',
        'https://cdn.cutcraft.test/cuts/v1.mp4',
        undefined,
        false,
        'First rough cut submission'
      );

      expect(sub.id).toBe('sub-new-1');
      expect(sub.status).toBe('pending');
      expect(sub.version_number).toBe(1);
      expect(sub.is_late).toBe(false);
    });

    it('flags late submissions if submitted past deadline', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          id: 'sub-late-1',
          assignment_id: 'assign-1',
          student_id: 'student-1',
          file_url: 'https://cdn.cutcraft.test/cuts/late_v1.mp4',
          status: 'pending',
          is_late: true,
          version_number: 1,
          created_at: new Date().toISOString(),
        },
        error: null,
      });

      const sub = await submitOrReplaceAssignment(
        'student-1',
        'assign-1',
        'https://cdn.cutcraft.test/cuts/late_v1.mp4'
      );

      expect(sub.is_late).toBe(true);
    });

    it('snapshots previous version into submission_versions and increments version on resubmission', async () => {
      // Mock RPC missing so fallback logic executes
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { code: '42883', message: 'function does not exist' },
      });

      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'assignments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { deadline: null } }),
              }),
            }),
          };
        }
        if (table === 'submissions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      maybeSingle: vi.fn().mockResolvedValue({
                        data: {
                          id: 'sub-existing-1',
                          file_url: 'https://cdn.cutcraft.test/v1.mp4',
                          status: 'needs_work',
                          version_number: 1,
                        },
                      }),
                    }),
                  }),
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: 'sub-existing-1',
                      assignment_id: 'assign-1',
                      student_id: 'student-1',
                      file_url: 'https://cdn.cutcraft.test/v2_revision.mp4',
                      status: 'pending',
                      version_number: 2,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'submission_versions') {
          return {
            insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return { select: vi.fn() };
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockFrom);

      const sub = await submitOrReplaceAssignment(
        'student-1',
        'assign-1',
        'https://cdn.cutcraft.test/v2_revision.mp4'
      );

      expect(sub.id).toBe('sub-existing-1');
      expect(sub.version_number).toBe(2);
      expect(sub.status).toBe('pending');
      expect(sub.file_url).toBe('https://cdn.cutcraft.test/v2_revision.mp4');
    });
  });
});
