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

export interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  file_url: string;
  status: SubmissionStatus;
  feedback: string | null;
  created_at?: string;
  updated_at?: string;
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

export async function getStudentCourseData(userId: string): Promise<StudentCourseData> {
  const { data: enrollment, error: enrollmentError } = await supabase
    .from('enrollments')
    .select('cohort_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (enrollmentError) throw enrollmentError;
  if (!enrollment) return { cohort: null, modules: [], progress: [] };

  const [{ data: cohort, error: cohortError }, { data: modules, error: modulesError }, { data: progress, error: progressError }] = await Promise.all([
    supabase.from('cohorts').select('id, title, description').eq('id', enrollment.cohort_id).maybeSingle(),
    supabase.from('modules').select(courseSelect).eq('cohort_id', enrollment.cohort_id).order('position', { ascending: true }),
    supabase.from('lesson_progress').select('lesson_id, completed').eq('user_id', userId),
  ]);

  if (cohortError) throw cohortError;
  if (modulesError) throw modulesError;
  if (progressError) throw progressError;

  return {
    cohort: cohort ? { id: cohort.id, name: cohort.title, description: cohort.description } : null,
    modules: ((modules ?? []) as Module[]).map((module) => ({
      ...module,
      lessons: [...(module.lessons ?? [])].sort((a, b) => a.position - b.position),
    })),
    progress: (progress ?? []) as LessonProgress[],
  };
}

export async function markLessonComplete(userId: string, lessonId: string, completed: boolean) {
  const { error } = await supabase.from('lesson_progress').upsert(
    { user_id: userId, lesson_id: lessonId, completed },
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

export async function reviewSubmission(
  id: string,
  mentorId: string,
  status: Extract<Submission['status'], 'reviewed' | 'resubmit'>,
  feedback: string
): Promise<Submission> {
  const { data, error } = await supabase
    .from('submissions')
    .update({ status })
    .eq('id', id)
    .select('id, assignment_id, student_id, file_url, status, created_at')
    .single();
  if (error) throw error;

  if (feedback.trim()) {
    const { error: feedbackError } = await supabase.from('feedback').insert({
      submission_id: id,
      mentor_id: mentorId,
      comments: feedback.trim(),
    });
    if (feedbackError) throw feedbackError;
  }

  return { ...(data as Omit<Submission, 'feedback'>), feedback: feedback || null };
}

async function addFeedback(submissions: Omit<Submission, 'feedback'>[]): Promise<Submission[]> {
  if (!submissions.length) return [];
  const { data } = await supabase
    .from('feedback')
    .select('submission_id, comments, created_at')
    .in('submission_id', submissions.map((submission) => submission.id))
    .order('created_at', { ascending: false });

  const feedbackBySubmission = new Map<string, string>();
  for (const item of data ?? []) {
    if (!feedbackBySubmission.has(item.submission_id)) {
      feedbackBySubmission.set(item.submission_id, item.comments);
    }
  }
  return submissions.map((submission) => ({ ...submission, feedback: feedbackBySubmission.get(submission.id) ?? null }));
}