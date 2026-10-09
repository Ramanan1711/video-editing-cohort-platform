import { supabase } from './supabaseClient';
import { parseDatabaseError } from './errorHandling';
import { getSecureSubmissionUrl } from './services/assetStorageService';
import {
  type CurriculumDay,
  type CurriculumCohortInput,
  DEFAULT_15_DAY_CURRICULUM,
  VIDEO_EDITING_15_DAY_CURRICULUM,
  CODING_FULLSTACK_15_DAY_CURRICULUM,
  MOTION_GRAPHICS_15_DAY_CURRICULUM,
  getCurriculumBlueprintForCohort,
  getCurriculumForCohort,
} from './curriculum';

export type { CurriculumDay, CurriculumCohortInput };
export {
  DEFAULT_15_DAY_CURRICULUM,
  VIDEO_EDITING_15_DAY_CURRICULUM,
  CODING_FULLSTACK_15_DAY_CURRICULUM,
  MOTION_GRAPHICS_15_DAY_CURRICULUM,
  getCurriculumBlueprintForCohort,
  getCurriculumForCohort,
};

export interface DailyChallenge {
  id: string;
  cohort_id: string;
  day_number: number;
  title: string;
  description: string | null;
  instructions: string | null;
  starter_files_url: string | null;
  track_type: 'coding' | 'non_coding' | 'general';
  submission_type: 'github_pr' | 'drive_link' | 'loom_video' | 'text' | 'file';
  deadline_hours: number;
  is_published?: boolean;
  unlocked_at?: string | null;
  created_at?: string;
}

export type DailyChallengeInput = Omit<DailyChallenge, 'id' | 'created_at'>;

export interface DailyChallengeSubmission {
  id: string;
  challenge_id: string;
  user_id: string;
  submission_url: string;
  notes: string | null;
  status: 'pending' | 'reviewed' | 'resubmit' | 'accepted';
  score: number | null;
  mentor_feedback: string | null;
  reviewed_by?: string | null;
  submitted_at: string;
  reviewed_at?: string | null;
  secure_url?: string | null;
}

export interface InternshipDayStatus {
  dayNumber: number;
  title: string;
  isUnlocked: boolean;
  challenge: DailyChallenge | null;
  submission: DailyChallengeSubmission | null;
  status: 'locked' | 'todo' | 'pending' | 'accepted' | 'resubmit';
}

export interface InternMonitoringRecord {
  userId: string;
  fullName: string;
  email: string;
  phone?: string | null;
  whatsappOptIn: boolean;
  streakDays: number;
  completedDaysCount: number;
  totalDays?: number;
  completionPercentage?: number;
  pendingReviewsCount: number;
  lastActiveAt: string | null;
  riskStatus: 'on_track' | 'at_risk' | 'critical';
  dayStatuses: Record<number, 'accepted' | 'pending' | 'missed' | 'locked'>;
}

async function fetchCohortCurriculumInput(cohortId: string): Promise<CurriculumCohortInput | null> {
  try {
    const { data: cData } = await supabase
      .from('cohorts')
      .select('id, title, name, track_type, course_id')
      .eq('id', cohortId)
      .maybeSingle();

    if (!cData) return null;

    let courseInfo = null;
    if (cData.course_id) {
      try {
        const { data: courseData } = await supabase
          .from('courses')
          .select('title, track_type')
          .eq('id', cData.course_id)
          .maybeSingle();
        courseInfo = courseData;
      } catch {
        // Ignore course lookup failure
      }
    }

    return {
      id: cData.id,
      title: cData.title,
      name: cData.name,
      track_type: cData.track_type,
      course: courseInfo,
    };
  } catch {
    return null;
  }
}

export async function listDailyChallenges(cohortId: string): Promise<DailyChallenge[]> {
  const { data, error } = await supabase
    .from('daily_challenges')
    .select('*')
    .eq('cohort_id', cohortId)
    .order('day_number', { ascending: true });

  if (!error && data && data.length > 0) {
    return data as DailyChallenge[];
  }

  // Attempt database-level auto-seeding for cohort via RPC
  try {
    const seedRes = await supabase.rpc('ensure_cohort_daily_challenges', {
      p_cohort_id: cohortId,
    });
    if (seedRes && !seedRes.error) {
      const { data: seededData } = await supabase
        .from('daily_challenges')
        .select('*')
        .eq('cohort_id', cohortId)
        .order('day_number', { ascending: true });
      if (seededData && seededData.length > 0) {
        return seededData as DailyChallenge[];
      }

      // If the RPC ran successfully (the 15 daily challenges exist in the database),
      // but seededData is empty, the current user cannot SELECT them due to RLS
      // (e.g. not enrolled or staff role desync).
      // Crucially, DO NOT attempt a client-side table upsert here — that would trigger
      // a 403 Forbidden error (42501 RLS violation) against PostgREST.
      // Instead, resolve the curriculum blueprint in-memory and return it gracefully.
      if (seedRes.data && (seedRes.data as { success?: boolean }).success) {
        const cohortDetails = await fetchCohortCurriculumInput(cohortId);
        return getCurriculumBlueprintForCohort(cohortDetails).map((item, idx) => ({
          id: `local-ch-${cohortId}-${idx + 1}`,
          cohort_id: cohortId,
          created_at: new Date().toISOString(),
          is_published: item.is_published ?? idx === 0,
          ...item,
        })) as DailyChallenge[];
      }
    }
  } catch (seedCatch) {
    console.warn('ensure_cohort_daily_challenges RPC unavailable:', seedCatch);
  }

  // Fallback: If RPC is unavailable, resolve course blueprint dynamically and seed directly into Supabase
  try {
    const cohortDetails = await fetchCohortCurriculumInput(cohortId);
    const blueprint = getCurriculumBlueprintForCohort(cohortDetails);
    const payload = blueprint.map((item) => ({
      ...item,
      cohort_id: cohortId,
    }));
    const { data: inserted, error: insertError } = await supabase
      .from('daily_challenges')
      .upsert(payload, { onConflict: 'cohort_id,day_number' })
      .select('*')
      .order('day_number', { ascending: true });

    if (!insertError && inserted && inserted.length > 0) {
      return inserted as DailyChallenge[];
    }
  } catch (directSeedErr) {
    console.warn('Direct daily_challenges seed failed:', directSeedErr);
  }

  if (error) {
    console.warn('Failed to load daily challenges from Supabase:', error.message);
  }

  // Fallback: Return in-memory tailored blueprint instead of empty array so students have syllabus visibility
  try {
    const cohortDetails = await fetchCohortCurriculumInput(cohortId);
    return getCurriculumBlueprintForCohort(cohortDetails).map((item, idx) => ({
      id: `local-ch-${cohortId}-${idx + 1}`,
      cohort_id: cohortId,
      created_at: new Date().toISOString(),
      is_published: item.is_published ?? idx === 0,
      ...item,
    })) as DailyChallenge[];
  } catch {
    return [];
  }
}

/**
 * Admin: Create a new daily challenge for a cohort
 */
export async function createDailyChallenge(input: DailyChallengeInput): Promise<DailyChallenge> {
  const payload: Record<string, unknown> = {
    cohort_id: input.cohort_id,
    day_number: input.day_number,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    instructions: input.instructions?.trim() || null,
    starter_files_url: input.starter_files_url?.trim() || null,
    track_type: input.track_type || 'general',
    submission_type: input.submission_type || 'drive_link',
    deadline_hours: Number(input.deadline_hours) || 24,
  };

  if (input.is_published !== undefined) {
    payload.is_published = input.is_published;
    if (input.is_published && !input.unlocked_at) {
      payload.unlocked_at = new Date().toISOString();
    }
  }
  if (input.unlocked_at !== undefined) {
    payload.unlocked_at = input.unlocked_at;
  }

  const { data, error } = await supabase
    .from('daily_challenges')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw parseDatabaseError(error);
  return data as DailyChallenge;
}

/**
 * Admin: Update an existing daily challenge
 */
export async function updateDailyChallenge(
  id: string,
  input: Partial<Omit<DailyChallengeInput, 'cohort_id'>>
): Promise<DailyChallenge> {
  const payload: Record<string, unknown> = {};
  if (input.day_number !== undefined) payload.day_number = input.day_number;
  if (input.title !== undefined) payload.title = input.title.trim();
  if (input.description !== undefined) payload.description = input.description?.trim() || null;
  if (input.instructions !== undefined) payload.instructions = input.instructions?.trim() || null;
  if (input.starter_files_url !== undefined) payload.starter_files_url = input.starter_files_url?.trim() || null;
  if (input.track_type !== undefined) payload.track_type = input.track_type;
  if (input.submission_type !== undefined) payload.submission_type = input.submission_type;
  if (input.deadline_hours !== undefined) payload.deadline_hours = Number(input.deadline_hours);
  if (input.is_published !== undefined) {
    payload.is_published = input.is_published;
    payload.unlocked_at = input.is_published ? new Date().toISOString() : null;
  }
  if (input.unlocked_at !== undefined) payload.unlocked_at = input.unlocked_at;

  const { data, error } = await supabase
    .from('daily_challenges')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw parseDatabaseError(error);
  return data as DailyChallenge;
}

/**
 * Automatically unlocks scheduled daily challenges across all cohorts
 * (Can be invoked via scheduled cron, Edge Function webhook, or client sync)
 */
export async function unlockScheduledDailyChallenges(): Promise<{
  success: boolean;
  total_unlocked: number;
  day_one_unlocked: number;
  scheduled_unlocked: number;
  cohorts_affected: number;
  executed_at: string;
}> {
  const { data, error } = await supabase.rpc('unlock_scheduled_daily_challenges');
  if (error) {
    throw parseDatabaseError(error);
  }
  return data as {
    success: boolean;
    total_unlocked: number;
    day_one_unlocked: number;
    scheduled_unlocked: number;
    cohorts_affected: number;
    executed_at: string;
  };
}

/**
 * Unlocks scheduled daily challenges for a specific cohort
 */
export async function unlockCohortDailyChallenges(cohortId: string): Promise<{
  success: boolean;
  cohort_id: string;
  unlocked_challenges: number;
  executed_at: string;
}> {
  const { data, error } = await supabase.rpc('unlock_cohort_daily_challenges', {
    p_cohort_id: cohortId,
  });
  if (error) {
    throw parseDatabaseError(error);
  }
  return data as {
    success: boolean;
    cohort_id: string;
    unlocked_challenges: number;
    executed_at: string;
  };
}

/**
 * Manually toggle or set challenge publication/unlock status (Mentor / Admin)
 */
export async function setDailyChallengePublicationStatus(
  challengeId: string,
  isPublished: boolean
): Promise<{
  success: boolean;
  id: string;
  day_number: number;
  is_published: boolean;
  unlocked_at: string | null;
}> {
  const { data, error } = await supabase.rpc('set_daily_challenge_publication_status', {
    p_challenge_id: challengeId,
    p_is_published: isPublished,
  });
  if (error) {
    throw parseDatabaseError(error);
  }
  return data as {
    success: boolean;
    id: string;
    day_number: number;
    is_published: boolean;
    unlocked_at: string | null;
  };
}

/**
 * Admin: Delete a daily challenge by ID
 */
export async function deleteDailyChallenge(id: string): Promise<void> {
  const { error } = await supabase.from('daily_challenges').delete().eq('id', id);
  if (error) throw parseDatabaseError(error);
}

/**
 * Admin: Explicitly seed the default 15-day sprint challenges for a cohort
 */
export async function seedCohortDailyChallenges(cohortId: string): Promise<DailyChallenge[]> {
  try {
    const rpcRes = await supabase.rpc('ensure_cohort_daily_challenges', {
      p_cohort_id: cohortId,
    });
    if (rpcRes && !rpcRes.error) {
      const { data, error } = await supabase
        .from('daily_challenges')
        .select('*')
        .eq('cohort_id', cohortId)
        .order('day_number', { ascending: true });
      if (!error && data && data.length > 0) {
        return data as DailyChallenge[];
      }
    }
  } catch (err) {
    console.warn('RPC ensure_cohort_daily_challenges failed, falling back to direct upsert:', err);
  }

  // Direct table insert with real UUIDs generated by PostgreSQL
  const cohortDetails = await fetchCohortCurriculumInput(cohortId);
  const blueprint = getCurriculumBlueprintForCohort(cohortDetails);
  const payload = blueprint.map((item) => ({
    ...item,
    cohort_id: cohortId,
  }));

  const table = supabase.from('daily_challenges');
  if (typeof table?.upsert !== 'function') {
    return [];
  }

  const { data, error } = await table
    .upsert(payload, { onConflict: 'cohort_id,day_number' })
    .select('*')
    .order('day_number', { ascending: true });

  if (error) throw parseDatabaseError(error);
  return (data ?? []) as DailyChallenge[];
}

/**
 * List student submissions for daily challenges
 */
export async function listMyDailySubmissions(userId: string): Promise<DailyChallengeSubmission[]> {
  const { data, error } = await supabase
    .from('daily_challenge_submissions')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.warn('Failed to fetch daily challenge submissions:', error.message);
    return [];
  }

  return (data ?? []) as DailyChallengeSubmission[];
}

/**
 * Submit or update a daily challenge task (requires genuine database record)
 */
export async function submitDailyChallenge(
  userId: string,
  challengeId: string,
  submissionUrl: string,
  notes?: string
): Promise<DailyChallengeSubmission> {
  // Enforce valid UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  let resolvedChallengeId = challengeId;

  if (!uuidRegex.test(challengeId)) {
    // Attempt resolving synthetic ID like 'default-ch-1' to a persisted DB challenge
    const dayMatch = challengeId.match(/(\d+)/);
    if (dayMatch) {
      const dayNum = parseInt(dayMatch[1], 10);
      const { data: realChallenge } = await supabase
        .from('daily_challenges')
        .select('id')
        .eq('day_number', dayNum)
        .limit(1)
        .maybeSingle();
      if (realChallenge?.id) {
        resolvedChallengeId = realChallenge.id;
      } else {
        throw new Error(`Invalid challenge ID '${challengeId}'. Challenge must be a persisted database record.`);
      }
    } else {
      throw new Error(`Invalid challenge ID '${challengeId}'. Challenge must be a persisted database record.`);
    }
  }

  const payload = {
    challenge_id: resolvedChallengeId,
    user_id: userId,
    submission_url: submissionUrl,
    notes: notes || null,
    status: 'pending',
    submitted_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('daily_challenge_submissions')
    .upsert(payload, { onConflict: 'challenge_id,user_id' })
    .select('*')
    .single();

  if (error) {
    throw parseDatabaseError(error);
  }

  return data as DailyChallengeSubmission;
}

/**
 * Grade a daily challenge submission (Mentor / Admin)
 */
export async function gradeDailyChallenge(
  submissionId: string,
  score: number,
  status: 'accepted' | 'resubmit' | 'reviewed',
  mentorFeedback: string,
  mentorId: string
): Promise<DailyChallengeSubmission> {
  const { data, error } = await supabase
    .from('daily_challenge_submissions')
    .update({
      score,
      status,
      mentor_feedback: mentorFeedback,
      reviewed_by: mentorId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', submissionId)
    .select('*')
    .single();

  if (error) throw parseDatabaseError(error);
  return data as DailyChallengeSubmission;
}

/**
 * Automatically generates a secure, expiring signed URL for mentor grading
 * or deliverable inspection.
 * External links (Drive, Loom, Frame.io, YouTube, GitHub, Figma) are returned directly.
 * Private Supabase storage objects have a fresh time-limited token issued (default 1 hour).
 */
export async function getSecureChallengeSubmissionUrl(
  submissionUrl: string,
  expiresInSeconds: number = 3600
): Promise<string> {
  if (!submissionUrl) return '';
  return getSecureSubmissionUrl(submissionUrl, expiresInSeconds);
}

/**
 * Retrieves a daily challenge submission and automatically attaches a freshly generated
 * secure, expiring signed URL for mentor grading.
 */
export async function getChallengeSubmissionForGrading(
  submissionId: string,
  expiresInSeconds: number = 3600
): Promise<{
  submission: DailyChallengeSubmission;
  secureGradingUrl: string;
}> {
  const { data, error } = await supabase
    .from('daily_challenge_submissions')
    .select('*')
    .eq('id', submissionId)
    .single();

  if (error || !data) {
    throw parseDatabaseError(error || new Error('Submission not found'));
  }

  const submission = data as DailyChallengeSubmission;
  const secureGradingUrl = await getSecureSubmissionUrl(submission.submission_url, expiresInSeconds);

  return {
    submission: {
      ...submission,
      secure_url: secureGradingUrl,
    },
    secureGradingUrl,
  };
}

/**
 * Compute student sprint progress with dynamic sprint duration
 */
export async function getStudentSprintDays(
  userId: string,
  cohortId: string
): Promise<{
  days: InternshipDayStatus[];
  completedCount: number;
  totalDays: number;
  streakCount: number;
  overallScore: number | null;
  progressPercent: number;
}> {
  const fetchCohortMeta = async (): Promise<{ durationDays: number | null; startDate: string | null }> => {
    try {
      const query = supabase.from('cohorts').select('sprint_duration_days, start_date');
      if (typeof query?.eq === 'function') {
        const eqQuery = query.eq('id', cohortId);
        if (typeof eqQuery?.maybeSingle === 'function') {
          const res = await eqQuery.maybeSingle();
          const cohortData = res?.data as { sprint_duration_days?: number; start_date?: string } | null;
          return {
            durationDays: cohortData?.sprint_duration_days ?? null,
            startDate: cohortData?.start_date ?? null,
          };
        }
      }
      return { durationDays: null, startDate: null };
    } catch {
      return { durationDays: null, startDate: null };
    }
  };

  const [cohortMeta, challenges, submissions] = await Promise.all([
    fetchCohortMeta(),
    listDailyChallenges(cohortId),
    listMyDailySubmissions(userId),
  ]);

  const maxChallengeDay = challenges.length > 0 ? Math.max(...challenges.map((c) => c.day_number)) : 0;
  const configuredSprintDays = cohortMeta.durationDays || 15;
  const totalDays = Math.max(configuredSprintDays, maxChallengeDay, 1);

  const submissionMap = new Map(submissions.map((s) => [s.challenge_id, s]));

  let completedCount = 0;
  let totalScore = 0;
  let scoredCount = 0;

  const days: InternshipDayStatus[] = [];

  for (let i = 1; i <= totalDays; i++) {
    const ch = challenges.find((c) => c.day_number === i) || null;
    const sub = ch ? submissionMap.get(ch.id) || null : null;

    let isCalendarUnlocked = ch?.is_published;
    if (isCalendarUnlocked === undefined) {
      isCalendarUnlocked = i === 1 || !cohortMeta.startDate;
    }

    if (!isCalendarUnlocked && cohortMeta.startDate) {
      const start = new Date(cohortMeta.startDate);
      start.setHours(0, 0, 0, 0);
      const unlockDate = new Date(start);
      unlockDate.setDate(unlockDate.getDate() + (i - 1));
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (today >= unlockDate) {
        isCalendarUnlocked = true;
      }
    }

    const isPrerequisiteMet = i === 1 || (days[i - 2]?.status === 'accepted' || days[i - 2]?.status === 'pending');
    const isUnlocked = Boolean(isCalendarUnlocked && isPrerequisiteMet);

    let status: 'locked' | 'todo' | 'pending' | 'accepted' | 'resubmit' = 'todo';

    if (!isUnlocked) {
      status = 'locked';
    } else if (sub) {
      if (sub.status === 'accepted') {
        status = 'accepted';
        completedCount++;
      } else if (sub.status === 'resubmit') {
        status = 'resubmit';
      } else {
        status = 'pending';
      }

      if (sub.score !== null) {
        totalScore += sub.score;
        scoredCount++;
      }
    }

    days.push({
      dayNumber: i,
      title: ch ? ch.title : `Day ${i.toString().padStart(2, '0')} Challenge`,
      isUnlocked,
      challenge: ch,
      submission: sub,
      status,
    });
  }

  const streakCount = completedCount > 0 ? Math.min(completedCount, totalDays) : 0;
  const overallScore = scoredCount > 0 ? Math.round(totalScore / scoredCount) : null;
  const progressPercent = Math.min(100, Math.round((completedCount / totalDays) * 100));

  return {
    days,
    completedCount,
    totalDays,
    streakCount,
    overallScore,
    progressPercent,
  };
}

/**
 * Telemetry monitoring for mentors across all enrolled cohort interns
 */
export async function listCohortInternsMonitoring(cohortId: string): Promise<InternMonitoringRecord[]> {
  const fetchCohortDuration = async (): Promise<number | null> => {
    try {
      const query = supabase.from('cohorts').select('sprint_duration_days');
      if (typeof query?.eq === 'function') {
        const eqQuery = query.eq('id', cohortId);
        if (typeof eqQuery?.maybeSingle === 'function') {
          const res = await eqQuery.maybeSingle();
          return (res?.data as { sprint_duration_days?: number } | null)?.sprint_duration_days ?? null;
        }
      }
      return null;
    } catch {
      return null;
    }
  };

  // 1. Fetch cohort enrollments & duration
  const [configuredDays, { data: enrollments, error: enrollError }] = await Promise.all([
    fetchCohortDuration(),
    supabase
      .from('enrollments')
      .select('user_id, status, created_at, profiles(id, full_name, email, whatsapp_number, whatsapp_opt_in)')
      .eq('cohort_id', cohortId),
  ]);

  if (enrollError || !enrollments || enrollments.length === 0) {
    return [];
  }

  // 2. Fetch all submissions for cohort
  const { data: challenges } = await supabase
    .from('daily_challenges')
    .select('id, day_number')
    .eq('cohort_id', cohortId);

  const maxChallengeDay = challenges && challenges.length > 0 ? Math.max(...challenges.map((c) => c.day_number)) : 0;
  const configuredSprintDays = configuredDays || 15;
  const totalDays = Math.max(configuredSprintDays, maxChallengeDay, 1);

  const challengeMap = new Map((challenges || []).map((c) => [c.id, c.day_number]));

  const { data: submissions } = await supabase
    .from('daily_challenge_submissions')
    .select('*')
    .in('challenge_id', (challenges || []).map((c) => c.id));

  const submissionsByUser = new Map<string, DailyChallengeSubmission[]>();
  for (const s of submissions || []) {
    const list = submissionsByUser.get(s.user_id) || [];
    list.push(s);
    submissionsByUser.set(s.user_id, list);
  }

  return enrollments.map((enr) => {
    const p = (enr as unknown as { profiles: { id: string; full_name: string; email: string; whatsapp_number?: string; whatsapp_opt_in?: boolean } }).profiles;
    const userSubs = submissionsByUser.get(enr.user_id) || [];

    const dayStatuses: Record<number, 'accepted' | 'pending' | 'missed' | 'locked'> = {};
    let completedCount = 0;
    let pendingCount = 0;

    for (let day = 1; day <= totalDays; day++) {
      const sub = userSubs.find((s) => challengeMap.get(s.challenge_id) === day);
      if (sub) {
        if (sub.status === 'accepted') {
          dayStatuses[day] = 'accepted';
          completedCount++;
        } else {
          dayStatuses[day] = 'pending';
          pendingCount++;
        }
      } else {
        dayStatuses[day] = day <= 3 ? 'missed' : 'locked';
      }
    }

    let riskStatus: 'on_track' | 'at_risk' | 'critical' = 'on_track';
    if (completedCount === 0 && userSubs.length === 0) {
      riskStatus = 'critical';
    } else if (completedCount < Math.max(1, Math.floor(totalDays * 0.2))) {
      riskStatus = 'at_risk';
    }

    const completionPercentage = Math.min(100, Math.round((completedCount / totalDays) * 100));

    return {
      userId: enr.user_id,
      fullName: p?.full_name || 'Intern',
      email: p?.email || '',
      phone: p?.whatsapp_number || null,
      whatsappOptIn: p?.whatsapp_opt_in ?? true,
      streakDays: Math.max(1, completedCount),
      completedDaysCount: completedCount,
      totalDays,
      completionPercentage,
      pendingReviewsCount: pendingCount,
      lastActiveAt: userSubs[0]?.submitted_at || null,
      riskStatus,
      dayStatuses,
    };
  });
}

// Re-export formal internship report models & functions
export * from './internshipReportService';

// Re-export WhatsApp delivery engine & models
export * from './whatsappService';

