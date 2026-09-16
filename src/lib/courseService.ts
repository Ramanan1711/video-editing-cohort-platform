import { supabase } from './supabaseClient';

export interface Cohort { id: string; name: string; description: string | null; }
export interface Lesson { id: string; module_id: string; title: string; description: string | null; video_url: string | null; duration_minutes: number | null; position: number; }
export interface Module { id: string; cohort_id: string; title: string; description: string | null; position: number; lessons: Lesson[]; }
export interface LessonProgress { lesson_id: string; completed: boolean; }
export interface StudentCourseData { cohort: Cohort | null; modules: Module[]; progress: LessonProgress[]; }

export async function getStudentCourseData(userId: string): Promise<StudentCourseData> {
  const { data: enrollment, error: enrollmentError } = await supabase.from('enrollments').select('cohort_id').eq('user_id', userId).limit(1).maybeSingle();
  if (enrollmentError) throw enrollmentError;
  if (!enrollment) return { cohort: null, modules: [], progress: [] };

  const [{ data: cohort, error: cohortError }, { data: modules, error: modulesError }, { data: progress, error: progressError }] = await Promise.all([
    supabase.from('cohorts').select('id, name, description').eq('id', enrollment.cohort_id).maybeSingle(),
    supabase.from('modules').select('id, cohort_id, title, description, position, lessons(id, module_id, title, description, video_url, duration_minutes, position)').eq('cohort_id', enrollment.cohort_id).order('position', { ascending: true }),
    supabase.from('lesson_progress').select('lesson_id, completed').eq('user_id', userId),
  ]);
  if (cohortError) throw cohortError;
  if (modulesError) throw modulesError;
  if (progressError) throw progressError;

  return {
    cohort: cohort as Cohort | null,
    modules: ((modules ?? []) as Module[]).map((module) => ({ ...module, lessons: [...(module.lessons ?? [])].sort((a, b) => a.position - b.position) })),
    progress: (progress ?? []) as LessonProgress[],
  };
}

export async function markLessonComplete(userId: string, lessonId: string, completed: boolean) {
  const { error } = await supabase.from('lesson_progress').upsert({ user_id: userId, lesson_id: lessonId, completed }, { onConflict: 'user_id,lesson_id' });
  if (error) throw error;
}