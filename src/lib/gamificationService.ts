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
