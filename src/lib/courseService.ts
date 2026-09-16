import { supabase } from './supabaseClient';

export interface Cohort { id: string; name: string; description: string | null; }
export interface Lesson { id: string; module_id: string; title: string; description: string | null; video_url: string | null; duration_minutes: number | null; position: number; }
export interface Module { id: string; cohort_id: string; title: string; description: string | null; position: number; lessons: Lesson[]; }
export interface Enrollment { id: string; user_id: string; cohort_id: string; status: 'active' | 'completed' | 'cancelled'; created_at?: string; }
export interface LessonResource { id: string; lesson_id: string; name: string; url: string; }
export interface LessonProgress { lesson_id: string; completed: boolean; completed_at?: string | null; }
export interface StudentCourseData { cohort: Cohort | null; modules: Module[]; progress: LessonProgress[]; }

export type CohortInput = Pick<Cohort, 'name' | 'description'>;
export type ModuleInput = Pick<Module, 'cohort_id' | 'title' | 'description' | 'position'>;
export type LessonInput = Pick<Lesson, 'module_id' | 'title' | 'description' | 'video_url' | 'duration_minutes' | 'position'>;
export type EnrollmentInput = Pick<Enrollment, 'user_id' | 'cohort_id' | 'status'>;

const courseSelect = 'id, cohort_id, title, description, position, lessons(id, module_id, title, description, video_url, duration_minutes, position)';

export async function getStudentCourseData(userId: string): Promise<StudentCourseData> {
  const { data: enrollment, error: enrollmentError } = await supabase.from('enrollments').select('cohort_id').eq('user_id', userId).limit(1).maybeSingle();
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
  const { error } = await supabase.from('lesson_progress').upsert({ user_id: userId, lesson_id: lessonId, completed, completed_at: completed ? new Date().toISOString() : null }, { onConflict: 'user_id,lesson_id' });
  if (error) throw error;
}

export async function listCohorts(): Promise<Cohort[]> {
  const { data, error } = await supabase.from('cohorts').select('id, title, description').order('title');
  if (error) throw error;
  return (data ?? []).map((cohort) => ({ id: cohort.id, name: cohort.title, description: cohort.description }));
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
  let query = supabase.from('enrollments').select('id, user_id, cohort_id, status, created_at').order('created_at', { ascending: false });
  if (cohortId) query = query.eq('cohort_id', cohortId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Enrollment[];
}

export async function saveEnrollment(input: EnrollmentInput, id?: string): Promise<Enrollment> {
  const query = id ? supabase.from('enrollments').update(input).eq('id', id) : supabase.from('enrollments').insert(input);
  const { data, error } = await query.select('id, user_id, cohort_id, status, created_at').single();
  if (error) throw error;
  return data as Enrollment;
}

export async function deleteEnrollment(id: string) {
  const { error } = await supabase.from('enrollments').delete().eq('id', id);
  if (error) throw error;
}

export async function listLessonResources(lessonId: string): Promise<LessonResource[]> {
  const { data, error } = await supabase.from('lesson_resources').select('id, lesson_id, name, url').eq('lesson_id', lessonId).order('name');
  if (error) return [];
  return (data ?? []) as LessonResource[];
}