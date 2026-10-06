import { supabase } from '../supabaseClient';
import { listAssignments } from './assignmentSubmissionService';

export interface CertificateEligibilityResult {
  eligible: boolean;
  already_issued?: boolean;
  certificate_number?: string;
  issued_at?: string;
  reason?: string;
  completed_lessons?: number;
  total_lessons?: number;
  approved_assignments?: number;
  total_assignments?: number;
  completed_challenges?: number;
  total_challenges?: number;
  attended_sessions?: number;
  total_sessions?: number;
  attendance_rate_pct?: number;
  min_attendance_pct?: number;
}

export interface PublicCertificate {
  valid: boolean;
  certificate_number?: string;
  student_id?: string;
  student_name?: string;
  cohort_id?: string;
  cohort_name?: string;
  issued_at?: string;
  metadata?: {
    total_lessons?: number;
    completed_lessons?: number;
    total_assignments?: number;
    approved_assignments?: number;
    total_challenges?: number;
    completed_challenges?: number;
    total_sessions?: number;
    attended_sessions?: number;
    attendance_rate_pct?: number;
    min_attendance_pct?: number;
    verified_by?: string;
  };
  error?: string;
}

// Authoritative Certificate Verification
export async function verifyCertificateEligibility(
  studentId: string,
  cohortId: string
): Promise<CertificateEligibilityResult> {
  // 1. Try authoritative PostgreSQL RPC
  try {
    const { data, error } = await supabase.rpc('verify_and_issue_certificate', {
      p_student_id: studentId,
      p_cohort_id: cohortId,
    });

    if (!error && data) {
      return data as CertificateEligibilityResult;
    }
  } catch (err) {
    console.warn('RPC verify_and_issue_certificate unavailable, running client fallback:', err);
  }

  // 2. Authoritative Client-side Fallback Check (Checking All 4 Pillars)
  try {
    const nowIso = new Date().toISOString();
    const [
      modulesRes,
      progressRes,
      cohortAssigns,
      subsRes,
      cohortRowRes,
      challengesRes,
      challengeSubsRes,
      heldSessionsRes,
      attendanceRes,
    ] = await Promise.all([
      supabase.from('modules').select('id, lessons(id, video_url)').eq('cohort_id', cohortId),
      supabase.from('lesson_progress').select('lesson_id, completed, watch_percentage').eq('user_id', studentId),
      listAssignments(cohortId),
      supabase.from('submissions').select('assignment_id, status').eq('student_id', studentId).in('status', ['reviewed', 'accepted', 'approved']),
      supabase.from('cohorts').select('sprint_duration_days').eq('id', cohortId).maybeSingle(),
      supabase.from('daily_challenges').select('id, day_number').eq('cohort_id', cohortId),
      supabase.from('daily_challenge_submissions').select('challenge_id, status').eq('user_id', studentId).eq('status', 'accepted'),
      supabase.from('live_sessions').select('id').or(`cohort_id.eq.${cohortId},cohort_id.is.null`).lte('starts_at', nowIso),
      supabase.from('session_attendance').select('session_id, status').eq('student_id', studentId).in('status', ['present', 'late', 'excused']),
    ]);

    // Pillar 1: Lessons
    const allLessons = (modulesRes.data ?? []).flatMap((m) => ((m.lessons as Array<{ id: string; video_url?: string }>) ?? []));
    const allLessonIds = allLessons.map((l) => l.id);
    const progressMap = new Map((progressRes.data ?? []).map((p) => [p.lesson_id, p]));

    const completedLessons = allLessons.filter((l) => {
      const prog = progressMap.get(l.id);
      if (!prog) return false;
      const hasVideo = Boolean(l.video_url && l.video_url.trim().length > 0);
      if (hasVideo) {
        return (prog.watch_percentage ?? 0) >= 80 || prog.completed;
      }
      return Boolean(prog.completed);
    }).length;

    const isLessonsComplete = allLessonIds.length === 0 || completedLessons >= allLessonIds.length;

    // Pillar 2: Assignments
    const totalAssigns = cohortAssigns.length;
    const approvedAssignIds = new Set((subsRes.data ?? []).map((s) => s.assignment_id));
    const approvedAssigns = cohortAssigns.filter((a) => approvedAssignIds.has(a.id)).length;
    const isAssignsComplete = totalAssigns === 0 || approvedAssigns >= totalAssigns;

    // Pillar 3: Dynamic Sprint Challenges
    const challenges = challengesRes.data ?? [];
    const maxChallengeDay = challenges.length > 0 ? Math.max(...challenges.map((c) => c.day_number)) : 0;
    const configuredSprintDays = (cohortRowRes.data as { sprint_duration_days?: number } | null)?.sprint_duration_days || 15;
    const effectiveSprintDays = Math.max(configuredSprintDays, maxChallengeDay, 1);
    const completedChallenges = (challengeSubsRes.data ?? []).length;
    const isChallengesComplete = challenges.length === 0 || completedChallenges >= effectiveSprintDays;

    // Pillar 4: Live Workshop Attendance
    const heldSessions = heldSessionsRes.data ?? [];
    const totalSessions = heldSessions.length;
    const heldSessionIdSet = new Set(heldSessions.map((s) => s.id));
    const attendedSessions = (attendanceRes.data ?? []).filter((a) => heldSessionIdSet.has(a.session_id)).length;
    const attendanceRatePct = totalSessions > 0 ? Math.round((attendedSessions / totalSessions) * 1000) / 10 : 100.0;
    const minAttendancePct = 75.0;
    const isAttendanceComplete = totalSessions === 0 || attendanceRatePct >= minAttendancePct;

    const isAllComplete = isLessonsComplete && isAssignsComplete && isChallengesComplete && isAttendanceComplete;

    if (isAllComplete) {
      // Check existing certificate in database
      const { data: certRow } = await supabase
        .from('certificates')
        .select('*')
        .eq('student_id', studentId)
        .eq('cohort_id', cohortId)
        .maybeSingle();

      if (certRow) {
        return {
          eligible: true,
          already_issued: true,
          certificate_number: certRow.certificate_number,
          issued_at: certRow.issued_at,
          completed_lessons: completedLessons,
          total_lessons: allLessonIds.length,
          approved_assignments: approvedAssigns,
          total_assignments: totalAssigns,
          completed_challenges: completedChallenges,
          total_challenges: effectiveSprintDays,
          attended_sessions: attendedSessions,
          total_sessions: totalSessions,
          attendance_rate_pct: attendanceRatePct,
          min_attendance_pct: minAttendancePct,
        };
      }

      // Persist new verified certificate in database
      const certNumber = `CC-${new Date().toISOString().slice(0, 7).replace('-', '')}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const { data: newCert, error: insertErr } = await supabase
        .from('certificates')
        .insert({
          certificate_number: certNumber,
          student_id: studentId,
          cohort_id: cohortId,
          metadata: {
            total_lessons: allLessonIds.length,
            completed_lessons: completedLessons,
            total_assignments: totalAssigns,
            approved_assignments: approvedAssigns,
            total_challenges: effectiveSprintDays,
            completed_challenges: completedChallenges,
            total_sessions: totalSessions,
            attended_sessions: attendedSessions,
            attendance_rate_pct: attendanceRatePct,
            verified_by: 'system',
          },
        })
        .select('*')
        .single();

      if (!insertErr && newCert) {
        // Update enrollment status to completed
        await supabase
          .from('enrollments')
          .update({ status: 'completed' })
          .eq('user_id', studentId)
          .eq('cohort_id', cohortId);

        return {
          eligible: true,
          already_issued: false,
          certificate_number: newCert.certificate_number,
          issued_at: newCert.issued_at,
          completed_lessons: completedLessons,
          total_lessons: allLessonIds.length,
          approved_assignments: approvedAssigns,
          total_assignments: totalAssigns,
          completed_challenges: completedChallenges,
          total_challenges: effectiveSprintDays,
          attended_sessions: attendedSessions,
          total_sessions: totalSessions,
          attendance_rate_pct: attendanceRatePct,
          min_attendance_pct: minAttendancePct,
        };
      } else {
        console.error('Failed to persist verified certificate:', insertErr);
        return {
          eligible: false,
          reason: 'Graduation criteria verified, but certificate issuance persistence failed. Please retry.',
          completed_lessons: completedLessons,
          total_lessons: allLessonIds.length,
          approved_assignments: approvedAssigns,
          total_assignments: totalAssigns,
          completed_challenges: completedChallenges,
          total_challenges: effectiveSprintDays,
          attended_sessions: attendedSessions,
          total_sessions: totalSessions,
          attendance_rate_pct: attendanceRatePct,
          min_attendance_pct: minAttendancePct,
        };
      }
    }

    // Determine specific failure reason
    let reason = 'Graduation requirements incomplete.';
    if (!isLessonsComplete) {
      reason = `${allLessonIds.length - completedLessons} required lesson(s) not completed (≥80% watch verification required).`;
    } else if (!isAssignsComplete) {
      reason = `${totalAssigns - approvedAssigns} assignment(s) not reviewed or approved by mentor.`;
    } else if (!isChallengesComplete) {
      reason = `${effectiveSprintDays - completedChallenges} sprint challenge(s) not completed or accepted.`;
    } else if (!isAttendanceComplete) {
      reason = `Live workshop attendance is ${attendanceRatePct}% (${attendedSessions} of ${totalSessions} sessions attended). Minimum ${minAttendancePct}% required.`;
    }

    return {
      eligible: false,
      reason,
      completed_lessons: completedLessons,
      total_lessons: allLessonIds.length,
      approved_assignments: approvedAssigns,
      total_assignments: totalAssigns,
      completed_challenges: completedChallenges,
      total_challenges: effectiveSprintDays,
      attended_sessions: attendedSessions,
      total_sessions: totalSessions,
      attendance_rate_pct: attendanceRatePct,
      min_attendance_pct: minAttendancePct,
    };
  } catch (fallbackErr) {
    return {
      eligible: false,
      reason: fallbackErr instanceof Error ? fallbackErr.message : 'Failed to verify certificate eligibility.',
    };
  }
}

// Authoritative Public Certificate Verification
export async function getPublicCertificate(certificateNumber: string): Promise<PublicCertificate> {
  const cleanNumber = (certificateNumber || '').trim();
  if (!cleanNumber) {
    return {
      valid: false,
      error: 'Please provide a valid certificate number.',
    };
  }

  // 1. Try authoritative RPC verify_certificate_authenticity
  try {
    const { data, error } = await supabase.rpc('verify_certificate_authenticity', {
      p_certificate_number: cleanNumber,
    });
    if (!error && data) {
      return data as PublicCertificate;
    }
  } catch (err) {
    console.warn('RPC verify_certificate_authenticity unavailable, falling back:', err);
  }

  // 2. Try alias get_public_certificate
  try {
    const { data, error } = await supabase.rpc('get_public_certificate', {
      p_certificate_number: cleanNumber,
    });
    if (!error && data) {
      return data as PublicCertificate;
    }
  } catch {
    // Proceed to direct query fallback
  }

  // 3. Fallback direct table query
  try {
    const { data: certRow, error: certErr } = await supabase
      .from('certificates')
      .select('id, certificate_number, student_id, cohort_id, issued_at, metadata')
      .ilike('certificate_number', cleanNumber)
      .maybeSingle();

    if (certErr || !certRow) {
      return {
        valid: false,
        error: 'Certificate not found. The provided certificate number is invalid or has not been issued.',
      };
    }

    const [profileRes, cohortRes] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', certRow.student_id).maybeSingle(),
      supabase.from('cohorts').select('name, title').eq('id', certRow.cohort_id).maybeSingle(),
    ]);

    const studentName = profileRes?.data?.full_name || 'Verified Graduate';
    const cohortName = cohortRes?.data?.name || cohortRes?.data?.title || 'Creative Editing Cohort';

    return {
      valid: true,
      certificate_number: certRow.certificate_number,
      student_id: certRow.student_id,
      student_name: studentName,
      cohort_id: certRow.cohort_id,
      cohort_name: cohortName,
      issued_at: certRow.issued_at,
      metadata: (certRow.metadata || {}) as PublicCertificate['metadata'],
    };
  } catch (_fallbackErr) {
    return {
      valid: false,
      error: 'An unexpected error occurred while verifying the certificate credential.',
    };
  }
}

