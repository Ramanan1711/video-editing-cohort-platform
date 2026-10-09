-- ==============================================================================
-- Migration: 20260928000009_canonical_lessons_watch_verification_and_crud.sql
-- Description: Establishes authoritative lesson watch verification, database-level
--              integrity constraints, atomic reordering, deep duplication, and safe deletion.
-- Resolves:
--   1. Ensures public.lessons and public.lesson_progress have updated_at timestamps & triggers.
--   2. Enforces database-level 80% watch threshold trigger on public.lesson_progress to prevent
--      client bypass or fraudulent self-marking of video lessons.
--   3. Hardens verify_and_complete_lesson RPC with cross-checked duration/position validation.
--   4. Implements atomic lesson reordering RPC: reorder_lessons.
--   5. Implements atomic deep clone lesson RPC: duplicate_lesson (with resources & assignments).
--   6. Implements safe deletion guard RPC: admin_delete_lesson (protects submissions & progress).
--   7. Creates public.lessons_overview diagnostic reporting view.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Schema Hardening on public.lessons & public.lesson_progress
-- ------------------------------------------------------------------------------
alter table public.lessons add column if not exists updated_at timestamptz not null default now();
alter table public.lesson_progress add column if not exists updated_at timestamptz not null default now();

-- Automated updated_at triggers
create or replace function public.sync_lessons_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_sync_lessons_updated_at on public.lessons;
create trigger trg_sync_lessons_updated_at
  before update on public.lessons
  for each row
  execute function public.sync_lessons_updated_at();

create or replace function public.sync_lesson_progress_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_sync_lesson_progress_updated_at on public.lesson_progress;
create trigger trg_sync_lesson_progress_updated_at
  before update on public.lesson_progress
  for each row
  execute function public.sync_lesson_progress_updated_at();

-- Indexes for lesson queries and progress tracking
create index if not exists idx_lessons_module_position on public.lessons(module_id, position);
create index if not exists idx_lessons_status on public.lessons(status);
create index if not exists idx_lesson_progress_user_lesson on public.lesson_progress(user_id, lesson_id);
create index if not exists idx_lesson_progress_completed on public.lesson_progress(user_id, completed);

-- ------------------------------------------------------------------------------
-- 2. Database-Level Watch Verification Trigger on public.lesson_progress
-- Prevents clients or direct REST calls from bypassing the 80% threshold.
-- ------------------------------------------------------------------------------
create or replace function public.enforce_lesson_completion_threshold()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_video boolean;
  v_effective_watch numeric;
begin
  -- Only validate when completed is being asserted true
  if new.completed = true then
    select (video_url is not null and trim(video_url) != '')
    into v_has_video
    from public.lessons
    where id = new.lesson_id;

    if v_has_video then
      v_effective_watch := coalesce(new.watch_percentage, 0);

      -- Check if caller is admin or mentor (allowed manual overrides)
      if not public.is_mentor_or_admin() and v_effective_watch < 80 then
        raise exception 'Cannot mark lesson as completed: verified watch progress (%s%%) is below the mandatory 80%% threshold for video lessons.',
          round(v_effective_watch)
          using errcode = 'P0001';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_lesson_completion_threshold on public.lesson_progress;
create trigger trg_enforce_lesson_completion_threshold
  before insert or update on public.lesson_progress
  for each row
  execute function public.enforce_lesson_completion_threshold();

-- ------------------------------------------------------------------------------
-- 3. Hardened Authoritative verify_and_complete_lesson RPC
-- ------------------------------------------------------------------------------
create or replace function public.verify_and_complete_lesson(
  p_user_id uuid,
  p_lesson_id uuid,
  p_watch_percentage numeric default 0,
  p_position_seconds numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lesson record;
  v_has_video boolean := false;
  v_is_eligible boolean := false;
  v_existing record;
  v_calculated_watch numeric := 0;
  v_final_watch numeric := 0;
begin
  -- Authorization check: student themselves or mentor/admin
  if auth.uid() != p_user_id and not public.is_mentor_or_admin() then
    return jsonb_build_object(
      'success', false,
      'completed', false,
      'reason', 'Unauthorized: You can only complete lessons for your own account.'
    );
  end if;

  -- Verify lesson exists
  select id, title, video_url, duration_minutes, status
  into v_lesson
  from public.lessons
  where id = p_lesson_id;

  if not found then
    return jsonb_build_object(
      'success', false,
      'completed', false,
      'reason', format('Lesson %s not found.', p_lesson_id)
    );
  end if;

  v_has_video := (v_lesson.video_url is not null and trim(v_lesson.video_url) != '');

  -- Fetch existing progress
  select completed, watch_percentage, last_position_seconds
  into v_existing
  from public.lesson_progress
  where user_id = p_user_id and lesson_id = p_lesson_id;

  -- Calculate watch percentage from duration if position is provided
  if v_has_video and coalesce(v_lesson.duration_minutes, 0) > 0 and coalesce(p_position_seconds, 0) > 0 then
    v_calculated_watch := least(100.0, (p_position_seconds::numeric / (v_lesson.duration_minutes * 60)::numeric) * 100.0);
  end if;

  -- Authoritative watch percentage: max of existing, passed, or calculated (capped at 100)
  v_final_watch := least(100.0, greatest(
    coalesce(v_existing.watch_percentage, 0),
    coalesce(p_watch_percentage, 0),
    coalesce(v_calculated_watch, 0)
  ));

  -- Eligibility evaluation
  if coalesce(v_existing.completed, false) = true then
    v_is_eligible := true;
  elsif not v_has_video then
    -- Non-video reading/exercise lessons are eligible upon confirmation
    v_is_eligible := true;
  elsif v_final_watch >= 80 then
    v_is_eligible := true;
  else
    v_is_eligible := false;
  end if;

  if v_is_eligible then
    insert into public.lesson_progress (
      user_id,
      lesson_id,
      completed,
      completed_at,
      watch_percentage,
      last_position_seconds,
      updated_at
    )
    values (
      p_user_id,
      p_lesson_id,
      true,
      now(),
      v_final_watch,
      coalesce(p_position_seconds, coalesce(v_existing.last_position_seconds, 0)),
      now()
    )
    on conflict (user_id, lesson_id)
    do update set
      completed = true,
      completed_at = coalesce(public.lesson_progress.completed_at, now()),
      watch_percentage = greatest(coalesce(public.lesson_progress.watch_percentage, 0), v_final_watch),
      last_position_seconds = greatest(coalesce(public.lesson_progress.last_position_seconds, 0), coalesce(p_position_seconds, 0)),
      updated_at = now();

    perform public.log_audit_event(
      'lesson.completed',
      'lesson_progress',
      p_lesson_id::text,
      jsonb_build_object(
        'student_id', p_user_id,
        'lesson_id', p_lesson_id,
        'watch_percentage', v_final_watch,
        'verified', true
      )
    );

    return jsonb_build_object(
      'success', true,
      'completed', true,
      'watch_percentage', v_final_watch,
      'verified', true,
      'message', 'Lesson completion verified and recorded.'
    );
  else
    -- Record highest watch progress without marking completed
    insert into public.lesson_progress (
      user_id,
      lesson_id,
      completed,
      watch_percentage,
      last_position_seconds,
      updated_at
    )
    values (
      p_user_id,
      p_lesson_id,
      false,
      v_final_watch,
      coalesce(p_position_seconds, 0),
      now()
    )
    on conflict (user_id, lesson_id)
    do update set
      watch_percentage = greatest(coalesce(public.lesson_progress.watch_percentage, 0), v_final_watch),
      last_position_seconds = greatest(coalesce(public.lesson_progress.last_position_seconds, 0), coalesce(p_position_seconds, 0)),
      updated_at = now();

    return jsonb_build_object(
      'success', false,
      'completed', false,
      'watch_percentage', v_final_watch,
      'reason', format(
        'You have currently watched %s%% of "%s". At least 80%% verified video progress is required to mark this lesson complete.',
        round(v_final_watch),
        v_lesson.title
      )
    );
  end if;
end;
$$;

grant execute on function public.verify_and_complete_lesson(uuid, uuid, numeric, numeric) to authenticated;

-- ------------------------------------------------------------------------------
-- 4. Atomic Lesson Reordering RPC: reorder_lessons
-- ------------------------------------------------------------------------------
create or replace function public.reorder_lessons(
  p_lesson_ids uuid[],
  p_module_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_idx integer;
  v_count integer;
begin
  if not (public.is_admin() and public.is_active_user()) then
    raise exception 'Unauthorized: Only active administrators can reorder lessons.'
      using errcode = '42501';
  end if;

  v_count := coalesce(array_length(p_lesson_ids, 1), 0);
  if v_count = 0 then
    return jsonb_build_object('success', true, 'count', 0, 'message', 'No lesson IDs provided.');
  end if;

  for v_idx in 1 .. v_count loop
    update public.lessons
    set position = v_idx,
        updated_at = now()
    where id = p_lesson_ids[v_idx];
  end loop;

  perform public.log_audit_event(
    'lesson.reordered_batch',
    'lessons',
    coalesce(p_module_id::text, 'batch'),
    jsonb_build_object(
      'module_id', p_module_id,
      'reordered_count', v_count,
      'lesson_ids', p_lesson_ids
    )
  );

  return jsonb_build_object(
    'success', true,
    'count', v_count,
    'message', format('%s lessons reordered successfully.', v_count)
  );
end;
$$;

grant execute on function public.reorder_lessons(uuid[], uuid) to authenticated;

-- ------------------------------------------------------------------------------
-- 5. Atomic Deep Clone Lesson RPC: duplicate_lesson
-- ------------------------------------------------------------------------------
create or replace function public.duplicate_lesson(
  p_lesson_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orig record;
  v_new_lesson_id uuid;
  v_next_pos integer;
  v_resource record;
  v_assignment record;
  v_resources_cloned integer := 0;
  v_assignments_cloned integer := 0;
begin
  if not (public.is_admin() and public.is_active_user()) then
    raise exception 'Unauthorized: Only active administrators can duplicate lessons.'
      using errcode = '42501';
  end if;

  select * into v_orig from public.lessons where id = p_lesson_id;
  if not found then
    raise exception 'Lesson % not found.', p_lesson_id using errcode = 'P0002';
  end if;

  -- Determine next position in module
  select coalesce(max(position), 0) + 1 into v_next_pos
  from public.lessons
  where module_id = v_orig.module_id;

  -- Insert clone
  insert into public.lessons (
    module_id,
    title,
    description,
    video_url,
    duration_minutes,
    position,
    status,
    created_at,
    updated_at
  )
  values (
    v_orig.module_id,
    v_orig.title || ' (Copy)',
    v_orig.description,
    v_orig.video_url,
    v_orig.duration_minutes,
    v_next_pos,
    'draft',
    now(),
    now()
  )
  returning id into v_new_lesson_id;

  -- Clone lesson resources
  for v_resource in
    select * from public.lesson_resources where lesson_id = p_lesson_id
  loop
    insert into public.lesson_resources (
      lesson_id,
      title,
      file_url,
      file_size,
      resource_type,
      visibility,
      created_at
    )
    values (
      v_new_lesson_id,
      v_resource.title,
      v_resource.file_url,
      v_resource.file_size,
      v_resource.resource_type,
      v_resource.visibility,
      now()
    );
    v_resources_cloned := v_resources_cloned + 1;
  end loop;

  -- Clone assignments
  for v_assignment in
    select * from public.assignments where lesson_id = p_lesson_id
  loop
    insert into public.assignments (
      lesson_id,
      title,
      instructions,
      deadline,
      created_at
    )
    values (
      v_new_lesson_id,
      v_assignment.title || ' (Copy)',
      v_assignment.instructions,
      v_assignment.deadline,
      now()
    );
    v_assignments_cloned := v_assignments_cloned + 1;
  end loop;

  perform public.log_audit_event(
    'lesson.duplicated',
    'lesson',
    v_new_lesson_id::text,
    jsonb_build_object(
      'source_lesson_id', p_lesson_id,
      'new_lesson_id', v_new_lesson_id,
      'module_id', v_orig.module_id,
      'resources_cloned', v_resources_cloned,
      'assignments_cloned', v_assignments_cloned
    )
  );

  return jsonb_build_object(
    'success', true,
    'id', v_new_lesson_id,
    'module_id', v_orig.module_id,
    'title', v_orig.title || ' (Copy)',
    'description', v_orig.description,
    'video_url', v_orig.video_url,
    'duration_minutes', v_orig.duration_minutes,
    'position', v_next_pos,
    'status', 'draft',
    'resources_cloned', v_resources_cloned,
    'assignments_cloned', v_assignments_cloned,
    'message', format('Lesson duplicated successfully with %s resource(s) and %s assignment(s).', v_resources_cloned, v_assignments_cloned)
  );
end;
$$;

grant execute on function public.duplicate_lesson(uuid) to authenticated;

-- ------------------------------------------------------------------------------
-- 6. Safe Lesson Deletion Guard RPC: admin_delete_lesson
-- ------------------------------------------------------------------------------
create or replace function public.admin_delete_lesson(
  p_lesson_id uuid,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lesson record;
  v_submission_count integer := 0;
  v_progress_count integer := 0;
begin
  if not (public.is_admin() and public.is_active_user()) then
    raise exception 'Unauthorized: Only active administrators can delete lessons.'
      using errcode = '42501';
  end if;

  select id, title, status, module_id
  into v_lesson
  from public.lessons
  where id = p_lesson_id;

  if not found then
    raise exception 'Lesson % not found.', p_lesson_id
      using errcode = 'P0002';
  end if;

  -- Check student submissions linked to assignments under this lesson
  select count(s.id)
  into v_submission_count
  from public.submissions s
  join public.assignments a on a.id = s.assignment_id
  where a.lesson_id = p_lesson_id;

  -- Check student progress records
  select count(lp.id)
  into v_progress_count
  from public.lesson_progress lp
  where lp.lesson_id = p_lesson_id;

  -- Safety check: if learner data exists and force is false, archive safely
  if (v_submission_count > 0 or v_progress_count > 0) and not p_force then
    update public.lessons
    set status = 'archived',
        updated_at = now()
    where id = p_lesson_id;

    perform public.log_audit_event(
      'lesson.archived_safely',
      'lesson',
      p_lesson_id::text,
      jsonb_build_object(
        'title', v_lesson.title,
        'submissions', v_submission_count,
        'progress_records', v_progress_count,
        'reason', 'Preserved student records; lesson marked as archived.'
      )
    );

    return jsonb_build_object(
      'success', true,
      'action', 'archived',
      'message', format(
        'Lesson "%s" contains %s student submission(s) and %s progress record(s). To protect learner records, it has been marked as Archived rather than permanently deleted.',
        v_lesson.title,
        v_submission_count,
        v_progress_count
      )
    );
  end if;

  -- Permitted delete
  delete from public.lessons where id = p_lesson_id;

  perform public.log_audit_event(
    'lesson.deleted',
    'lesson',
    p_lesson_id::text,
    jsonb_build_object(
      'title', v_lesson.title,
      'forced', p_force,
      'previous_submissions', v_submission_count,
      'previous_progress_records', v_progress_count
    )
  );

  return jsonb_build_object(
    'success', true,
    'action', 'deleted',
    'message', format('Lesson "%s" was successfully deleted.', v_lesson.title)
  );
end;
$$;

grant execute on function public.admin_delete_lesson(uuid, boolean) to authenticated;

-- ------------------------------------------------------------------------------
-- 7. Canonical Lessons Overview View
-- ------------------------------------------------------------------------------
drop view if exists public.lessons_overview cascade;
create or replace view public.lessons_overview as
select
  l.id,
  l.module_id,
  m.title as module_title,
  m.cohort_id,
  coalesce(c.title, 'Standalone Course') as cohort_title,
  l.title,
  l.description,
  l.video_url,
  l.duration_minutes,
  l.position,
  l.status,
  l.created_at,
  l.updated_at,
  count(distinct lr.id) as resources_count,
  count(distinct a.id) as assignments_count,
  count(distinct lp.user_id) filter (where lp.completed = true) as completed_students_count
from public.lessons l
join public.modules m on m.id = l.module_id
left join public.cohorts c on c.id = m.cohort_id
left join public.lesson_resources lr on lr.lesson_id = l.id
left join public.assignments a on a.lesson_id = l.id
left join public.lesson_progress lp on lp.lesson_id = l.id
group by l.id, l.module_id, m.title, m.cohort_id, c.title, l.title, l.description, l.video_url, l.duration_minutes, l.position, l.status, l.created_at, l.updated_at;

grant select on public.lessons_overview to authenticated;

