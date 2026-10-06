import { supabase } from '../supabaseClient';
import { listModules } from './curriculumService';

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

export type AssignmentInput = {
  lesson_id: string;
  cohort_id?: string | null;
  module_id?: string | null;
  title: string;
  instructions?: string | null;
  description?: string | null;
  deadline?: string | null;
};

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

export interface MentorSubmission extends Submission {
  student_name?: string;
  student_email?: string;
  assignment_title?: string;
  assignment_instructions?: string | null;
  assignment_deadline?: string | null;
  cohort_name?: string;
}

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

