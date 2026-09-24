import { supabase } from './supabaseClient';
import { parseDatabaseError } from './errorHandling';
import { queryCache } from './queryCache';

export interface Cohort {
  id: string;
  name: string;
  description: string | null;
  status?: 'draft' | 'review' | 'published' | 'archived';
  capacity?: number;
  visibility?: 'public' | 'private' | 'unlisted';
  enrollment_start?: string | null;
  enrollment_end?: string | null;
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
  cohort_id: string;
  title: string;
  description: string | null;
  position: number;
  lessons: Lesson[];
}

export interface Enrollment {
  user_id: string;
  cohort_id: string;
  status: 'active' | 'completed' | 'dropped' | 'waitlisted';
  created_at?: string;
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
  lesson_id: string;
  title: string;
  instructions: string | null;
  deadline: string | null;
  created_at?: string;
}

export type SubmissionStatus = 'draft' | 'pending' | 'reviewed' | 'resubmit';

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
  version_number: number;
  file_url: string;
  status: string;
  notes?: string | null;
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
  is_late?: boolean;
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

export type CohortInput = Pick<Cohort, 'name' | 'description'> &
  Partial<Pick<Cohort, 'status' | 'capacity' | 'visibility' | 'enrollment_start' | 'enrollment_end'>>;
export type ModuleInput = Pick<Module, 'cohort_id' | 'title' | 'description' | 'position'>;
export type LessonInput = Pick<Lesson, 'module_id' | 'title' | 'description' | 'video_url' | 'duration_minutes' | 'position'> &
  Partial<Pick<Lesson, 'status'>>;
export type EnrollmentInput = Pick<Enrollment, 'user_id' | 'cohort_id' | 'status'>;
export type AssignmentInput = Pick<Assignment, 'lesson_id' | 'title' | 'instructions' | 'deadline'>;
export interface LessonResourceInput {
  lesson_id: string;
  name: string;
  url: string;
  visibility?: VisibilityRule;
  resource_type?: ResourceType;
  file_size?: number | null;
}

const courseSelectWithStatus = 'id, cohort_id, title, description, position, lessons(id, module_id, title, description, video_url, duration_minutes, position, status)';
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

  let progressData: LessonProgress[];
  const [{ data: rawModules, error: modulesError }, { data: rawProgress, error: progressError }] = await Promise.all([
    supabase.from('modules').select(courseSelect).eq('cohort_id', targetCohort.id).order('position', { ascending: true }),
    supabase.from('lesson_progress').select('lesson_id, completed, completed_at, watch_percentage, last_position_seconds').eq('user_id', userId),
  ]);

  if (progressError && (progressError.message.includes('watch_percentage') || progressError.message.includes('last_position_seconds'))) {
    const { data: fallbackProgress } = await supabase
      .from('lesson_progress')
      .select('lesson_id, completed, completed_at')
      .eq('user_id', userId);
    progressData = (fallbackProgress ?? []) as LessonProgress[];
  } else if (progressError) {
    throw progressError;
  } else {
    progressData = (rawProgress ?? []) as LessonProgress[];
  }

  let modules: Module[] | null = (rawModules ?? []) as Module[];
  if (modulesError) {
    const fallbackRes = await supabase.from('modules').select(courseSelectLegacy).eq('cohort_id', targetCohort.id).order('position', { ascending: true });
    if (fallbackRes.error) throw modulesError;
    modules = ((fallbackRes.data ?? []) as unknown as Module[]).map((m) => ({
      ...m,
      lessons: (m.lessons || []).map((l) => ({ ...l, status: l.status ?? 'published' })),
    }));
  }

  return {
    cohort: targetCohort,
    modules: ((modules ?? []) as Module[]).map((module) => ({
      ...module,
      lessons: [...(module.lessons ?? [])].sort((a, b) => a.position - b.position),
    })),
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
    supabase.from('enrollments').select('cohort_id').eq('user_id', userId),
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
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('verify_and_complete_lesson', {
        p_user_id: userId,
        p_lesson_id: lessonId,
        p_watch_percentage: Math.round(options?.watchPercentage ?? 100),
        p_position_seconds: Math.round(options?.positionSeconds ?? 0),
      });

      if (!rpcErr && rpcRes) {
        const res = rpcRes as { success?: boolean; reason?: string };
        if (res.success === false) {
          throw new Error(res.reason || 'You must watch at least 80% of this video lesson before marking it complete.');
        }
        return;
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('80%')) {
        throw err;
      }
      console.warn('verify_and_complete_lesson RPC fallback:', err);
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
  if (error) throw error;
}

export async function updateLessonWatchProgress(
  userId: string,
  lessonId: string,
  watchPercentage: number,
  positionSeconds: number = 0
): Promise<void> {
  const isAutoCompleted = watchPercentage >= 80;
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
    console.warn('Failed to update watch progress:', err);
  }
}

export async function listCohorts(): Promise<Cohort[]> {
  return queryCache.getOrFetch(
    'cohorts_list',
    async () => {
      const { data, error } = await supabase
        .from('cohorts')
        .select('id, title, description, status, capacity, visibility, enrollment_start, enrollment_end')
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
        }));
      }

      return (data ?? []).map((cohort) => ({
        id: cohort.id,
        name: cohort.title,
        description: cohort.description,
        status: cohort.status ?? 'published',
        capacity: cohort.capacity ?? 30,
        visibility: cohort.visibility ?? 'public',
        enrollment_start: cohort.enrollment_start ?? null,
        enrollment_end: cohort.enrollment_end ?? null,
      }));
    },
    300_000,
    ['cohorts']
  );
}

export async function listAvailableCohorts(userId: string): Promise<Cohort[]> {
  const { data: enrollments, error: enrollmentError } = await supabase.from('enrollments').select('cohort_id').eq('user_id', userId);
  if (enrollmentError) throw enrollmentError;
  const enrolledIds = (enrollments ?? []).map((enrollment) => enrollment.cohort_id);
  const cohorts = await listCohorts();
  return cohorts.filter((cohort) => !enrolledIds.includes(cohort.id) && cohort.status !== 'archived');
}

export async function enrollInCohort(userId: string, cohortId: string): Promise<Enrollment> {
  // 1. Attempt validated server-side RPC (enforces capacity, enrollment window, active user status, and emits audit log)
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
  queryCache.invalidate('stats');

  const payload: Record<string, unknown> = {
    title: input.name,
    description: input.description,
  };
  if (input.status !== undefined) payload.status = input.status;
  if (input.capacity !== undefined) payload.capacity = input.capacity;
  if (input.visibility !== undefined) payload.visibility = input.visibility;
  if (input.enrollment_start !== undefined) payload.enrollment_start = input.enrollment_start;
  if (input.enrollment_end !== undefined) payload.enrollment_end = input.enrollment_end;

  let res = await supabase.from('cohorts').insert(payload).select('id, title, description, status, capacity, visibility, enrollment_start, enrollment_end').single();
  if (res.error) {
    res = await supabase.from('cohorts').insert({ title: input.name, description: input.description }).select('id, title, description').single();
  }
  if (res.error) throw res.error;
  return {
    id: res.data.id,
    name: res.data.title,
    description: res.data.description,
    status: res.data.status ?? 'published',
    capacity: res.data.capacity ?? 30,
    visibility: res.data.visibility ?? 'public',
    enrollment_start: res.data.enrollment_start ?? null,
    enrollment_end: res.data.enrollment_end ?? null,
  };
}

export async function updateCohort(id: string, input: Partial<CohortInput>): Promise<Cohort> {
  queryCache.invalidate('cohorts');

  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload.title = input.name;
  if (input.description !== undefined) payload.description = input.description;
  if (input.status !== undefined) payload.status = input.status;
  if (input.capacity !== undefined) payload.capacity = input.capacity;
  if (input.visibility !== undefined) payload.visibility = input.visibility;
  if (input.enrollment_start !== undefined) payload.enrollment_start = input.enrollment_start;
  if (input.enrollment_end !== undefined) payload.enrollment_end = input.enrollment_end;

  let res = await supabase.from('cohorts').update(payload).eq('id', id).select('id, title, description, status, capacity, visibility, enrollment_start, enrollment_end').single();
  if (res.error) {
    const fallbackPayload: Record<string, unknown> = {};
    if (input.name !== undefined) fallbackPayload.title = input.name;
    if (input.description !== undefined) fallbackPayload.description = input.description;
    res = await supabase.from('cohorts').update(fallbackPayload).eq('id', id).select('id, title, description').single();
  }
  if (res.error) throw res.error;
  return {
    id: res.data.id,
    name: res.data.title,
    description: res.data.description,
    status: res.data.status ?? 'published',
    capacity: res.data.capacity ?? 30,
    visibility: res.data.visibility ?? 'public',
    enrollment_start: res.data.enrollment_start ?? null,
    enrollment_end: res.data.enrollment_end ?? null,
  };
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
  let query = supabase.from('modules').select(courseSelect).order('position');
  if (cohortId) query = query.eq('cohort_id', cohortId);
  const { data, error } = await query;
  if (error) {
    let fallbackQuery = supabase.from('modules').select(courseSelectLegacy).order('position');
    if (cohortId) fallbackQuery = fallbackQuery.eq('cohort_id', cohortId);
    const { data: fallbackData, error: fallbackError } = await fallbackQuery;
    if (fallbackError) throw fallbackError;
    return ((fallbackData ?? []) as Module[]).map((module) => ({
      ...module,
      lessons: [...(module.lessons ?? [])].map((l) => ({ ...l, status: l.status ?? 'published' })).sort((a, b) => a.position - b.position),
    }));
  }
  return ((data ?? []) as Module[]).map((module) => ({
    ...module,
    lessons: [...(module.lessons ?? [])].map((l) => ({ ...l, status: l.status ?? 'published' })).sort((a, b) => a.position - b.position),
  }));
}

export async function createModule(input: ModuleInput): Promise<Module> {
  queryCache.invalidate('curriculum');
  queryCache.invalidate('cohorts');
  const { data, error } = await supabase.from('modules').insert(input).select('id, cohort_id, title, description, position').single();
  if (error) throw error;
  return { ...(data as Module), lessons: [] };
}

export async function updateModule(id: string, input: Omit<ModuleInput, 'cohort_id'>): Promise<Module> {
  queryCache.invalidate('curriculum');
  queryCache.invalidate('cohorts');
  const { data, error } = await supabase.from('modules').update(input).eq('id', id).select('id, cohort_id, title, description, position').single();
  if (error) throw error;
  return { ...(data as Module), lessons: [] };
}

export async function deleteModule(id: string) {
  queryCache.invalidate('curriculum');
  queryCache.invalidate('cohorts');
  const { error } = await supabase.from('modules').delete().eq('id', id);
  if (error) throw error;
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

export async function deleteLesson(id: string) {
  queryCache.invalidate('curriculum');
  queryCache.invalidate('cohorts');
  const { error } = await supabase.from('lessons').delete().eq('id', id);
  if (error) throw error;
}

export async function reorderModule(moduleId: string, newPosition: number): Promise<void> {
  queryCache.invalidate('curriculum');
  queryCache.invalidate('cohorts');
  const { error } = await supabase.from('modules').update({ position: newPosition }).eq('id', moduleId);
  if (error) throw error;
}

export async function reorderLesson(lessonId: string, newPosition: number): Promise<void> {
  queryCache.invalidate('curriculum');
  queryCache.invalidate('cohorts');
  const { error } = await supabase.from('lessons').update({ position: newPosition }).eq('id', lessonId);
  if (error) throw error;
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
  const { data: original, error } = await supabase
    .from('lessons')
    .select('module_id, title, description, video_url, duration_minutes, position, status')
    .eq('id', lessonId)
    .single();
  if (error) throw error;

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
  if (createError) throw createError;

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
    .select('title, instructions, deadline')
    .eq('lesson_id', lessonId)
    .maybeSingle();

  if (assignment) {
    await supabase.from('assignments').insert({
      lesson_id: newLesson.id,
      title: `${assignment.title} (Copy)`,
      instructions: assignment.instructions,
      deadline: assignment.deadline,
    });
  }

  return newLesson as Lesson;
}

export async function duplicateModule(moduleId: string): Promise<Module> {
  const { data: original, error } = await supabase
    .from('modules')
    .select('cohort_id, title, description, position')
    .eq('id', moduleId)
    .single();
  if (error) throw error;

  const { data: newModule, error: createError } = await supabase
    .from('modules')
    .insert({
      cohort_id: original.cohort_id,
      title: `${original.title} (Copy)`,
      description: original.description,
      position: (original.position || 0) + 1,
    })
    .select('id, cohort_id, title, description, position')
    .single();
  if (createError) throw createError;

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

  return { ...(newModule as Module), lessons: clonedLessons };
}

export async function listEnrollments(cohortId?: string): Promise<Enrollment[]> {
  let query = supabase.from('enrollments').select('user_id, cohort_id, status, created_at').order('created_at', { ascending: false });
  if (cohortId) query = query.eq('cohort_id', cohortId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Enrollment[];
}

export async function saveEnrollment(input: EnrollmentInput, id?: string): Promise<Enrollment> {
  const query = id ? supabase.from('enrollments').update({ status: input.status }).eq('user_id', input.user_id).eq('cohort_id', input.cohort_id) : supabase.from('enrollments').upsert(input, { onConflict: 'user_id,cohort_id' });
  const { data, error } = await query.select('user_id, cohort_id, status, created_at').single();
  if (error) throw error;
  return data as Enrollment;
}

export async function deleteEnrollment(userId: string, cohortId: string) {
  const { error } = await supabase.from('enrollments').delete().eq('user_id', userId).eq('cohort_id', cohortId);
  if (error) throw error;
}

// Assignment CRUD
export async function listAssignments(cohortId?: string): Promise<Assignment[]> {
  if (!cohortId) return listAllAssignments();
  const modules = await listModules(cohortId);
  const lessonIds = modules.flatMap((module) => module.lessons.map((lesson) => lesson.id));
  if (!lessonIds.length) return [];
  const { data, error } = await supabase
    .from('assignments')
    .select('id, lesson_id, title, instructions, deadline, created_at')
    .in('lesson_id', lessonIds)
    .order('deadline', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as Assignment[];
}

export async function listAssignmentsByLesson(lessonId: string): Promise<Assignment[]> {
  const { data, error } = await supabase
    .from('assignments')
    .select('id, lesson_id, title, instructions, deadline, created_at')
    .eq('lesson_id', lessonId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Assignment[];
}

export async function listAllAssignments(): Promise<Assignment[]> {
  const { data, error } = await supabase
    .from('assignments')
    .select('id, lesson_id, title, instructions, deadline, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Assignment[];
}

export async function createAssignment(input: AssignmentInput): Promise<Assignment> {
  const { data, error } = await supabase
    .from('assignments')
    .insert({
      lesson_id: input.lesson_id,
      title: input.title.trim(),
      instructions: input.instructions?.trim() || null,
      deadline: input.deadline || null,
    })
    .select('id, lesson_id, title, instructions, deadline, created_at')
    .single();
  if (error) throw error;
  return data as Assignment;
}

export async function updateAssignment(id: string, input: Omit<AssignmentInput, 'lesson_id'>): Promise<Assignment> {
  const { data, error } = await supabase
    .from('assignments')
    .update({
      title: input.title.trim(),
      instructions: input.instructions?.trim() || null,
      deadline: input.deadline || null,
    })
    .eq('id', id)
    .select('id, lesson_id, title, instructions, deadline, created_at')
    .single();
  if (error) throw error;
  return data as Assignment;
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
  return supabase.storage.from('course-assets').getPublicUrl(path).data.publicUrl;
}

export async function uploadSubmissionFile(userId: string, file: File): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const path = `${userId}/${crypto.randomUUID()}-${safeName}`;
  const contentType = file.type || inferMimeType(file.name);
  const { error: uploadError } = await supabase.storage.from('submissions').upload(path, file, {
    upsert: false,
    contentType,
  });
  if (uploadError) throw uploadError;

  // The 'submissions' bucket is strictly private. Generate a signed expiring URL for immediate access
  // or return the storage path identifier to prevent public URL exposure.
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

  try {
    const { data, error } = await supabase.storage
      .from('submissions')
      .createSignedUrl(objectPath, expiresIn);

    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }
  } catch (err) {
    console.warn('Could not create signed URL for submission:', err);
  }

  // Fallback to original URL during migration or offline mode
  return fileUrl;
}

/**
 * Resolves a secure, time-limited signed URL for private course assets or lesson downloads.
 * External URLs are returned as-is.
 */
export async function getSecureAssetUrl(fileUrl: string, expiresIn = 3600): Promise<string> {
  if (!fileUrl) return '';

  const isSupabaseStorage =
    fileUrl.includes('/storage/v1/object/') ||
    fileUrl.startsWith('course-assets/') ||
    fileUrl.includes('course-assets');

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
  objectPath = decodeURIComponent(objectPath);

  try {
    const { data, error } = await supabase.storage
      .from('course-assets')
      .createSignedUrl(objectPath, expiresIn);

    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }
  } catch (err) {
    console.warn('Could not create signed URL for course asset:', err);
  }

  return fileUrl;
}

// Student Submissions & Resubmissions
export async function listMySubmissions(userId: string): Promise<Submission[]> {
  let { data, error } = await supabase
    .from('submissions')
    .select('id, assignment_id, student_id, file_url, status, created_at, is_late, version_number')
    .eq('student_id', userId)
    .order('created_at', { ascending: false });

  if (error && (error.message.includes('is_late') || error.message.includes('version_number'))) {
    const fallback = await supabase
      .from('submissions')
      .select('id, assignment_id, student_id, file_url, status, created_at')
      .eq('student_id', userId)
      .order('created_at', { ascending: false });
    data = fallback.data as unknown as typeof data;
    error = fallback.error;
  }
  if (error) throw error;
  const submissions = (data ?? []) as Omit<Submission, 'feedback'>[];
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
      return {
        id: parsed.id as string,
        assignment_id: parsed.assignment_id as string,
        student_id: parsed.student_id as string,
        file_url: parsed.file_url as string,
        status: parsed.status as SubmissionStatus,
        is_late: Boolean(parsed.is_late),
        version_number: (parsed.version_number as number) || 1,
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
  let previousRecord: { id: string; file_url: string; status: string; version_number?: number } | null = null;

  if (!targetId) {
    const { data: existing } = await supabase
      .from('submissions')
      .select('id, file_url, status, version_number')
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
      .select('id, file_url, status, version_number')
      .eq('id', targetId)
      .maybeSingle();
    previousRecord = existing;
  }

  const newStatus: SubmissionStatus = isDraft ? 'draft' : 'pending';
  const newVersionNumber = (previousRecord?.version_number || 1) + (previousRecord ? 1 : 0);

  if (targetId && previousRecord) {
    // Save previous version to submission_versions
    try {
      await supabase.from('submission_versions').insert({
        submission_id: targetId,
        version_number: previousRecord.version_number || 1,
        file_url: previousRecord.file_url,
        status: previousRecord.status,
        notes: notes || null,
      });
    } catch (verErr) {
      console.warn('submission_versions table unavailable:', verErr);
    }

    const updatePayload: Record<string, unknown> = {
      file_url: fileUrl,
      status: newStatus,
      is_late: isLate,
      version_number: newVersionNumber,
    };
    let { data, error } = await supabase
      .from('submissions')
      .update({ ...updatePayload, updated_at: new Date().toISOString() })
      .eq('id', targetId)
      .select('id, assignment_id, student_id, file_url, status, created_at, is_late, version_number')
      .single();

    if (error && (error.message.includes('updated_at') || error.message.includes('is_late') || error.message.includes('version_number'))) {
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
    return { ...(data as Omit<Submission, 'feedback'>), feedback: null, is_late: isLate, version_number: newVersionNumber };
  }

  // Initial submission
  const insertPayload: Record<string, unknown> = {
    student_id: userId,
    assignment_id: assignmentId,
    file_url: fileUrl,
    status: newStatus,
    is_late: isLate,
    version_number: 1,
  };

  let { data, error } = await supabase
    .from('submissions')
    .insert(insertPayload)
    .select('id, assignment_id, student_id, file_url, status, created_at, is_late, version_number')
    .single();

  if (error && (error.message.includes('is_late') || error.message.includes('version_number'))) {
    const retry = await supabase
      .from('submissions')
      .insert({ student_id: userId, assignment_id: assignmentId, file_url: fileUrl, status: newStatus })
      .select('id, assignment_id, student_id, file_url, status, created_at')
      .single();
    data = retry.data as unknown as typeof data;
    error = retry.error;
  }
  if (error) throw error;
  return { ...(data as Omit<Submission, 'feedback'>), feedback: null, is_late: isLate, version_number: 1 };
}

export async function submitAssignment(userId: string, assignmentId: string, videoUrl: string): Promise<Submission> {
  return submitOrReplaceAssignment(userId, assignmentId, videoUrl);
}

export async function listPendingSubmissions(): Promise<Submission[]> {
  const { data, error } = await supabase
    .from('submissions')
    .select('id, assignment_id, student_id, file_url, status, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return addFeedback((data ?? []) as Omit<Submission, 'feedback'>[]);
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
    .select('id, assignment_id, student_id, file_url, status, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
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
    supabase.from('assignments').select('id, title, instructions, deadline, lesson_id').in('id', assignmentIds),
    supabase.from('feedback').select('id, submission_id, mentor_id, comments, created_at').in('submission_id', submissionIds).order('created_at', { ascending: false }),
  ]);

  const profileMap = new Map<string, { full_name: string; email: string }>();
  for (const p of profiles ?? []) {
    profileMap.set(p.id, { full_name: p.full_name, email: p.email });
  }

  const assignmentMap = new Map<string, { title: string; instructions: string | null; deadline: string | null; lesson_id: string }>();
  for (const a of assignments ?? []) {
    assignmentMap.set(a.id, { title: a.title, instructions: a.instructions, deadline: a.deadline, lesson_id: a.lesson_id });
  }

  // Resolve cohort names via lesson_id -> module_id -> cohort_id
  const lessonIds = Array.from(new Set((assignments ?? []).map((a) => a.lesson_id).filter(Boolean)));
  const cohortNameByAssignment = new Map<string, string>();
  const cohortIdByAssignment = new Map<string, string>();

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
  const { error } = await supabase.rpc('review_submission', {
    p_submission_id: id,
    p_status: status,
    p_comments: feedback.trim() || null,
  });

  if (error) {
    if (
      error.code === 'PGRST202' ||
      error.message.includes('review_submission') ||
      error.message.includes('schema cache')
    ) {
      throw new Error(
        'Database function "review_submission" not found. Please run the updated supabase/mentor_access_and_rbac.sql script in Supabase SQL Editor.'
      );
    }

    throw new Error(error.message || 'Unable to review submission.');
  }
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
      enhancedError.message.includes('student_read_at'))
  ) {
    const { data: midData, error: midError } = await supabase
      .from('feedback')
      .select('id, submission_id, mentor_id, comments, rubric, timestamped_notes, created_at')
      .in('submission_id', submissions.map((submission) => submission.id))
      .order('created_at', { ascending: false });

    if (midError) {
      const { data: legacyData } = await supabase
        .from('feedback')
        .select('id, submission_id, mentor_id, comments, created_at')
        .in('submission_id', submissions.map((submission) => submission.id))
        .order('created_at', { ascending: false });
      feedbackData = legacyData;
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
      const { data: replyProfiles } = replyAuthorIds.length
        ? await supabase.from('profiles').select('id, full_name, role').in('id', replyAuthorIds)
        : { data: [] };
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
    if (!feedbackBySubmission.has(item.submission_id)) {
      feedbackBySubmission.set(item.submission_id, item.comments);
    }
    const current = historyBySubmission.get(item.submission_id) || [];
    current.push({
      ...(item as FeedbackItem),
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
export async function listStudentAnnouncements(): Promise<StudentAnnouncement[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('id, title, body, created_at')
    .eq('published', true)
    .order('created_at', { ascending: false });

  if (error) {
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
      .select('id, submission_id, version_number, file_url, status, notes, created_at')
      .eq('submission_id', submissionId)
      .order('version_number', { ascending: false });
    if (error) throw error;
    return (data ?? []) as SubmissionVersion[];
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
    const { data: profiles } = authorIds.length
      ? await supabase.from('profiles').select('id, full_name, role').in('id', authorIds)
      : { data: [] };

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

  // Client-side fallback check
  try {
    const [modulesRes, progressRes, cohortAssigns, subsRes] = await Promise.all([
      supabase.from('modules').select('id, lessons(id, video_url)').eq('cohort_id', cohortId),
      supabase.from('lesson_progress').select('lesson_id, completed, watch_percentage').eq('user_id', studentId),
      listAssignments(cohortId),
      supabase.from('submissions').select('assignment_id, status').eq('student_id', studentId).eq('status', 'reviewed'),
    ]);

    const allLessons = (modulesRes.data ?? []).flatMap((m) => ((m.lessons as Array<{ id: string; video_url?: string }>) ?? []));
    const allLessonIds = allLessons.map((l) => l.id);
    const progressMap = new Map((progressRes.data ?? []).map((p) => [p.lesson_id, p]));

    // Enforce 80% watch progress or completed
    const completedLessons = allLessons.filter((l) => {
      const prog = progressMap.get(l.id);
      if (!prog) return false;
      const hasVideo = Boolean(l.video_url && l.video_url.trim().length > 0);
      if (hasVideo) {
        return (prog.watch_percentage ?? 0) >= 80 || prog.completed;
      }
      return Boolean(prog.completed);
    }).length;

    const totalAssigns = cohortAssigns.length;
    const approvedAssignIds = new Set((subsRes.data ?? []).map((s) => s.assignment_id));
    const approvedAssigns = cohortAssigns.filter((a) => approvedAssignIds.has(a.id)).length;

    const isLessonsComplete = allLessonIds.length === 0 || completedLessons >= allLessonIds.length;
    const isAssignsComplete = totalAssigns === 0 || approvedAssigns >= totalAssigns;

    if (isLessonsComplete && isAssignsComplete) {
      const fallbackCertNumber = `CC-${cohortId.replace(/-/g, '').slice(0, 6).toUpperCase()}-${studentId.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
      return {
        eligible: true,
        already_issued: true,
        certificate_number: fallbackCertNumber,
        issued_at: new Date().toISOString(),
        completed_lessons: completedLessons,
        total_lessons: allLessonIds.length,
        approved_assignments: approvedAssigns,
        total_assignments: totalAssigns,
      };
    } else {
      return {
        eligible: false,
        reason: !isLessonsComplete
          ? `${allLessonIds.length - completedLessons} required lesson(s) not completed (≥80% watch verification required).`
          : `${totalAssigns - approvedAssigns} assignment(s) not reviewed or approved yet.`,
        completed_lessons: completedLessons,
        total_lessons: allLessonIds.length,
        approved_assignments: approvedAssigns,
        total_assignments: totalAssigns,
      };
    }
  } catch (fallbackErr) {
    return {
      eligible: false,
      reason: fallbackErr instanceof Error ? fallbackErr.message : 'Failed to verify certificate eligibility.',
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
    if (!error && data) {
      return data as StudentStudyReminder[];
    }
  } catch (err) {
    console.warn('student_study_reminders table query error, falling back to localStorage:', err);
  }

  // Fallback to localStorage
  try {
    const raw = localStorage.getItem(`student_study_reminders_${userId}`);
    if (raw) {
      const items = JSON.parse(raw) as StudentStudyReminder[];
      if (cohortId) {
        return items.filter((r) => !r.cohort_id || r.cohort_id === cohortId);
      }
      return items;
    }
  } catch {
    // ignore
  }
  return [];
}

export async function createStudentStudyReminder(
  input: Omit<StudentStudyReminder, 'id' | 'created_at'>
): Promise<StudentStudyReminder> {
  try {
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

    if (!error && data) {
      return data as StudentStudyReminder;
    }
  } catch (err) {
    console.warn('Failed to insert student study reminder in Supabase, using localStorage:', err);
  }

  // Fallback
  const fallbackItem: StudentStudyReminder = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ...input,
    created_at: new Date().toISOString(),
  };
  try {
    const raw = localStorage.getItem(`student_study_reminders_${input.user_id}`);
    const current = raw ? (JSON.parse(raw) as StudentStudyReminder[]) : [];
    localStorage.setItem(`student_study_reminders_${input.user_id}`, JSON.stringify([...current, fallbackItem]));
  } catch {
    // ignore
  }
  return fallbackItem;
}

export async function toggleStudyReminder(
  id: string,
  isCompleted: boolean,
  userId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('student_study_reminders')
      .update({ is_completed: isCompleted })
      .eq('id', id);
    if (!error) return;
  } catch {
    // ignore
  }

  // Fallback
  try {
    const raw = localStorage.getItem(`student_study_reminders_${userId}`);
    if (raw) {
      const current = JSON.parse(raw) as StudentStudyReminder[];
      const updated = current.map((r) => (r.id === id ? { ...r, is_completed: isCompleted } : r));
      localStorage.setItem(`student_study_reminders_${userId}`, JSON.stringify(updated));
    }
  } catch {
    // ignore
  }
}

export async function deleteStudentStudyReminder(
  id: string,
  userId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('student_study_reminders')
      .delete()
      .eq('id', id);
    if (!error) return;
  } catch {
    // ignore
  }

  // Fallback
  try {
    const raw = localStorage.getItem(`student_study_reminders_${userId}`);
    if (raw) {
      const current = JSON.parse(raw) as StudentStudyReminder[];
      const updated = current.filter((r) => r.id !== id);
      localStorage.setItem(`student_study_reminders_${userId}`, JSON.stringify(updated));
    }
  } catch {
    // ignore
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