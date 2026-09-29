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
  createModule,
  updateModule,
  deleteModule,
  reorderModules,
  duplicateModule,
  updateModuleStatus,
  listModules,
  deleteLesson,
  reorderLessons,
  duplicateLesson,
  getSecureAssetUrl,
  getSecureSubmissionUrl,
  uploadCourseAsset,
  getLessonResourceDownloadUrl,
  listAssignments,
  listAssignmentsByLesson,
  listAllAssignments,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  normalizeAssignmentRow,
  normalizeSubmissionStatus,
  listMySubmissions,
  listSubmissionVersions,
  reviewSubmission,
  addFeedbackReply,
  listFeedbackReplies,
  markFeedbackRead,
} from '../../lib/courseService';
import { supabase } from '../../lib/supabaseClient';

const mockStorageFrom = vi.fn();

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
    storage: {
      from: (...args: unknown[]) => mockStorageFrom(...args),
    },
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

    it('authoritatively records watch heartbeat via record_lesson_watch_heartbeat RPC', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { success: true, watch_percentage: 85, completed: true, is_auto_completed: true },
        error: null,
      });

      await updateLessonWatchProgress('user-1', 'lesson-1', 85, 420, 1.5);

      expect(supabase.rpc).toHaveBeenCalledWith('record_lesson_watch_heartbeat', {
        p_lesson_id: 'lesson-1',
        p_position_seconds: 420,
        p_playback_rate: 1.5,
        p_user_id: 'user-1',
      });
    });

    it('unmarks lesson completion via toggle_lesson_completion RPC', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { success: true, completed: false },
        error: null,
      });

      await markLessonComplete('user-1', 'lesson-1', false);

      expect(supabase.rpc).toHaveBeenCalledWith('toggle_lesson_completion', {
        p_lesson_id: 'lesson-1',
        p_completed: false,
        p_user_id: 'user-1',
      });
    });

    it('auto-completes lesson when updateLessonWatchProgress reaches 80% in fallback mode', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { code: '42883', message: 'function record_lesson_watch_heartbeat does not exist' },
      });
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

    it('rejects completion in fallback mode when effective watch percentage is below 80% for video lesson', async () => {
      // Simulate RPC unavailable
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { code: '42883', message: 'function verify_and_complete_lesson does not exist' },
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'lessons') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 'lesson-vid-1', title: 'Premiere Pro Cuts', video_url: 'https://vimeo.com/12345', duration_minutes: 10 },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'lesson_progress') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { watch_percentage: 45, completed: false },
                    error: null,
                  }),
                }),
              }),
            }),
            upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return {};
      });

      await expect(
        markLessonComplete('user-1', 'lesson-vid-1', true, { watchPercentage: 45 })
      ).rejects.toThrow('At least 80% is required before marking it complete');
    });

    it('allows completion in fallback mode when effective watch percentage is >= 80% for video lesson', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { code: '42883', message: 'function verify_and_complete_lesson does not exist' },
      });

      const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'lessons') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 'lesson-vid-2', title: 'Audio Ducking', video_url: 'https://vimeo.com/54321', duration_minutes: 15 },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'lesson_progress') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { watch_percentage: 85, completed: false },
                    error: null,
                  }),
                }),
              }),
            }),
            upsert: mockUpsert,
          };
        }
        return {};
      });

      await expect(
        markLessonComplete('user-1', 'lesson-vid-2', true, { watchPercentage: 85 })
      ).resolves.not.toThrow();

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          lesson_id: 'lesson-vid-2',
          completed: true,
          watch_percentage: 85,
        }),
        expect.anything()
      );
    });

    it('does not fraudulently default watchPercentage to 100 when options are omitted', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { success: false, reason: 'You have watched 0% of the video. At least 80% is required.' },
        error: null,
      });

      await expect(
        markLessonComplete('user-1', 'lesson-vid-1', true)
      ).rejects.toThrow('At least 80% is required');

      expect(supabase.rpc).toHaveBeenCalledWith('verify_and_complete_lesson', {
        p_user_id: 'user-1',
        p_lesson_id: 'lesson-vid-1',
        p_watch_percentage: 0,
        p_position_seconds: 0,
      });
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

    it('normalizeSubmissionStatus correctly harmonizes DB and UI status vocabularies', () => {
      expect(normalizeSubmissionStatus('resubmit_requested')).toBe('resubmit');
      expect(normalizeSubmissionStatus('needs_revision')).toBe('resubmit');
      expect(normalizeSubmissionStatus('needs_work')).toBe('resubmit');
      expect(normalizeSubmissionStatus('approved')).toBe('reviewed');
      expect(normalizeSubmissionStatus('accepted')).toBe('reviewed');
      expect(normalizeSubmissionStatus('reviewed')).toBe('reviewed');
      expect(normalizeSubmissionStatus('draft')).toBe('draft');
      expect(normalizeSubmissionStatus('pending')).toBe('pending');
      expect(normalizeSubmissionStatus('resubmit')).toBe('resubmit');
      expect(normalizeSubmissionStatus(null)).toBe('pending');
      expect(normalizeSubmissionStatus(undefined)).toBe('pending');
    });

    it('listMySubmissions harmonizes legacy statuses and exposes notes and dual version fields', async () => {
      const mockOrder = vi.fn().mockResolvedValue({
        data: [
          {
            id: 'sub-legacy-1',
            assignment_id: 'assign-1',
            student_id: 'student-1',
            file_url: 'https://cdn.cutcraft.test/v1.mp4',
            status: 'resubmit_requested',
            notes: 'Check dialogue ducking at 00:45',
            created_at: '2026-09-28T00:00:00Z',
            updated_at: '2026-09-28T01:00:00Z',
            is_late: false,
            version: 1,
            version_number: 1,
          },
          {
            id: 'sub-legacy-2',
            assignment_id: 'assign-2',
            student_id: 'student-1',
            file_url: 'https://cdn.cutcraft.test/v2.mp4',
            status: 'approved',
            notes: 'Final export cut',
            created_at: '2026-09-28T02:00:00Z',
            updated_at: '2026-09-28T03:00:00Z',
            is_late: false,
            version: 2,
            version_number: 2,
          },
        ],
        error: null,
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'submissions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: mockOrder,
              }),
            }),
          };
        }
        if (table === 'feedback') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const subs = await listMySubmissions('student-1');
      expect(subs).toHaveLength(2);
      expect(subs[0].status).toBe('resubmit');
      expect(subs[0].notes).toBe('Check dialogue ducking at 00:45');
      expect(subs[0].version_number).toBe(1);
      expect(subs[0].version).toBe(1);

      expect(subs[1].status).toBe('reviewed');
      expect(subs[1].notes).toBe('Final export cut');
      expect(subs[1].version_number).toBe(2);
      expect(subs[1].version).toBe(2);
    });

    it('listSubmissionVersions queries dual version numbers, submitted_at, notes and normalizes status', async () => {
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'submission_versions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'ver-2',
                      submission_id: 'sub-1',
                      version: 2,
                      version_number: 2,
                      file_url: 'https://cdn.cutcraft.test/v2.mp4',
                      status: 'needs_revision',
                      notes: 'Revised pacing in scene 2',
                      submitted_at: '2026-09-28T04:00:00Z',
                      created_at: '2026-09-28T04:00:00Z',
                    },
                    {
                      id: 'ver-1',
                      submission_id: 'sub-1',
                      version: 1,
                      version_number: 1,
                      file_url: 'https://cdn.cutcraft.test/v1.mp4',
                      status: 'resubmit_requested',
                      notes: 'Initial rough cut',
                      submitted_at: '2026-09-28T01:00:00Z',
                      created_at: '2026-09-28T01:00:00Z',
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const versions = await listSubmissionVersions('sub-1');
      expect(versions).toHaveLength(2);
      expect(versions[0].status).toBe('resubmit');
      expect(versions[0].version).toBe(2);
      expect(versions[0].version_number).toBe(2);
      expect(versions[0].notes).toBe('Revised pacing in scene 2');
      expect(versions[0].submitted_at).toBe('2026-09-28T04:00:00Z');

      expect(versions[1].status).toBe('resubmit');
      expect(versions[1].version).toBe(1);
      expect(versions[1].version_number).toBe(1);
      expect(versions[1].notes).toBe('Initial rough cut');
    });

    it('reviewSubmission executes review_submission RPC with normalized status', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: null,
      });

      await reviewSubmission('sub-1', 'reviewed', 'Great cut!');

      expect(supabase.rpc).toHaveBeenCalledWith('review_submission', {
        p_submission_id: 'sub-1',
        p_status: 'reviewed',
        p_comments: 'Great cut!',
      });
    });

    it('reviewSubmission falls back to direct table inserts/updates when RPC is unavailable', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { code: 'PGRST202', message: 'function does not exist' },
      });

      const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'feedback') return { insert: mockInsert };
        if (table === 'submissions') return { update: mockUpdate };
        return {};
      });

      (supabase.auth.getUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { user: { id: 'mentor-author-1' } },
        error: null,
      });

      await reviewSubmission('sub-42', 'resubmit', 'Needs trim at end.');

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          submission_id: 'sub-42',
          mentor_id: 'mentor-author-1',
          comment: 'Needs trim at end.',
        })
      );
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'resubmit',
        })
      );
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

  describe('Module Curriculum Management & Reordering', () => {
    it('creates a module with status and course_id', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'mod-1',
              cohort_id: 'cohort-1',
              course_id: 'course-1',
              title: 'Narrative Pacing',
              description: 'Editing rhythms and cuts',
              position: 1,
              status: 'published',
            },
            error: null,
          }),
        }),
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'modules') return { insert: mockInsert };
        return {};
      });

      const module = await createModule({
        cohort_id: 'cohort-1',
        course_id: 'course-1',
        title: 'Narrative Pacing',
        description: 'Editing rhythms and cuts',
        position: 1,
        status: 'published',
      });

      expect(module.id).toBe('mod-1');
      expect(module.status).toBe('published');
      expect(module.lessons).toEqual([]);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Narrative Pacing',
          status: 'published',
        })
      );
    });

    it('falls back to legacy insert if status/course_id columns are missing', async () => {
      let callCount = 0;
      const mockInsert = vi.fn().mockImplementation((payload: Record<string, unknown>) => {
        callCount++;
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'column status does not exist' },
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'mod-legacy-1',
                cohort_id: payload.cohort_id,
                title: payload.title,
                description: payload.description,
                position: payload.position,
              },
              error: null,
            }),
          }),
        };
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'modules') return { insert: mockInsert };
        return {};
      });

      const module = await createModule({
        cohort_id: 'cohort-1',
        title: 'Color Grading Fundamentals',
        description: 'Basics of color',
        position: 2,
        status: 'published',
      });

      expect(callCount).toBe(2);
      expect(module.id).toBe('mod-legacy-1');
      expect(module.status).toBe('published');
    });

    it('reorders modules using canonical atomic RPC', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { success: true, count: 3 },
        error: null,
      });

      await reorderModules({ cohortId: 'cohort-1' }, ['mod-3', 'mod-1', 'mod-2']);

      expect(supabase.rpc).toHaveBeenCalledWith('reorder_modules', {
        p_module_ids: ['mod-3', 'mod-1', 'mod-2'],
        p_cohort_id: 'cohort-1',
        p_course_id: null,
      });
    });

    it('falls back to sequential updates when reorder_modules RPC is not installed', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { code: '42883', message: 'function reorder_modules does not exist' },
      });

      const mockEq = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'modules') return { update: mockUpdate };
        return {};
      });

      await reorderModules({ cohortId: 'cohort-1' }, ['mod-1', 'mod-2']);

      expect(mockUpdate).toHaveBeenCalledTimes(2);
      expect(mockEq).toHaveBeenCalledWith('id', 'mod-1');
      expect(mockEq).toHaveBeenCalledWith('id', 'mod-2');
    });

    it('duplicates module via atomic RPC and retrieves cloned lessons', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          id: 'mod-copy-1',
          cohort_id: 'cohort-1',
          course_id: null,
          title: 'Color Grading (Copy)',
          description: 'Desc',
          position: 2,
          status: 'draft',
        },
        error: null,
      });

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [
              { id: 'less-cloned-1', module_id: 'mod-copy-1', title: 'Color Wheel Basics', position: 1, status: 'draft' },
            ],
            error: null,
          }),
        }),
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'lessons') return { select: mockSelect };
        return {};
      });

      const copy = await duplicateModule('mod-orig-1');

      expect(supabase.rpc).toHaveBeenCalledWith('duplicate_module', {
        p_module_id: 'mod-orig-1',
      });
      expect(copy.id).toBe('mod-copy-1');
      expect(copy.lessons).toHaveLength(1);
      expect(copy.lessons[0].title).toBe('Color Wheel Basics');
    });

    it('safely deletes or archives module using admin_delete_module RPC', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { success: true, action: 'archived', message: 'Preserved learner submissions.' },
        error: null,
      });

      const res = await deleteModule('mod-1', { force: false });

      expect(supabase.rpc).toHaveBeenCalledWith('admin_delete_module', {
        p_module_id: 'mod-1',
        p_force: false,
      });
      expect(res.action).toBe('archived');
    });

    it('updates module status with updateModuleStatus', async () => {
      const mockEq = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'modules') return { update: mockUpdate };
        return {};
      });

      await updateModuleStatus('mod-1', 'archived');

      expect(mockUpdate).toHaveBeenCalledWith({ status: 'archived' });
      expect(mockEq).toHaveBeenCalledWith('id', 'mod-1');
    });

    it('updates a module with updateModule', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'mod-1',
            cohort_id: 'cohort-1',
            course_id: 'course-1',
            title: 'Updated Pacing',
            description: 'Updated desc',
            position: 2,
            status: 'review',
          },
          error: null,
        }),
      });
      const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'modules') return { update: mockUpdate };
        return {};
      });

      const updated = await updateModule('mod-1', {
        title: 'Updated Pacing',
        description: 'Updated desc',
        position: 2,
        status: 'review',
      });

      expect(updated.title).toBe('Updated Pacing');
      expect(updated.status).toBe('review');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Updated Pacing',
          status: 'review',
        })
      );
    });

    it('lists modules for a cohort with listModules', async () => {
      const mockOrder = vi.fn().mockResolvedValue({
        data: [
          {
            id: 'mod-1',
            cohort_id: 'cohort-1',
            course_id: null,
            title: 'Module 1',
            description: null,
            position: 1,
            status: 'published',
            lessons: [{ id: 'l-1', module_id: 'mod-1', title: 'Lesson 1', position: 1, status: 'published' }],
          },
        ],
        error: null,
      });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ order: mockOrder, eq: mockEq });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'modules') return { select: mockSelect };
        return {};
      });

      const list = await listModules('cohort-1');

      expect(list).toHaveLength(1);
      expect(list[0].title).toBe('Module 1');
      expect(list[0].lessons).toHaveLength(1);
    });

    it('reorders lessons using canonical atomic RPC reorder_lessons', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { success: true, count: 2 },
        error: null,
      });

      await reorderLessons('mod-1', ['less-2', 'less-1']);

      expect(supabase.rpc).toHaveBeenCalledWith('reorder_lessons', {
        p_lesson_ids: ['less-2', 'less-1'],
        p_module_id: 'mod-1',
      });
    });

    it('duplicates lesson using atomic RPC duplicate_lesson', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          id: 'less-copy-1',
          module_id: 'mod-1',
          title: 'Color Wheels (Copy)',
          description: 'Desc',
          video_url: 'https://vimeo.com/999',
          duration_minutes: 12,
          position: 3,
          status: 'draft',
        },
        error: null,
      });

      const copy = await duplicateLesson('less-orig-1');

      expect(supabase.rpc).toHaveBeenCalledWith('duplicate_lesson', {
        p_lesson_id: 'less-orig-1',
      });
      expect(copy.id).toBe('less-copy-1');
      expect(copy.title).toBe('Color Wheels (Copy)');
      expect(copy.status).toBe('draft');
    });

    it('safely deletes or archives lesson using admin_delete_lesson RPC', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { success: true, action: 'archived', message: 'Preserved learner submissions.' },
        error: null,
      });

      const res = await deleteLesson('less-1', { force: false });

      expect(supabase.rpc).toHaveBeenCalledWith('admin_delete_lesson', {
        p_lesson_id: 'less-1',
        p_force: false,
      });
      expect(res.action).toBe('archived');
    });
  });

  describe('Lesson Resources & Storage Privacy', () => {
    it('returns third-party external URLs as-is without attempting storage signing', async () => {
      const externalUrl = 'https://drive.google.com/file/d/1B2C3D4E5F/view';
      const result = await getSecureAssetUrl(externalUrl);
      expect(result).toBe(externalUrl);
      expect(mockStorageFrom).not.toHaveBeenCalled();
    });

    it('generates a time-limited signed URL for private course-assets files', async () => {
      const createSignedUrlMock = vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://test.supabase.co/storage/v1/object/sign/course-assets/resources/raw-footage.zip?token=xyz' },
        error: null,
      });
      mockStorageFrom.mockReturnValue({
        createSignedUrl: createSignedUrlMock,
      });

      const rawStorageUrl = 'https://test.supabase.co/storage/v1/object/public/course-assets/resources/raw-footage.zip';
      const signed = await getSecureAssetUrl(rawStorageUrl, 1800);

      expect(mockStorageFrom).toHaveBeenCalledWith('course-assets');
      expect(createSignedUrlMock).toHaveBeenCalledWith('resources/raw-footage.zip', 1800);
      expect(signed).toBe('https://test.supabase.co/storage/v1/object/sign/course-assets/resources/raw-footage.zip?token=xyz');
    });

    it('resolves download URL via server-side entitlement RPC for enrolled students', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          success: true,
          resource_id: 'res-123',
          name: 'DaVinci Resolve Template',
          url: 'course-assets/resources/template.drp',
          visibility: 'enrolled',
          authorized_as: 'student',
        },
        error: null,
      });

      const createSignedUrlMock = vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://test.supabase.co/storage/v1/object/sign/course-assets/resources/template.drp?token=signed' },
        error: null,
      });
      mockStorageFrom.mockReturnValue({
        createSignedUrl: createSignedUrlMock,
      });

      const downloadUrl = await getLessonResourceDownloadUrl('res-123');

      expect(supabase.rpc).toHaveBeenCalledWith('get_lesson_resource_download_url', {
        p_resource_id: 'res-123',
      });
      expect(createSignedUrlMock).toHaveBeenCalledWith('resources/template.drp', 3600);
      expect(downloadUrl).toBe('https://test.supabase.co/storage/v1/object/sign/course-assets/resources/template.drp?token=signed');
    });

    it('throws error when server RPC rejects access due to locked resource (lesson incomplete)', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: {
          code: '42501',
          message: 'LOCKED_RESOURCE: You must complete this lesson before accessing this download.',
        },
      });

      await expect(
        getLessonResourceDownloadUrl('res-locked-1', 'course-assets/resources/secret.zip')
      ).rejects.toThrow('LOCKED_RESOURCE');
    });

    it('throws error when server RPC rejects access due to lack of enrollment', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: {
          code: '42501',
          message: 'UNAUTHORIZED: You must be actively enrolled in this cohort to download this resource.',
        },
      });

      await expect(
        getLessonResourceDownloadUrl('res-unauth-1', 'course-assets/resources/locked.zip')
      ).rejects.toThrow('UNAUTHORIZED');
    });

    it('fails closed and throws an error if URL signing fails for private course asset (never returns raw storage URL)', async () => {
      const createSignedUrlMock = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Object not found or access denied' },
      });
      mockStorageFrom.mockReturnValue({
        createSignedUrl: createSignedUrlMock,
      });

      const rawStorageUrl = 'course-assets/resources/restricted-file.zip';
      await expect(getSecureAssetUrl(rawStorageUrl, 1800)).rejects.toThrow(
        'Object not found or access denied'
      );
      expect(mockStorageFrom).toHaveBeenCalledWith('course-assets');
      expect(createSignedUrlMock).toHaveBeenCalledWith('resources/restricted-file.zip', 1800);
    });

    it('uploadCourseAsset saves file and returns canonical private storage path instead of public CDN URL', async () => {
      const uploadMock = vi.fn().mockResolvedValue({ error: null });
      mockStorageFrom.mockReturnValue({
        upload: uploadMock,
      });

      const file = new File(['mock content'], 'intro-lesson.mp4', { type: 'video/mp4' });
      const pathResult = await uploadCourseAsset(file, 'lessons');

      expect(mockStorageFrom).toHaveBeenCalledWith('course-assets');
      expect(uploadMock).toHaveBeenCalledWith(
        expect.stringMatching(/^lessons\/[0-9a-f-]+-intro-lesson\.mp4$/),
        file,
        expect.objectContaining({ upsert: false, contentType: 'video/mp4' })
      );
      expect(pathResult).toMatch(/^course-assets\/lessons\/[0-9a-f-]+-intro-lesson\.mp4$/);
      expect(pathResult).not.toContain('/storage/v1/object/public/');
    });

    it('getSecureSubmissionUrl preserves external links (YouTube, Vimeo, Google Drive)', async () => {
      const youtubeUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      const result = await getSecureSubmissionUrl(youtubeUrl);
      expect(result).toBe(youtubeUrl);
      expect(mockStorageFrom).not.toHaveBeenCalled();
    });

    it('getSecureSubmissionUrl generates signed URL for private submissions bucket', async () => {
      const createSignedUrlMock = vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://test.supabase.co/storage/v1/object/sign/submissions/user-1/submission.mp4?token=signed' },
        error: null,
      });
      mockStorageFrom.mockReturnValue({
        createSignedUrl: createSignedUrlMock,
      });

      const result = await getSecureSubmissionUrl('submissions/user-1/submission.mp4', 3600);
      expect(mockStorageFrom).toHaveBeenCalledWith('submissions');
      expect(createSignedUrlMock).toHaveBeenCalledWith('user-1/submission.mp4', 3600);
      expect(result).toBe('https://test.supabase.co/storage/v1/object/sign/submissions/user-1/submission.mp4?token=signed');
    });

    it('getSecureSubmissionUrl fails closed and throws an error if URL signing fails (never returns raw storage path)', async () => {
      const createSignedUrlMock = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Access denied: not authorized' },
      });
      mockStorageFrom.mockReturnValue({
        createSignedUrl: createSignedUrlMock,
      });

      await expect(
        getSecureSubmissionUrl('submissions/other-user/secret-cut.mp4', 3600)
      ).rejects.toThrow('Access denied: not authorized');
      expect(mockStorageFrom).toHaveBeenCalledWith('submissions');
    });
  });

  describe('Assignment Authoring, Dual-Column Sync & Cohort Scoping', () => {
    it('normalizeAssignmentRow mirrors instructions and description and retains cohort_id', () => {
      const fromInstructions = normalizeAssignmentRow({
        id: 'assign-1',
        lesson_id: 'lesson-1',
        cohort_id: 'cohort-1',
        module_id: 'module-1',
        title: 'Color Grading Challenge',
        instructions: 'Deliver a teal-and-orange grade with balanced skin tones',
        description: null,
        deadline: '2026-10-15T23:59:59Z',
      });

      expect(fromInstructions.instructions).toBe('Deliver a teal-and-orange grade with balanced skin tones');
      expect(fromInstructions.description).toBe('Deliver a teal-and-orange grade with balanced skin tones');
      expect(fromInstructions.cohort_id).toBe('cohort-1');
      expect(fromInstructions.module_id).toBe('module-1');

      const fromDescription = normalizeAssignmentRow({
        id: 'assign-2',
        lesson_id: 'lesson-2',
        cohort_id: 'cohort-2',
        title: 'Sound Design Challenge',
        instructions: null,
        description: 'Design Foley sound effects for 30s fight scene',
        deadline: null,
      });

      expect(fromDescription.instructions).toBe('Design Foley sound effects for 30s fight scene');
      expect(fromDescription.description).toBe('Design Foley sound effects for 30s fight scene');
      expect(fromDescription.cohort_id).toBe('cohort-2');
    });

    it('createAssignment creates assignment with explicit cohort_id and dual instructions/description payload', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'assign-created-1',
              cohort_id: 'cohort-alpha',
              module_id: 'module-1',
              lesson_id: 'lesson-1',
              title: 'Multi-Cam Editing',
              instructions: 'Sync 4 cameras via audio waveform and cut multicam sequence',
              description: 'Sync 4 cameras via audio waveform and cut multicam sequence',
              deadline: '2026-11-01T23:59:59Z',
              created_at: '2026-09-28T12:00:00Z',
            },
            error: null,
          }),
        }),
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'assignments') {
          return { insert: mockInsert };
        }
        return { select: vi.fn() };
      });

      const assignment = await createAssignment({
        lesson_id: 'lesson-1',
        cohort_id: 'cohort-alpha',
        title: 'Multi-Cam Editing',
        instructions: 'Sync 4 cameras via audio waveform and cut multicam sequence',
        deadline: '2026-11-01T23:59:59Z',
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          lesson_id: 'lesson-1',
          cohort_id: 'cohort-alpha',
          title: 'Multi-Cam Editing',
          instructions: 'Sync 4 cameras via audio waveform and cut multicam sequence',
          description: 'Sync 4 cameras via audio waveform and cut multicam sequence',
          deadline: '2026-11-01T23:59:59Z',
        })
      );
      expect(assignment.id).toBe('assign-created-1');
      expect(assignment.cohort_id).toBe('cohort-alpha');
      expect(assignment.instructions).toBe('Sync 4 cameras via audio waveform and cut multicam sequence');
      expect(assignment.description).toBe('Sync 4 cameras via audio waveform and cut multicam sequence');
    });

    it('createAssignment auto-derives cohort_id and module_id from parent lesson if omitted by caller', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'assign-auto-cohort-1',
              cohort_id: 'cohort-derived-99',
              module_id: 'mod-parent-10',
              lesson_id: 'lesson-with-parent',
              title: 'Pacing Challenge',
              instructions: 'Cut a 60s trailer',
              description: 'Cut a 60s trailer',
              deadline: null,
              created_at: '2026-09-28T12:00:00Z',
            },
            error: null,
          }),
        }),
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'lessons') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: 'lesson-with-parent',
                    module_id: 'mod-parent-10',
                    modules: { cohort_id: 'cohort-derived-99' },
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'assignments') {
          return { insert: mockInsert };
        }
        return { select: vi.fn() };
      });

      const assignment = await createAssignment({
        lesson_id: 'lesson-with-parent',
        title: 'Pacing Challenge',
        instructions: 'Cut a 60s trailer',
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          lesson_id: 'lesson-with-parent',
          cohort_id: 'cohort-derived-99',
          module_id: 'mod-parent-10',
          title: 'Pacing Challenge',
          instructions: 'Cut a 60s trailer',
          description: 'Cut a 60s trailer',
        })
      );
      expect(assignment.cohort_id).toBe('cohort-derived-99');
    });

    it('createAssignment falls back to legacy description schema if instructions column is missing', async () => {
      let callCount = 0;
      const mockInsert = vi.fn().mockImplementation((payload: Record<string, unknown>) => {
        callCount++;
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: '42703', message: 'column "instructions" of relation "assignments" does not exist' },
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'assign-legacy-1',
                cohort_id: 'cohort-leg',
                lesson_id: payload.lesson_id,
                title: payload.title,
                description: payload.description,
                deadline: payload.deadline,
                created_at: '2026-09-28T12:00:00Z',
              },
              error: null,
            }),
          }),
        };
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'assignments') {
          return { insert: mockInsert };
        }
        return { select: vi.fn() };
      });

      const assignment = await createAssignment({
        lesson_id: 'lesson-legacy',
        cohort_id: 'cohort-leg',
        title: 'Dialogue Clean-up',
        instructions: 'Remove plosives and hiss from lavalier track',
      });

      expect(callCount).toBe(2);
      expect(assignment.id).toBe('assign-legacy-1');
      expect(assignment.instructions).toBe('Remove plosives and hiss from lavalier track');
      expect(assignment.description).toBe('Remove plosives and hiss from lavalier track');
    });

    it('updateAssignment updates assignment with cohort_id and synced description/instructions', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'assign-update-1',
                cohort_id: 'cohort-updated',
                module_id: 'mod-1',
                lesson_id: 'lesson-1',
                title: 'Updated Assignment Title',
                instructions: 'Updated directions',
                description: 'Updated directions',
                deadline: '2026-12-01T00:00:00Z',
                created_at: '2026-09-28T12:00:00Z',
              },
              error: null,
            }),
          }),
        }),
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'assignments') {
          return { update: mockUpdate };
        }
        return { select: vi.fn() };
      });

      const updated = await updateAssignment('assign-update-1', {
        cohort_id: 'cohort-updated',
        title: 'Updated Assignment Title',
        instructions: 'Updated directions',
        deadline: '2026-12-01T00:00:00Z',
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          cohort_id: 'cohort-updated',
          title: 'Updated Assignment Title',
          instructions: 'Updated directions',
          description: 'Updated directions',
          deadline: '2026-12-01T00:00:00Z',
        })
      );
      expect(updated.title).toBe('Updated Assignment Title');
      expect(updated.cohort_id).toBe('cohort-updated');
    });

    it('listAssignments queries by cohort_id directly and normalizes items', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'assign-fast-1',
                cohort_id: 'cohort-query-1',
                module_id: 'mod-1',
                lesson_id: 'lesson-1',
                title: 'Direct Query Assignment',
                description: 'Description from canonical schema',
                instructions: null,
                deadline: '2026-11-15T00:00:00Z',
                created_at: '2026-09-28T12:00:00Z',
              },
            ],
            error: null,
          }),
        }),
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'assignments') {
          return { select: mockSelect };
        }
        return { select: vi.fn() };
      });

      const list = await listAssignments('cohort-query-1');

      expect(mockSelect).toHaveBeenCalled();
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe('assign-fast-1');
      expect(list[0].instructions).toBe('Description from canonical schema');
      expect(list[0].description).toBe('Description from canonical schema');
      expect(list[0].cohort_id).toBe('cohort-query-1');
    });

    it('listAssignmentsByLesson queries by lesson_id and normalizes dual-columns', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'assign-lesson-1',
                cohort_id: 'cohort-1',
                lesson_id: 'lesson-target',
                title: 'Lesson Assignment',
                description: 'Lesson instructions',
                instructions: null,
                deadline: null,
                created_at: '2026-09-28T12:00:00Z',
              },
            ],
            error: null,
          }),
        }),
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'assignments') {
          return { select: mockSelect };
        }
        return { select: vi.fn() };
      });

      const list = await listAssignmentsByLesson('lesson-target');
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe('assign-lesson-1');
      expect(list[0].instructions).toBe('Lesson instructions');
      expect(list[0].description).toBe('Lesson instructions');
    });

    it('listAllAssignments retrieves all assignments with descending created_at', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'assign-all-1',
              cohort_id: 'cohort-1',
              lesson_id: 'lesson-1',
              title: 'All Assignments 1',
              instructions: 'Instructions 1',
              deadline: null,
              created_at: '2026-09-28T12:00:00Z',
            },
          ],
          error: null,
        }),
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'assignments') {
          return { select: mockSelect };
        }
        return { select: vi.fn() };
      });

      const all = await listAllAssignments();
      expect(all).toHaveLength(1);
      expect(all[0].title).toBe('All Assignments 1');
      expect(all[0].description).toBe('Instructions 1');
    });

    it('deleteAssignment deletes assignment by ID', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'assignments') {
          return { delete: mockDelete };
        }
        return { select: vi.fn() };
      });

      await deleteAssignment('assign-del-1');
      expect(mockDelete).toHaveBeenCalled();
    });
  });

  describe('Feedback Schema Reconciliation, Replies & Read Tracking', () => {
    it('listMySubmissions falls back to comment column if comments column fails', async () => {
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'submissions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'sub-legacy-1',
                      assignment_id: 'assign-1',
                      student_id: 'student-1',
                      file_url: 'https://cdn.cutcraft.com/sub1.mp4',
                      status: 'reviewed',
                      created_at: '2026-09-28T10:00:00Z',
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }

        if (table === 'feedback') {
          return {
            select: vi.fn().mockImplementation((columns: string) => {
              // If querying enhanced columns (with comments) or legacy comments, simulate missing column error
              if (columns.includes('comments')) {
                return {
                  in: vi.fn().mockReturnValue({
                    order: vi.fn().mockResolvedValue({
                      data: null,
                      error: { message: 'column "comments" does not exist' },
                    }),
                  }),
                };
              }
              // Fallback query requesting 'comment' column
              if (columns.includes('comment')) {
                return {
                  in: vi.fn().mockReturnValue({
                    order: vi.fn().mockResolvedValue({
                      data: [
                        {
                          id: 'fb-legacy-1',
                          submission_id: 'sub-legacy-1',
                          mentor_id: 'mentor-1',
                          comment: 'Excellent sound balance and smooth cut.',
                          created_at: '2026-09-28T11:00:00Z',
                        },
                      ],
                      error: null,
                    }),
                  }),
                };
              }
              return { in: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
            }),
          };
        }

        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [{ id: 'mentor-1', full_name: 'Mentor Sarah' }],
                error: null,
              }),
            }),
          };
        }

        if (table === 'feedback_replies') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          };
        }

        return {};
      });

      const subs = await listMySubmissions('student-1');
      expect(subs).toHaveLength(1);
      expect(subs[0].feedback).toBe('Excellent sound balance and smooth cut.');
      expect(subs[0].feedback_history).toHaveLength(1);
      expect(subs[0].feedback_history![0].comments).toBe('Excellent sound balance and smooth cut.');
      expect(subs[0].feedback_history![0].mentor_name).toBe('Mentor Sarah');
    });

    it('listMySubmissions loads and binds replies from feedback_replies table', async () => {
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'submissions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'sub-thread-1',
                      assignment_id: 'assign-1',
                      student_id: 'student-1',
                      file_url: 'https://cdn.cutcraft.com/sub2.mp4',
                      status: 'resubmit',
                      created_at: '2026-09-28T10:00:00Z',
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }

        if (table === 'feedback') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'fb-thread-1',
                      submission_id: 'sub-thread-1',
                      mentor_id: 'mentor-1',
                      comments: 'Pacing slows down significantly between 01:10 and 01:45.',
                      rubric: { pacing: 3, story: 4 },
                      timestamped_notes: [{ timestamp: '01:15', note: 'Cut away earlier' }],
                      student_read_at: null,
                      created_at: '2026-09-28T11:00:00Z',
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }

        if (table === 'feedback_replies') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'reply-1',
                      feedback_id: 'fb-thread-1',
                      author_id: 'student-1',
                      message: 'Got it! Trimming that dialogue pause now.',
                      created_at: '2026-09-28T11:30:00Z',
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }

        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [
                  { id: 'mentor-1', full_name: 'Mentor Dave', role: 'mentor' },
                  { id: 'student-1', full_name: 'Alice Student', role: 'student' },
                ],
                error: null,
              }),
            }),
          };
        }

        return {};
      });

      const subs = await listMySubmissions('student-1');
      expect(subs).toHaveLength(1);
      const history = subs[0].feedback_history!;
      expect(history).toHaveLength(1);
      expect(history[0].replies).toHaveLength(1);
      expect(history[0].replies![0].message).toBe('Got it! Trimming that dialogue pause now.');
      expect(history[0].replies![0].author_name).toBe('Alice Student');
    });

    it('addFeedbackReply inserts new reply and returns hydrated author info', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'rep-new-1',
              feedback_id: 'fb-123',
              author_id: 'user-alice',
              message: 'Thanks for the critique!',
              created_at: '2026-09-28T12:00:00Z',
            },
            error: null,
          }),
        }),
      });

      const mockProfileQuery = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { full_name: 'Alice Wonder', role: 'student' },
            error: null,
          }),
        }),
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'feedback_replies') {
          return { insert: mockInsert };
        }
        if (table === 'profiles') {
          return { select: mockProfileQuery };
        }
        return {};
      });

      const result = await addFeedbackReply('fb-123', 'user-alice', 'Thanks for the critique!');
      expect(mockInsert).toHaveBeenCalledWith({
        feedback_id: 'fb-123',
        author_id: 'user-alice',
        message: 'Thanks for the critique!',
      });
      expect(result.id).toBe('rep-new-1');
      expect(result.author_name).toBe('Alice Wonder');
      expect(result.author_role).toBe('student');
    });

    it('listFeedbackReplies returns all thread replies formatted with authors', async () => {
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'feedback_replies') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'rep-1',
                      feedback_id: 'fb-thread-2',
                      author_id: 'mentor-1',
                      message: 'Check clip alignment at 00:32.',
                      created_at: '2026-09-28T10:00:00Z',
                    },
                    {
                      id: 'rep-2',
                      feedback_id: 'fb-thread-2',
                      author_id: 'student-1',
                      message: 'Aligned and re-uploaded!',
                      created_at: '2026-09-28T10:15:00Z',
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }

        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [
                  { id: 'mentor-1', full_name: 'Coach Rick', role: 'mentor' },
                  { id: 'student-1', full_name: 'Sam Student', role: 'student' },
                ],
                error: null,
              }),
            }),
          };
        }

        return {};
      });

      const replies = await listFeedbackReplies('fb-thread-2');
      expect(replies).toHaveLength(2);
      expect(replies[0].author_name).toBe('Coach Rick');
      expect(replies[1].author_name).toBe('Sam Student');
      expect(replies[1].message).toBe('Aligned and re-uploaded!');
    });

    it('markFeedbackRead calls RPC and falls back to table update if RPC fails', async () => {
      // 1. Successful RPC path
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: null,
        error: null,
      });

      await markFeedbackRead('fb-read-1');
      expect(supabase.rpc).toHaveBeenCalledWith('mark_feedback_as_read', {
        p_feedback_id: 'fb-read-1',
      });

      // 2. RPC failure path -> direct table fallback
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: null,
        error: { message: 'function mark_feedback_as_read does not exist' },
      });

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'feedback') {
          return { update: mockUpdate };
        }
        return {};
      });

      await markFeedbackRead('fb-read-2');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          student_read_at: expect.any(String),
        })
      );
    });
  });
});


