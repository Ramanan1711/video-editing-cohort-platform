import { supabase } from './supabaseClient';
import { parseDatabaseError } from './errorHandling';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
export type CheckInMethod = 'self_check_in' | 'mentor_marked' | 'admin_marked' | 'system' | 'code';

export interface SessionAttendanceRecord {
  id: string;
  session_id: string;
  session_title?: string;
  session_starts_at?: string;
  student_id: string;
  student_name?: string;
  student_email?: string;
  cohort_id?: string | null;
  status: AttendanceStatus;
  join_time: string | null;
  duration_minutes: number;
  notes: string | null;
  verified_by: string | null;
  verifier_name?: string;
  check_in_method: CheckInMethod;
  created_at: string;
  updated_at: string;
}

export interface SessionAttendanceSummary {
  session_id: string;
  session_title: string;
  total_students: number;
  present_count: number;
  late_count: number;
  absent_count: number;
  excused_count: number;
  attendance_rate_pct: number;
}

export interface StudentAttendanceSummary {
  student_id: string;
  student_name: string;
  student_email: string;
  sessions_held: number;
  attended_count: number;
  attendance_rate_pct: number;
  last_attended_at: string | null;
}

export interface AttendanceProfileRow {
  id: string;
  full_name?: string | null;
  email?: string | null;
}

export interface AttendanceEnrollmentRow {
  user_id: string;
}

export interface CohortAttendanceReportRpcRow {
  student_id: string;
  student_name: string;
  student_email: string;
  sessions_held: number | string;
  attended_count: number | string;
  attendance_rate_pct: number | string;
  last_attended_at?: string | null;
}

export interface LiveSessionBasicRow {
  id: string;
  title?: string | null;
  starts_at?: string | null;
}

/**
 * 1. Student self check-in to a live session
 */
export async function checkInToSession(
  sessionId: string,
  method: CheckInMethod = 'self_check_in'
): Promise<SessionAttendanceRecord> {
  // 1. Try canonical RPC check_in_to_session
  try {
    const { data, error } = await supabase.rpc('check_in_to_session', {
      p_session_id: sessionId,
      p_method: method,
    });

    if (!error && data) {
      return data as SessionAttendanceRecord;
    }
  } catch {
    // Fallback to direct table upsert
  }

  // Fallback: Direct table upsert
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) throw new Error('Authentication required to check into live session.');

  // Find session cohort
  const { data: session } = await supabase
    .from('live_sessions')
    .select('cohort_id')
    .eq('id', sessionId)
    .maybeSingle();

  const cohortId = session?.cohort_id || null;

  const now = new Date().toISOString();
  const { data: inserted, error: insertErr } = await supabase
    .from('session_attendance')
    .upsert(
      {
        session_id: sessionId,
        student_id: userId,
        cohort_id: cohortId,
        status: 'present',
        join_time: now,
        duration_minutes: 1,
        check_in_method: method,
        updated_at: now,
      },
      { onConflict: 'session_id,student_id' }
    )
    .select('*')
    .single();

  if (insertErr) throw parseDatabaseError(insertErr);
  return inserted as SessionAttendanceRecord;
}

/**
 * 2. Mark or update attendance for an individual student (Mentor / Admin)
 */
export async function markStudentAttendance(input: {
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  notes?: string;
  durationMinutes?: number;
}): Promise<SessionAttendanceRecord> {
  const { sessionId, studentId, status, notes, durationMinutes } = input;

  // Try authoritative RPC mark_student_attendance
  try {
    const { data, error } = await supabase.rpc('mark_student_attendance', {
      p_session_id: sessionId,
      p_student_id: studentId,
      p_status: status,
      p_notes: notes || null,
      p_duration_minutes: durationMinutes ?? 0,
    });

    if (!error && data) {
      return data as SessionAttendanceRecord;
    }
  } catch {
    // Fallback to direct table upsert
  }

  const { data: userData } = await supabase.auth.getUser();
  const actorId = userData?.user?.id || null;

  const now = new Date().toISOString();
  const { data: record, error: upsertErr } = await supabase
    .from('session_attendance')
    .upsert(
      {
        session_id: sessionId,
        student_id: studentId,
        status,
        notes: notes || null,
        duration_minutes: durationMinutes ?? 0,
        verified_by: actorId,
        check_in_method: 'mentor_marked',
        join_time: status === 'present' || status === 'late' ? now : null,
        updated_at: now,
      },
      { onConflict: 'session_id,student_id' }
    )
    .select('*')
    .single();

  if (upsertErr) throw parseDatabaseError(upsertErr);
  return record as SessionAttendanceRecord;
}

/**
 * 3. Bulk mark attendance for entire roster (Mentor / Admin)
 */
export async function bulkMarkAttendance(
  sessionId: string,
  records: Array<{
    studentId: string;
    status: AttendanceStatus;
    notes?: string;
    durationMinutes?: number;
  }>
): Promise<number> {
  if (!records.length) return 0;

  // Try RPC bulk_mark_attendance
  try {
    const payload = records.map((r) => ({
      student_id: r.studentId,
      status: r.status,
      notes: r.notes || null,
      duration_minutes: r.durationMinutes ?? 0,
    }));

    const { data, error } = await supabase.rpc('bulk_mark_attendance', {
      p_session_id: sessionId,
      p_records: payload,
    });

    if (!error && typeof data === 'number') {
      return data;
    }
  } catch {
    // Fallback to individual or table upsert
  }

  const { data: userData } = await supabase.auth.getUser();
  const actorId = userData?.user?.id || null;
  const now = new Date().toISOString();

  const rows = records.map((r) => ({
    session_id: sessionId,
    student_id: r.studentId,
    status: r.status,
    notes: r.notes || null,
    duration_minutes: r.durationMinutes ?? 0,
    verified_by: actorId,
    check_in_method: 'mentor_marked',
    join_time: r.status === 'present' || r.status === 'late' ? now : null,
    updated_at: now,
  }));

  const { error } = await supabase
    .from('session_attendance')
    .upsert(rows, { onConflict: 'session_id,student_id' });

  if (error) throw parseDatabaseError(error);
  return rows.length;
}

/**
 * 4. Get complete session attendance roster with student profiles and defaults
 */
export async function getSessionAttendanceRoster(
  sessionId: string,
  cohortId?: string | null
): Promise<SessionAttendanceRecord[]> {
  try {
    // Fetch session details if cohortId not provided
    let targetCohortId = cohortId;
    if (!targetCohortId) {
      const { data: session } = await supabase
        .from('live_sessions')
        .select('cohort_id')
        .eq('id', sessionId)
        .maybeSingle();
      targetCohortId = session?.cohort_id;
    }

    // Parallel fetch: existing attendance records + cohort enrolled students
    const [attRes, enrollRes] = await Promise.all([
      supabase
        .from('session_attendance')
        .select('*')
        .eq('session_id', sessionId),
      targetCohortId
        ? supabase
            .from('enrollments')
            .select('user_id')
            .eq('cohort_id', targetCohortId)
            .in('status', ['active', 'completed'])
        : { data: [] },
    ]);

    const attendanceRecords = (attRes.data as SessionAttendanceRecord[]) || [];
    const enrolledUserIds = ((enrollRes.data ?? []) as AttendanceEnrollmentRow[]).map((e) => e.user_id);

    // Collect all student IDs that should be in the roster
    const allStudentIds = Array.from(
      new Set([...attendanceRecords.map((a) => a.student_id), ...enrolledUserIds])
    );

    if (allStudentIds.length === 0) return [];

    // Fetch student profile names and emails
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', allStudentIds);

    const profileMap = new Map(((profiles ?? []) as AttendanceProfileRow[]).map((p) => [p.id, p]));
    const attendanceMap = new Map(attendanceRecords.map((a) => [a.student_id, a]));

    // Build unified roster (existing attendance or default absent/unmarked)
    return allStudentIds.map((studentId) => {
      const profile = profileMap.get(studentId);
      const existing = attendanceMap.get(studentId);

      if (existing) {
        return {
          ...existing,
          student_name: profile?.full_name || 'Student',
          student_email: profile?.email || '',
        };
      }

      return {
        id: `virtual-${studentId}`,
        session_id: sessionId,
        student_id: studentId,
        student_name: profile?.full_name || 'Student',
        student_email: profile?.email || '',
        cohort_id: targetCohortId || null,
        status: 'absent',
        join_time: null,
        duration_minutes: 0,
        notes: null,
        verified_by: null,
        check_in_method: 'system',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });
  } catch (err) {
    console.warn('Failed to load session attendance roster:', err);
    return [];
  }
}

/**
 * 5. Get high-level summary KPIs for a single session
 */
export async function getSessionAttendanceSummary(
  sessionId: string
): Promise<SessionAttendanceSummary> {
  try {
    const { data, error } = await supabase.rpc('get_session_attendance_summary', {
      p_session_id: sessionId,
    });

    if (!error && data) {
      return data as SessionAttendanceSummary;
    }
  } catch {
    // Client-side aggregation fallback
  }

  // Fallback calculation
  const [{ data: session }, { data: records }] = await Promise.all([
    supabase.from('live_sessions').select('id, title, cohort_id').eq('id', sessionId).maybeSingle(),
    supabase.from('session_attendance').select('status').eq('session_id', sessionId),
  ]);

  const list = records || [];
  const present = list.filter((r) => r.status === 'present').length;
  const late = list.filter((r) => r.status === 'late').length;
  const absent = list.filter((r) => r.status === 'absent').length;
  const excused = list.filter((r) => r.status === 'excused').length;
  const total = list.length || 0;
  const rate = total > 0 ? Math.round(((present + late) / total) * 1000) / 10 : 0;

  return {
    session_id: sessionId,
    session_title: session?.title || 'Live Session',
    total_students: total,
    present_count: present,
    late_count: late,
    absent_count: absent,
    excused_count: excused,
    attendance_rate_pct: rate,
  };
}

/**
 * 6. Get cohort attendance report across all sessions
 */
export async function getCohortAttendanceReport(
  cohortId: string
): Promise<StudentAttendanceSummary[]> {
  try {
    const { data, error } = await supabase.rpc('get_cohort_attendance_report', {
      p_cohort_id: cohortId,
    });

    if (!error && Array.isArray(data)) {
      return (data as CohortAttendanceReportRpcRow[]).map((d) => ({
        student_id: d.student_id,
        student_name: d.student_name,
        student_email: d.student_email,
        sessions_held: Number(d.sessions_held) || 0,
        attended_count: Number(d.attended_count) || 0,
        attendance_rate_pct: Number(d.attendance_rate_pct) || 0,
        last_attended_at: d.last_attended_at || null,
      }));
    }
  } catch {
    // Client fallback
  }

  // Fallback query
  const [enrollRes, sessionsRes, attendanceRes] = await Promise.all([
    supabase
      .from('enrollments')
      .select('user_id')
      .eq('cohort_id', cohortId),
    supabase
      .from('live_sessions')
      .select('id')
      .or(`cohort_id.eq.${cohortId},cohort_id.is.null`),
    supabase
      .from('session_attendance')
      .select('student_id, status, join_time')
      .eq('cohort_id', cohortId),
  ]);

  const userIds = ((enrollRes.data ?? []) as AttendanceEnrollmentRow[]).map((e) => e.user_id);
  if (!userIds.length) return [];

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', userIds);

  const profileMap = new Map(((profiles ?? []) as AttendanceProfileRow[]).map((p) => [p.id, p]));
  const totalSessions = (sessionsRes.data ?? []).length;

  const attendanceByUser = new Map<string, { attended: number; lastJoin: string | null }>();
  for (const a of attendanceRes.data ?? []) {
    const curr = attendanceByUser.get(a.student_id) || { attended: 0, lastJoin: null };
    if (a.status === 'present' || a.status === 'late') {
      curr.attended += 1;
      if (a.join_time && (!curr.lastJoin || a.join_time > curr.lastJoin)) {
        curr.lastJoin = a.join_time;
      }
    }
    attendanceByUser.set(a.student_id, curr);
  }

  return userIds.map((userId) => {
    const profile = profileMap.get(userId);
    const stats = attendanceByUser.get(userId) || { attended: 0, lastJoin: null };
    const rate = totalSessions > 0 ? Math.round((stats.attended / totalSessions) * 1000) / 10 : 0;

    return {
      student_id: userId,
      student_name: profile?.full_name || 'Student',
      student_email: profile?.email || '',
      sessions_held: totalSessions,
      attended_count: stats.attended,
      attendance_rate_pct: rate,
      last_attended_at: stats.lastJoin,
    };
  });
}

/**
 * 7. Get attendance history for a single student (for student dashboard / profile)
 */
export async function getStudentAttendanceHistory(
  studentId: string
): Promise<SessionAttendanceRecord[]> {
  try {
    const { data: records, error } = await supabase
      .from('session_attendance')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!records || !records.length) return [];

    const sessionIds = Array.from(new Set(records.map((r: SessionAttendanceRecord) => r.session_id)));
    const { data: sessions } = await supabase
      .from('live_sessions')
      .select('id, title, starts_at')
      .in('id', sessionIds);

    const sessionMap = new Map(((sessions ?? []) as LiveSessionBasicRow[]).map((s) => [s.id, s]));

    return records.map((r: SessionAttendanceRecord) => {
      const s = sessionMap.get(r.session_id);
      return {
        ...r,
        session_title: s?.title || 'Workshop Session',
        session_starts_at: s?.starts_at || r.created_at,
      };
    });
  } catch (err) {
    console.warn('Failed to load student attendance history:', err);
    return [];
  }
}
