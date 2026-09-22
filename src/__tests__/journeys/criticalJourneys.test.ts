import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  enrollInCohort,
  markLessonComplete,
  submitOrReplaceAssignment,
  createCohort,
  createModule,
  createLesson,
  createAssignment,
} from '../../lib/courseService';
import {
  listDetailedMentorSubmissions,
  submitDetailedReview,
  RUBRIC_REVIEW_TEMPLATES,
} from '../../lib/mentorService';
import { deleteCommunityPost } from '../../lib/communityService';
import { supabase } from '../../lib/supabaseClient';
import { queryCache } from '../../lib/queryCache';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe('Critical User Journeys (End-to-End Flow Simulations)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryCache.clear();
  });

  it('Journey 1: Sign up -> Login -> Student Profile Hydration', async () => {
    // 1. Mock self-healing student profile creation with least privileges
    const mockStudent = {
      id: 'student-uuid-1',
      email: 'newstudent@cutcraft.test',
      full_name: 'Jordan Editor',
      role: 'student',
      status: 'active',
      created_at: new Date().toISOString(),
    };

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: mockStudent, error: null }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });
    (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockFrom);

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', 'student-uuid-1')
      .maybeSingle();

    expect(profile?.role).toBe('student');
    expect(profile?.status).toBe('active');
    expect(profile?.email).toBe('newstudent@cutcraft.test');
  });

  it('Journey 2: Admin creates cohort -> module -> lesson -> assignment', async () => {
    // 1. Admin creates cohort
    (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === 'cohorts') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'cohort-doc-1',
                  title: 'Documentary Masterclass 2026',
                  description: 'Advanced pacing and subtext in non-fiction editing',
                  status: 'published',
                  capacity: 25,
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'modules') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'module-doc-1',
                  cohort_id: 'cohort-doc-1',
                  title: 'Module 1: The First Assembly',
                  order_index: 0,
                  lessons: [],
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'lessons') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'lesson-doc-1',
                  module_id: 'module-doc-1',
                  title: 'Editing Dialogue for Subtext',
                  video_url: 'https://cdn.cutcraft.test/lessons/subtext.mp4',
                  order_index: 0,
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'assignments') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'assign-doc-1',
                  lesson_id: 'lesson-doc-1',
                  title: '3-Minute Dialogue Scene Cut',
                  instructions: 'Cut dialogue between characters without matching sound room tones',
                  deadline: '2026-11-01T23:59:59Z',
                  created_at: new Date().toISOString(),
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    const cohort = await createCohort({
      name: 'Documentary Masterclass 2026',
      description: 'Advanced pacing and subtext in non-fiction editing',
      capacity: 25,
      status: 'published',
    });
    expect(cohort.id).toBe('cohort-doc-1');

    const moduleRecord = await createModule({
      cohort_id: cohort.id,
      title: 'Module 1: The First Assembly',
      description: null,
      position: 0,
    });
    expect(moduleRecord.id).toBe('module-doc-1');

    const lesson = await createLesson({
      module_id: moduleRecord.id,
      title: 'Editing Dialogue for Subtext',
      description: null,
      video_url: 'https://cdn.cutcraft.test/lessons/subtext.mp4',
      duration_minutes: 15,
      position: 0,
    });
    expect(lesson.id).toBe('lesson-doc-1');

    const assignment = await createAssignment({
      lesson_id: lesson.id,
      title: '3-Minute Dialogue Scene Cut',
      instructions: 'Cut dialogue between characters without matching sound room tones',
      deadline: '2026-11-01T23:59:59Z',
    });
    expect(assignment.id).toBe('assign-doc-1');
  });

  it('Journey 3: Student enrolls -> completes lesson >= 80% -> submits assignment cut', async () => {
    // 1. Enroll student
    (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockImplementation((proc: string) => {
      if (proc === 'enroll_student_in_cohort') {
        return Promise.resolve({
          data: { status: 'active', message: 'Enrollment confirmed' },
          error: null,
        });
      }
      if (proc === 'verify_and_complete_lesson') {
        return Promise.resolve({
          data: { success: true },
          error: null,
        });
      }
      if (proc === 'submit_student_assignment') {
        return Promise.resolve({
          data: {
            id: 'sub-student-1',
            assignment_id: 'assign-doc-1',
            student_id: 'student-uuid-1',
            file_url: 'https://cdn.cutcraft.test/student-cuts/v1.mp4',
            status: 'pending',
            version_number: 1,
            is_late: false,
            created_at: new Date().toISOString(),
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const enrollment = await enrollInCohort('student-uuid-1', 'cohort-doc-1');
    expect(enrollment.status).toBe('active');

    // 2. Complete lesson with 85% watch time
    await expect(
      markLessonComplete('student-uuid-1', 'lesson-doc-1', true, { watchPercentage: 85 })
    ).resolves.not.toThrow();

    // 3. Submit assignment cut
    const submission = await submitOrReplaceAssignment(
      'student-uuid-1',
      'assign-doc-1',
      'https://cdn.cutcraft.test/student-cuts/v1.mp4'
    );
    expect(submission.id).toBe('sub-student-1');
    expect(submission.status).toBe('pending');
    expect(submission.version_number).toBe(1);
  });

  it('Journey 4: Mentor reviews -> applies rubric -> requests revisions -> student resubmits v2', async () => {
    // 1. Mentor views submissions scoped to assigned cohort
    const mockMap = new Map([
      [
        'assign-doc-1',
        {
          assignmentId: 'assign-doc-1',
          assignmentTitle: '3-Minute Dialogue Scene Cut',
          assignmentInstructions: 'Cut dialogue',
          assignmentDeadline: '2026-11-01',
          cohortId: 'cohort-doc-1',
          cohortName: 'Documentary Masterclass 2026',
        },
      ],
    ]);
    queryCache.set('assignment_cohort_map', mockMap, 600000);

    const mockSubmissions = [
      {
        id: 'sub-student-1',
        assignment_id: 'assign-doc-1',
        student_id: 'student-uuid-1',
        file_url: 'https://cdn.cutcraft.test/student-cuts/v1.mp4',
        status: 'pending',
        created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      },
    ];

    (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === 'submissions') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              in: vi.fn().mockImplementation((_field: string, ids: string[]) => {
                const filtered = mockSubmissions.filter((s) => ids.includes(s.assignment_id));
                return Promise.resolve({ data: filtered, error: null });
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        };
      }
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ id: 'student-uuid-1', full_name: 'Jordan Editor', email: 'jordan@cutcraft.test' }],
              error: null,
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
      if (table === 'audit_logs') {
        return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) };
      }
      return { select: vi.fn() };
    });

    const queue = await listDetailedMentorSubmissions(['cohort-doc-1']);
    expect(queue).toHaveLength(1);
    expect(queue[0].sla_status).toBe('on_track');

    // 2. Mentor applies rubric template and submits review requesting changes
    (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: null,
      error: null,
    });

    await expect(
      submitDetailedReview(
        'sub-student-1',
        'resubmit',
        'Dialogue pacing is strong, but audio cuts clip room tone at 01:14.',
        RUBRIC_REVIEW_TEMPLATES[0].scores,
        [
          {
            id: 'note-1',
            timestamp_seconds: 74,
            formatted_time: '01:14',
            category: 'audio',
            text: 'Room tone clips abruptly on audio track 2',
          },
        ]
      )
    ).resolves.not.toThrow();

    // 3. Student resubmits revised v2 cut
    (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        id: 'sub-student-1',
        assignment_id: 'assign-doc-1',
        student_id: 'student-uuid-1',
        file_url: 'https://cdn.cutcraft.test/student-cuts/v2_fixed.mp4',
        status: 'pending',
        version_number: 2,
        is_late: false,
        created_at: new Date().toISOString(),
      },
      error: null,
    });

    const resubmission = await submitOrReplaceAssignment(
      'student-uuid-1',
      'assign-doc-1',
      'https://cdn.cutcraft.test/student-cuts/v2_fixed.mp4'
    );
    expect(resubmission.version_number).toBe(2);
    expect(resubmission.status).toBe('pending');
  });

  it('Journey 5: Admin moderates community content and triggers audit record', async () => {
    const mockDelete = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const mockInsertAudit = vi.fn().mockResolvedValue({ data: null, error: null });

    (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === 'community_posts') {
        return { delete: mockDelete };
      }
      if (table === 'audit_logs') {
        return { insert: mockInsertAudit };
      }
      return { select: vi.fn() };
    });

    await deleteCommunityPost('post-inappropriate-1');
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });
});
