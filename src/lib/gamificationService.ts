import { supabase } from './supabaseClient';
import type { LessonProgress, Submission, FeedbackReply } from './courseService';

export interface EditorTier {
  level: number;
  title: string;
  minXp: number;
  maxXp: number;
  badgeColor: string;
}

export const EDITOR_TIERS: EditorTier[] = [
  { level: 1, title: 'Apprentice Cutter', minXp: 0, maxXp: 250, badgeColor: 'text-slate-400 bg-slate-100 border-slate-200' },
  { level: 2, title: 'Assembly Artist', minXp: 250, maxXp: 650, badgeColor: 'text-blue-700 bg-blue-50 border-blue-200' },
  { level: 3, title: 'Rough Cut Stylist', minXp: 650, maxXp: 1300, badgeColor: 'text-amber-700 bg-amber-50 border-amber-200' },
  { level: 4, title: 'Pacing & Flow Specialist', minXp: 1300, maxXp: 2200, badgeColor: 'text-orange-700 bg-orange-50 border-orange-200' },
  { level: 5, title: 'Master Lead Editor', minXp: 2200, maxXp: 4000, badgeColor: 'text-purple-700 bg-purple-50 border-purple-200' },
];

export interface StudentBadge {
  id: string;
  name: string;
  description: string;
  iconName: string;
  category: 'timeline' | 'critique' | 'consistency' | 'craft';
  unlocked: boolean;
  unlockedAt?: string;
  progressText: string;
}

export interface HabitDay {
  dateStr: string;
  dayLabel: string;
  dayNumber: number;
  isActive: boolean;
  isToday: boolean;
}

export interface GamificationProfile {
  totalXp: number;
  level: number;
  tierTitle: string;
  nextTierTitle: string;
  currentLevelMinXp: number;
  nextLevelXp: number;
  progressPercent: number;
  badges: StudentBadge[];
  streakDays: number;
  hasStreakShield: boolean;
  weeklyActiveCount: number;
  weeklyTarget: number;
  recentHeatmap: HabitDay[];
}

/**
 * Computes gamification profile from active student data
 */
export function calculateGamificationProfile(
  progress: LessonProgress[],
  submissions: Submission[],
  replies: FeedbackReply[] = [],
  streakDays: number = 0
): GamificationProfile {
  const completedLessons = progress.filter((p) => p.completed);
  const approvedSubmissions = submissions.filter((s) => s.status === 'reviewed');

  // XP breakdown:
  // - 50 XP per completed lesson
  // - 150 XP per submission
  // - 300 XP per approved submission
  // - 25 XP per daily streak day
  // - 20 XP per mentor feedback reply
  const lessonXp = completedLessons.length * 50;
  const submissionXp = submissions.length * 150;
  const approvedXp = approvedSubmissions.length * 300;
  const streakXp = streakDays * 25;
  const replyXp = replies.length * 20;

  const totalXp = lessonXp + submissionXp + approvedXp + streakXp + replyXp;

  // Determine Tier
  let currentTier = EDITOR_TIERS[0];
  let nextTier = EDITOR_TIERS[1];

  for (let i = 0; i < EDITOR_TIERS.length; i++) {
    if (totalXp >= EDITOR_TIERS[i].minXp) {
      currentTier = EDITOR_TIERS[i];
      nextTier = EDITOR_TIERS[i + 1] || EDITOR_TIERS[i];
    }
  }

  const range = nextTier.minXp - currentTier.minXp;
  const progressInLevel = Math.max(0, totalXp - currentTier.minXp);
  const progressPercent = currentTier.level === 5 ? 100 : Math.min(100, Math.round((progressInLevel / (range || 1)) * 100));

  // Check rubric scores for craft badges
  const hasHighAudioScore = submissions.some((s) =>
    s.feedback_history?.some((f) => (f.rubric?.audio ?? 0) >= 4)
  );
  const hasHighPacingScore = submissions.some((s) =>
    s.feedback_history?.some((f) => (f.rubric?.pacing ?? 0) >= 4)
  );

  // Compute Badges
  const badges: StudentBadge[] = [
    {
      id: 'first_cut',
      name: 'First Cut',
      description: 'Submitted your first video editing assignment for mentor review.',
      iconName: 'Scissors',
      category: 'timeline',
      unlocked: submissions.length > 0,
      progressText: submissions.length > 0 ? 'Unlocked' : '0/1 Submissions',
    },
    {
      id: 'rhythm_master',
      name: 'Rhythm Master',
      description: 'Mastered pacing across 5 completed curriculum lessons.',
      iconName: 'Play',
      category: 'craft',
      unlocked: completedLessons.length >= 5,
      progressText: `${Math.min(5, completedLessons.length)}/5 Lessons`,
    },
    {
      id: 'audio_alchemist',
      name: 'Audio Alchemist',
      description: 'Earned a 4+ rating on Audio Ducking & Sound Mixing from a mentor.',
      iconName: 'Volume2',
      category: 'craft',
      unlocked: hasHighAudioScore,
      progressText: hasHighAudioScore ? 'Unlocked' : 'Needs 4★ Audio Score',
    },
    {
      id: 'pacing_prodigy',
      name: 'Pacing Prodigy',
      description: 'Demonstrated exceptional timeline pace with a 4+ Pacing score.',
      iconName: 'Clock',
      category: 'craft',
      unlocked: hasHighPacingScore,
      progressText: hasHighPacingScore ? 'Unlocked' : 'Needs 4★ Pacing Score',
    },
    {
      id: 'streak_sentinel',
      name: 'Streak Sentinel',
      description: 'Maintained a 7-day editing habit streak.',
      iconName: 'Flame',
      category: 'consistency',
      unlocked: streakDays >= 7,
      progressText: `${Math.min(7, streakDays)}/7 Days`,
    },
    {
      id: 'critique_scholar',
      name: 'Critique Scholar',
      description: 'Engaged with mentors by replying to feedback critiques.',
      iconName: 'MessageSquare',
      category: 'critique',
      unlocked: replies.length > 0,
      progressText: replies.length > 0 ? 'Unlocked' : '0/1 Replies',
    },
    {
      id: 'graduation_honors',
      name: 'Graduate of Distinction',
      description: 'Achieved 100% course lesson completion.',
      iconName: 'Award',
      category: 'timeline',
      unlocked: progress.length > 0 && completedLessons.length === progress.length,
      progressText: `${completedLessons.length}/${progress.length || 1} Lessons`,
    },
  ];

  // 14-Day Activity Heatmap
  const activeTimestamps = [
    ...progress.map((p) => p.completed_at),
    ...submissions.map((s) => s.created_at),
  ].filter(Boolean) as string[];

  const activeDayKeys = new Set(
    activeTimestamps.map((t) => new Date(t).toISOString().slice(0, 10))
  );

  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const recentHeatmap: HabitDay[] = [];
  let weeklyActiveCount = 0;

  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const isActive = activeDayKeys.has(key);
    const isToday = key === todayKey;

    if (i < 7 && isActive) {
      weeklyActiveCount++;
    }

    recentHeatmap.push({
      dateStr: key,
      dayLabel: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
      dayNumber: d.getDate(),
      isActive,
      isToday,
    });
  }

  return {
    totalXp,
    level: currentTier.level,
    tierTitle: currentTier.title,
    nextTierTitle: nextTier.title,
    currentLevelMinXp: currentTier.minXp,
    nextLevelXp: nextTier.minXp,
    progressPercent,
    badges,
    streakDays,
    hasStreakShield: true, // 1 weekly streak shield available
    weeklyActiveCount,
    weeklyTarget: 4, // 4 study days/week target
    recentHeatmap,
  };
}

/**
 * Saves or updates student gamification state in Supabase if table exists
 */
export async function syncGamificationProfile(
  userId: string,
  xpOrProfile: number | GamificationProfile,
  level?: number,
  badgeIds?: string[]
): Promise<void> {
  try {
    const xp = typeof xpOrProfile === 'number' ? xpOrProfile : xpOrProfile.totalXp;
    const lvl = typeof xpOrProfile === 'number' ? (level ?? 1) : xpOrProfile.level;
    const badges =
      typeof xpOrProfile === 'number'
        ? (badgeIds ?? [])
        : xpOrProfile.badges.filter((b) => b.unlocked).map((b) => b.id);

    await supabase.from('student_gamification').upsert({
      user_id: userId,
      xp_points: xp,
      editor_level: lvl,
      badges: badges,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // Non-blocking fallback
  }
}

export interface LeaderboardMember {
  rank: number;
  id: string;
  name: string;
  points: number; // PRO points = total XP
  avatarUrl?: string;
  isCurrentUser?: boolean;
  level?: number;
  lessonsCompleted?: number;
  submissionsCount?: number;
}

const AVATAR_PHOTOS = [
  '1535713875002-d1d0cf377fde',
  '1570295999919-56ceb5ecca61',
  '1507003211169-0a1dd7228f2d',
  '1500648767791-00dcc994a43e',
  '1492562080023-ab3db95bfbce',
  '1522075469751-3a6694fb2f61',
  '1519085360753-af0119f7cbe7',
  '1472099645785-5658abf4ff4e',
  '1517841905240-472988babdf9',
  '1534528741775-53994a69daeb',
  '1506794778202-cad84cf45f1d',
  '1539571696357-5a69c17a67c6',
];

function getDeterministicAvatar(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % AVATAR_PHOTOS.length;
  return `https://images.unsplash.com/photo-${AVATAR_PHOTOS[index]}?auto=format&fit=crop&w=120&h=120&q=80`;
}

/**
 * Fetches enrolled students and computes their PRO points dynamically based on their XP.
 */
export async function fetchEnrolledLeaderboard(
  cohortId?: string,
  currentUserId?: string
): Promise<LeaderboardMember[]> {
  try {
    // 1. Fetch enrollments for the cohort (or all enrolled students)
    let enrollmentQuery = supabase
      .from('enrollments')
      .select('user_id, cohort_id, status');

    if (cohortId && cohortId !== 'all') {
      enrollmentQuery = enrollmentQuery.eq('cohort_id', cohortId);
    }

    const { data: enrollments, error: enrollError } = await enrollmentQuery;
    if (enrollError) {
      console.warn('Error fetching enrollments for leaderboard:', enrollError);
    }

    let userIds = Array.from(new Set((enrollments ?? []).map((e) => e.user_id)));

    // Ensure current authenticated user is included in the leaderboard so they can see their rank
    if (currentUserId && !userIds.includes(currentUserId)) {
      userIds.push(currentUserId);
    }

    // Fallback: If no enrollments are found in database, check for registered student profiles
    if (userIds.length === 0) {
      const { data: studentProfiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .limit(50);
      if (studentProfiles && studentProfiles.length > 0) {
        userIds = studentProfiles.map((p) => p.id);
      }
    }

    if (userIds.length === 0) {
      return [];
    }

    // 2. Parallel fetch student profiles, gamification points, lesson progress, and submissions
    const [
      { data: profiles },
      { data: gamificationRows },
      { data: progressRows },
      { data: submissionsRows },
    ] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, role').in('id', userIds),
      supabase.from('student_gamification').select('user_id, xp_points, editor_level').in('user_id', userIds),
      supabase.from('lesson_progress').select('user_id, lesson_id, completed').in('user_id', userIds),
      supabase.from('submissions').select('student_id, status').in('student_id', userIds),
    ]);

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const gamificationMap = new Map((gamificationRows ?? []).map((g) => [g.user_id, g]));

    // Group progress by user
    const completedLessonsByUser = new Map<string, number>();
    for (const p of progressRows ?? []) {
      if (p.completed) {
        completedLessonsByUser.set(p.user_id, (completedLessonsByUser.get(p.user_id) || 0) + 1);
      }
    }

    // Group submissions by user
    const submissionsByUser = new Map<string, { total: number; reviewed: number }>();
    for (const s of submissionsRows ?? []) {
      const curr = submissionsByUser.get(s.student_id) || { total: 0, reviewed: 0 };
      curr.total++;
      if (s.status === 'reviewed') curr.reviewed++;
      submissionsByUser.set(s.student_id, curr);
    }

    // 3. Compute each enrolled student's PRO points directly based on their XP
    const members: LeaderboardMember[] = userIds.map((uid) => {
      const prof = profileMap.get(uid);
      const name =
        prof?.full_name?.trim() ||
        (prof?.email ? prof.email.split('@')[0] : 'Enrolled Student');

      const savedGamification = gamificationMap.get(uid);
      const completedLessons = completedLessonsByUser.get(uid) || 0;
      const sub = submissionsByUser.get(uid) || { total: 0, reviewed: 0 };

      // Calculate XP:
      // - 50 XP per completed lesson
      // - 150 XP per submission
      // - 300 XP per approved/reviewed submission
      const calculatedXp =
        completedLessons * 50 + sub.total * 150 + sub.reviewed * 300;
      const totalXp = Math.max(savedGamification?.xp_points ?? 0, calculatedXp);

      const avatarUrl = getDeterministicAvatar(uid);

      return {
        rank: 1,
        id: uid,
        name,
        points: totalXp,
        avatarUrl,
        isCurrentUser: uid === currentUserId,
        level: savedGamification?.editor_level ?? 1,
        lessonsCompleted: completedLessons,
        submissionsCount: sub.total,
      };
    });

    // 4. Sort by points descending (highest XP first). Tie-break alphabetically by name
    members.sort((a, b) => {
      if (b.points !== a.points) {
        return b.points - a.points;
      }
      return a.name.localeCompare(b.name);
    });

    // 5. Assign sequential ranks
    members.forEach((m, idx) => {
      m.rank = idx + 1;
    });

    return members;
  } catch (err) {
    console.error('Failed to fetch enrolled leaderboard:', err);
    return [];
  }
}

