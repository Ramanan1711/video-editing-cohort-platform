import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getUserProfileOverview,
  updateUserProfileContact,
} from '../../lib/userProfileService';
import { supabase } from '../../lib/supabaseClient';
import * as attendanceModule from '../../lib/attendanceService';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock('../../lib/attendanceService', () => ({
  getStudentAttendanceHistory: vi.fn(),
}));

describe('User Profile Service (Multi-Course Enrollment, Attendance & Fee Aggregation)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('aggregates single course enrollment (JAVA total 1) with fee and attendance', async () => {
    const mockUserId = 'user-student-123';

    // 1. Mock profiles query
    const profileSelectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: mockUserId,
            email: 'java.dev@example.com',
            full_name: 'Java Developer',
            role: 'student',
            status: 'active',
            whatsapp_number: '+91 99999 11111',
            created_at: '2026-09-01T00:00:00Z',
          },
          error: null,
        }),
      }),
    });

    // 2. Mock enrollments query (1 Java course)
    const enrollmentsSelectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: [
          {
            cohort_id: 'cohort-java-1',
            status: 'enrolled',
            enrolled_at: '2026-09-10T00:00:00Z',
            created_at: '2026-09-10T00:00:00Z',
          },
        ],
        error: null,
      }),
    });

    // 3. Mock cohorts query
    const cohortsSelectMock = vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'cohort-java-1',
            title: 'JAVA Backend Masterclass',
            name: 'JAVA Backend Masterclass',
            description: 'Master Java 21, Spring Boot & Microservices',
            price_inr: 4999,
            currency: 'INR',
            status: 'active',
          },
        ],
        error: null,
      }),
    });

    // 4. Mock payments query (1 captured payment of 499900 paise = 4999 INR)
    const paymentsSelectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'pay-uuid-1',
              order_id: 'order_java_001',
              payment_id: 'pay_rzp_java_001',
              cohort_id: 'cohort-java-1',
              amount: 499900,
              currency: 'INR',
              status: 'captured',
              provider: 'razorpay',
              receipt: 'rcpt_001',
              created_at: '2026-09-10T00:00:00Z',
            },
          ],
          error: null,
        }),
      }),
    });

    // 5. Mock modules & lesson progress
    const modulesSelectMock = vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({
        data: [
          { id: 'mod-1', cohort_id: 'cohort-java-1', lessons: [{ id: 'les-1' }, { id: 'les-2' }] },
        ],
        error: null,
      }),
    });

    const progressSelectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: [{ lesson_id: 'les-1', completed: true }],
        error: null,
      }),
    });

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'profiles') return { select: profileSelectMock } as unknown as ReturnType<typeof supabase.from>;
      if (table === 'enrollments') return { select: enrollmentsSelectMock } as unknown as ReturnType<typeof supabase.from>;
      if (table === 'cohorts') return { select: cohortsSelectMock } as unknown as ReturnType<typeof supabase.from>;
      if (table === 'payments') return { select: paymentsSelectMock } as unknown as ReturnType<typeof supabase.from>;
      if (table === 'modules') return { select: modulesSelectMock } as unknown as ReturnType<typeof supabase.from>;
      if (table === 'lesson_progress') return { select: progressSelectMock } as unknown as ReturnType<typeof supabase.from>;
      return { select: vi.fn() } as unknown as ReturnType<typeof supabase.from>;
    });

    // Mock attendance history (2 sessions, 2 present)
    vi.mocked(attendanceModule.getStudentAttendanceHistory).mockResolvedValue([
      {
        id: 'att-1',
        session_id: 'sess-1',
        session_title: 'Java Concurrency & Threads',
        session_starts_at: '2026-09-12T10:00:00Z',
        student_id: mockUserId,
        status: 'present',
        join_time: '2026-09-12T10:02:00Z',
        duration_minutes: 60,
        notes: null,
        verified_by: null,
        check_in_method: 'self_check_in',
        created_at: '2026-09-12T10:00:00Z',
        updated_at: '2026-09-12T10:00:00Z',
      },
      {
        id: 'att-2',
        session_id: 'sess-2',
        session_title: 'Spring Security Deep Dive',
        session_starts_at: '2026-09-15T10:00:00Z',
        student_id: mockUserId,
        status: 'present',
        join_time: '2026-09-15T10:00:00Z',
        duration_minutes: 90,
        notes: null,
        verified_by: 'mentor-1',
        check_in_method: 'mentor_marked',
        created_at: '2026-09-15T10:00:00Z',
        updated_at: '2026-09-15T10:00:00Z',
      },
    ]);

    const result = await getUserProfileOverview(mockUserId);

    expect(result.user.fullName).toBe('Java Developer');
    expect(result.user.email).toBe('java.dev@example.com');
    // Multi-course logic: 1 enrolled course
    expect(result.stats.enrolledCount).toBe(1);
    expect(result.enrolledCourses).toHaveLength(1);
    expect(result.enrolledCourses[0].cohortTitle).toBe('JAVA Backend Masterclass');
    expect(result.enrolledCourses[0].progressPercent).toBe(50); // 1 out of 2 lessons completed

    // Fee paid verification: 4999 INR
    expect(result.stats.totalFeePaidInr).toBe(4999);
    expect(result.payments).toHaveLength(1);
    expect(result.payments[0].amountInr).toBe(4999);
    expect(result.payments[0].status).toBe('captured');

    // Attendance verification: 2 of 2 sessions = 100%
    expect(result.attendance.totalSessionsHeld).toBe(2);
    expect(result.attendance.attendedCount).toBe(2);
    expect(result.attendance.attendanceRatePct).toBe(100);
  });

  it('aggregates multi-course enrollment (JAVA + PYTHON total 2) dynamically', async () => {
    const mockUserId = 'user-polyglot-456';

    const profileSelectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: mockUserId,
            email: 'polyglot@example.com',
            full_name: 'Fullstack Dev',
            role: 'student',
            status: 'active',
            created_at: '2026-08-01T00:00:00Z',
          },
          error: null,
        }),
      }),
    });

    // 2 Enrollments: Java + Python
    const enrollmentsSelectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: [
          { cohort_id: 'cohort-java-1', status: 'enrolled', enrolled_at: '2026-08-10T00:00:00Z' },
          { cohort_id: 'cohort-python-2', status: 'enrolled', enrolled_at: '2026-09-01T00:00:00Z' },
        ],
        error: null,
      }),
    });

    const cohortsSelectMock = vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({
        data: [
          { id: 'cohort-java-1', title: 'JAVA Masterclass', price_inr: 4999, currency: 'INR' },
          { id: 'cohort-python-2', title: 'PYTHON AI Sprint', price_inr: 4999, currency: 'INR' },
        ],
        error: null,
      }),
    });

    // 2 Payments of 4999 INR = 9998 INR total
    const paymentsSelectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [
            { id: 'p1', order_id: 'ord_1', cohort_id: 'cohort-java-1', amount: 499900, status: 'captured', created_at: '2026-08-10T00:00:00Z' },
            { id: 'p2', order_id: 'ord_2', cohort_id: 'cohort-python-2', amount: 499900, status: 'captured', created_at: '2026-09-01T00:00:00Z' },
          ],
          error: null,
        }),
      }),
    });

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'profiles') return { select: profileSelectMock } as unknown as ReturnType<typeof supabase.from>;
      if (table === 'enrollments') return { select: enrollmentsSelectMock } as unknown as ReturnType<typeof supabase.from>;
      if (table === 'cohorts') return { select: cohortsSelectMock } as unknown as ReturnType<typeof supabase.from>;
      if (table === 'payments') return { select: paymentsSelectMock } as unknown as ReturnType<typeof supabase.from>;
      if (table === 'modules') return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [] }) }) } as unknown as ReturnType<typeof supabase.from>;
      if (table === 'lesson_progress') return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [] }) }) } as unknown as ReturnType<typeof supabase.from>;
      return { select: vi.fn() } as unknown as ReturnType<typeof supabase.from>;
    });

    vi.mocked(attendanceModule.getStudentAttendanceHistory).mockResolvedValue([]);

    const result = await getUserProfileOverview(mockUserId);

    // Assert: Lists both JAVA and PYTHON
    expect(result.stats.enrolledCount).toBe(2);
    expect(result.enrolledCourses).toHaveLength(2);
    const titles = result.enrolledCourses.map((c) => c.cohortTitle);
    expect(titles).toContain('JAVA Masterclass');
    expect(titles).toContain('PYTHON AI Sprint');

    // Total Fee Paid = 9998 INR
    expect(result.stats.totalFeePaidInr).toBe(9998);
    expect(result.payments).toHaveLength(2);
  });

  it('updates student profile contact details successfully', async () => {
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    vi.mocked(supabase.from).mockReturnValue({
      update: updateMock,
    } as unknown as ReturnType<typeof supabase.from>);

    await expect(
      updateUserProfileContact('user-1', {
        fullName: 'Updated Name',
        whatsappNumber: '+91 91234 56789',
      })
    ).resolves.not.toThrow();

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        full_name: 'Updated Name',
        whatsapp_number: '+91 91234 56789',
      })
    );
  });
});

