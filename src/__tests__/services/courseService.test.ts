import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  markLessonComplete,
  updateLessonWatchProgress,
  enrollInCohort,
  submitOrReplaceAssignment,
  listEnrollments,
  saveEnrollment,
  listCourses,
  createCourse,
  cloneCourseCurriculumToCohort,
  createCohort,
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

  describe('Enrollment Schema Harmonization & Dual Timestamp Resilience', () => {
    it('listEnrollments queries both created_at and enrolled_at and falls back smoothly if enrolled_at is absent', async () => {
      // First attempt fails with column missing, fallback succeeds
      const mockOrder = vi.fn()
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'column enrolled_at does not exist', code: '42703' },
        })
        .mockResolvedValueOnce({
          data: [
            {
              user_id: 'u-1',
              cohort_id: 'c-1',
              status: 'enrolled',
              created_at: '2026-09-28T00:00:00Z',
            },
          ],
          error: null,
        });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: mockOrder,
        }),
      });

      const enrollments = await listEnrollments();
      expect(enrollments).toHaveLength(1);
      expect(enrollments[0].status).toBe('enrolled');
      expect(enrollments[0].created_at).toBe('2026-09-28T00:00:00Z');
    });

    it('saveEnrollment populates both created_at and enrolled_at on upsert', async () => {
      const mockUpsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              user_id: 'u-2',
              cohort_id: 'c-2',
              status: 'active',
              created_at: '2026-09-28T12:00:00Z',
              enrolled_at: '2026-09-28T12:00:00Z',
            },
            error: null,
          }),
        }),
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'enrollments') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                neq: vi.fn().mockReturnValue({
                  in: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
            upsert: mockUpsert,
          };
        }
        return { select: vi.fn() };
      });

      const result = await saveEnrollment({
        user_id: 'u-2',
        cohort_id: 'c-2',
        status: 'active',
      });

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'u-2',
          cohort_id: 'c-2',
          status: 'active',
          created_at: expect.any(String),
          enrolled_at: expect.any(String),
        }),
        expect.anything()
      );
      expect(result.status).toBe('active');
      expect(result.enrolled_at).toBe('2026-09-28T12:00:00Z');
    });
  });

  describe('Course Entity & Cohort Decoupling', () => {
    it('listCourses fetches from courses_overview with fallback resilience', async () => {
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'courses_overview') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'course-1',
                    title: 'Premiere Pro Masterclass',
                    cohorts_count: 3,
                    modules_count: 8,
                    status: 'published',
                  },
                ],
                error: null,
              }),
            }),
          };
        }
        return { select: vi.fn() };
      });

      const courses = await listCourses();
      expect(courses).toHaveLength(1);
      expect(courses[0].title).toBe('Premiere Pro Masterclass');
      expect(courses[0].cohorts_count).toBe(3);
    });

    it('createCourse inserts into courses table with generated slug', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'new-course-id',
              title: 'After Effects VFX Sprint',
              slug: 'after-effects-vfx-sprint-abc123',
              status: 'published',
              difficulty_level: 'intermediate',
            },
            error: null,
          }),
        }),
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'courses') {
          return { insert: mockInsert };
        }
        return { select: vi.fn() };
      });

      const course = await createCourse({
        title: 'After Effects VFX Sprint',
        difficulty_level: 'intermediate',
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'After Effects VFX Sprint',
          difficulty_level: 'intermediate',
        })
      );
      expect(course.id).toBe('new-course-id');
    });

    it('createCohort stores course_id association when provided', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'cohort-inst-1',
              title: 'Fall 2026 Batch A',
              course_id: 'master-course-123',
              description: 'First run',
              status: 'published',
              capacity: 25,
            },
            error: null,
          }),
        }),
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'cohorts') {
          return { insert: mockInsert };
        }
        return { select: vi.fn() };
      });

      const cohort = await createCohort({
        name: 'Fall 2026 Batch A',
        description: 'First run',
        course_id: 'master-course-123',
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Fall 2026 Batch A',
          course_id: 'master-course-123',
        })
      );
      expect(cohort.course_id).toBe('master-course-123');
    });

    it('cloneCourseCurriculumToCohort calls server RPC', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          success: true,
          course_id: 'c-1',
          cohort_id: 'ch-1',
          modules_cloned: 4,
          lessons_cloned: 16,
        },
        error: null,
      });

      const res = await cloneCourseCurriculumToCohort('c-1', 'ch-1');
      expect(res.success).toBe(true);
      expect(res.modules_cloned).toBe(4);
      expect(res.lessons_cloned).toBe(16);
      expect(supabase.rpc).toHaveBeenCalledWith('clone_course_curriculum_to_cohort', {
        p_course_id: 'c-1',
        p_cohort_id: 'ch-1',
      });
    });
  });
});
