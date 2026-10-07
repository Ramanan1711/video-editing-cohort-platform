import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getStudentCourseData } from '../../lib/services/lessonProgressService';
import { supabase } from '../../lib/supabaseClient';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('Course Enrollment Access Guard (Paid-Only Policy Enforcement)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows access to paid/enrolled course data', async () => {
    const mockEnrollments = [
      { cohort_id: 'cohort-java', status: 'active', created_at: '2026-09-01T00:00:00Z' },
    ];
    const mockCohorts = [
      { id: 'cohort-java', title: 'Java Masterclass', description: 'Comprehensive Java Course' },
    ];
    const mockModules = [
      {
        id: 'mod-1',
        cohort_id: 'cohort-java',
        title: 'Core Java',
        position: 1,
        lessons: [
          { id: 'les-1', title: 'Variables & Data Types', position: 1, video_url: 'https://cdn.example.com/java1.mp4' },
        ],
      },
    ];

    (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === 'enrollments') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockEnrollments, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'cohorts') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockCohorts, error: null }),
            }),
          }),
        };
      }
      if (table === 'modules') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockModules, error: null }),
            }),
          }),
        };
      }
      if (table === 'lesson_progress') {
        const query = {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
        return query;
      }
      return { select: vi.fn() };
    });

    const result = await getStudentCourseData('user-student-1', 'cohort-java');
    expect(result.cohort).not.toBeNull();
    expect(result.cohort?.id).toBe('cohort-java');
    expect(result.modules).toHaveLength(1);
    expect(result.modules[0].title).toBe('Core Java');
    expect(result.enrolledCohorts).toHaveLength(1);
  });

  it('strictly blocks access to unpaid courses when student is enrolled in another course', async () => {
    // Student only paid for Java
    const mockEnrollments = [
      { cohort_id: 'cohort-java', status: 'active', created_at: '2026-09-01T00:00:00Z' },
    ];
    const mockCohorts = [
      { id: 'cohort-java', title: 'Java Masterclass', description: 'Comprehensive Java Course' },
    ];

    (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === 'enrollments') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockEnrollments, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'cohorts') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockCohorts, error: null }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    // Student requests unpaid Python cohort
    const result = await getStudentCourseData('user-student-1', 'cohort-python-unpaid');

    // Must NOT leak modules or fall back silently to Java as the target cohort
    expect(result.cohort).toBeNull();
    expect(result.modules).toEqual([]);
    expect(result.progress).toEqual([]);
    expect(result.enrolledCohorts).toHaveLength(1);
    expect(result.enrolledCohorts[0].id).toBe('cohort-java');
  });

  it('supports multi-course enrollment: permits access to both Course A and Course B when paid, while blocking Course C', async () => {
    // Student paid for both Java and Python
    const mockEnrollments = [
      { cohort_id: 'cohort-java', status: 'active', created_at: '2026-09-01T00:00:00Z' },
      { cohort_id: 'cohort-python', status: 'active', created_at: '2026-09-10T00:00:00Z' },
    ];
    const mockCohorts = [
      { id: 'cohort-java', title: 'Java Masterclass', description: 'Comprehensive Java Course' },
      { id: 'cohort-python', title: 'Python for AI', description: 'Comprehensive Python Course' },
    ];
    const mockJavaModules = [
      { id: 'mod-java', cohort_id: 'cohort-java', title: 'Java Basics', position: 1, lessons: [] },
    ];
    const mockPythonModules = [
      { id: 'mod-python', cohort_id: 'cohort-python', title: 'Python Basics', position: 1, lessons: [] },
    ];

    (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === 'enrollments') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockEnrollments, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'cohorts') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockCohorts, error: null }),
            }),
          }),
        };
      }
      if (table === 'modules') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((_col: string, val: string) => ({
              order: vi.fn().mockResolvedValue({
                data: val === 'cohort-java' ? mockJavaModules : val === 'cohort-python' ? mockPythonModules : [],
                error: null,
              }),
            })),
          }),
        };
      }
      return { select: vi.fn() };
    });

    // 1. Access Java (paid)
    const javaResult = await getStudentCourseData('user-student-1', 'cohort-java');
    expect(javaResult.cohort?.id).toBe('cohort-java');
    expect(javaResult.modules[0].title).toBe('Java Basics');

    // 2. Access Python (paid)
    const pythonResult = await getStudentCourseData('user-student-1', 'cohort-python');
    expect(pythonResult.cohort?.id).toBe('cohort-python');
    expect(pythonResult.modules[0].title).toBe('Python Basics');

    // 3. Attempt to access Rust (unpaid)
    const rustResult = await getStudentCourseData('user-student-1', 'cohort-rust-unpaid');
    expect(rustResult.cohort).toBeNull();
    expect(rustResult.modules).toEqual([]);
  });
});

