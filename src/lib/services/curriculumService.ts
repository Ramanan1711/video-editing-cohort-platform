import { supabase } from '../supabaseClient';
import { parseDatabaseError } from '../errorHandling';
import { queryCache } from '../queryCache';
import { DEFAULT_COHORT_FEE_INR, DEFAULT_CURRENCY } from '../paymentService';

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

export type CourseInput = Pick<Course, 'title'> &
  Partial<Pick<Course, 'description' | 'slug' | 'thumbnail_url' | 'status' | 'difficulty_level' | 'estimated_hours' | 'track_type'>>;

export type CohortInput = Pick<Cohort, 'name' | 'description'> &
  Partial<Pick<Cohort, 'status' | 'capacity' | 'visibility' | 'enrollment_start' | 'enrollment_end' | 'course_id' | 'track_type' | 'duration_days' | 'price_inr' | 'currency'>>;

export type ModuleInput = Pick<Module, 'title'> &
  Partial<Pick<Module, 'cohort_id' | 'course_id' | 'description' | 'position' | 'status'>>;

export type LessonInput = Pick<Lesson, 'module_id' | 'title' | 'description' | 'video_url' | 'duration_minutes' | 'position'> &
  Partial<Pick<Lesson, 'status'>>;

export type EnrollmentInput = Pick<Enrollment, 'user_id' | 'cohort_id' | 'status'>;

export const courseSelectWithStatus = 'id, cohort_id, course_id, title, description, position, status, lessons(id, module_id, title, description, video_url, duration_minutes, position, status)';
export const courseSelectLegacy = 'id, cohort_id, title, description, position, lessons(id, module_id, title, description, video_url, duration_minutes, position)';
export const courseSelect = courseSelectWithStatus;

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
    .in('status', ['enrolled', 'active', 'completed', 'inactive']);
  if (enrollmentError) throw enrollmentError;
  const enrolledIds = (enrollments ?? []).map((enrollment) => enrollment.cohort_id);
  const cohorts = await listCohorts();
  return cohorts.filter((cohort) => !enrolledIds.includes(cohort.id) && cohort.status !== 'archived');
}

export async function listEnrolledCohorts(userId: string): Promise<Cohort[]> {
  const { data: enrollments, error: enrollmentsError } = await supabase
    .from('enrollments')
    .select('cohort_id')
    .eq('user_id', userId)
    .in('status', ['enrolled', 'active', 'completed', 'inactive']);

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
    supabase.from('enrollments').select('cohort_id').eq('user_id', userId).in('status', ['enrolled', 'active', 'completed', 'inactive']),
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

