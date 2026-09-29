import { supabase } from './supabaseClient';
import { parseDatabaseError } from './errorHandling';

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

/**
 * Default curated 15-Day Internship Curriculum Blueprint
 */
export const DEFAULT_15_DAY_CURRICULUM: Omit<DailyChallenge, 'id' | 'cohort_id'>[] = [
  // Sprint 1: Days 1-5 (Fundamentals & Kinetic Drills)
  {
    day_number: 1,
    title: 'Day 01: Production Setup & First Kinetic Cut',
    description: 'Establish project directory structure, import raw footage/starter repo, and ship first edit.',
    instructions: 'Submit your Day 1 repository PR or Google Drive cut link before midnight.',
    starter_files_url: 'https://drive.google.com/drive/folders/sample-day-1',
    track_type: 'general',
    submission_type: 'drive_link',
    deadline_hours: 24,
  },
  {
    day_number: 2,
    title: 'Day 02: Pacing, Micro-Transitions & Retention',
    description: 'Learn fast-paced cuts, J/L audio cuts, and maintaining 70%+ audience watch retention.',
    instructions: 'Produce a 30-second timeline maintaining retention peaks at seconds 3, 7, and 15.',
    starter_files_url: null,
    track_type: 'general',
    submission_type: 'drive_link',
    deadline_hours: 24,
  },
  {
    day_number: 3,
    title: 'Day 03: Sound Design, SFX Stems & Audio Layering',
    description: 'Layer whooshes, risers, foley hits, and balance speech volume levels to -6dB True Peak.',
    instructions: 'Include at least 4 distinct audio stem layers and export your clean WAV/MP4 master.',
    starter_files_url: null,
    track_type: 'general',
    submission_type: 'drive_link',
    deadline_hours: 24,
  },
  {
    day_number: 4,
    title: 'Day 04: Kinetic Typography & Motion Graphics',
    description: 'Sync word-by-word highlighted captions and title lower-thirds to voice cadence.',
    instructions: 'Submit a 45-second commercial segment featuring dynamic kinetic typography.',
    starter_files_url: null,
    track_type: 'general',
    submission_type: 'drive_link',
    deadline_hours: 24,
  },
  {
    day_number: 5,
    title: 'Day 05: Sprint 1 Milestone — First Client Simulation',
    description: 'Integrate Days 1–4 techniques into a complete 60s vertical product ad or full code module.',
    instructions: 'Submit your Sprint 1 final export for weekend mentor live grading.',
    starter_files_url: null,
    track_type: 'general',
    submission_type: 'drive_link',
    deadline_hours: 48,
  },

  // Sprint 2: Days 6-10 (Advanced Workflows & Commercial Polish)
  {
    day_number: 6,
    title: 'Day 06: Cinematic Color Grading & Tone Curves',
    description: 'Color balance Log footage, create a moody contrast curve, and export Rec.709 clean grades.',
    instructions: 'Submit a side-by-side Before/After color comparison video.',
    starter_files_url: null,
    track_type: 'general',
    submission_type: 'drive_link',
    deadline_hours: 24,
  },
  {
    day_number: 7,
    title: 'Day 07: Speed Ramping, Optical Flow & Match Cuts',
    description: 'Execute smooth seamless speed-ramps between action sequences using bezier handles.',
    instructions: 'Deliver a 20-second dynamic sports or fitness montage with 3 speed ramps.',
    starter_files_url: null,
    track_type: 'general',
    submission_type: 'drive_link',
    deadline_hours: 24,
  },
  {
    day_number: 8,
    title: 'Day 08: Visual FX, Green Screen & Rotoscoping',
    description: 'Mask foreground subjects, layer background lighting effects, and clean edge bleed.',
    instructions: 'Submit your composite shot file and render proof.',
    starter_files_url: null,
    track_type: 'general',
    submission_type: 'drive_link',
    deadline_hours: 24,
  },
  {
    day_number: 9,
    title: 'Day 09: Music Video Rhythm & Beat Synchronicity',
    description: 'Cut to dynamic tempo shifts and transient drum peaks for maximum emotional punch.',
    instructions: 'Sync 8 fast-cut b-roll scenes to acoustic/electronic tempo drop.',
    starter_files_url: null,
    track_type: 'general',
    submission_type: 'drive_link',
    deadline_hours: 24,
  },
  {
    day_number: 10,
    title: 'Day 10: Sprint 2 Milestone — Mid-Term Portfolio Review',
    description: 'Consolidated commercial cut incorporating color, sound, typography, and speed ramps.',
    instructions: 'Submit for mid-term mentor feedback audit and cohort leaderboard score.',
    starter_files_url: null,
    track_type: 'general',
    submission_type: 'drive_link',
    deadline_hours: 48,
  },

  // Sprint 3: Days 11-15 (Capstone Project & Graduation Proof)
  {
    day_number: 11,
    title: 'Day 11: Production Capstone — Storyboard & Raw Assembly',
    description: 'Begin your final 15-day capstone client project. Assemble the A-roll timeline.',
    instructions: 'Submit rough narrative sequence cut.',
    starter_files_url: null,
    track_type: 'general',
    submission_type: 'drive_link',
    deadline_hours: 24,
  },
  {
    day_number: 12,
    title: 'Day 12: Production Capstone — Sound Design & Foley Polish',
    description: 'Add music transitions, SFX sweetening, and vocal clarity EQ pass.',
    instructions: 'Submit second cut with completed audio stems.',
    starter_files_url: null,
    track_type: 'general',
    submission_type: 'drive_link',
    deadline_hours: 24,
  },
  {
    day_number: 13,
    title: 'Day 13: Production Capstone — Motion & Color Mastering',
    description: 'Fine-tune color consistency across all takes, add typography overlays, and sharpen details.',
    instructions: 'Submit near-final client master for preliminary mentor critique.',
    starter_files_url: null,
    track_type: 'general',
    submission_type: 'drive_link',
    deadline_hours: 24,
  },
  {
    day_number: 14,
    title: 'Day 14: Final Capstone Master Export & Showcase',
    description: 'Deliver the client-ready 4K and vertical master exports with complete source project bundle.',
    instructions: 'Submit high-bitrate export link along with written production notes.',
    starter_files_url: null,
    track_type: 'general',
    submission_type: 'drive_link',
    deadline_hours: 24,
  },
  {
    day_number: 15,
    title: 'Day 15: Graduation, Exit Evaluation & Letter of Recommendation',
    description: 'Final mentor grading, portfolio verification, and release of your verified Internship Certificate.',
    instructions: 'Complete the exit survey and claim your verifiable digital certificate.',
    starter_files_url: null,
    track_type: 'general',
    submission_type: 'text',
    deadline_hours: 24,
  },
];

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
    const { error: seedErr } = await supabase.rpc('ensure_cohort_daily_challenges', {
      p_cohort_id: cohortId,
    });
    if (!seedErr) {
      const { data: seededData } = await supabase
        .from('daily_challenges')
        .select('*')
        .eq('cohort_id', cohortId)
        .order('day_number', { ascending: true });
      if (seededData && seededData.length > 0) {
        return seededData as DailyChallenge[];
      }
    }
  } catch (seedCatch) {
    console.warn('ensure_cohort_daily_challenges RPC unavailable:', seedCatch);
  }

  // Fallback: If RPC is unavailable, seed default curriculum directly into Supabase so real database records with UUIDs are generated
  try {
    const payload = DEFAULT_15_DAY_CURRICULUM.map((item) => ({
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
  return [];
}

/**
 * Admin: Create a new daily challenge for a cohort
 */
export async function createDailyChallenge(input: DailyChallengeInput): Promise<DailyChallenge> {
  const payload = {
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
    const { error: rpcErr } = await supabase.rpc('ensure_cohort_daily_challenges', {
      p_cohort_id: cohortId,
    });
    if (!rpcErr) {
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
  const payload = DEFAULT_15_DAY_CURRICULUM.map((item) => ({
    ...item,
    cohort_id: cohortId,
  }));

  const { data, error } = await supabase
    .from('daily_challenges')
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

  const [configuredDays, challenges, submissions] = await Promise.all([
    fetchCohortDuration(),
    listDailyChallenges(cohortId),
    listMyDailySubmissions(userId),
  ]);

  const maxChallengeDay = challenges.length > 0 ? Math.max(...challenges.map((c) => c.day_number)) : 0;
  const configuredSprintDays = configuredDays || 15;
  const totalDays = Math.max(configuredSprintDays, maxChallengeDay, 1);

  const submissionMap = new Map(submissions.map((s) => [s.challenge_id, s]));

  let completedCount = 0;
  let totalScore = 0;
  let scoredCount = 0;

  const days: InternshipDayStatus[] = [];

  for (let i = 1; i <= totalDays; i++) {
    const ch = challenges.find((c) => c.day_number === i) || null;
    const sub = ch ? submissionMap.get(ch.id) || null : null;

    let status: 'locked' | 'todo' | 'pending' | 'accepted' | 'resubmit' = 'todo';
    const isUnlocked = i === 1 || (days[i - 2]?.status === 'accepted' || days[i - 2]?.status === 'pending');

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

