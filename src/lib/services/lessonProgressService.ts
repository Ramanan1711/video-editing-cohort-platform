import { supabase } from '../supabaseClient';
import { parseDatabaseError } from '../errorHandling';
import { type Cohort, type Module, type Lesson, courseSelect, courseSelectLegacy } from './curriculumService';

export interface LessonProgress {
  lesson_id: string;
  completed: boolean;
  completed_at?: string | null;
  watch_percentage?: number;
  last_position_seconds?: number;
}

export interface StudentCourseData {
  cohort: Cohort | null;
  modules: Module[];
  progress: LessonProgress[];
  enrolledCohorts: Cohort[];
}

export async function getStudentCourseData(userId: string, cohortId?: string): Promise<StudentCourseData> {
  const { data: enrollments, error: enrollmentError } = await supabase
    .from('enrollments')
    .select('cohort_id, status, created_at')
    .eq('user_id', userId)
    .in('status', ['enrolled', 'active'])
    .order('created_at', { ascending: false });

  if (enrollmentError) throw enrollmentError;

  const enrolledCohortIds = (enrollments ?? []).map((e) => e.cohort_id);
  if (!enrolledCohortIds.length) {
    return { cohort: null, modules: [], progress: [], enrolledCohorts: [] };
  }

  // Load metadata for all enrolled cohorts
  const { data: cohortsData, error: cohortsError } = await supabase
    .from('cohorts')
    .select('id, title, description')
    .in('id', enrolledCohortIds)
    .order('title');

  if (cohortsError) throw cohortsError;

  const enrolledCohorts: Cohort[] = (cohortsData ?? []).map((c) => ({
    id: c.id,
    name: c.title,
    description: c.description,
  }));

  // Target cohort: if a specific cohortId is requested, it MUST be an enrolled cohort.
  // Otherwise default to the first enrolled cohort.
  const targetCohort = cohortId
    ? enrolledCohorts.find((c) => c.id === cohortId) || null
    : enrolledCohorts[0] || null;
  if (!targetCohort) {
    return { cohort: null, modules: [], progress: [], enrolledCohorts };
  }

  // 1. Fetch modules and lessons for the target cohort
  let modules: Module[];
  const { data: rawModules, error: modulesError } = await supabase
    .from('modules')
    .select(courseSelect)
    .eq('cohort_id', targetCohort.id)
    .order('position', { ascending: true });

  if (modulesError) {
    const fallbackRes = await supabase
      .from('modules')
      .select(courseSelectLegacy)
      .eq('cohort_id', targetCohort.id)
      .order('position', { ascending: true });
    if (fallbackRes.error) throw modulesError;
    modules = ((fallbackRes.data ?? []) as unknown as Module[]).map((m) => ({
      ...m,
      lessons: (m.lessons || []).map((l) => ({ ...l, status: l.status ?? 'published' })),
    }));
  } else {
    modules = (rawModules ?? []) as Module[];
  }

  const sortedModules: Module[] = (modules ?? []).map((module) => ({
    ...module,
    lessons: [...(module.lessons ?? [])].sort((a, b) => a.position - b.position),
  }));

  // 2. Extract lesson IDs scoped strictly to this target cohort
  const targetLessonIds = Array.from(
    new Set(sortedModules.flatMap((m) => (m.lessons || []).map((l) => l.id)).filter(Boolean))
  );

  // 3. Fetch progress scoped strictly to the target cohort's lesson IDs
  let progressData: LessonProgress[] = [];
  if (targetLessonIds.length > 0) {
    const progressQuery = supabase
      .from('lesson_progress')
      .select('lesson_id, completed, completed_at, watch_percentage, last_position_seconds')
      .eq('user_id', userId);

    const { data: rawProgress, error: progressError } =
      typeof (progressQuery as unknown as { in?: unknown })?.in === 'function'
        ? await (progressQuery as unknown as { in: (col: string, vals: string[]) => Promise<{ data: unknown; error: { message: string } | null }> }).in('lesson_id', targetLessonIds)
        : await progressQuery;

    if (
      progressError &&
      (progressError.message.includes('watch_percentage') || progressError.message.includes('last_position_seconds'))
    ) {
      const fallbackQuery = supabase
        .from('lesson_progress')
        .select('lesson_id, completed, completed_at')
        .eq('user_id', userId);

      const { data: fallbackProgress } =
        typeof (fallbackQuery as unknown as { in?: unknown })?.in === 'function'
          ? await (fallbackQuery as unknown as { in: (col: string, vals: string[]) => Promise<{ data: unknown; error: { message: string } | null }> }).in('lesson_id', targetLessonIds)
          : await fallbackQuery;
      progressData = ((fallbackProgress ?? []) as LessonProgress[]).filter((p) => targetLessonIds.includes(p.lesson_id));
    } else if (progressError) {
      throw progressError;
    } else {
      progressData = ((rawProgress ?? []) as LessonProgress[]).filter((p) => targetLessonIds.includes(p.lesson_id));
    }
  }

  return {
    cohort: targetCohort,
    modules: sortedModules,
    progress: progressData,
    enrolledCohorts,
  };
}

export async function markLessonComplete(
  userId: string,
  lessonId: string,
  completed: boolean,
  options?: { watchPercentage?: number; positionSeconds?: number }
) {
  if (completed) {
    const watchPercentage = options?.watchPercentage !== undefined ? Math.round(options.watchPercentage) : 0;
    const positionSeconds = options?.positionSeconds !== undefined ? Math.round(options.positionSeconds) : 0;

    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('verify_and_complete_lesson', {
        p_user_id: userId,
        p_lesson_id: lessonId,
        p_watch_percentage: watchPercentage,
        p_position_seconds: positionSeconds,
      });

      if (!rpcErr && rpcRes) {
        const res = rpcRes as { success?: boolean; reason?: string };
        if (res.success === false) {
          throw new Error(res.reason || 'You must watch at least 80% of this video lesson before marking it complete.');
        }
        return;
      }
      if (rpcErr) {
        const msg = rpcErr.message || '';
        if (msg.includes('80%') || msg.includes('threshold') || msg.includes('watched') || msg.includes('DIRECT_WRITE_DENIED')) {
          throw new Error(msg);
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && (err.message.includes('80%') || err.message.includes('threshold') || err.message.includes('watched') || err.message.includes('DIRECT_WRITE_DENIED'))) {
        throw err;
      }
      console.warn('verify_and_complete_lesson RPC fallback:', err);
    }

    // Resilient fallback: verify against lesson video status and recorded progress
    const { data: lessonData } = await supabase
      .from('lessons')
      .select('id, title, video_url, duration_minutes')
      .eq('id', lessonId)
      .maybeSingle();

    const hasVideo = Boolean(lessonData?.video_url && lessonData.video_url.trim() !== '');

    if (hasVideo) {
      const { data: existingProgress } = await supabase
        .from('lesson_progress')
        .select('watch_percentage, completed')
        .eq('user_id', userId)
        .eq('lesson_id', lessonId)
        .maybeSingle();

      const effectiveWatchPct = Math.max(
        existingProgress?.watch_percentage ?? 0,
        options?.watchPercentage ?? 0
      );

      if (effectiveWatchPct < 80 && !existingProgress?.completed) {
        throw new Error(
          `You have watched ${Math.round(effectiveWatchPct)}% of this video lesson. At least 80% is required before marking it complete.`
        );
      }
    }
  } else {
    // Unmarking completion via toggle_lesson_completion
    try {
      const { data: toggleRes, error: toggleErr } = await supabase.rpc('toggle_lesson_completion', {
        p_lesson_id: lessonId,
        p_completed: false,
        p_user_id: userId,
      });
      if (!toggleErr && toggleRes) {
        return;
      }
    } catch (toggleErr) {
      console.warn('toggle_lesson_completion RPC fallback:', toggleErr);
    }
  }

  const { error } = await supabase.from('lesson_progress').upsert(
    {
      user_id: userId,
      lesson_id: lessonId,
      completed,
      completed_at: completed ? new Date().toISOString() : null,
      ...(options?.watchPercentage !== undefined ? { watch_percentage: Math.min(100, Math.round(options.watchPercentage)) } : {}),
      ...(options?.positionSeconds !== undefined ? { last_position_seconds: Math.round(options.positionSeconds) } : {}),
    },
    { onConflict: 'user_id,lesson_id' }
  );
  if (error) throw parseDatabaseError(error);
}

export async function updateLessonWatchProgress(
  userId: string,
  lessonId: string,
  watchPercentage: number,
  positionSeconds: number = 0,
  playbackRate: number = 1.0
): Promise<void> {
  const isAutoCompleted = watchPercentage >= 80;

  // 1. Authoritative server-side heartbeat tracking
  try {
    const { data: heartbeatRes, error: heartbeatErr } = await supabase.rpc('record_lesson_watch_heartbeat', {
      p_lesson_id: lessonId,
      p_position_seconds: Math.round(positionSeconds),
      p_playback_rate: playbackRate,
      p_user_id: userId,
    });

    if (!heartbeatErr && heartbeatRes) {
      return;
    }
  } catch (rpcErr) {
    console.warn('record_lesson_watch_heartbeat RPC fallback:', rpcErr);
  }

  // 2. Resilient fallback for unmigrated environments
  try {
    const payload: Record<string, unknown> = {
      user_id: userId,
      lesson_id: lessonId,
      watch_percentage: Math.min(100, Math.round(watchPercentage)),
      last_position_seconds: Math.round(positionSeconds),
      completed_at: new Date().toISOString(),
    };
    if (isAutoCompleted) {
      payload.completed = true;
    }
    const { error } = await supabase
      .from('lesson_progress')
      .upsert(payload, { onConflict: 'user_id,lesson_id' });

    if (error && error.message.includes('watch_percentage')) {
      if (isAutoCompleted) {
        await markLessonComplete(userId, lessonId, true);
      }
    }
  } catch (err) {
    console.warn('Failed to update watch progress fallback:', err);
  }
}

export function calculateStreak(timestamps: (string | null | undefined)[]): number {
  const validDates = timestamps
    .filter((ts): ts is string => Boolean(ts))
    .map((ts) => {
      const d = new Date(ts);
      return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
    })
    .filter((d): d is string => Boolean(d));

  if (!validDates.length) return 0;

  const uniqueDays = Array.from(new Set(validDates)).sort().reverse();
  const today = new Date().toISOString().slice(0, 10);
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = yesterdayDate.toISOString().slice(0, 10);

  // If latest activity is neither today nor yesterday, streak is broken
  if (uniqueDays[0] !== today && uniqueDays[0] !== yesterday) {
    return 0;
  }

  let streak = 1;
  let current = new Date(uniqueDays[0]);

  for (let i = 1; i < uniqueDays.length; i++) {
    const prevExpected = new Date(current);
    prevExpected.setDate(prevExpected.getDate() - 1);
    const prevExpectedStr = prevExpected.toISOString().slice(0, 10);

    if (uniqueDays[i] === prevExpectedStr) {
      streak++;
      current = prevExpected;
    } else {
      break;
    }
  }

  return streak;
}

export function calculateLearningTime(completedLessons: Lesson[]): string {
  if (!completedLessons.length) return '0 mins';

  let totalMinutes = 0;
  for (const lesson of completedLessons) {
    totalMinutes += (lesson.duration_minutes && lesson.duration_minutes > 0)
      ? lesson.duration_minutes
      : 20; // Default estimate 20 minutes if duration is unspecified
  }

  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours} hrs`;
  return `${mins} mins`;
}

export function parseVideoUrl(url: string | null): {
  type: 'embed' | 'video' | 'empty';
  embedUrl: string | null;
  directUrl: string | null;
} {
  if (!url || !url.trim()) return { type: 'empty', embedUrl: null, directUrl: null };

  const trimmed = url.trim();

  // YouTube format match
  const ytMatch = trimmed.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i);
  if (ytMatch && ytMatch[1]) {
    return {
      type: 'embed',
      embedUrl: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?rel=0&modestbranding=1`,
      directUrl: null,
    };
  }

  // Vimeo format match
  const vimeoMatch = trimmed.match(/(?:vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^/]*)\/videos\/|album\/(\d+)\/video\/|video\/|)(\d+))/i);
  if (vimeoMatch && vimeoMatch[3]) {
    return {
      type: 'embed',
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[3]}?dnt=1&title=0&byline=0`,
      directUrl: null,
    };
  }

  // Direct video file link (.mp4, .webm, storage public URL, etc.)
  return {
    type: 'video',
    embedUrl: null,
    directUrl: trimmed,
  };
}
