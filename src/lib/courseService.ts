import { supabase } from './supabaseClient';

export interface Cohort { id: string; name: string; description: string | null; }
export interface Lesson { id: string; module_id: string; title: string; description: string | null; video_url: string | null; duration_minutes: number | null; position: number; }
export interface Module { id: string; cohort_id: string; title: string; description: string | null; position: number; lessons: Lesson[]; }
export interface Enrollment { user_id: string; cohort_id: string; status: 'active' | 'completed' | 'dropped'; created_at?: string; }
export interface LessonResource { id: string; lesson_id: string; name: string; url: string; }
export interface LessonProgress { lesson_id: string; completed: boolean; completed_at?: string | null; }
export interface StudentCourseData { cohort: Cohort | null; modules: Module[]; progress: LessonProgress[]; }
export interface Assignment { id: string; lesson_id: string; title: string; instructions: string | null; deadline: string | null; }
export type SubmissionStatus = 'pending' | 'reviewed' | 'resubmit';
export interface Submission { id: string; assignment_id: string; student_id: string; file_url: string; status: SubmissionStatus; feedback: string | null; created_at?: string; }

export type CohortInput = Pick<Cohort, 'name' | 'description'>;
export type ModuleInput = Pick<Module, 'cohort_id' | 'title' | 'description' | 'position'>;
export type LessonInput = Pick<Lesson, 'module_id' | 'title' | 'description' | 'video_url' | 'duration_minutes' | 'position'>;
export type EnrollmentInput = Pick<Enrollment, 'user_id' | 'cohort_id' | 'status'>;

const courseSelect = 'id, cohort_id, title, description, position, lessons(id, module_id, title, description, video_url, duration_minutes, position)';

export async function getStudentCourseData(userId: string): Promise<StudentCourseData> {
  // Select active enrollment, ordering by newest created to handle multiple historical enrollments
  const { data: enrollment, error: enrollmentError } = await supabase
    .from('enrollments')
    .select('cohort_id, status, created_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
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
    modules: ((modules ?? []) as Module[]).map((module) => ({ ...module, lessons: [...(module.lessons ?? [])].sort((a, b) => a.position - b.position) })),
    progress: (progress ?? []) as LessonProgress[],
  };
}

export async function markLessonComplete(userId: string, lessonId: string, completed: boolean) {
  const { error } = await supabase
    .from('lesson_progress')
    .upsert({ user_id: userId, lesson_id: lessonId, completed, completed_at: completed ? new Date().toISOString() : null }, { onConflict: 'user_id,lesson_id' });
  if (error) throw error;
}

export async function listCohorts(): Promise<Cohort[]> {
  const { data, error } = await supabase.from('cohorts').select('id, title, description').order('title');
  if (error) throw error;
  return (data ?? []).map((cohort) => ({ id: cohort.id, name: cohort.title, description: cohort.description }));
}

export async function listAvailableCohorts(userId: string): Promise<Cohort[]> {
  const { data: enrollments, error: enrollmentError } = await supabase
    .from('enrollments')
    .select('cohort_id, status')
    .eq('user_id', userId)
    .eq('status', 'active');
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
  return ((data ?? []) as Module[]).map((module) => ({ ...module, lessons: module.lessons ?? [] }));
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

export type AssignmentInput = Pick<Assignment, 'lesson_id' | 'title' | 'instructions' | 'deadline'>;

export async function createAssignment(input: AssignmentInput): Promise<Assignment> {
  const { data, error } = await supabase.from('assignments').insert(input).select('id, lesson_id, title, instructions, deadline').single();
  if (error) throw error;
  return data as Assignment;
}

export async function updateAssignment(id: string, input: Omit<AssignmentInput, 'lesson_id'>): Promise<Assignment> {
  const { data, error } = await supabase.from('assignments').update(input).eq('id', id).select('id, lesson_id, title, instructions, deadline').single();
  if (error) throw error;
  return data as Assignment;
}

export async function deleteAssignment(id: string) {
  const { error } = await supabase.from('assignments').delete().eq('id', id);
  if (error) throw error;
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
  const query = id
    ? supabase.from('enrollments').update({ status: input.status }).eq('user_id', input.user_id).eq('cohort_id', input.cohort_id)
    : supabase.from('enrollments').upsert(input, { onConflict: 'user_id,cohort_id' });
  const { data, error } = await query.select('user_id, cohort_id, status, created_at').single();
  if (error) throw error;
  return data as Enrollment;
}

export async function deleteEnrollment(userId: string, cohortId: string) {
  const { error } = await supabase.from('enrollments').delete().eq('user_id', userId).eq('cohort_id', cohortId);
  if (error) throw error;
}

export async function listAssignments(_cohortId: string): Promise<Assignment[]> {
  const modules = await listModules(_cohortId);
  const lessonIds = modules.flatMap((module) => module.lessons.map((lesson) => lesson.id));
  if (!lessonIds.length) return [];
  const { data, error } = await supabase.from('assignments').select('id, lesson_id, title, instructions, deadline').in('lesson_id', lessonIds).order('deadline');
  if (error) throw error;
  return (data ?? []) as Assignment[];
}

// Storage path extraction for private bucket objects
export function extractStoragePath(fileUrlOrPath: string): string | null {
  if (!fileUrlOrPath) return null;
  if (fileUrlOrPath.includes('/storage/v1/object/public/submissions/')) {
    return decodeURIComponent(fileUrlOrPath.split('/storage/v1/object/public/submissions/')[1]);
  }
  if (fileUrlOrPath.includes('/storage/v1/object/sign/submissions/')) {
    return decodeURIComponent(fileUrlOrPath.split('/storage/v1/object/sign/submissions/')[1].split('?')[0]);
  }
  if (fileUrlOrPath.includes('/submissions/')) {
    return decodeURIComponent(fileUrlOrPath.split('/submissions/')[1].split('?')[0]);
  }
  if (!fileUrlOrPath.startsWith('http://') && !fileUrlOrPath.startsWith('https://')) {
    return fileUrlOrPath;
  }
  return null;
}

// Generates time-limited signed URL for private submission files (default 1 hour)
export async function getSubmissionSignedUrl(fileUrlOrPath: string): Promise<string> {
  const path = extractStoragePath(fileUrlOrPath);
  if (!path) return fileUrlOrPath; // External link or fallback
  try {
    const { data, error } = await supabase.storage.from('submissions').createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) {
      console.warn('Could not generate signed URL for path:', path, error);
      return fileUrlOrPath;
    }
    return data.signedUrl;
  } catch (err) {
    console.warn('Failed to get signed URL:', err);
    return fileUrlOrPath;
  }
}

async function resolveSubmissionUrls(submissions: Omit<Submission, 'feedback'>[]): Promise<Omit<Submission, 'feedback'>[]> {
  return Promise.all(
    submissions.map(async (sub) => {
      const signedUrl = await getSubmissionSignedUrl(sub.file_url);
      return { ...sub, file_url: signedUrl };
    })
  );
}

export async function listMySubmissions(userId: string): Promise<Submission[]> {
  const { data, error } = await supabase
    .from('submissions')
    .select('id, assignment_id, student_id, file_url, status, created_at')
    .eq('student_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const submissions = await resolveSubmissionUrls((data ?? []) as Omit<Submission, 'feedback'>[]);
  return addFeedback(submissions);
}

export async function submitAssignment(userId: string, assignmentId: string, videoUrl: string): Promise<Submission> {
  // Prevent duplicate pending submissions for the same assignment
  const { data: existingPending, error: checkError } = await supabase
    .from('submissions')
    .select('id')
    .eq('student_id', userId)
    .eq('assignment_id', assignmentId)
    .eq('status', 'pending')
    .maybeSingle();

  if (checkError) throw checkError;
  if (existingPending) {
    throw new Error('You already have a pending submission for this assignment. Please wait for mentor review.');
  }

  const { data, error } = await supabase
    .from('submissions')
    .insert({ student_id: userId, assignment_id: assignmentId, file_url: videoUrl, status: 'pending' })
    .select('id, assignment_id, student_id, file_url, status, created_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('You already have a pending submission for this assignment. Please wait for mentor review.');
    }
    throw error;
  }
  return { ...(data as Omit<Submission, 'feedback'>), feedback: null };
}

// Uploads file to private submissions bucket and returns relative storage path
export async function uploadSubmissionFile(userId: string, file: File): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const path = `${userId}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from('submissions')
    .upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (uploadError) throw uploadError;
  return path;
}

export async function uploadCourseAsset(file: File): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const path = `lessons/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage
    .from('course-assets')
    .upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (error) throw error;
  return supabase.storage.from('course-assets').getPublicUrl(path).data.publicUrl;
}

export async function listPendingSubmissions(): Promise<Submission[]> {
  const { data, error } = await supabase
    .from('submissions')
    .select('id, assignment_id, student_id, file_url, status, created_at')
    .eq('status', 'pending')
    .order('created_at');
  if (error) throw error;
  const submissions = await resolveSubmissionUrls((data ?? []) as Omit<Submission, 'feedback'>[]);
  return addFeedback(submissions);
}

// Atomic review update and feedback insertion
export async function reviewSubmission(
  id: string,
  mentorId: string,
  status: Extract<Submission['status'], 'reviewed' | 'resubmit'>,
  feedback: string
): Promise<Submission> {
  const trimmedFeedback = feedback.trim();

  // 1. Attempt atomic stored procedure execution
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('review_submission_atomic', {
      p_submission_id: id,
      p_mentor_id: mentorId,
      p_status: status,
      p_feedback: trimmedFeedback || null,
    });

    if (!rpcError && rpcData) {
      const parsed = typeof rpcData === 'string' ? JSON.parse(rpcData) : rpcData;
      return parsed as Submission;
    }
    if (rpcError) {
      console.warn('review_submission_atomic RPC error, falling back to sequential transaction:', rpcError.message);
    }
  } catch (err) {
    console.warn('review_submission_atomic invocation exception, using fallback:', err);
  }

  // 2. Fallback sequential execution if RPC is not deployed yet
  const { data, error } = await supabase
    .from('submissions')
    .update({ status })
    .eq('id', id)
    .select('id, assignment_id, student_id, file_url, status, created_at')
    .single();
  if (error) throw error;

  if (trimmedFeedback) {
    const { error: feedbackError } = await supabase
      .from('feedback')
      .insert({ submission_id: id, mentor_id: mentorId, comments: trimmedFeedback });
    if (feedbackError) throw feedbackError;
  }
  return { ...(data as Omit<Submission, 'feedback'>), feedback: trimmedFeedback || null };
}

async function addFeedback(submissions: Omit<Submission, 'feedback'>[]): Promise<Submission[]> {
  if (!submissions.length) return [];
  const { data } = await supabase
    .from('feedback')
    .select('submission_id, comments, created_at')
    .in('submission_id', submissions.map((submission) => submission.id))
    .order('created_at', { ascending: false });
  const feedbackBySubmission = new Map<string, string>();
  for (const item of data ?? []) if (!feedbackBySubmission.has(item.submission_id)) feedbackBySubmission.set(item.submission_id, item.comments);
  return submissions.map((submission) => ({ ...submission, feedback: feedbackBySubmission.get(submission.id) ?? null }));
}

export async function listLessonResources(lessonId: string): Promise<LessonResource[]> {
  const { data, error } = await supabase.from('lesson_resources').select('id, lesson_id, name, url').eq('lesson_id', lessonId).order('name');
  if (error) return [];
  return (data ?? []) as LessonResource[];
}

export type LessonResourceInput = Pick<LessonResource, 'lesson_id' | 'name' | 'url'>;

export async function createLessonResource(input: LessonResourceInput): Promise<LessonResource> {
  const { data, error } = await supabase.from('lesson_resources').insert(input).select('id, lesson_id, name, url').single();
  if (error) throw error;
  return data as LessonResource;
}

export async function updateLessonResource(id: string, input: Omit<LessonResourceInput, 'lesson_id'>): Promise<LessonResource> {
  const { data, error } = await supabase.from('lesson_resources').update(input).eq('id', id).select('id, lesson_id, name, url').single();
  if (error) throw error;
  return data as LessonResource;
}

export async function deleteLessonResource(id: string) {
  const { error } = await supabase.from('lesson_resources').delete().eq('id', id);
  if (error) throw error;
}