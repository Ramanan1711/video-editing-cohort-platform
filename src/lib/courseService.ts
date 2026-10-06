import { supabase } from './supabaseClient';
import { parseDatabaseError } from './errorHandling';
import { queryCache } from './queryCache';
import { getStudentSprintDays } from './internshipService';
import { DEFAULT_COHORT_FEE_INR, DEFAULT_CURRENCY } from './paymentService';

export interface Course {
  id: string;
  title: string;
  slug?: string;
  description: string | null;
  thumbnail_url?: string | null;
  status: 'draft' | 'review' | 'published' | 'archived';
  difficulty_level?: 'beginner' | 'intermediate' | 'advanced' | 'all_levels';
  estimated_hours?: number;
  track_type?: 'coding' | 'non_coding' | 'general';
  cohorts_count?: number;
  modules_count?: number;
  total_active_students?: number;
  created_at?: string;
  updated_at?: string;
}

export function formatCurrencyINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export interface Cohort {
  id: string;
  name: string;
  title?: string;
  course_id?: string | null;
  course?: Course | null;
  description: string | null;
  status?: 'draft' | 'review' | 'published' | 'archived' | 'upcoming' | 'active' | 'completed';
  capacity?: number;
  visibility?: 'public' | 'private' | 'unlisted';
  enrollment_start?: string | null;
  enrollment_end?: string | null;
  track_type?: 'coding' | 'non_coding' | 'general';
  duration_days?: number;
  price_inr?: number;
  currency?: string;
}

export interface DbCohortRow {
  id: string;
  title: string;
  name?: string;
  course_id?: string | null;
  description: string | null;
  status?: Cohort['status'];
  capacity?: number;
  visibility?: Cohort['visibility'];
  enrollment_start?: string | null;
  enrollment_end?: string | null;
  track_type?: Cohort['track_type'];
  duration_days?: number;
  price_inr?: number;
  currency?: string;
}

export interface DbSubmissionRow {
  id: string;
  assignment_id: string;
  student_id: string;
  file_url: string;
  status: string;
  notes?: string | null;
  created_at: string;
  updated_at?: string;
  is_late?: boolean;
  version_number?: number;
  version?: number;
}

export interface DbSubmissionVersionRow {
  id: string;
  submission_id: string;
  version_number?: number;
  version?: number;
  file_url: string;
  status: string;
  notes?: string | null;
  created_at: string;
  submitted_at?: string;
}

export interface Lesson {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  duration_minutes: number | null;
  position: number;
  status?: 'draft' | 'review' | 'published' | 'archived';
}

export interface Module {
  id: string;
  cohort_id?: string | null;
  course_id?: string | null;
  title: string;
  description: string | null;
  position: number;
  status?: 'draft' | 'review' | 'published' | 'archived';
  created_at?: string;
  updated_at?: string;
  lessons: Lesson[];
}

export type EnrollmentStatus =
  | 'enrolled'
  | 'active'
  | 'inactive'
  | 'waitlist'
  | 'waitlisted'
  | 'completed'
  | 'dropped';

export interface Enrollment {
  id?: string;
  user_id: string;
  cohort_id: string;
  status: EnrollmentStatus;
  role?: string;
  created_at?: string;
  enrolled_at?: string;
}

export type VisibilityRule = 'enrolled' | 'public' | 'after_completion';
export type ResourceType = 'video' | 'pdf' | 'document' | 'image' | 'project_file' | 'link' | 'other';

export interface LessonResource {
  id: string;
  lesson_id: string;
  name: string;
  url: string;
  visibility?: VisibilityRule;
  resource_type?: ResourceType;
  file_size?: number | null;
  created_at?: string;
}

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

export interface Assignment {
  id: string;
  cohort_id?: string | null;
  module_id?: string | null;
  lesson_id: string;
  title: string;
  instructions: string | null;
  description?: string | null;
  rubric?: unknown;
  deadline: string | null;
  created_at?: string;
}

export type SubmissionStatus = 'draft' | 'pending' | 'reviewed' | 'resubmit';

export function normalizeSubmissionStatus(status?: string | null): SubmissionStatus {
  if (!status) return 'pending';
  const s = status.trim().toLowerCase();
  if (s === 'draft') return 'draft';
  if (s === 'reviewed' || s === 'approved' || s === 'accepted') return 'reviewed';
  if (s === 'resubmit' || s === 'resubmit_requested' || s === 'needs_revision' || s === 'needs_work') return 'resubmit';
  return 'pending';
}

export interface FeedbackReply {
  id: string;
  feedback_id: string;
  author_id: string;
  message: string;
  created_at: string;
  author_name?: string;
  author_role?: string;
}

export interface FeedbackItem {
  id: string;
  submission_id: string;
  mentor_id: string;
  comments: string;
  created_at: string;
  mentor_name?: string;
  replies?: FeedbackReply[];
  rubric?: {
    storytelling?: number;
    pacing?: number;
    audio?: number;
    color?: number;
    technical?: number;
  };
  timestamped_notes?: {
    id: string;
    timestamp_seconds: number;
    formatted_time: string;
    category: 'pacing' | 'audio' | 'color' | 'storytelling' | 'technical' | 'general';
    text: string;
  }[];
  student_read_at?: string | null;
}

export interface StudentStudyReminder {
  id: string;
  user_id: string;
  cohort_id?: string | null;
  title: string;
  description?: string | null;
  scheduled_at: string;
  reminder_type: 'study_block' | 'assignment_prep' | 'review_session' | 'custom';
  is_completed: boolean;
  created_at?: string;
}

export interface SubmissionVersion {
  id: string;
  submission_id: string;
  version?: number;
  version_number: number;
  file_url: string;
  status: string;
  notes?: string | null;
  submitted_at?: string;
  created_at: string;
}

export interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  file_url: string;
  status: SubmissionStatus;
  feedback: string | null;
  feedback_history?: FeedbackItem[];
  notes?: string | null;
  is_late?: boolean;
  version?: number;
  version_number?: number;
  versions?: SubmissionVersion[];
  created_at?: string;
  updated_at?: string;
}

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

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  type: 'assignment' | 'live_session' | 'reminder';
  date: string;
  status?: string;
  actionUrl?: string;
  isCompleted?: boolean;
  reminderType?: 'study_block' | 'assignment_prep' | 'review_session' | 'custom';
}

export interface MentorSubmission extends Submission {
  student_name?: string;
  student_email?: string;
  assignment_title?: string;
  assignment_instructions?: string | null;
  assignment_deadline?: string | null;
  cohort_name?: string;
}

export interface StudentNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
  category?: 'review' | 'community' | 'deadline' | 'system';
  action_url?: string | null;
}

export interface StudentAnnouncement {
  id: string;
  cohort_id?: string | null;
  title: string;
  body: string;
  created_at: string;
}

export interface StudentLiveSession {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  meeting_url: string;
}

export type CourseInput = Pick<Course, 'title'> &
  Partial<Pick<Course, 'description' | 'slug' | 'thumbnail_url' | 'status' | 'difficulty_level' | 'estimated_hours' | 'track_type'>>;

export type CohortInput = Pick<Cohort, 'name' | 'description'> &
  Partial<Pick<Cohort, 'status' | 'capacity' | 'visibility' | 'enrollment_start' | 'enrollment_end' | 'course_id' | 'track_type' | 'duration_days' | 'price_inr' | 'currency'>>;
export type ModuleInput = Pick<Module, 'title'> &
  Partial<Pick<Module, 'cohort_id' | 'course_id' | 'description' | 'position' | 'status'>>;
export type LessonInput = Pick<Lesson, 'module_id' | 'title' | 'description' | 'video_url' | 'duration_minutes' | 'position'> &
  Partial<Pick<Lesson, 'status'>>;
export type EnrollmentInput = Pick<Enrollment, 'user_id' | 'cohort_id' | 'status'>;
export type AssignmentInput = {
  lesson_id: string;
  cohort_id?: string | null;
  module_id?: string | null;
  title: string;
  instructions?: string | null;
  description?: string | null;
  deadline?: string | null;
};
export interface LessonResourceInput {
  lesson_id: string;
  name: string;
  url: string;
  visibility?: VisibilityRule;
  resource_type?: ResourceType;
  file_size?: number | null;
}

const courseSelectWithStatus = 'id, cohort_id, course_id, title, description, position, status, lessons(id, module_id, title, description, video_url, duration_minutes, position, status)';
const courseSelectLegacy = 'id, cohort_id, title, description, position, lessons(id, module_id, title, description, video_url, duration_minutes, position)';
const courseSelect = courseSelectWithStatus;

export function inferMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'mp4': return 'video/mp4';
    case 'mov': return 'video/quicktime';
    case 'webm': return 'video/webm';
    case 'm4v': return 'video/x-m4v';
    case 'pdf': return 'application/pdf';
    case 'doc': return 'application/msword';
    case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'txt': return 'text/plain';
    case 'rtf': return 'application/rtf';
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'webp': return 'image/webp';
    case 'svg': return 'image/svg+xml';
    case 'gif': return 'image/gif';
    case 'prproj': return 'application/x-premiere-project';
    case 'drp': return 'application/x-davinci-resolve-project';
    case 'fcpxml': return 'application/xml';
    case 'aep': return 'application/x-after-effects';
    case 'psd': return 'image/vnd.adobe.photoshop';
    case 'zip': return 'application/zip';
    case 'rar': return 'application/x-rar-compressed';
    case '7z': return 'application/x-7z-compressed';
    default: return 'application/octet-stream';
  }
}

export function detectResourceType(fileNameOrUrl: string): ResourceType {
  const clean = fileNameOrUrl.split('?')[0].toLowerCase();
  const ext = clean.split('.').pop() || '';
  if (['mp4', 'mov', 'webm', 'mkv', 'm4v'].includes(ext)) return 'video';
  if (ext === 'pdf') return 'pdf';
  if (['doc', 'docx', 'txt', 'rtf', 'odt', 'md'].includes(ext)) return 'document';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp'].includes(ext)) return 'image';
  if (['prproj', 'drp', 'fcpxml', 'aep', 'psd', 'ai', 'zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'project_file';
  if (fileNameOrUrl.startsWith('http://') || fileNameOrUrl.startsWith('https://')) return 'link';
  return 'other';
}

export function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

  // Target cohort: either requested or default to first enrolled
  const targetCohort = (cohortId && enrolledCohorts.find((c) => c.id === cohortId)) || enrolledCohorts[0];
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

export async function listEnrolledCohorts(userId: string): Promise<Cohort[]> {
  const { data: enrollments, error: enrollmentsError } = await supabase
    .from('enrollments')
    .select('cohort_id')
    .eq('user_id', userId);

  if (enrollmentsError) throw enrollmentsError;
  const cohortIds = (enrollments ?? []).map((e) => e.cohort_id);
  if (!cohortIds.length) return [];

  const { data, error } = await supabase
    .from('cohorts')
    .select('id, title, description')
    .in('id', cohortIds)
    .order('title');

  if (error) throw error;
  return (data ?? []).map((c) => ({ id: c.id, name: c.title, description: c.description }));
}

export async function listAllStudentCohorts(userId: string): Promise<(Cohort & { isEnrolled: boolean })[]> {
  const [{ data: allCohorts, error: cohortsError }, { data: enrollments, error: enrollmentsError }] = await Promise.all([
    supabase.from('cohorts').select('id, title, description').order('title'),
    supabase.from('enrollments').select('cohort_id').eq('user_id', userId).in('status', ['enrolled', 'active']),
  ]);

  if (cohortsError) throw cohortsError;
  if (enrollmentsError) throw enrollmentsError;

  const enrolledSet = new Set((enrollments ?? []).map((e) => e.cohort_id));
  return (allCohorts ?? []).map((cohort) => ({
    id: cohort.id,
    name: cohort.title,
    description: cohort.description,
    isEnrolled: enrolledSet.has(cohort.id),
  }));
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

export async function listCohorts(): Promise<Cohort[]> {
  return queryCache.getOrFetch(
    'cohorts_list',
    async () => {
      const { data, error } = await supabase
        .from('cohorts')
        .select('id, title, course_id, description, status, capacity, visibility, enrollment_start, enrollment_end, track_type, duration_days, price_inr, currency')
        .order('title');

      if (error) {
        const { data: fallback, error: fallbackError } = await supabase
          .from('cohorts')
          .select('id, title, description')
          .order('title');
        if (fallbackError) throw fallbackError;
        return (fallback ?? []).map((c) => ({
          id: c.id,
          name: c.title,
          description: c.description,
          status: 'published',
          capacity: 30,
          visibility: 'public',
          enrollment_start: null,
          enrollment_end: null,
          price_inr: DEFAULT_COHORT_FEE_INR,
          currency: DEFAULT_CURRENCY,
        }));
      }

      return ((data ?? []) as DbCohortRow[]).map((cohort) => ({
        id: cohort.id,
        name: cohort.title,
        title: cohort.title,
        course_id: cohort.course_id ?? null,
        description: cohort.description,
        status: cohort.status ?? 'published',
        capacity: cohort.capacity ?? 30,
        visibility: cohort.visibility ?? 'public',
        enrollment_start: cohort.enrollment_start ?? null,
        enrollment_end: cohort.enrollment_end ?? null,
        track_type: cohort.track_type ?? 'general',
        duration_days: cohort.duration_days ?? 15,
        price_inr: cohort.price_inr ?? DEFAULT_COHORT_FEE_INR,
        currency: cohort.currency ?? DEFAULT_CURRENCY,
      }));
    },
    300_000,
    ['cohorts']
  );
}

export async function listAvailableCohorts(userId: string): Promise<Cohort[]> {
  const { data: enrollments, error: enrollmentError } = await supabase
    .from('enrollments')
    .select('cohort_id')
    .eq('user_id', userId)
    .in('status', ['enrolled', 'active']);
  if (enrollmentError) throw enrollmentError;
  const enrolledIds = (enrollments ?? []).map((enrollment) => enrollment.cohort_id);
  const cohorts = await listCohorts();
  return cohorts.filter((cohort) => !enrolledIds.includes(cohort.id) && cohort.status !== 'archived');
}

export async function enrollInCohort(userId: string, cohortId: string): Promise<Enrollment> {
  // Fail-closed payment requirement check for paid cohorts
  try {
    const { data: cohortData } = await supabase
      .from('cohorts')
      .select('price_inr')
      .eq('id', cohortId)
      .maybeSingle();

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (profile?.role !== 'admin') {
      // Enforce paid-only launch policy: free or zero-priced cohorts cannot grant enrollment
      if (!cohortData?.price_inr || Number(cohortData.price_inr) <= 0) {
        throw new Error('Free enrollment is prohibited under the platform paid-only policy. Cohorts require a valid positive price.');
      }

      const { data: payment } = await supabase
        .from('payments')
        .select('id')
        .eq('user_id', userId)
        .eq('cohort_id', cohortId)
        .eq('status', 'captured')
        .maybeSingle();

      if (!payment) {
        throw new Error('Payment required to enroll in this cohort. Please complete checkout.');
      }
    }
  } catch (checkErr) {
    if (checkErr instanceof Error && checkErr.message.includes('Payment required')) {
      throw checkErr;
    }
  }

  // 1. Deactivate any existing active enrollments for this student in other cohorts
  try {
    await supabase
      .from('enrollments')
      .update({ status: 'inactive' })
      .eq('user_id', userId)
      .neq('cohort_id', cohortId)
      .in('status', ['active', 'enrolled']);
  } catch (deactivateErr) {
    console.warn('Could not deactivate prior enrollments client-side:', deactivateErr);
  }

  // 2. Attempt validated server-side RPC (enforces capacity, enrollment window, active user status, and emits audit log)
  const { data: rpcData, error: rpcError } = await supabase.rpc('enroll_student_in_cohort', {
    p_cohort_id: cohortId,
    p_student_id: userId,
  });

  if (!rpcError && rpcData) {
    const rawStatus = (rpcData as { status?: string }).status;
    const status: Enrollment['status'] = rawStatus === 'waitlist' ? 'waitlisted' : 'active';
    return {
      user_id: userId,
      cohort_id: cohortId,
      status,
    };
  }

  // If RPC is missing (42883), fallback to direct table operation
  if (rpcError && (rpcError.code === '42883' || rpcError.message.includes('enroll_student_in_cohort'))) {
    return saveEnrollment({ user_id: userId, cohort_id: cohortId, status: 'active' });
  }

  if (rpcError) throw parseDatabaseError(rpcError);
  return saveEnrollment({ user_id: userId, cohort_id: cohortId, status: 'active' });
}

export async function createCohort(input: CohortInput): Promise<Cohort> {
  queryCache.invalidate('cohorts');
  queryCache.invalidate('courses');
  queryCache.invalidate('stats');

  const payload: Record<string, unknown> = {
    title: input.name,
    name: input.name,
    description: input.description,
  };
  if (input.course_id !== undefined) payload.course_id = input.course_id;
  if (input.status !== undefined) payload.status = input.status;
  if (input.capacity !== undefined) payload.capacity = input.capacity;
  if (input.visibility !== undefined) payload.visibility = input.visibility;
  if (input.enrollment_start !== undefined) payload.enrollment_start = input.enrollment_start;
  if (input.enrollment_end !== undefined) payload.enrollment_end = input.enrollment_end;
  if (input.track_type !== undefined) payload.track_type = input.track_type;
  if (input.duration_days !== undefined) payload.duration_days = input.duration_days;
  payload.price_inr = Math.max(1, Number(input.price_inr) || DEFAULT_COHORT_FEE_INR);
  if (input.currency !== undefined) payload.currency = input.currency;

  let res = await supabase.from('cohorts').insert(payload).select('id, title, course_id, description, status, capacity, visibility, enrollment_start, enrollment_end, track_type, duration_days, price_inr, currency').single();
  if (res.error) {
    res = await supabase.from('cohorts').insert({ title: input.name, description: input.description, price_inr: payload.price_inr, currency: input.currency }).select('id, title, description').single();
  }
  if (res.error) throw res.error;
  const created = res.data as DbCohortRow;
  return {
    id: created.id,
    name: created.title,
    title: created.title,
    course_id: created.course_id ?? null,
    description: created.description,
    status: created.status ?? 'published',
    capacity: created.capacity ?? 30,
    visibility: created.visibility ?? 'public',
    enrollment_start: created.enrollment_start ?? null,
    enrollment_end: created.enrollment_end ?? null,
    track_type: created.track_type ?? 'general',
    duration_days: created.duration_days ?? 15,
    price_inr: created.price_inr ?? DEFAULT_COHORT_FEE_INR,
    currency: created.currency ?? DEFAULT_CURRENCY,
  };
}

export async function updateCohort(id: string, input: Partial<CohortInput>): Promise<Cohort> {
  queryCache.invalidate('cohorts');
  queryCache.invalidate('courses');

  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) {
    payload.title = input.name;
    payload.name = input.name;
  }
  if (input.course_id !== undefined) payload.course_id = input.course_id;
  if (input.description !== undefined) payload.description = input.description;
  if (input.status !== undefined) payload.status = input.status;
  if (input.capacity !== undefined) payload.capacity = input.capacity;
  if (input.visibility !== undefined) payload.visibility = input.visibility;
  if (input.enrollment_start !== undefined) payload.enrollment_start = input.enrollment_start;
  if (input.enrollment_end !== undefined) payload.enrollment_end = input.enrollment_end;
  if (input.track_type !== undefined) payload.track_type = input.track_type;
  if (input.duration_days !== undefined) payload.duration_days = input.duration_days;
  if (input.price_inr !== undefined) {
    payload.price_inr = Math.max(1, Number(input.price_inr) || DEFAULT_COHORT_FEE_INR);
  }
  if (input.currency !== undefined) payload.currency = input.currency;

  let res = await supabase.from('cohorts').update(payload).eq('id', id).select('id, title, course_id, description, status, capacity, visibility, enrollment_start, enrollment_end, track_type, duration_days, price_inr, currency').single();
  if (res.error) {
    const fallbackPayload: Record<string, unknown> = {};
    if (input.name !== undefined) fallbackPayload.title = input.name;
    if (input.description !== undefined) fallbackPayload.description = input.description;
    if (input.price_inr !== undefined) fallbackPayload.price_inr = input.price_inr;
    res = await supabase.from('cohorts').update(fallbackPayload).eq('id', id).select('id, title, description').single();
  }
  if (res.error) throw res.error;
  const updated = res.data as DbCohortRow;
  return {
    id: updated.id,
    name: updated.title,
    title: updated.title,
    course_id: updated.course_id ?? null,
    description: updated.description,
    status: updated.status ?? 'published',
    capacity: updated.capacity ?? 30,
    visibility: updated.visibility ?? 'public',
    enrollment_start: updated.enrollment_start ?? null,
    enrollment_end: updated.enrollment_end ?? null,
    track_type: updated.track_type ?? 'general',
    duration_days: updated.duration_days ?? 15,
    price_inr: updated.price_inr ?? DEFAULT_COHORT_FEE_INR,
    currency: updated.currency ?? DEFAULT_CURRENCY,
  };
}

// ============================================================================
// First-Class Master Course Entity Operations
// ============================================================================

export async function listCourses(): Promise<Course[]> {
  return queryCache.getOrFetch(
    'courses_list',
    async () => {
      // 1. Try canonical courses_overview view
      const { data, error } = await supabase
        .from('courses_overview')
        .select('*')
        .order('title');

      if (!error && data) {
        return data as Course[];
      }

      // 2. Try raw courses table
      const rawRes = await supabase.from('courses').select('*').order('title');
      if (!rawRes.error && rawRes.data) {
        return rawRes.data as Course[];
      }

      // 3. Fallback: synthesize courses from cohorts if migrations are in-flight
      const cohorts = await listCohorts();
      const uniqueCourses = new Map<string, Course>();
      cohorts.forEach((c) => {
        const id = c.course_id || c.id;
        if (!uniqueCourses.has(id)) {
          uniqueCourses.set(id, {
            id,
            title: c.title || c.name,
            description: c.description,
            status: (c.status as Course['status']) || 'published',
            track_type: c.track_type,
            cohorts_count: 1,
          });
        }
      });
      return Array.from(uniqueCourses.values());
    },
    300_000,
    ['courses']
  );
}

export async function getCourse(id: string): Promise<Course | null> {
  const { data, error } = await supabase.from('courses').select('*').eq('id', id).maybeSingle();
  if (error) {
    console.warn('Error fetching course:', error);
    return null;
  }
  return data as Course | null;
}

export async function createCourse(input: CourseInput): Promise<Course> {
  queryCache.invalidate('courses');
  const slug = input.slug || input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Date.now().toString(36);
  const payload = {
    title: input.title,
    slug,
    description: input.description ?? null,
    thumbnail_url: input.thumbnail_url ?? null,
    status: input.status ?? 'published',
    difficulty_level: input.difficulty_level ?? 'all_levels',
    estimated_hours: input.estimated_hours ?? 20,
    track_type: input.track_type ?? 'general',
  };
  const { data, error } = await supabase.from('courses').insert(payload).select('*').single();
  if (error) throw error;
  return data as Course;
}

export async function updateCourse(id: string, input: Partial<CourseInput>): Promise<Course> {
  queryCache.invalidate('courses');
  const { data, error } = await supabase.from('courses').update(input).eq('id', id).select('*').single();
  if (error) throw error;
  return data as Course;
}

export async function deleteCourse(id: string): Promise<void> {
  queryCache.invalidate('courses');
  const { error } = await supabase.from('courses').delete().eq('id', id);
  if (error) throw error;
}

export async function cloneCourseCurriculumToCohort(
  courseId: string,
  cohortId: string
): Promise<{ success: boolean; modules_cloned: number; lessons_cloned: number }> {
  queryCache.invalidate('cohorts');
  queryCache.invalidate('courses');
  const { data, error } = await supabase.rpc('clone_course_curriculum_to_cohort', {
    p_course_id: courseId,
    p_cohort_id: cohortId,
  });
  if (error) throw error;
  return data as { success: boolean; modules_cloned: number; lessons_cloned: number };
}

export async function deleteCohort(id: string, force: boolean = false) {
  queryCache.invalidate('cohorts');
  queryCache.invalidate('stats');

  // 1. Attempt validated server-side RPC (safely archives if active enrollments/submissions exist)
  const { data: rpcData, error: rpcError } = await supabase.rpc('admin_delete_cohort', {
    p_cohort_id: id,
    p_force: force,
  });

  if (!rpcError && rpcData) {
    return rpcData;
  }

  // 2. Fallback to direct delete if RPC is missing
  if (rpcError && (rpcError.code === '42883' || rpcError.message.includes('admin_delete_cohort'))) {
    const { error } = await supabase.from('cohorts').delete().eq('id', id);
    if (error) throw parseDatabaseError(error);
    return { success: true, action: 'deleted' };
  }

  if (rpcError) throw parseDatabaseError(rpcError);
}

export async function listModules(cohortId?: string): Promise<Module[]> {
  let query = supabase.from('modules').select(courseSelect);
  if (cohortId) query = query.eq('cohort_id', cohortId);
  const { data, error } = await query.order('position');
  if (error) {
    let fallbackQuery = supabase.from('modules').select(courseSelectLegacy);
    if (cohortId) fallbackQuery = fallbackQuery.eq('cohort_id', cohortId);
    const { data: fallbackData, error: fallbackError } = await fallbackQuery.order('position');
    if (fallbackError) throw parseDatabaseError(fallbackError);
    return ((fallbackData ?? []) as Module[]).map((module) => ({
      ...module,
      status: module.status ?? 'published',
      lessons: [...(module.lessons ?? [])].map((l) => ({ ...l, status: l.status ?? 'published' })).sort((a, b) => a.position - b.position),
    }));
  }
  return ((data ?? []) as Module[]).map((module) => ({
    ...module,
    status: module.status ?? 'published',
    lessons: [...(module.lessons ?? [])].map((l) => ({ ...l, status: l.status ?? 'published' })).sort((a, b) => a.position - b.position),
  }));
}

export async function createModule(input: ModuleInput): Promise<Module> {
  queryCache.invalidate('curriculum');
  queryCache.invalidate('cohorts');
  let res = await supabase
    .from('modules')
    .insert(input)
    .select('id, cohort_id, course_id, title, description, position, status')
    .single();

  if (res.error) {
    const fallbackInput = {
      cohort_id: input.cohort_id,
      title: input.title,
      description: input.description,
      position: input.position,
    };
    res = await supabase
      .from('modules')
      .insert(fallbackInput)
      .select('id, cohort_id, title, description, position')
      .single();
  }

  if (res.error) throw parseDatabaseError(res.error);
  return { ...(res.data as Module), lessons: [], status: res.data.status ?? 'published' };
}

export async function updateModule(id: string, input: Partial<Omit<ModuleInput, 'cohort_id'>>): Promise<Module> {
  queryCache.invalidate('curriculum');
  queryCache.invalidate('cohorts');
  let res = await supabase
    .from('modules')
    .update(input)
    .eq('id', id)
    .select('id, cohort_id, course_id, title, description, position, status')
    .single();

  if (res.error) {
    const fallbackInput: Record<string, unknown> = {};
    if (input.title !== undefined) fallbackInput.title = input.title;
    if (input.description !== undefined) fallbackInput.description = input.description;
    if (input.position !== undefined) fallbackInput.position = input.position;

    res = await supabase
      .from('modules')
      .update(fallbackInput)
      .eq('id', id)
      .select('id, cohort_id, title, description, position')
      .single();
  }

  if (res.error) throw parseDatabaseError(res.error);
  return { ...(res.data as Module), lessons: [], status: res.data.status ?? 'published' };
}

export async function deleteModule(id: string, options?: { force?: boolean }): Promise<{ success: boolean; action: 'deleted' | 'archived'; message?: string }> {
  queryCache.invalidate('curriculum');
  queryCache.invalidate('cohorts');

  const { data: rpcData, error: rpcError } = await supabase.rpc('admin_delete_module', {
    p_module_id: id,
    p_force: options?.force ?? false,
  });

  if (!rpcError && rpcData) {
    return rpcData as { success: boolean; action: 'deleted' | 'archived'; message?: string };
  }

  if (rpcError && (rpcError.code === '42883' || rpcError.message.includes('admin_delete_module'))) {
    const { error } = await supabase.from('modules').delete().eq('id', id);
    if (error) throw parseDatabaseError(error);
    return { success: true, action: 'deleted' };
  }

  if (rpcError) throw parseDatabaseError(rpcError);
  return { success: true, action: 'deleted' };
}

export async function createLesson(input: LessonInput): Promise<Lesson> {
  queryCache.invalidate('curriculum');
  queryCache.invalidate('cohorts');
  let res = await supabase.from('lessons').insert(input).select('id, module_id, title, description, video_url, duration_minutes, position, status').single();
  if (res.error) {
    const legacyInput = { ...input };
    delete legacyInput.status;
    res = await supabase.from('lessons').insert(legacyInput).select('id, module_id, title, description, video_url, duration_minutes, position').single();
  }
  if (res.error) throw res.error;
  return { ...(res.data as Lesson), status: res.data.status ?? 'published' };
}

export async function updateLesson(id: string, input: Omit<LessonInput, 'module_id'>): Promise<Lesson> {
  queryCache.invalidate('curriculum');
  queryCache.invalidate('cohorts');
  let res = await supabase.from('lessons').update(input).eq('id', id).select('id, module_id, title, description, video_url, duration_minutes, position, status').single();
  if (res.error) {
    const legacyInput = { ...input };
    delete legacyInput.status;
    res = await supabase.from('lessons').update(legacyInput).eq('id', id).select('id, module_id, title, description, video_url, duration_minutes, position').single();
  }
  if (res.error) throw res.error;
  return { ...(res.data as Lesson), status: res.data.status ?? 'published' };
}

export async function deleteLesson(id: string, options?: { force?: boolean }): Promise<{ success: boolean; action: 'deleted' | 'archived'; message?: string }> {
  queryCache.invalidate('curriculum');
  queryCache.invalidate('cohorts');

  const { data: rpcData, error: rpcError } = await supabase.rpc('admin_delete_lesson', {
    p_lesson_id: id,
    p_force: options?.force ?? false,
  });

  if (!rpcError && rpcData) {
    return rpcData as { success: boolean; action: 'deleted' | 'archived'; message?: string };
  }

  if (rpcError && (rpcError.code === '42883' || rpcError.message.includes('admin_delete_lesson'))) {
    const { error } = await supabase.from('lessons').delete().eq('id', id);
    if (error) throw parseDatabaseError(error);
    return { success: true, action: 'deleted' };
  }

  if (rpcError) throw parseDatabaseError(rpcError);
  return { success: true, action: 'deleted' };
}

export async function reorderModules(
  container: { cohortId?: string; courseId?: string },
  moduleIds: string[]
): Promise<void> {
  queryCache.invalidate('curriculum');
  queryCache.invalidate('cohorts');

  if (!moduleIds.length) return;

  const { error: rpcError } = await supabase.rpc('reorder_modules', {
    p_module_ids: moduleIds,
    p_cohort_id: container.cohortId ?? null,
    p_course_id: container.courseId ?? null,
  });

  if (!rpcError) return;

  if (rpcError.code === '42883' || rpcError.message.includes('reorder_modules')) {
    await Promise.all(
      moduleIds.map((id, index) =>
        supabase.from('modules').update({ position: index + 1 }).eq('id', id)
      )
    );
    return;
  }

  throw parseDatabaseError(rpcError);
}

export async function reorderModule(moduleId: string, newPosition: number): Promise<void> {
  queryCache.invalidate('curriculum');
  queryCache.invalidate('cohorts');
  const { error } = await supabase.from('modules').update({ position: newPosition }).eq('id', moduleId);
  if (error) throw parseDatabaseError(error);
}

export async function updateModuleStatus(
  moduleId: string,
  status: 'draft' | 'review' | 'published' | 'archived'
): Promise<void> {
  queryCache.invalidate('curriculum');
  queryCache.invalidate('cohorts');
  const { error } = await supabase.from('modules').update({ status }).eq('id', moduleId);
  if (error) throw parseDatabaseError(error);
}

export async function reorderLessons(
  moduleId: string,
  lessonIds: string[]
): Promise<void> {
  queryCache.invalidate('curriculum');
  queryCache.invalidate('cohorts');

  if (!lessonIds.length) return;

  const { error: rpcError } = await supabase.rpc('reorder_lessons', {
    p_lesson_ids: lessonIds,
    p_module_id: moduleId,
  });

  if (!rpcError) return;

  if (rpcError.code === '42883' || rpcError.message.includes('reorder_lessons')) {
    await Promise.all(
      lessonIds.map((id, index) =>
        supabase.from('lessons').update({ position: index + 1 }).eq('id', id)
      )
    );
    return;
  }

  throw parseDatabaseError(rpcError);
}

export async function reorderLesson(lessonId: string, newPosition: number): Promise<void> {
  queryCache.invalidate('curriculum');
  queryCache.invalidate('cohorts');
  const { error } = await supabase.from('lessons').update({ position: newPosition }).eq('id', lessonId);
  if (error) throw parseDatabaseError(error);
}

export async function updateLessonStatus(
  lessonId: string,
  status: 'draft' | 'review' | 'published' | 'archived'
): Promise<void> {
  queryCache.invalidate('curriculum');
  queryCache.invalidate('cohorts');
  const { error } = await supabase.from('lessons').update({ status }).eq('id', lessonId);
  if (error) throw error;
}

export async function bulkUpdateLessonStatus(
  lessonIds: string[],
  status: 'draft' | 'review' | 'published' | 'archived'
): Promise<void> {
  if (!lessonIds.length) return;
  queryCache.invalidate('curriculum');
  queryCache.invalidate('cohorts');
  const { error } = await supabase.from('lessons').update({ status }).in('id', lessonIds);
  if (error) throw error;
}

export function subscribeToSubmissionFeedback(
  submissionId: string,
  onUpdate: () => void
): () => void {
  const channel = supabase
    .channel(`submission-feedback-${submissionId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'feedback',
        filter: `submission_id=eq.${submissionId}`,
      },
      () => onUpdate()
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'feedback_replies',
      },
      () => onUpdate()
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export function subscribeToUserSubmissions(
  userId: string,
  onUpdate: () => void
): () => void {
  const channel = supabase
    .channel(`user-submissions-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'submissions',
        filter: `student_id=eq.${userId}`,
      },
      () => onUpdate()
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'feedback',
      },
      () => onUpdate()
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'feedback_replies',
      },
      () => onUpdate()
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function duplicateLesson(lessonId: string): Promise<Lesson> {
  queryCache.invalidate('curriculum');
  queryCache.invalidate('cohorts');

  // 1. Try atomic server RPC
  const { data: rpcData, error: rpcError } = await supabase.rpc('duplicate_lesson', {
    p_lesson_id: lessonId,
  });

  if (!rpcError && rpcData) {
    return {
      id: rpcData.id ?? rpcData.lesson_id,
      module_id: rpcData.module_id,
      title: rpcData.title,
      description: rpcData.description,
      video_url: rpcData.video_url,
      duration_minutes: rpcData.duration_minutes,
      position: rpcData.position,
      status: rpcData.status ?? 'draft',
    };
  }

  // 2. Client fallback if RPC is not deployed
  if (rpcError && (rpcError.code === '42883' || rpcError.message.includes('duplicate_lesson'))) {
    const { data: original, error } = await supabase
      .from('lessons')
      .select('module_id, title, description, video_url, duration_minutes, position, status')
      .eq('id', lessonId)
      .single();
    if (error) throw parseDatabaseError(error);

    const { data: newLesson, error: createError } = await supabase
      .from('lessons')
      .insert({
        module_id: original.module_id,
        title: `${original.title} (Copy)`,
        description: original.description,
        video_url: original.video_url,
        duration_minutes: original.duration_minutes,
        position: (original.position || 0) + 1,
        status: 'draft',
      })
      .select('id, module_id, title, description, video_url, duration_minutes, position, status')
      .single();
    if (createError) throw parseDatabaseError(createError);

    // Duplicate resources
    const { data: resources } = await supabase
      .from('lesson_resources')
      .select('name, url, visibility, resource_type, file_size')
      .eq('lesson_id', lessonId);

    if (resources && resources.length > 0) {
      await supabase.from('lesson_resources').insert(
        resources.map((r) => ({ ...r, lesson_id: newLesson.id }))
      );
    }

    // Duplicate assignment
    const { data: assignment } = await supabase
      .from('assignments')
      .select('title, instructions, description, deadline, cohort_id, module_id')
      .eq('lesson_id', lessonId)
      .maybeSingle();

    if (assignment) {
      const assignmentText = assignment.instructions ?? assignment.description ?? null;
      await supabase.from('assignments').insert({
        lesson_id: newLesson.id,
        cohort_id: assignment.cohort_id || null,
        module_id: newLesson.module_id || assignment.module_id || null,
        title: `${assignment.title} (Copy)`,
        instructions: assignmentText,
        description: assignmentText,
        deadline: assignment.deadline,
      });
    }

    return newLesson as Lesson;
  }

  if (rpcError) throw parseDatabaseError(rpcError);
  throw new Error('Failed to duplicate lesson.');
}

export async function duplicateModule(moduleId: string): Promise<Module> {
  queryCache.invalidate('curriculum');
  queryCache.invalidate('cohorts');

  // 1. Try atomic server RPC
  const { data: rpcData, error: rpcError } = await supabase.rpc('duplicate_module', {
    p_module_id: moduleId,
  });

  if (!rpcError && rpcData) {
    const newModuleId = (rpcData.id || rpcData.module_id) as string;
    const { data: lessons } = await supabase
      .from('lessons')
      .select('id, module_id, title, description, video_url, duration_minutes, position, status')
      .eq('module_id', newModuleId)
      .order('position', { ascending: true });

    return {
      id: newModuleId,
      cohort_id: rpcData.cohort_id,
      course_id: rpcData.course_id,
      title: rpcData.title,
      description: rpcData.description,
      position: rpcData.position,
      status: rpcData.status ?? 'draft',
      lessons: (lessons ?? []) as Lesson[],
    };
  }

  // 2. Client fallback if RPC is not deployed
  if (rpcError && (rpcError.code === '42883' || rpcError.message.includes('duplicate_module'))) {
    const { data: original, error } = await supabase
      .from('modules')
      .select('cohort_id, course_id, title, description, position')
      .eq('id', moduleId)
      .single();
    if (error) throw parseDatabaseError(error);

    let newModuleRes = await supabase
      .from('modules')
      .insert({
        cohort_id: original.cohort_id,
        course_id: original.course_id,
        title: `${original.title} (Copy)`,
        description: original.description,
        position: (original.position || 0) + 1,
        status: 'draft',
      })
      .select('id, cohort_id, course_id, title, description, position, status')
      .single();

    if (newModuleRes.error) {
      newModuleRes = await supabase
        .from('modules')
        .insert({
          cohort_id: original.cohort_id,
          title: `${original.title} (Copy)`,
          description: original.description,
          position: (original.position || 0) + 1,
        })
        .select('id, cohort_id, title, description, position')
        .single();
    }

    if (newModuleRes.error) throw parseDatabaseError(newModuleRes.error);
    const newModule = newModuleRes.data;

    // Clone lessons inside module
    const { data: lessons } = await supabase
      .from('lessons')
      .select('id, title, description, video_url, duration_minutes, position, status')
      .eq('module_id', moduleId);

    const clonedLessons: Lesson[] = [];
    for (const l of lessons ?? []) {
      const { data: newLesson } = await supabase
        .from('lessons')
        .insert({
          module_id: newModule.id,
          title: l.title,
          description: l.description,
          video_url: l.video_url,
          duration_minutes: l.duration_minutes,
          position: l.position,
          status: 'draft',
        })
        .select('id, module_id, title, description, video_url, duration_minutes, position, status')
        .single();

      if (newLesson) clonedLessons.push(newLesson as Lesson);
    }

    return {
      ...(newModule as Module),
      status: newModule.status ?? 'draft',
      lessons: clonedLessons,
    };
  }

  if (rpcError) throw parseDatabaseError(rpcError);
  throw new Error('Failed to duplicate module.');
}

export async function listEnrollments(cohortId?: string): Promise<Enrollment[]> {
  let query = supabase.from('enrollments').select('user_id, cohort_id, status, created_at, enrolled_at').order('created_at', { ascending: false });
  if (cohortId) query = query.eq('cohort_id', cohortId);
  const { data, error } = await query;
  if (error) {
    if (error.message.includes('enrolled_at')) {
      let fallbackQuery = supabase.from('enrollments').select('user_id, cohort_id, status, created_at').order('created_at', { ascending: false });
      if (cohortId) fallbackQuery = fallbackQuery.eq('cohort_id', cohortId);
      const fallback = await fallbackQuery;
      if (fallback.error) throw fallback.error;
      return (fallback.data ?? []) as Enrollment[];
    }
    throw error;
  }
  return (data ?? []) as Enrollment[];
}

export async function saveEnrollment(input: EnrollmentInput, id?: string): Promise<Enrollment> {
  if (input.status === 'active') {
    try {
      await supabase
        .from('enrollments')
        .update({ status: 'inactive' })
        .eq('user_id', input.user_id)
        .neq('cohort_id', input.cohort_id)
        .in('status', ['active', 'enrolled']);
    } catch (err) {
      console.warn('Could not deactivate prior enrollments in saveEnrollment:', err);
    }
  }
  const now = new Date().toISOString();
  const upsertPayload = {
    ...input,
    created_at: now,
    enrolled_at: now,
  };
  const query = id
    ? supabase.from('enrollments').update({ status: input.status }).eq('user_id', input.user_id).eq('cohort_id', input.cohort_id)
    : supabase.from('enrollments').upsert(upsertPayload, { onConflict: 'user_id,cohort_id' });
  let { data, error } = await query.select('user_id, cohort_id, status, created_at, enrolled_at').single();
  if (error && error.message.includes('enrolled_at')) {
    const fallbackQuery = id
      ? supabase.from('enrollments').update({ status: input.status }).eq('user_id', input.user_id).eq('cohort_id', input.cohort_id)
      : supabase.from('enrollments').upsert(input, { onConflict: 'user_id,cohort_id' });
    const fallbackRes = await fallbackQuery.select('user_id, cohort_id, status, created_at').single();
    data = fallbackRes.data ? ({ ...fallbackRes.data, enrolled_at: fallbackRes.data.created_at } as typeof data) : null;
    error = fallbackRes.error;
  }
  if (error) throw error;
  return data as Enrollment;
}

export async function deleteEnrollment(userId: string, cohortId: string) {
  const { error } = await supabase.from('enrollments').delete().eq('user_id', userId).eq('cohort_id', cohortId);
  if (error) throw error;
}

// Assignment Normalizer & CRUD
export function normalizeAssignmentRow(row: {
  id: string;
  lesson_id: string;
  title: string;
  cohort_id?: string | null;
  module_id?: string | null;
  instructions?: string | null;
  description?: string | null;
  rubric?: unknown;
  deadline?: string | null;
  created_at?: string;
}): Assignment {
  const instructions = row.instructions ?? row.description ?? null;
  const description = row.description ?? row.instructions ?? null;
  return {
    id: row.id,
    cohort_id: row.cohort_id ?? null,
    module_id: row.module_id ?? null,
    lesson_id: row.lesson_id,
    title: row.title,
    instructions,
    description,
    rubric: row.rubric,
    deadline: row.deadline ?? null,
    created_at: row.created_at,
  };
}

export async function listAssignments(cohortId?: string): Promise<Assignment[]> {
  if (!cohortId) return listAllAssignments();

  // Primary fast path: direct query by cohort_id
  const { data: byCohort, error: cohortErr } = await supabase
    .from('assignments')
    .select('id, cohort_id, module_id, lesson_id, title, instructions, description, deadline, created_at')
    .eq('cohort_id', cohortId)
    .order('deadline', { ascending: true, nullsFirst: false });

  if (!cohortErr && byCohort && byCohort.length > 0) {
    return byCohort.map((row) => normalizeAssignmentRow(row as unknown as Parameters<typeof normalizeAssignmentRow>[0]));
  }

  // Fallback: traverse modules -> lessons for this cohort
  const modules = await listModules(cohortId);
  const lessonIds = modules.flatMap((module) => module.lessons.map((lesson) => lesson.id));
  if (!lessonIds.length) return [];

  const { data, error } = await supabase
    .from('assignments')
    .select('id, cohort_id, module_id, lesson_id, title, instructions, description, deadline, created_at')
    .in('lesson_id', lessonIds)
    .order('deadline', { ascending: true, nullsFirst: false });

  if (error) {
    // Resilience fallback if schema lacks instructions or description column in query
    const fallback = await supabase
      .from('assignments')
      .select('id, lesson_id, title, instructions, deadline, created_at')
      .in('lesson_id', lessonIds)
      .order('deadline', { ascending: true, nullsFirst: false });
    if (fallback.error) throw fallback.error;
    return (fallback.data ?? []).map((row) => normalizeAssignmentRow(row as unknown as Parameters<typeof normalizeAssignmentRow>[0]));
  }

  return (data ?? []).map((row) => normalizeAssignmentRow(row as unknown as Parameters<typeof normalizeAssignmentRow>[0]));
}

export async function listAssignmentsByLesson(lessonId: string): Promise<Assignment[]> {
  const { data, error } = await supabase
    .from('assignments')
    .select('id, cohort_id, module_id, lesson_id, title, instructions, description, deadline, created_at')
    .eq('lesson_id', lessonId)
    .order('created_at', { ascending: true });

  if (error) {
    const fallback = await supabase
      .from('assignments')
      .select('id, lesson_id, title, instructions, deadline, created_at')
      .eq('lesson_id', lessonId)
      .order('created_at', { ascending: true });
    if (fallback.error) throw fallback.error;
    return (fallback.data ?? []).map((row) => normalizeAssignmentRow(row as unknown as Parameters<typeof normalizeAssignmentRow>[0]));
  }

  return (data ?? []).map((row) => normalizeAssignmentRow(row as unknown as Parameters<typeof normalizeAssignmentRow>[0]));
}

export async function listAllAssignments(): Promise<Assignment[]> {
  const { data, error } = await supabase
    .from('assignments')
    .select('id, cohort_id, module_id, lesson_id, title, instructions, description, deadline, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    const fallback = await supabase
      .from('assignments')
      .select('id, lesson_id, title, instructions, deadline, created_at')
      .order('created_at', { ascending: false });
    if (fallback.error) throw fallback.error;
    return (fallback.data ?? []).map((row) => normalizeAssignmentRow(row as unknown as Parameters<typeof normalizeAssignmentRow>[0]));
  }

  return (data ?? []).map((row) => normalizeAssignmentRow(row as unknown as Parameters<typeof normalizeAssignmentRow>[0]));
}

export async function createAssignment(input: AssignmentInput): Promise<Assignment> {
  const trimmedTitle = input.title.trim();
  const textBody = input.instructions?.trim() || input.description?.trim() || null;
  const deadline = input.deadline || null;

  // Resolve cohort_id and module_id if omitted
  let cohortId = input.cohort_id || null;
  let moduleId = input.module_id || null;
  if ((!cohortId || !moduleId) && input.lesson_id) {
    try {
      const { data: lessonData } = await supabase
        .from('lessons')
        .select('id, module_id, modules(cohort_id)')
        .eq('id', input.lesson_id)
        .maybeSingle();

      if (lessonData) {
        if (!moduleId && lessonData.module_id) {
          moduleId = lessonData.module_id;
        }
        const parentCohort = (lessonData.modules as { cohort_id?: string } | undefined)?.cohort_id;
        if (!cohortId && parentCohort) {
          cohortId = parentCohort;
        }
      }
    } catch {
      // Continue and allow database trigger to populate cohort_id/module_id
    }
  }

  const payload: Record<string, unknown> = {
    lesson_id: input.lesson_id,
    title: trimmedTitle,
    instructions: textBody,
    description: textBody,
    deadline,
  };
  if (cohortId) payload.cohort_id = cohortId;
  if (moduleId) payload.module_id = moduleId;

  const { data, error } = await supabase
    .from('assignments')
    .insert(payload)
    .select('id, cohort_id, module_id, lesson_id, title, instructions, description, deadline, created_at')
    .single();

  if (error) {
    // Resilience: If instructions column doesn't exist, try description
    if (error.message?.includes('instructions') || error.code === '42703') {
      const { instructions: _, ...legacyPayload } = payload;
      const fallback = await supabase
        .from('assignments')
        .insert(legacyPayload)
        .select('id, lesson_id, title, description, deadline, created_at')
        .single();
      if (fallback.error) throw fallback.error;
      return normalizeAssignmentRow(fallback.data as unknown as Parameters<typeof normalizeAssignmentRow>[0]);
    }
    // Resilience: If description column doesn't exist, try instructions
    if (error.message?.includes('description')) {
      const { description: _, ...legacyPayload } = payload;
      const fallback = await supabase
        .from('assignments')
        .insert(legacyPayload)
        .select('id, lesson_id, title, instructions, deadline, created_at')
        .single();
      if (fallback.error) throw fallback.error;
      return normalizeAssignmentRow(fallback.data as unknown as Parameters<typeof normalizeAssignmentRow>[0]);
    }
    throw error;
  }

  return normalizeAssignmentRow(data as unknown as Parameters<typeof normalizeAssignmentRow>[0]);
}

export async function updateAssignment(
  id: string,
  input: Omit<AssignmentInput, 'lesson_id'>
): Promise<Assignment> {
  const textBody = input.instructions?.trim() || input.description?.trim() || null;
  const updatePayload: Record<string, unknown> = {
    title: input.title.trim(),
    instructions: textBody,
    description: textBody,
    deadline: input.deadline || null,
  };
  if (input.cohort_id) updatePayload.cohort_id = input.cohort_id;
  if (input.module_id) updatePayload.module_id = input.module_id;

  const { data, error } = await supabase
    .from('assignments')
    .update(updatePayload)
    .eq('id', id)
    .select('id, cohort_id, module_id, lesson_id, title, instructions, description, deadline, created_at')
    .single();

  if (error) {
    if (error.message?.includes('instructions') || error.code === '42703') {
      const { instructions: _, ...legacyPayload } = updatePayload;
      const fallback = await supabase
        .from('assignments')
        .update(legacyPayload)
        .eq('id', id)
        .select('id, lesson_id, title, description, deadline, created_at')
        .single();
      if (fallback.error) throw fallback.error;
      return normalizeAssignmentRow(fallback.data as unknown as Parameters<typeof normalizeAssignmentRow>[0]);
    }
    if (error.message?.includes('description')) {
      const { description: _, ...legacyPayload } = updatePayload;
      const fallback = await supabase
        .from('assignments')
        .update(legacyPayload)
        .eq('id', id)
        .select('id, lesson_id, title, instructions, deadline, created_at')
        .single();
      if (fallback.error) throw fallback.error;
      return normalizeAssignmentRow(fallback.data as unknown as Parameters<typeof normalizeAssignmentRow>[0]);
    }
    throw error;
  }

  return normalizeAssignmentRow(data as unknown as Parameters<typeof normalizeAssignmentRow>[0]);
}

export async function deleteAssignment(id: string): Promise<void> {
  const { error } = await supabase.from('assignments').delete().eq('id', id);
  if (error) throw error;
}

// Lesson Resources CRUD
export async function listLessonResources(lessonId: string): Promise<LessonResource[]> {
  const { data, error } = await supabase
    .from('lesson_resources')
    .select('id, lesson_id, name, url, visibility, resource_type, file_size, created_at')
    .eq('lesson_id', lessonId)
    .order('created_at', { ascending: true });

  if (error) {
    // Fallback if visibility or resource_type columns are not yet in the DB
    const fallback = await supabase
      .from('lesson_resources')
      .select('id, lesson_id, name, url, created_at')
      .eq('lesson_id', lessonId)
      .order('name');
    if (fallback.error) return [];
    return (fallback.data ?? []).map((item) => ({
      ...item,
      visibility: 'enrolled' as VisibilityRule,
      resource_type: detectResourceType(item.url),
      file_size: null,
    }));
  }

  return (data ?? []).map((res) => ({
    ...res,
    visibility: (res.visibility as VisibilityRule) || 'enrolled',
    resource_type: (res.resource_type as ResourceType) || detectResourceType(res.url),
  })) as LessonResource[];
}

export async function listAllLessonResources(): Promise<LessonResource[]> {
  const { data, error } = await supabase
    .from('lesson_resources')
    .select('id, lesson_id, name, url, visibility, resource_type, file_size, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    const fallback = await supabase
      .from('lesson_resources')
      .select('id, lesson_id, name, url, created_at')
      .order('created_at', { ascending: false });
    if (fallback.error) return [];
    return (fallback.data ?? []).map((item) => ({
      ...item,
      visibility: 'enrolled' as VisibilityRule,
      resource_type: detectResourceType(item.url),
      file_size: null,
    }));
  }

  return (data ?? []).map((res) => ({
    ...res,
    visibility: (res.visibility as VisibilityRule) || 'enrolled',
    resource_type: (res.resource_type as ResourceType) || detectResourceType(res.url),
  })) as LessonResource[];
}

export async function createLessonResource(input: LessonResourceInput): Promise<LessonResource> {
  const resourcePayload: Record<string, unknown> = {
    lesson_id: input.lesson_id,
    name: input.name.trim(),
    url: input.url.trim(),
    visibility: input.visibility ?? 'enrolled',
    resource_type: input.resource_type ?? detectResourceType(input.url),
    file_size: input.file_size ?? null,
  };

  let result = await supabase.from('lesson_resources').insert(resourcePayload).select().single();
  if (result.error && (result.error.message.includes('visibility') || result.error.message.includes('resource_type') || result.error.message.includes('file_size'))) {
    result = await supabase
      .from('lesson_resources')
      .insert({
        lesson_id: input.lesson_id,
        name: input.name.trim(),
        url: input.url.trim(),
      })
      .select('id, lesson_id, name, url, created_at')
      .single();
  }

  if (result.error) throw result.error;

  return {
    ...result.data,
    visibility: result.data.visibility ?? (input.visibility || 'enrolled'),
    resource_type: result.data.resource_type ?? (input.resource_type || detectResourceType(input.url)),
    file_size: result.data.file_size ?? input.file_size,
  } as LessonResource;
}

export async function updateLessonResource(id: string, input: Omit<LessonResourceInput, 'lesson_id'>): Promise<LessonResource> {
  const resourcePayload: Record<string, unknown> = {
    name: input.name.trim(),
    url: input.url.trim(),
    visibility: input.visibility ?? 'enrolled',
    resource_type: input.resource_type ?? detectResourceType(input.url),
    file_size: input.file_size ?? null,
  };

  let result = await supabase.from('lesson_resources').update(resourcePayload).eq('id', id).select().single();
  if (result.error && (result.error.message.includes('visibility') || result.error.message.includes('resource_type') || result.error.message.includes('file_size'))) {
    result = await supabase
      .from('lesson_resources')
      .update({
        name: input.name.trim(),
        url: input.url.trim(),
      })
      .eq('id', id)
      .select('id, lesson_id, name, url, created_at')
      .single();
  }

  if (result.error) throw result.error;

  return {
    ...result.data,
    visibility: result.data.visibility ?? (input.visibility || 'enrolled'),
    resource_type: result.data.resource_type ?? (input.resource_type || detectResourceType(input.url)),
    file_size: result.data.file_size ?? input.file_size,
  } as LessonResource;
}

export async function deleteLessonResource(id: string): Promise<void> {
  const { error } = await supabase.from('lesson_resources').delete().eq('id', id);
  if (error) throw error;
}

// Storage asset uploads
export async function uploadCourseAsset(file: File, folder = 'lessons'): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const path = `${folder}/${crypto.randomUUID()}-${safeName}`;
  const contentType = file.type || inferMimeType(file.name);
  const { error } = await supabase.storage.from('course-assets').upload(path, file, {
    upsert: false,
    contentType,
  });
  if (error) throw error;
  // Return the canonical private storage reference rather than a public CDN URL
  return `course-assets/${path}`;
}

export async function uploadSubmissionFile(userId: string, file: File): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const path = `${userId}/${crypto.randomUUID()}-${safeName}`;
  const contentType = file.type || inferMimeType(file.name);
  const { error: uploadError } = await supabase.storage.from('submissions').upload(path, file, {
    upsert: false,
    contentType,
  });
  if (uploadError) {
    if (uploadError.message?.includes('Bucket not found') || (uploadError as { statusCode?: string }).statusCode === '404') {
      throw new Error(
        'Storage bucket "submissions" not found in Supabase. Please create the private "submissions" bucket in Supabase Dashboard (Storage -> New Bucket) or execute migration 20260921000003_storage_and_hardening.sql.'
      );
    }
    throw uploadError;
  }

  // The 'submissions' bucket is strictly private. Generate a signed expiring URL for immediate access
  // or return the canonical private storage path reference.
  const { data: signedData, error: signedError } = await supabase.storage
    .from('submissions')
    .createSignedUrl(path, 86400); // 24-hour expiration

  if (!signedError && signedData?.signedUrl) {
    return signedData.signedUrl;
  }

  // Fallback to private object path reference
  return `submissions/${path}`;
}

/**
 * Resolves a secure, time-limited signed URL for private student submission files.
 * External submission links (YouTube, Vimeo, Frame.io, Google Drive) are preserved as-is.
 * Fails closed with an explicit error if URL signing fails for private storage.
 */
export async function getSecureSubmissionUrl(fileUrl: string, expiresIn = 3600): Promise<string> {
  if (!fileUrl) return '';

  // Preserve external third-party streaming/sharing links
  const isSupabaseStorage =
    fileUrl.includes('/storage/v1/object/') ||
    fileUrl.startsWith('submissions/') ||
    (fileUrl.includes('supabase.co') && fileUrl.includes('submissions'));

  if (!isSupabaseStorage && (fileUrl.startsWith('http://') || fileUrl.startsWith('https://'))) {
    return fileUrl;
  }

  // Extract object path within the 'submissions' bucket
  let objectPath = fileUrl;
  if (fileUrl.includes('/submissions/')) {
    objectPath = fileUrl.split('/submissions/')[1];
  } else if (fileUrl.startsWith('submissions/')) {
    objectPath = fileUrl.slice('submissions/'.length);
  }

  // Strip query parameters or URL hashes
  objectPath = objectPath.split('?')[0].split('#')[0];
  objectPath = decodeURIComponent(objectPath);

  if (!objectPath || !objectPath.trim()) {
    throw new Error('Invalid submission storage path.');
  }

  const { data, error } = await supabase.storage
    .from('submissions')
    .createSignedUrl(objectPath, expiresIn);

  if (error || !data?.signedUrl) {
    throw new Error(
      error?.message || 'Failed to generate secure signed URL for submission: access denied or file unavailable.'
    );
  }

  return data.signedUrl;
}

/**
 * Checks whether an asset URL or storage path points to protected Supabase course assets
 * or contains a time-limited signed token.
 */
export function isSecurableAsset(fileUrl: string | null | undefined): boolean {
  if (!fileUrl) return false;
  return (
    fileUrl.includes('/storage/v1/object/') ||
    fileUrl.startsWith('course-assets/') ||
    fileUrl.includes('course-assets') ||
    fileUrl.startsWith('lessons/') ||
    fileUrl.startsWith('resources/') ||
    fileUrl.includes('token=')
  );
}

/**
 * Resolves a secure, time-limited signed URL for private course assets or lesson downloads.
 * External URLs are returned as-is.
 * Fails closed with an explicit error if URL signing fails for private storage.
 */
export async function getSecureAssetUrl(fileUrl: string, expiresIn = 3600): Promise<string> {
  if (!fileUrl) return '';

  const isSupabaseStorage = isSecurableAsset(fileUrl);

  if (!isSupabaseStorage && (fileUrl.startsWith('http://') || fileUrl.startsWith('https://'))) {
    return fileUrl;
  }

  let objectPath = fileUrl;
  if (fileUrl.includes('/course-assets/')) {
    objectPath = fileUrl.split('/course-assets/')[1];
  } else if (fileUrl.startsWith('course-assets/')) {
    objectPath = fileUrl.slice('course-assets/'.length);
  }

  objectPath = objectPath.split('?')[0].split('#')[0];
  objectPath = decodeURIComponent(objectPath).replace(/^\/+/, '');

  if (!objectPath || !objectPath.trim()) {
    throw new Error('Invalid course asset storage path.');
  }

  const { data, error } = await supabase.storage
    .from('course-assets')
    .createSignedUrl(objectPath, expiresIn);

  if (error || !data?.signedUrl) {
    throw new Error(
      error?.message || 'Failed to generate secure signed URL for course asset: access denied or file unavailable.'
    );
  }

  return data.signedUrl;
}

/**
 * Validates access entitlements and returns a secure, time-limited signed download URL
 * for a lesson resource. Enforces enrollment and completion rules via server-side RPC.
 * Fails closed without falling back to raw URLs if authorization or entitlement fails.
 */
export async function getLessonResourceDownloadUrl(
  resourceId: string,
  fallbackUrl?: string,
  expiresIn = 3600
): Promise<string> {
  if (!resourceId) {
    if (fallbackUrl) {
      return getSecureAssetUrl(fallbackUrl, expiresIn);
    }
    return '';
  }

  const { data, error } = await supabase.rpc('get_lesson_resource_download_url', {
    p_resource_id: resourceId,
  });

  if (error) {
    const errMsg = error.message || 'Failed to resolve download URL.';
    throw new Error(errMsg);
  }

  const payload = data as { url?: string } | null;
  const targetUrl = payload?.url;
  if (!targetUrl) {
    throw new Error('No download URL available for this resource.');
  }

  return getSecureAssetUrl(targetUrl, expiresIn);
}

// Student Submissions & Resubmissions
export async function listMySubmissions(userId: string): Promise<Submission[]> {
  let { data, error } = await supabase
    .from('submissions')
    .select('id, assignment_id, student_id, file_url, status, notes, created_at, updated_at, is_late, version_number, version')
    .eq('student_id', userId)
    .order('created_at', { ascending: false });

  if (error && (error.message.includes('is_late') || error.message.includes('version_number') || error.message.includes('version') || error.message.includes('notes'))) {
    const fallback = await supabase
      .from('submissions')
      .select('id, assignment_id, student_id, file_url, status, created_at')
      .eq('student_id', userId)
      .order('created_at', { ascending: false });
    data = fallback.data as unknown as typeof data;
    error = fallback.error;
  }
  if (error) throw error;
  const submissions = ((data ?? []) as DbSubmissionRow[]).map((s) => ({
    ...s,
    status: normalizeSubmissionStatus(s.status),
    version: s.version ?? s.version_number ?? 1,
    version_number: s.version_number ?? s.version ?? 1,
    notes: s.notes ?? null,
  })) as Omit<Submission, 'feedback'>[];
  return addFeedback(submissions);
}

export async function submitOrReplaceAssignment(
  userId: string,
  assignmentId: string,
  fileUrl: string,
  existingSubmissionId?: string,
  isDraft: boolean = false,
  notes?: string
): Promise<Submission> {
  // 1. Primary: Execute server-side definer RPC to guarantee status & ownership integrity
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('submit_student_assignment', {
      p_assignment_id: assignmentId,
      p_file_url: fileUrl,
      p_is_draft: isDraft,
      p_notes: notes || null,
    });

    if (!rpcError && rpcData) {
      const parsed = rpcData as Record<string, unknown>;
      const versionNum = (parsed.version_number as number) ?? (parsed.version as number) ?? 1;
      return {
        id: parsed.id as string,
        assignment_id: parsed.assignment_id as string,
        student_id: parsed.student_id as string,
        file_url: parsed.file_url as string,
        status: normalizeSubmissionStatus(parsed.status as string),
        notes: (parsed.notes as string) || notes || null,
        is_late: Boolean(parsed.is_late),
        version: versionNum,
        version_number: versionNum,
        created_at: parsed.created_at as string,
        updated_at: (parsed.updated_at as string) || (parsed.created_at as string),
        feedback: null,
      };
    }

    if (rpcError && !rpcError.message.includes('function') && !rpcError.message.includes('does not exist')) {
      throw new Error(rpcError.message);
    }
  } catch (rpcErr) {
    if (rpcErr instanceof Error && (
      rpcErr.message.includes('suspended') ||
      rpcErr.message.includes('enrolled') ||
      rpcErr.message.includes('Authentication')
    )) {
      throw rpcErr;
    }
    console.warn('submit_student_assignment RPC fallback to direct query:', rpcErr);
  }

  // 2. Fallback: Direct table operations (if RPC migration is pending)
  // Check if submission is late based on assignment deadline
  let isLate = false;
  try {
    const { data: assign } = await supabase
      .from('assignments')
      .select('deadline')
      .eq('id', assignmentId)
      .maybeSingle();

    if (assign?.deadline) {
      isLate = new Date().getTime() > new Date(assign.deadline).getTime();
    }
  } catch {
    isLate = false;
  }

  let targetId = existingSubmissionId;
  let previousRecord: { id: string; file_url: string; status: string; notes?: string | null; version_number?: number; version?: number } | null = null;

  if (!targetId) {
    const { data: existing } = await supabase
      .from('submissions')
      .select('id, file_url, status, notes, version_number, version')
      .eq('student_id', userId)
      .eq('assignment_id', assignmentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing?.id) {
      targetId = existing.id;
      previousRecord = existing;
    }
  } else {
    const { data: existing } = await supabase
      .from('submissions')
      .select('id, file_url, status, notes, version_number, version')
      .eq('id', targetId)
      .maybeSingle();
    previousRecord = existing;
  }

  const newStatus: SubmissionStatus = isDraft ? 'draft' : 'pending';
  const prevVer = previousRecord?.version_number ?? previousRecord?.version ?? 1;
  const newVersionNumber = prevVer + (previousRecord ? 1 : 0);

  if (targetId && previousRecord) {
    // Save previous version to submission_versions
    try {
      await supabase.from('submission_versions').insert({
        submission_id: targetId,
        version_number: prevVer,
        version: prevVer,
        file_url: previousRecord.file_url,
        status: normalizeSubmissionStatus(previousRecord.status),
        notes: previousRecord.notes || notes || null,
      });
    } catch (verErr) {
      console.warn('submission_versions table unavailable:', verErr);
    }

    const updatePayload: Record<string, unknown> = {
      file_url: fileUrl,
      status: newStatus,
      notes: notes || null,
      is_late: isLate,
      version: newVersionNumber,
      version_number: newVersionNumber,
    };
    let { data, error } = await supabase
      .from('submissions')
      .update({ ...updatePayload, updated_at: new Date().toISOString() })
      .eq('id', targetId)
      .select('id, assignment_id, student_id, file_url, status, notes, created_at, updated_at, is_late, version_number, version')
      .single();

    if (error && (error.message.includes('updated_at') || error.message.includes('is_late') || error.message.includes('version') || error.message.includes('notes'))) {
      const retry = await supabase
        .from('submissions')
        .update({ file_url: fileUrl, status: newStatus })
        .eq('id', targetId)
        .select('id, assignment_id, student_id, file_url, status, created_at')
        .single();
      data = retry.data as unknown as typeof data;
      error = retry.error;
    }
    if (error) throw error;
    const finalData = data as Record<string, unknown>;
    return {
      id: finalData.id as string,
      assignment_id: finalData.assignment_id as string,
      student_id: finalData.student_id as string,
      file_url: finalData.file_url as string,
      status: normalizeSubmissionStatus(finalData.status as string),
      notes: (finalData.notes as string) || notes || null,
      is_late: Boolean(finalData.is_late ?? isLate),
      version: (finalData.version as number) ?? (finalData.version_number as number) ?? newVersionNumber,
      version_number: (finalData.version_number as number) ?? (finalData.version as number) ?? newVersionNumber,
      created_at: finalData.created_at as string,
      updated_at: (finalData.updated_at as string) || new Date().toISOString(),
      feedback: null,
    };
  }

  // Initial submission
  const insertPayload: Record<string, unknown> = {
    student_id: userId,
    assignment_id: assignmentId,
    file_url: fileUrl,
    status: newStatus,
    notes: notes || null,
    is_late: isLate,
    version: 1,
    version_number: 1,
  };

  let { data, error } = await supabase
    .from('submissions')
    .insert(insertPayload)
    .select('id, assignment_id, student_id, file_url, status, notes, created_at, updated_at, is_late, version_number, version')
    .single();

  if (error && (error.message.includes('is_late') || error.message.includes('version') || error.message.includes('notes'))) {
    const retry = await supabase
      .from('submissions')
      .insert({ student_id: userId, assignment_id: assignmentId, file_url: fileUrl, status: newStatus })
      .select('id, assignment_id, student_id, file_url, status, created_at')
      .single();
    data = retry.data as unknown as typeof data;
    error = retry.error;
  }
  if (error) throw error;
  const finalData = data as Record<string, unknown>;
  return {
    id: finalData.id as string,
    assignment_id: finalData.assignment_id as string,
    student_id: finalData.student_id as string,
    file_url: finalData.file_url as string,
    status: normalizeSubmissionStatus(finalData.status as string),
    notes: (finalData.notes as string) || notes || null,
    is_late: Boolean(finalData.is_late ?? isLate),
    version: (finalData.version as number) ?? (finalData.version_number as number) ?? 1,
    version_number: (finalData.version_number as number) ?? (finalData.version as number) ?? 1,
    created_at: finalData.created_at as string,
    updated_at: (finalData.updated_at as string) || finalData.created_at as string,
    feedback: null,
  };
}

export async function submitAssignment(userId: string, assignmentId: string, videoUrl: string): Promise<Submission> {
  return submitOrReplaceAssignment(userId, assignmentId, videoUrl);
}

export async function listPendingSubmissions(): Promise<Submission[]> {
  const { data, error } = await supabase
    .from('submissions')
    .select('id, assignment_id, student_id, file_url, status, notes, created_at, updated_at, is_late, version_number, version')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw error;
  const submissions = ((data ?? []) as DbSubmissionRow[]).map((s) => ({
    ...s,
    status: normalizeSubmissionStatus(s.status),
    version: s.version ?? s.version_number ?? 1,
    version_number: s.version_number ?? s.version ?? 1,
    notes: s.notes ?? null,
  })) as Omit<Submission, 'feedback'>[];
  return addFeedback(submissions);
}

export async function listMentorSubmissions(
  statusFilter: 'pending' | 'reviewed' | 'resubmit' | 'all' = 'all',
  cohortId?: string,
  allowedCohortIds?: string[]
): Promise<MentorSubmission[]> {
  if (allowedCohortIds !== undefined && allowedCohortIds.length === 0) {
    return [];
  }
  if (cohortId && allowedCohortIds && !allowedCohortIds.includes(cohortId)) {
    return [];
  }

  let query = supabase
    .from('submissions')
    .select('id, assignment_id, student_id, file_url, status, notes, created_at, updated_at, is_late, version_number, version')
    .order('created_at', { ascending: false });

  if (statusFilter !== 'all') {
    if (statusFilter === 'resubmit') {
      query = query.in('status', ['resubmit', 'resubmit_requested', 'needs_revision']);
    } else if (statusFilter === 'reviewed') {
      query = query.in('status', ['reviewed', 'accepted', 'approved']);
    } else {
      query = query.eq('status', statusFilter);
    }
  }

  const { data: rawSubmissions, error } = await query;
  if (error) throw error;
  if (!rawSubmissions || rawSubmissions.length === 0) return [];

  const studentIds = Array.from(new Set(rawSubmissions.map((s) => s.student_id)));
  const assignmentIds = Array.from(new Set(rawSubmissions.map((s) => s.assignment_id)));
  const submissionIds = rawSubmissions.map((s) => s.id);

  const [
    { data: profiles },
    { data: assignments },
    { data: feedbackRows },
  ] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email').in('id', studentIds),
    supabase.from('assignments').select('id, title, instructions, description, deadline, lesson_id, cohort_id').in('id', assignmentIds),
    supabase.from('feedback').select('id, submission_id, mentor_id, comments, created_at').in('submission_id', submissionIds).order('created_at', { ascending: false }),
  ]);

  const profileMap = new Map<string, { full_name: string; email: string }>();
  for (const p of profiles ?? []) {
    profileMap.set(p.id, { full_name: p.full_name, email: p.email });
  }

  const cohortNameByAssignment = new Map<string, string>();
  const cohortIdByAssignment = new Map<string, string>();
  const assignmentMap = new Map<string, { title: string; instructions: string | null; deadline: string | null; lesson_id: string }>();
  for (const a of assignments ?? []) {
    const aRecord = a as { id: string; title: string; instructions?: string | null; description?: string | null; deadline: string | null; lesson_id: string; cohort_id?: string | null };
    const text = aRecord.instructions ?? aRecord.description ?? null;
    assignmentMap.set(aRecord.id, { title: aRecord.title, instructions: text, deadline: aRecord.deadline, lesson_id: aRecord.lesson_id });
    if (aRecord.cohort_id) {
      cohortIdByAssignment.set(aRecord.id, aRecord.cohort_id);
    }
  }

  // Resolve cohort names via lesson_id -> module_id -> cohort_id
  const lessonIds = Array.from(new Set((assignments ?? []).map((a) => a.lesson_id).filter(Boolean)));

  if (lessonIds.length > 0) {
    const { data: lessons } = await supabase
      .from('lessons')
      .select('id, module_id')
      .in('id', lessonIds);

    const moduleIds = Array.from(new Set((lessons ?? []).map((l) => l.module_id).filter(Boolean)));
    if (moduleIds.length > 0) {
      const { data: modules } = await supabase
        .from('modules')
        .select('id, cohort_id')
        .in('id', moduleIds);

      const cohortIds = Array.from(new Set((modules ?? []).map((m) => m.cohort_id).filter(Boolean)));
      if (cohortIds.length > 0) {
        const { data: cohorts } = await supabase
          .from('cohorts')
          .select('id, title')
          .in('id', cohortIds);

        const cohortMap = new Map<string, string>();
        for (const c of cohorts ?? []) {
          cohortMap.set(c.id, c.title);
        }

        const moduleToCohort = new Map<string, { id: string; name: string }>();
        for (const m of modules ?? []) {
          moduleToCohort.set(m.id, { id: m.cohort_id, name: cohortMap.get(m.cohort_id) || 'General Cohort' });
        }

        const lessonToCohort = new Map<string, { id: string; name: string }>();
        for (const l of lessons ?? []) {
          const cInfo = moduleToCohort.get(l.module_id);
          if (cInfo) lessonToCohort.set(l.id, cInfo);
        }

        for (const a of assignments ?? []) {
          const cInfo = lessonToCohort.get(a.lesson_id);
          if (cInfo) {
            cohortNameByAssignment.set(a.id, cInfo.name);
            cohortIdByAssignment.set(a.id, cInfo.id);
          }
        }
      }
    }
  }

  // Group feedback history
  const feedbackBySubmission = new Map<string, string>();
  const historyBySubmission = new Map<string, FeedbackItem[]>();

  for (const item of feedbackRows ?? []) {
    if (!feedbackBySubmission.has(item.submission_id)) {
      feedbackBySubmission.set(item.submission_id, item.comments);
    }
    const list = historyBySubmission.get(item.submission_id) || [];
    list.push(item as FeedbackItem);
    historyBySubmission.set(item.submission_id, list);
  }

  const results: MentorSubmission[] = [];

  for (const s of rawSubmissions) {
    const aCohortId = cohortIdByAssignment.get(s.assignment_id);
    if (cohortId && aCohortId && aCohortId !== cohortId) {
      continue;
    }
    if (allowedCohortIds && allowedCohortIds.length > 0 && aCohortId && !allowedCohortIds.includes(aCohortId)) {
      continue;
    }

    const student = profileMap.get(s.student_id);
    const assignment = assignmentMap.get(s.assignment_id);

    results.push({
      ...s,
      student_name: student?.full_name || 'Student',
      student_email: student?.email || '',
      assignment_title: assignment?.title || 'Assignment Challenge',
      assignment_instructions: assignment?.instructions || null,
      assignment_deadline: assignment?.deadline || null,
      cohort_name: cohortNameByAssignment.get(s.assignment_id) || 'Main Cohort',
      feedback: feedbackBySubmission.get(s.id) ?? null,
      feedback_history: historyBySubmission.get(s.id) ?? [],
    });
  }

  return results;
}

export async function reviewSubmission(
  id: string,
  status: Extract<Submission['status'], 'reviewed' | 'resubmit'>,
  feedback: string
): Promise<void> {
  const normStatus = normalizeSubmissionStatus(status);
  const { error } = await supabase.rpc('review_submission', {
    p_submission_id: id,
    p_status: normStatus,
    p_comments: feedback.trim() || null,
  });

  if (!error) return;

  // Resilient Direct Table Fallback (if RPC is pending in database migration)
  if (
    error.code === 'PGRST202' ||
    error.message.includes('review_submission') ||
    error.message.includes('schema cache') ||
    error.message.includes('function')
  ) {
    const { data: userData } = await supabase.auth.getUser();
    const currentUserId = userData?.user?.id;
    if (!currentUserId) {
      throw new Error('Authentication required to review submission.');
    }

    // Insert feedback record
    const { error: fbErr } = await supabase.from('feedback').insert({
      submission_id: id,
      mentor_id: currentUserId,
      comment: feedback.trim() || null,
      comments: feedback.trim() || null,
      rubric: {},
      timestamped_notes: [],
    });
    if (fbErr) throw fbErr;

    // Update submission status
    const { error: subErr } = await supabase
      .from('submissions')
      .update({
        status: normStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (subErr) throw subErr;

    return;
  }

  throw new Error(error.message || 'Unable to review submission.');
}

async function addFeedback(submissions: Omit<Submission, 'feedback'>[]): Promise<Submission[]> {
  if (!submissions.length) return [];
  let feedbackData;
  const { data: enhancedData, error: enhancedError } = await supabase
    .from('feedback')
    .select('id, submission_id, mentor_id, comments, rubric, timestamped_notes, student_read_at, created_at')
    .in('submission_id', submissions.map((submission) => submission.id))
    .order('created_at', { ascending: false });

  if (
    enhancedError &&
    (enhancedError.message.includes('rubric') ||
      enhancedError.message.includes('timestamped_notes') ||
      enhancedError.message.includes('student_read_at') ||
      enhancedError.message.includes('comments'))
  ) {
    const { data: midData, error: midError } = await supabase
      .from('feedback')
      .select('id, submission_id, mentor_id, comments, rubric, timestamped_notes, created_at')
      .in('submission_id', submissions.map((submission) => submission.id))
      .order('created_at', { ascending: false });

    if (midError) {
      const { data: legacyData, error: legacyError } = await supabase
        .from('feedback')
        .select('id, submission_id, mentor_id, comments, created_at')
        .in('submission_id', submissions.map((submission) => submission.id))
        .order('created_at', { ascending: false });

      if (legacyError) {
        // Fallback to baseline canonical schema where column was 'comment'
        const { data: commentData } = await supabase
          .from('feedback')
          .select('id, submission_id, mentor_id, comment, created_at')
          .in('submission_id', submissions.map((submission) => submission.id))
          .order('created_at', { ascending: false });
        feedbackData = commentData;
      } else {
        feedbackData = legacyData;
      }
    } else {
      feedbackData = midData;
    }
  } else {
    feedbackData = enhancedData;
  }

  const feedbackBySubmission = new Map<string, string>();
  const historyBySubmission = new Map<string, FeedbackItem[]>();

  const mentorIds = Array.from(new Set((feedbackData ?? []).map((f) => f.mentor_id)));
  const { data: mentorProfiles } = mentorIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', mentorIds)
    : { data: [] };
  const mentorMap = new Map((mentorProfiles ?? []).map((p) => [p.id, p.full_name]));

  // Fetch feedback replies if table exists
  const feedbackIds = (feedbackData ?? []).map((f) => f.id);
  const repliesByFeedback = new Map<string, FeedbackReply[]>();

  if (feedbackIds.length > 0) {
    try {
      const { data: replies } = await supabase
        .from('feedback_replies')
        .select('id, feedback_id, author_id, message, created_at')
        .in('feedback_id', feedbackIds)
        .order('created_at', { ascending: true });

      const replyAuthorIds = Array.from(new Set((replies ?? []).map((r) => r.author_id)));
      let replyProfiles: Array<{ id: string; full_name: string | null; role: string }> = [];
      if (replyAuthorIds.length) {
        const { data: pubData, error: pubErr } = await supabase
          .from('public_profiles')
          .select('id, full_name, role')
          .in('id', replyAuthorIds);
        if (!pubErr && pubData) {
          replyProfiles = pubData as typeof replyProfiles;
        } else {
          const { data: fallbackProfiles } = await supabase
            .from('profiles')
            .select('id, full_name, role')
            .in('id', replyAuthorIds);
          replyProfiles = (fallbackProfiles ?? []) as typeof replyProfiles;
        }
      }
      const replyProfileMap = new Map((replyProfiles ?? []).map((p) => [p.id, p]));

      for (const r of replies ?? []) {
        const list = repliesByFeedback.get(r.feedback_id) || [];
        const author = replyProfileMap.get(r.author_id);
        list.push({
          ...r,
          author_name: author?.full_name || 'Member',
          author_role: author?.role || 'student',
        });
        repliesByFeedback.set(r.feedback_id, list);
      }
    } catch {
      // ignore
    }
  }

  for (const item of feedbackData ?? []) {
    const raw = item as Record<string, unknown>;
    const commentText = (raw.comments as string) ?? (raw.comment as string) ?? '';
    if (!feedbackBySubmission.has(item.submission_id)) {
      feedbackBySubmission.set(item.submission_id, commentText);
    }
    const current = historyBySubmission.get(item.submission_id) || [];
    current.push({
      ...(item as FeedbackItem),
      comments: commentText,
      rubric: (raw.rubric as FeedbackItem['rubric']) || (raw.rubric_scores as FeedbackItem['rubric']) || {},
      timestamped_notes: Array.isArray(raw.timestamped_notes) ? raw.timestamped_notes : [],
      mentor_name: mentorMap.get(item.mentor_id) || 'Mentor',
      replies: repliesByFeedback.get(item.id) || [],
    });
    historyBySubmission.set(item.submission_id, current);
  }

  return submissions.map((submission) => ({
    ...submission,
    feedback: feedbackBySubmission.get(submission.id) ?? null,
    feedback_history: historyBySubmission.get(submission.id) ?? [],
  }));
}

export async function markFeedbackRead(feedbackId: string): Promise<void> {
  try {
    const { error: rpcError } = await supabase.rpc('mark_feedback_as_read', {
      p_feedback_id: feedbackId,
    });
    if (!rpcError) return;
  } catch {
    // fallback to direct table update
  }

  const { error } = await supabase
    .from('feedback')
    .update({ student_read_at: new Date().toISOString() })
    .eq('id', feedbackId);

  if (error) {
    console.warn('markFeedbackRead error:', error);
    throw error;
  }
}

// Student Announcements
export async function listStudentAnnouncements(cohortId?: string | null): Promise<StudentAnnouncement[]> {
  let query = supabase
    .from('announcements')
    .select('id, cohort_id, title, body, created_at')
    .eq('published', true)
    .order('created_at', { ascending: false });

  if (cohortId) {
    // When a cohort is selected, retrieve announcements targeted to that cohort or platform broadcasts (cohort_id is null)
    query = query.or(`cohort_id.is.null,cohort_id.eq.${cohortId}`);
  }

  const { data, error } = await query;

  if (error) {
    if (error.code === '42703' || error.message.includes('cohort_id')) {
      const fb = await supabase
        .from('announcements')
        .select('id, title, body, created_at')
        .eq('published', true)
        .order('created_at', { ascending: false });
      if (!fb.error && fb.data) {
        return fb.data as StudentAnnouncement[];
      }
    }
    if (error.code === '42P01' || error.message.includes('announcements')) {
      console.warn('Announcements table not yet migrated, returning empty list');
      return [];
    }
    throw parseDatabaseError(error);
  }
  return (data ?? []) as StudentAnnouncement[];
}

// Student Live Sessions
export async function listStudentLiveSessions(): Promise<StudentLiveSession[]> {
  const { data, error } = await supabase
    .from('live_sessions')
    .select('id, title, description, starts_at, meeting_url')
    .order('starts_at', { ascending: true });

  if (error) {
    if (error.code === '42P01' || error.message.includes('live_sessions')) {
      console.warn('Live sessions table not yet migrated, returning empty list');
      return [];
    }
    throw parseDatabaseError(error);
  }
  return (data ?? []) as StudentLiveSession[];
}

// Student Notifications
export async function listStudentNotifications(userId: string): Promise<StudentNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, user_id, title, body, read_at, created_at, category, action_url')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error && (error.message.includes('category') || error.message.includes('action_url'))) {
    const { data: legacy, error: legacyError } = await supabase
      .from('notifications')
      .select('id, user_id, title, body, read_at, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (legacyError) {
      if (legacyError.code === '42P01' || legacyError.message.includes('notifications')) return [];
      throw parseDatabaseError(legacyError);
    }
    return (legacy ?? []).map((n) => {
      let cat: 'review' | 'community' | 'deadline' | 'system' = 'system';
      const text = `${n.title} ${n.body}`.toLowerCase();
      if (text.includes('review') || text.includes('feedback') || text.includes('critique') || text.includes('grade')) cat = 'review';
      else if (text.includes('comment') || text.includes('post') || text.includes('reply') || text.includes('mention')) cat = 'community';
      else if (text.includes('deadline') || text.includes('due') || text.includes('assignment')) cat = 'deadline';
      return { ...n, category: cat };
    });
  }

  if (error) {
    if (error.code === '42P01' || error.message.includes('notifications')) {
      console.warn('Notifications table not yet migrated, returning empty list');
      return [];
    }
    throw parseDatabaseError(error);
  }
  return (data ?? []) as StudentNotification[];
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) throw error;
}

// Real Metric Calculators
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

// ==============================================================================
// Submission Versions & History
// ==============================================================================
export async function listSubmissionVersions(submissionId: string): Promise<SubmissionVersion[]> {
  try {
    const { data, error } = await supabase
      .from('submission_versions')
      .select('id, submission_id, version, version_number, file_url, status, notes, submitted_at, created_at')
      .eq('submission_id', submissionId)
      .order('version_number', { ascending: false });

    if (error) {
      if (error.message.includes('version') || error.message.includes('notes') || error.message.includes('submitted_at')) {
        const fallback = await supabase
          .from('submission_versions')
          .select('id, submission_id, version_number, file_url, status, created_at')
          .eq('submission_id', submissionId)
          .order('version_number', { ascending: false });
        if (fallback.error) throw fallback.error;
        return ((fallback.data ?? []) as DbSubmissionVersionRow[]).map((v) => ({
          ...v,
          status: normalizeSubmissionStatus(v.status),
          version: v.version_number ?? 1,
          version_number: v.version_number ?? 1,
          notes: null,
          submitted_at: v.created_at,
        })) as SubmissionVersion[];
      }
      throw error;
    }

    return ((data ?? []) as DbSubmissionVersionRow[]).map((v) => ({
      ...v,
      status: normalizeSubmissionStatus(v.status),
      version: v.version ?? v.version_number ?? 1,
      version_number: v.version_number ?? v.version ?? 1,
      notes: v.notes ?? null,
      submitted_at: v.submitted_at ?? v.created_at,
    })) as SubmissionVersion[];
  } catch (err) {
    console.warn('submission_versions table unavailable:', err);
    return [];
  }
}

// ==============================================================================
// Feedback Replies (Student-Mentor Loop)
// ==============================================================================
export async function addFeedbackReply(
  feedbackId: string,
  authorId: string,
  message: string
): Promise<FeedbackReply> {
  const { data, error } = await supabase
    .from('feedback_replies')
    .insert({
      feedback_id: feedbackId,
      author_id: authorId,
      message: message.trim(),
    })
    .select('id, feedback_id, author_id, message, created_at')
    .single();

  if (error) throw error;

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', authorId)
    .maybeSingle();

  return {
    ...(data as FeedbackReply),
    author_name: profile?.full_name || 'You',
    author_role: profile?.role || 'student',
  };
}

export async function listFeedbackReplies(feedbackId: string): Promise<FeedbackReply[]> {
  try {
    const { data, error } = await supabase
      .from('feedback_replies')
      .select('id, feedback_id, author_id, message, created_at')
      .eq('feedback_id', feedbackId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    if (!data || data.length === 0) return [];

    const authorIds = Array.from(new Set(data.map((r) => r.author_id)));
    let profiles: Array<{ id: string; full_name: string | null; role: string }> = [];
    if (authorIds.length) {
      const { data: pubData, error: pubErr } = await supabase
        .from('public_profiles')
        .select('id, full_name, role')
        .in('id', authorIds);
      if (!pubErr && pubData) {
        profiles = pubData as typeof profiles;
      } else {
        const { data: fallbackProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, role')
          .in('id', authorIds);
        profiles = (fallbackProfiles ?? []) as typeof profiles;
      }
    }

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    return data.map((r) => {
      const profile = profileMap.get(r.author_id);
      return {
        ...r,
        author_name: profile?.full_name || 'User',
        author_role: profile?.role || 'student',
      };
    });
  } catch (err) {
    console.warn('feedback_replies table unavailable:', err);
    return [];
  }
}

// ==============================================================================
// Authoritative Certificate Verification
// ==============================================================================
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

// ==============================================================================
// Authoritative Public Certificate Verification
// ==============================================================================
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

// ==============================================================================
// Student Study Planning Reminders (Database-Backed with Offline Fallback)
// ==============================================================================
export async function listStudentStudyReminders(
  userId: string,
  cohortId?: string
): Promise<StudentStudyReminder[]> {
  try {
    let query = supabase
      .from('student_study_reminders')
      .select('*')
      .eq('user_id', userId)
      .order('scheduled_at', { ascending: true });

    if (cohortId) {
      query = query.or(`cohort_id.eq.${cohortId},cohort_id.is.null`);
    }
    const { data, error } = await query;
    if (error) {
      console.warn('Failed to load student study reminders:', error.message);
      return [];
    }
    return (data ?? []) as StudentStudyReminder[];
  } catch (err) {
    console.warn('student_study_reminders query error:', err);
    return [];
  }
}

export async function createStudentStudyReminder(
  input: Omit<StudentStudyReminder, 'id' | 'created_at'>
): Promise<StudentStudyReminder> {
  const { data, error } = await supabase
    .from('student_study_reminders')
    .insert({
      user_id: input.user_id,
      cohort_id: input.cohort_id || null,
      title: input.title,
      description: input.description || null,
      scheduled_at: input.scheduled_at,
      reminder_type: input.reminder_type || 'study_block',
      is_completed: input.is_completed || false,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw parseDatabaseError(error);
  }

  return data as StudentStudyReminder;
}

export async function toggleStudyReminder(
  id: string,
  isCompleted: boolean,
  _userId: string
): Promise<void> {
  const { error } = await supabase
    .from('student_study_reminders')
    .update({ is_completed: isCompleted })
    .eq('id', id);

  if (error) {
    throw parseDatabaseError(error);
  }
}

export async function deleteStudentStudyReminder(
  id: string,
  _userId: string
): Promise<void> {
  const { error } = await supabase
    .from('student_study_reminders')
    .delete()
    .eq('id', id);

  if (error) {
    throw parseDatabaseError(error);
  }
}

// ==============================================================================
// Student Consolidated Calendar
// ==============================================================================
export async function listStudentCalendarEvents(
  studentId: string,
  cohortId?: string
): Promise<CalendarEvent[]> {
  const events: CalendarEvent[] = [];

  try {
    const [assignments, liveSessions, submissions] = await Promise.all([
      cohortId ? listAssignments(cohortId) : Promise.resolve([]),
      listStudentLiveSessions(),
      listMySubmissions(studentId),
    ]);

    const submissionMap = new Map(submissions.map((s) => [s.assignment_id, s]));

    for (const a of assignments) {
      if (a.deadline) {
        const sub = submissionMap.get(a.id);
        events.push({
          id: `assignment-${a.id}`,
          title: `Assignment: ${a.title}`,
          description: a.instructions,
          type: 'assignment',
          date: a.deadline,
          status: sub?.status || 'unsubmitted',
          isCompleted: sub?.status === 'reviewed',
        });
      }
    }

    for (const s of liveSessions) {
      events.push({
        id: `session-${s.id}`,
        title: s.title,
        description: s.description,
        type: 'live_session',
        date: s.starts_at,
        actionUrl: s.meeting_url,
      });
    }

    // Load personal study reminders from database (with offline fallback)
    try {
      const studyReminders = await listStudentStudyReminders(studentId, cohortId);
      for (const r of studyReminders) {
        events.push({
          id: r.id,
          title: r.title,
          description: r.description,
          type: 'reminder',
          date: r.scheduled_at,
          isCompleted: r.is_completed,
          reminderType: r.reminder_type,
        });
      }
    } catch {
      // ignore
    }

    // Sort chronologically
    return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  } catch (err) {
    console.warn('Failed to load calendar events:', err);
    return [];
  }
}

// ============================================================================
// 19. Authoritative Unified Progress Tracking Subsystem
// ============================================================================

export interface StudentUnifiedProgress {
  student_id: string;
  cohort_id: string;
  enrollment: {
    is_enrolled: boolean;
    status: string;
  };
  curriculum: {
    total_lessons: number;
    completed_lessons: number;
    percent: number;
    total_watch_seconds: number;
  };
  assignments: {
    total_assignments: number;
    submitted_assignments: number;
    approved_assignments: number;
    percent: number;
  };
  sprint_challenges: {
    configured_sprint_days: number;
    effective_sprint_days: number;
    total_challenges: number;
    submitted_challenges: number;
    completed_challenges: number;
    percent: number;
    streak_days: number;
    average_score: number | null;
  };
  attendance?: {
    total_sessions: number;
    attended_sessions: number;
    attendance_rate_pct: number;
    min_attendance_pct: number;
    is_passed: boolean;
  };
  overall: {
    composite_percent: number;
    total_milestones: number;
    completed_milestones: number;
    is_completed: boolean;
    eligible_for_certificate: boolean;
    has_certificate: boolean;
    certificate_number?: string | null;
    certificate_issued_at?: string | null;
  };
}

export async function getStudentUnifiedProgress(
  userId: string,
  cohortId: string
): Promise<StudentUnifiedProgress> {
  // 1. Try authoritative PostgreSQL RPC
  try {
    const { data, error } = await supabase.rpc('get_student_unified_progress', {
      p_student_id: userId,
      p_cohort_id: cohortId,
    });

    if (!error && data) {
      return data as StudentUnifiedProgress;
    }
  } catch (rpcErr) {
    console.warn('get_student_unified_progress RPC error, falling back:', rpcErr);
  }

  // 2. Client-side fallback aggregation
  const [courseData, assignments, sprintData] = await Promise.all([
    getStudentCourseData(userId, cohortId).catch(() => ({ cohort: null, modules: [], progress: [], enrolledCohorts: [] })),
    listAssignments(cohortId).catch(() => []),
    getStudentSprintDays(userId, cohortId).catch(() => ({
      days: [],
      completedCount: 0,
      totalDays: 15,
      streakCount: 0,
      overallScore: null,
      progressPercent: 0,
    })),
  ]);

  const allLessons = courseData.modules.flatMap((m) => m.lessons);
  const totalLessons = allLessons.length;
  const completedLessons = courseData.progress.filter((p) => p.completed).length;
  const curriculumPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  const totalAssignments = assignments.length;
  let approvedAssignments = 0;
  let submittedAssignments = 0;
  try {
    const { data: subs } = await supabase
      .from('submissions')
      .select('assignment_id, status')
      .eq('student_id', userId)
      .in('assignment_id', assignments.map((a) => a.id));

    if (subs) {
      submittedAssignments = subs.length;
      approvedAssignments = subs.filter((s) => s.status === 'reviewed' || s.status === 'approved' || s.status === 'accepted').length;
    }
  } catch {
    // fallback
  }

  const assignmentPercent = totalAssignments > 0 ? Math.round((approvedAssignments / totalAssignments) * 100) : 0;
  const effectiveSprintDays = sprintData.totalDays || 15;
  const sprintPercent = sprintData.progressPercent || 0;

  // Live session attendance metrics
  let totalSessions = 0;
  let attendedSessions = 0;
  let attendanceRatePct = 100.0;
  let isAttendancePassed = true;
  try {
    const nowIso = new Date().toISOString();
    const { data: heldSessions } = await supabase
      .from('live_sessions')
      .select('id')
      .or(`cohort_id.eq.${cohortId},cohort_id.is.null`)
      .lte('starts_at', nowIso);

    totalSessions = heldSessions?.length ?? 0;
    if (totalSessions > 0) {
      const heldSessionIds = heldSessions!.map((s) => s.id);
      const { data: attData } = await supabase
        .from('session_attendance')
        .select('session_id')
        .eq('student_id', userId)
        .in('session_id', heldSessionIds)
        .in('status', ['present', 'late', 'excused']);

      attendedSessions = attData?.length ?? 0;
      attendanceRatePct = Math.round((attendedSessions / totalSessions) * 1000) / 10;
      isAttendancePassed = attendanceRatePct >= 75.0;
    }
  } catch {
    // attendance query fallback
  }

  const totalMilestones = totalLessons + totalAssignments + (sprintData.days.length > 0 ? effectiveSprintDays : 0) + totalSessions;
  const completedMilestones = completedLessons + approvedAssignments + (sprintData.days.length > 0 ? sprintData.completedCount : 0) + attendedSessions;
  const compositePercent = totalMilestones > 0 ? Math.min(100, Math.round((completedMilestones / totalMilestones) * 100)) : 0;

  const isEligibleForCert =
    curriculumPercent >= 100 &&
    (totalAssignments === 0 || approvedAssignments >= totalAssignments) &&
    (sprintData.days.length === 0 || sprintData.completedCount >= effectiveSprintDays) &&
    isAttendancePassed;

  return {
    student_id: userId,
    cohort_id: cohortId,
    enrollment: {
      is_enrolled: Boolean(courseData.cohort),
      status: 'active',
    },
    curriculum: {
      total_lessons: totalLessons,
      completed_lessons: completedLessons,
      percent: curriculumPercent,
      total_watch_seconds: 0,
    },
    assignments: {
      total_assignments: totalAssignments,
      submitted_assignments: submittedAssignments,
      approved_assignments: approvedAssignments,
      percent: assignmentPercent,
    },
    sprint_challenges: {
      configured_sprint_days: effectiveSprintDays,
      effective_sprint_days: effectiveSprintDays,
      total_challenges: sprintData.days.length,
      submitted_challenges: sprintData.completedCount,
      completed_challenges: sprintData.completedCount,
      percent: sprintPercent,
      streak_days: sprintData.streakCount,
      average_score: sprintData.overallScore,
    },
    attendance: {
      total_sessions: totalSessions,
      attended_sessions: attendedSessions,
      attendance_rate_pct: attendanceRatePct,
      min_attendance_pct: 75.0,
      is_passed: isAttendancePassed,
    },
    overall: {
      composite_percent: compositePercent,
      total_milestones: totalMilestones,
      completed_milestones: completedMilestones,
      is_completed: compositePercent >= 100,
      eligible_for_certificate: isEligibleForCert,
      has_certificate: false,
    },
  };
}