import { supabase } from './supabaseClient';

export interface Cohort {
  id: string;
  name: string;
  description: string | null;
}

export interface Lesson {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  duration_minutes: number | null;
  position: number;
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
  status: 'active' | 'completed' | 'dropped';
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

export type SubmissionStatus = 'pending' | 'reviewed' | 'resubmit';

export interface FeedbackItem {
  id: string;
  submission_id: string;
  mentor_id: string;
  comments: string;
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
  created_at?: string;
  updated_at?: string;
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

export type CohortInput = Pick<Cohort, 'name' | 'description'>;
export type ModuleInput = Pick<Module, 'cohort_id' | 'title' | 'description' | 'position'>;
export type LessonInput = Pick<Lesson, 'module_id' | 'title' | 'description' | 'video_url' | 'duration_minutes' | 'position'>;
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

const courseSelect = 'id, cohort_id, title, description, position, lessons(id, module_id, title, description, video_url, duration_minutes, position)';

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

  const [{ data: modules, error: modulesError }, { data: progress, error: progressError }] = await Promise.all([
    supabase.from('modules').select(courseSelect).eq('cohort_id', targetCohort.id).order('position', { ascending: true }),
    supabase.from('lesson_progress').select('lesson_id, completed, completed_at').eq('user_id', userId),
  ]);

  if (modulesError) throw modulesError;
  if (progressError) throw progressError;

  return {
    cohort: targetCohort,
    modules: ((modules ?? []) as Module[]).map((module) => ({
      ...module,
      lessons: [...(module.lessons ?? [])].sort((a, b) => a.position - b.position),
    })),
    progress: (progress ?? []) as LessonProgress[],
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

export async function markLessonComplete(userId: string, lessonId: string, completed: boolean) {
  const { error } = await supabase.from('lesson_progress').upsert(
    { user_id: userId, lesson_id: lessonId, completed, completed_at: new Date().toISOString() },
    { onConflict: 'user_id,lesson_id' }
  );
  if (error) throw error;
}

export async function listCohorts(): Promise<Cohort[]> {
  const { data, error } = await supabase.from('cohorts').select('id, title, description').order('title');
  if (error) throw error;
  return (data ?? []).map((cohort) => ({ id: cohort.id, name: cohort.title, description: cohort.description }));
}

export async function listAvailableCohorts(userId: string): Promise<Cohort[]> {
  const { data: enrollments, error: enrollmentError } = await supabase.from('enrollments').select('cohort_id').eq('user_id', userId);
  if (enrollmentError) throw enrollmentError;
  const enrolledIds = (enrollments ?? []).map((enrollment) => enrollment.cohort_id);
  const { data, error } = await supabase.from('cohorts').select('id, title, description').order('title');
  if (error) throw error;
  return (data ?? []).filter((cohort) => !enrolledIds.includes(cohort.id)).map((cohort) => ({ id: cohort.id, name: cohort.title, description: cohort.description }));
}

export async function enrollInCohort(userId: string, cohortId: string): Promise<Enrollment> {
  return saveEnrollment({ user_id: userId, cohort_id: cohortId, status: 'active' });
}

export async function createCohort(input: CohortInput): Promise<Cohort> {
  const { data, error } = await supabase.from('cohorts').insert({ title: input.name, description: input.description }).select('id, title, description').single();
  if (error) throw error;
  return { id: data.id, name: data.title, description: data.description };
}

export async function updateCohort(id: string, input: CohortInput): Promise<Cohort> {
  const { data, error } = await supabase.from('cohorts').update({ title: input.name, description: input.description }).eq('id', id).select('id, title, description').single();
  if (error) throw error;
  return { id: data.id, name: data.title, description: data.description };
}

export async function deleteCohort(id: string) {
  const { error } = await supabase.from('cohorts').delete().eq('id', id);
  if (error) throw error;
}

export async function listModules(cohortId?: string): Promise<Module[]> {
  let query = supabase.from('modules').select(courseSelect).order('position');
  if (cohortId) query = query.eq('cohort_id', cohortId);
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as Module[]).map((module) => ({
    ...module,
    lessons: [...(module.lessons ?? [])].sort((a, b) => a.position - b.position),
  }));
}

export async function createModule(input: ModuleInput): Promise<Module> {
  const { data, error } = await supabase.from('modules').insert(input).select('id, cohort_id, title, description, position').single();
  if (error) throw error;
  return { ...(data as Module), lessons: [] };
}

export async function updateModule(id: string, input: Omit<ModuleInput, 'cohort_id'>): Promise<Module> {
  const { data, error } = await supabase.from('modules').update(input).eq('id', id).select('id, cohort_id, title, description, position').single();
  if (error) throw error;
  return { ...(data as Module), lessons: [] };
}

export async function deleteModule(id: string) {
  const { error } = await supabase.from('modules').delete().eq('id', id);
  if (error) throw error;
}

export async function createLesson(input: LessonInput): Promise<Lesson> {
  const { data, error } = await supabase.from('lessons').insert(input).select('id, module_id, title, description, video_url, duration_minutes, position').single();
  if (error) throw error;
  return data as Lesson;
}

export async function updateLesson(id: string, input: Omit<LessonInput, 'module_id'>): Promise<Lesson> {
  const { data, error } = await supabase.from('lessons').update(input).eq('id', id).select('id, module_id, title, description, video_url, duration_minutes, position').single();
  if (error) throw error;
  return data as Lesson;
}

export async function deleteLesson(id: string) {
  const { error } = await supabase.from('lessons').delete().eq('id', id);
  if (error) throw error;
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
export async function listAssignments(cohortId: string): Promise<Assignment[]> {
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
  const { data } = supabase.storage.from('submissions').getPublicUrl(path);
  return data.publicUrl;
}

// Student Submissions & Resubmissions
export async function listMySubmissions(userId: string): Promise<Submission[]> {
  const { data, error } = await supabase
    .from('submissions')
    .select('id, assignment_id, student_id, file_url, status, created_at')
    .eq('student_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const submissions = (data ?? []) as Omit<Submission, 'feedback'>[];
  return addFeedback(submissions);
}

export async function submitOrReplaceAssignment(
  userId: string,
  assignmentId: string,
  fileUrl: string,
  existingSubmissionId?: string
): Promise<Submission> {
  let targetId = existingSubmissionId;
  if (!targetId) {
    const { data: existing } = await supabase
      .from('submissions')
      .select('id')
      .eq('student_id', userId)
      .eq('assignment_id', assignmentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing?.id) {
      targetId = existing.id;
    }
  }

  if (targetId) {
    // Resubmission replacement: update file_url and reset status to 'pending'
    const updatePayload: Record<string, unknown> = {
      file_url: fileUrl,
      status: 'pending',
    };
    let { data, error } = await supabase
      .from('submissions')
      .update({ ...updatePayload, updated_at: new Date().toISOString() })
      .eq('id', targetId)
      .select('id, assignment_id, student_id, file_url, status, created_at')
      .single();

    if (error && error.message.includes('updated_at')) {
      const retry = await supabase
        .from('submissions')
        .update(updatePayload)
        .eq('id', targetId)
        .select('id, assignment_id, student_id, file_url, status, created_at')
        .single();
      data = retry.data;
      error = retry.error;
    }
    if (error) throw error;
    return { ...(data as Omit<Submission, 'feedback'>), feedback: null };
  }

  // Initial submission
  const { data, error } = await supabase
    .from('submissions')
    .insert({ student_id: userId, assignment_id: assignmentId, file_url: fileUrl, status: 'pending' })
    .select('id, assignment_id, student_id, file_url, status, created_at')
    .single();
  if (error) throw error;
  return { ...(data as Omit<Submission, 'feedback'>), feedback: null };
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
  cohortId?: string
): Promise<MentorSubmission[]> {
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
  const { data } = await supabase
    .from('feedback')
    .select('id, submission_id, mentor_id, comments, created_at')
    .in('submission_id', submissions.map((submission) => submission.id))
    .order('created_at', { ascending: false });

  const feedbackBySubmission = new Map<string, string>();
  const historyBySubmission = new Map<string, FeedbackItem[]>();

  for (const item of data ?? []) {
    if (!feedbackBySubmission.has(item.submission_id)) {
      feedbackBySubmission.set(item.submission_id, item.comments);
    }
    const current = historyBySubmission.get(item.submission_id) || [];
    current.push(item as FeedbackItem);
    historyBySubmission.set(item.submission_id, current);
  }

  return submissions.map((submission) => ({
    ...submission,
    feedback: feedbackBySubmission.get(submission.id) ?? null,
    feedback_history: historyBySubmission.get(submission.id) ?? [],
  }));
}

// Student Announcements
export async function listStudentAnnouncements(): Promise<StudentAnnouncement[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('id, title, body, created_at')
    .eq('published', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('Unable to load announcements:', error);
    return [];
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
    console.warn('Unable to load live sessions:', error);
    return [];
  }
  return (data ?? []) as StudentLiveSession[];
}

// Student Notifications
export async function listStudentNotifications(userId: string): Promise<StudentNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, user_id, title, body, read_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('Unable to load notifications:', error);
    return [];
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