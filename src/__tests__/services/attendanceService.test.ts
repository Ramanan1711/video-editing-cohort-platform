import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkInToSession,
  markStudentAttendance,
  bulkMarkAttendance,
  getSessionAttendanceRoster,
  getSessionAttendanceSummary,
  getCohortAttendanceReport,
  getStudentAttendanceHistory,
} from '../../lib/attendanceService';
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

describe('Attendance Service: Live Sessions & Roster Reporting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkInToSession', () => {
    it('successfully calls check_in_to_session RPC when available', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          id: 'att-1',
          session_id: 'sess-101',
          student_id: 'stud-1',
          status: 'present',
          join_time: '2026-09-29T10:00:00Z',
          duration_minutes: 1,
          check_in_method: 'self_check_in',
        },
        error: null,
      });

      const res = await checkInToSession('sess-101');
      expect(supabase.rpc).toHaveBeenCalledWith('check_in_to_session', {
        p_session_id: 'sess-101',
        p_method: 'self_check_in',
      });
      expect(res.id).toBe('att-1');
      expect(res.status).toBe('present');
    });

    it('falls back to direct table upsert if RPC is unmigrated or fails', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: null,
        error: { message: 'function check_in_to_session does not exist' },
      });

      (supabase.auth.getUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { user: { id: 'stud-2' } },
        error: null,
      });

      const mockSelect = vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { cohort_id: 'cohort-1' },
          error: null,
        }),
      });

      const mockUpsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'att-fallback-2',
              session_id: 'sess-102',
              student_id: 'stud-2',
              cohort_id: 'cohort-1',
              status: 'present',
              duration_minutes: 1,
              check_in_method: 'self_check_in',
            },
            error: null,
          }),
        }),
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'live_sessions') {
          return { select: vi.fn().mockReturnValue({ eq: mockSelect }) };
        }
        if (table === 'session_attendance') {
          return { upsert: mockUpsert };
        }
        return {};
      });

      const res = await checkInToSession('sess-102');
      expect(res.id).toBe('att-fallback-2');
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          session_id: 'sess-102',
          student_id: 'stud-2',
          cohort_id: 'cohort-1',
          status: 'present',
        }),
        expect.any(Object)
      );
    });
  });

  describe('markStudentAttendance', () => {
    it('calls mark_student_attendance RPC with normalized parameters', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          id: 'att-mark-1',
          session_id: 'sess-101',
          student_id: 'stud-1',
          status: 'late',
          notes: 'Joined 15m in',
          duration_minutes: 45,
        },
        error: null,
      });

      const res = await markStudentAttendance({
        sessionId: 'sess-101',
        studentId: 'stud-1',
        status: 'late',
        notes: 'Joined 15m in',
        durationMinutes: 45,
      });

      expect(supabase.rpc).toHaveBeenCalledWith('mark_student_attendance', {
        p_session_id: 'sess-101',
        p_student_id: 'stud-1',
        p_status: 'late',
        p_notes: 'Joined 15m in',
        p_duration_minutes: 45,
      });
      expect(res.status).toBe('late');
      expect(res.notes).toBe('Joined 15m in');
    });

    it('falls back to direct table upsert if RPC fails', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: null,
        error: { message: 'function mark_student_attendance does not exist' },
      });

      (supabase.auth.getUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { user: { id: 'mentor-1' } },
        error: null,
      });

      const mockUpsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'att-mark-2',
              session_id: 'sess-101',
              student_id: 'stud-2',
              status: 'excused',
              notes: 'Family emergency',
              verified_by: 'mentor-1',
            },
            error: null,
          }),
        }),
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'session_attendance') {
          return { upsert: mockUpsert };
        }
        return {};
      });

      const res = await markStudentAttendance({
        sessionId: 'sess-101',
        studentId: 'stud-2',
        status: 'excused',
        notes: 'Family emergency',
      });

      expect(res.status).toBe('excused');
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          session_id: 'sess-101',
          student_id: 'stud-2',
          status: 'excused',
          verified_by: 'mentor-1',
        }),
        expect.any(Object)
      );
    });
  });

  describe('bulkMarkAttendance', () => {
    it('executes bulk_mark_attendance RPC for cohort roster', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: 3,
        error: null,
      });

      const count = await bulkMarkAttendance('sess-101', [
        { studentId: 's1', status: 'present' },
        { studentId: 's2', status: 'late', notes: '10 min late' },
        { studentId: 's3', status: 'absent' },
      ]);

      expect(supabase.rpc).toHaveBeenCalledWith('bulk_mark_attendance', {
        p_session_id: 'sess-101',
        p_records: [
          { student_id: 's1', status: 'present', notes: null, duration_minutes: 0 },
          { student_id: 's2', status: 'late', notes: '10 min late', duration_minutes: 0 },
          { student_id: 's3', status: 'absent', notes: null, duration_minutes: 0 },
        ],
      });
      expect(count).toBe(3);
    });
  });

  describe('getSessionAttendanceRoster', () => {
    it('hydrates student profiles and defaults unenrolled students to absent', async () => {
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'session_attendance') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'att-1',
                    session_id: 'sess-1',
                    student_id: 'user-1',
                    status: 'present',
                    join_time: '2026-09-29T10:00:00Z',
                    duration_minutes: 60,
                  },
                ],
                error: null,
              }),
            }),
          };
        }

        if (table === 'enrollments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({
                  data: [{ user_id: 'user-1' }, { user_id: 'user-2' }],
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
                  { id: 'user-1', full_name: 'John Doe', email: 'john@example.com' },
                  { id: 'user-2', full_name: 'Jane Smith', email: 'jane@example.com' },
                ],
                error: null,
              }),
            }),
          };
        }

        return {};
      });

      const roster = await getSessionAttendanceRoster('sess-1', 'cohort-1');
      expect(roster).toHaveLength(2);

      const john = roster.find((r) => r.student_id === 'user-1');
      expect(john?.student_name).toBe('John Doe');
      expect(john?.status).toBe('present');

      const jane = roster.find((r) => r.student_id === 'user-2');
      expect(jane?.student_name).toBe('Jane Smith');
      expect(jane?.status).toBe('absent'); // Defaulted because unrecorded
    });
  });

  describe('getSessionAttendanceSummary', () => {
    it('calls get_session_attendance_summary RPC and returns metrics', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          session_id: 'sess-1',
          session_title: 'Sprint 1 Kickoff',
          total_students: 20,
          present_count: 15,
          late_count: 3,
          absent_count: 2,
          excused_count: 0,
          attendance_rate_pct: 90.0,
        },
        error: null,
      });

      const summary = await getSessionAttendanceSummary('sess-1');
      expect(supabase.rpc).toHaveBeenCalledWith('get_session_attendance_summary', {
        p_session_id: 'sess-1',
      });
      expect(summary.total_students).toBe(20);
      expect(summary.attendance_rate_pct).toBe(90.0);
    });
  });

  describe('getCohortAttendanceReport', () => {
    it('calls get_cohort_attendance_report RPC and returns student summaries', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: [
          {
            student_id: 'user-1',
            student_name: 'Alice',
            student_email: 'alice@example.com',
            sessions_held: 10,
            attended_count: 9,
            attendance_rate_pct: 90.0,
            last_attended_at: '2026-09-28T10:00:00Z',
          },
        ],
        error: null,
      });

      const report = await getCohortAttendanceReport('cohort-1');
      expect(supabase.rpc).toHaveBeenCalledWith('get_cohort_attendance_report', {
        p_cohort_id: 'cohort-1',
      });
      expect(report).toHaveLength(1);
      expect(report[0].student_name).toBe('Alice');
      expect(report[0].attendance_rate_pct).toBe(90.0);
    });
  });

  describe('getStudentAttendanceHistory', () => {
    it('returns student attendance history hydrated with session titles', async () => {
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'session_attendance') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'att-1',
                      session_id: 'sess-1',
                      student_id: 'stud-1',
                      status: 'present',
                      created_at: '2026-09-20T10:00:00Z',
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }

        if (table === 'live_sessions') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [{ id: 'sess-1', title: 'Color Grading Masterclass', starts_at: '2026-09-20T10:00:00Z' }],
                error: null,
              }),
            }),
          };
        }

        return {};
      });

      const history = await getStudentAttendanceHistory('stud-1');
      expect(history).toHaveLength(1);
      expect(history[0].session_title).toBe('Color Grading Masterclass');
      expect(history[0].status).toBe('present');
    });
  });
});
