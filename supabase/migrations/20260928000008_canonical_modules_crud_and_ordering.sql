-- ==============================================================================
-- Migration: 20260928000008_canonical_modules_crud_and_ordering.sql
-- Description: Hardens Modules entity with canonical schema, RLS policies,
--              status lifecycle, atomic reordering, safe duplication, and deletion guard.
-- Resolves:
--   1. Ensures public.modules has status ('draft', 'review', 'published', 'archived'),
--      course_id, updated_at, and automated timestamp triggers.
--   2. Enforces canonical RLS policies for public.modules, public.lessons, and public.lesson_resources.
--   3. Implements server-side atomic reordering RPC: reorder_modules
--   4. Implements atomic deep clone RPC: duplicate_module (including lessons & resources)
--   5. Implements safe deletion RPC: admin_delete_module (checks submissions & progress)
--   6. Creates public.modules_overview diagnostic view.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Schema Hardening on public.modules
-- ------------------------------------------------------------------------------
alter table public.modules add column if not exists course_id uuid references public.courses(id) on delete cascade;
alter table public.modules alter column cohort_id drop not null;
alter table public.modules add column if not exists status text not null default 'published';
alter table public.modules add column if not exists updated_at timestamptz not null default now();

-- Ensure status check constraint exists
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'modules_status_check'
  ) then
    alter table public.modules
      add constraint modules_status_check
      check (status in ('draft', 'review', 'published', 'archived'));
  end if;
exception when others then
  null;
end $$;

-- Automated updated_at trigger for modules
create or replace function public.sync_modules_updated_at()
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

drop trigger if exists trg_sync_modules_updated_at on public.modules;
create trigger trg_sync_modules_updated_at
  before update on public.modules
  for each row
  execute function public.sync_modules_updated_at();

-- Performance indexes for modules
create index if not exists idx_modules_cohort_position on public.modules(cohort_id, position);
create index if not exists idx_modules_course_position on public.modules(course_id, position);
create index if not exists idx_modules_status on public.modules(status);

-- ------------------------------------------------------------------------------
-- 2. Canonical Row Level Security for Modules, Lessons & Resources
-- ------------------------------------------------------------------------------

-- Modules RLS
alter table public.modules enable row level security;

drop policy if exists "Modules select policy" on public.modules;
create policy "Modules select policy"
  on public.modules for select
  to authenticated
  using (
    public.is_admin()
    or (
      cohort_id is not null
      and public.is_mentor_for_cohort(cohort_id)
    )
    or (
      status in ('published', 'review')
      and (
        cohort_id is null
        or exists (
          select 1 from public.enrollments e
          where e.cohort_id = modules.cohort_id
            and e.user_id = auth.uid()
            and e.status in ('enrolled', 'active', 'completed')
        )
        or exists (
          select 1 from public.cohorts c
          where c.id = modules.cohort_id
            and (c.visibility = 'public' or c.status in ('published', 'active'))
        )
      )
    )
    or (
      cohort_id is null
      and exists (
        select 1 from public.courses co
        where co.id = modules.course_id
          and co.status in ('published', 'active')
      )
    )
  );

drop policy if exists "Admins can manage modules" on public.modules;
create policy "Admins can manage modules"
  on public.modules for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Lessons RLS
alter table public.lessons enable row level security;

drop policy if exists "Lessons select policy" on public.lessons;
create policy "Lessons select policy"
  on public.lessons for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.modules m
      where m.id = lessons.module_id
      and (
        (m.cohort_id is not null and public.is_mentor_for_cohort(m.cohort_id))
        or (
          (lessons.status in ('published', 'review') or lessons.status is null)
          and (
            m.cohort_id is null
            or exists (
              select 1 from public.enrollments e
              where e.cohort_id = m.cohort_id
                and e.user_id = auth.uid()
                and e.status in ('enrolled', 'active', 'completed')
            )
            or exists (
              select 1 from public.cohorts c
              where c.id = m.cohort_id
                and (c.visibility = 'public' or c.status in ('published', 'active'))
            )
          )
        )
      )
    )
  );

drop policy if exists "Admins can manage lessons" on public.lessons;
create policy "Admins can manage lessons"
  on public.lessons for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Lesson Resources RLS
alter table public.lesson_resources enable row level security;

drop policy if exists "Lesson resources select policy" on public.lesson_resources;
create policy "Lesson resources select policy"
  on public.lesson_resources for select
  to authenticated
  using (
    public.is_admin()
    or visibility = 'public'
    or exists (
      select 1 from public.lessons l
      join public.modules m on m.id = l.module_id
      where l.id = lesson_resources.lesson_id
      and (
        public.is_mentor_for_cohort(m.cohort_id)
        or exists (
          select 1 from public.enrollments e
          where e.cohort_id = m.cohort_id
            and e.user_id = auth.uid()
            and e.status in ('enrolled', 'active', 'completed')
        )
      )
    )
  );

drop policy if exists "Admins can manage lesson resources" on public.lesson_resources;
create policy "Admins can manage lesson resources"
  on public.lesson_resources for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------------------------------------
-- 3. Atomic Reordering RPC: reorder_modules
-- ------------------------------------------------------------------------------
create or replace function public.reorder_modules(
  p_module_ids uuid[],
  p_cohort_id uuid default null,
  p_course_id uuid default null
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
    raise exception 'Unauthorized: Only active administrators can reorder modules.'
      using errcode = '42501';
  end if;

  v_count := coalesce(array_length(p_module_ids, 1), 0);
  if v_count = 0 then
    return jsonb_build_object('success', true, 'count', 0, 'message', 'No module IDs provided.');
  end if;

  for v_idx in 1 .. v_count loop
    update public.modules
    set position = v_idx,
        updated_at = now()
    where id = p_module_ids[v_idx];
  end loop;

  perform public.log_audit_event(
    'module.reordered_batch',
    'modules',
    coalesce(p_cohort_id::text, p_course_id::text, 'batch'),
    jsonb_build_object(
      'cohort_id', p_cohort_id,
      'course_id', p_course_id,
      'reordered_count', v_count,
      'module_ids', p_module_ids
    )
  );

  return jsonb_build_object(
    'success', true,
    'count', v_count,
    'message', format('%s modules reordered successfully.', v_count)
  );
end;
$$;

grant execute on function public.reorder_modules(uuid[], uuid, uuid) to authenticated;

-- ------------------------------------------------------------------------------
-- 4. Atomic Deep Duplication RPC: duplicate_module
-- ------------------------------------------------------------------------------
create or replace function public.duplicate_module(
  p_module_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mod record;
  v_new_mod_id uuid;
  v_next_pos integer;
  v_lesson record;
  v_new_lesson_id uuid;
  v_resource record;
  v_lessons_cloned integer := 0;
begin
  if not (public.is_admin() and public.is_active_user()) then
    raise exception 'Unauthorized: Only active administrators can duplicate modules.'
      using errcode = '42501';
  end if;

  select * into v_mod from public.modules where id = p_module_id;
  if not found then
    raise exception 'Module % not found.', p_module_id using errcode = 'P0002';
  end if;

  -- Determine next sequential position in container
  if v_mod.cohort_id is not null then
    select coalesce(max(position), 0) + 1 into v_next_pos
    from public.modules
    where cohort_id = v_mod.cohort_id;
  elsif v_mod.course_id is not null then
    select coalesce(max(position), 0) + 1 into v_next_pos
    from public.modules
    where course_id = v_mod.course_id;
  else
    v_next_pos := v_mod.position + 1;
  end if;

  -- Insert duplicated module
  insert into public.modules (
    cohort_id,
    course_id,
    title,
    description,
    position,
    status,
    created_at,
    updated_at
  )
  values (
    v_mod.cohort_id,
    v_mod.course_id,
    v_mod.title || ' (Copy)',
    v_mod.description,
    v_next_pos,
    'draft',
    now(),
    now()
  )
  returning id into v_new_mod_id;

  -- Clone lessons and resources
  for v_lesson in
    select * from public.lessons where module_id = p_module_id order by position
  loop
    insert into public.lessons (
      module_id,
      title,
      description,
      video_url,
      duration_minutes,
      position,
      status,
      created_at
    )
    values (
      v_new_mod_id,
      v_lesson.title,
      v_lesson.description,
      v_lesson.video_url,
      v_lesson.duration_minutes,
      v_lesson.position,
      'draft',
      now()
    )
    returning id into v_new_lesson_id;

    v_lessons_cloned := v_lessons_cloned + 1;

    for v_resource in
      select * from public.lesson_resources where lesson_id = v_lesson.id
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
    end loop;
  end loop;

  perform public.log_audit_event(
    'module.duplicated',
    'module',
    v_new_mod_id::text,
    jsonb_build_object(
      'source_module_id', p_module_id,
      'new_module_id', v_new_mod_id,
      'cohort_id', v_mod.cohort_id,
      'course_id', v_mod.course_id,
      'lessons_cloned', v_lessons_cloned
    )
  );

  return jsonb_build_object(
    'success', true,
    'id', v_new_mod_id,
    'cohort_id', v_mod.cohort_id,
    'course_id', v_mod.course_id,
    'title', v_mod.title || ' (Copy)',
    'description', v_mod.description,
    'position', v_next_pos,
    'status', 'draft',
    'lessons_cloned', v_lessons_cloned,
    'message', format('Module duplicated successfully with %s lesson(s).', v_lessons_cloned)
  );
end;
$$;

grant execute on function public.duplicate_module(uuid) to authenticated;

-- ------------------------------------------------------------------------------
-- 5. Safe Module Deletion Guard RPC: admin_delete_module
-- ------------------------------------------------------------------------------
create or replace function public.admin_delete_module(
  p_module_id uuid,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mod record;
  v_submission_count integer := 0;
  v_progress_count integer := 0;
begin
  if not (public.is_admin() and public.is_active_user()) then
    raise exception 'Unauthorized: Only active administrators can delete modules.'
      using errcode = '42501';
  end if;

  select id, title, status, cohort_id, course_id
  into v_mod
  from public.modules
  where id = p_module_id;

  if not found then
    raise exception 'Module % not found.', p_module_id
      using errcode = 'P0002';
  end if;

  -- Check student submissions linked to lessons within this module
  select count(s.id)
  into v_submission_count
  from public.submissions s
  join public.assignments a on s.assignment_id = a.id
  join public.lessons l on l.id = a.lesson_id
  where l.module_id = p_module_id;

  -- Check lesson watch progress linked to lessons within this module
  select count(lp.id)
  into v_progress_count
  from public.lesson_progress lp
  join public.lessons l on l.id = lp.lesson_id
  where l.module_id = p_module_id;

  -- Safety check: archive if student data exists and force is false
  if (v_submission_count > 0 or v_progress_count > 0) and not p_force then
    update public.modules
    set status = 'archived',
        updated_at = now()
    where id = p_module_id;

    perform public.log_audit_event(
      'module.archived_safely',
      'module',
      p_module_id::text,
      jsonb_build_object(
        'title', v_mod.title,
        'submissions', v_submission_count,
        'progress_records', v_progress_count,
        'reason', 'Preserved student progress and submissions; module status switched to archived.'
      )
    );

    return jsonb_build_object(
      'success', true,
      'action', 'archived',
      'message', format(
        'Module "%s" contains %s student submission(s) and %s progress record(s). To protect learner records, it has been marked as Archived rather than permanently deleted.',
        v_mod.title,
        v_submission_count,
        v_progress_count
      )
    );
  end if;

  -- Permitted delete
  delete from public.modules where id = p_module_id;

  perform public.log_audit_event(
    'module.deleted',
    'module',
    p_module_id::text,
    jsonb_build_object(
      'title', v_mod.title,
      'forced', p_force,
      'previous_submissions', v_submission_count,
      'previous_progress_records', v_progress_count
    )
  );

  return jsonb_build_object(
    'success', true,
    'action', 'deleted',
    'message', format('Module "%s" was successfully deleted.', v_mod.title)
  );
end;
$$;

grant execute on function public.admin_delete_module(uuid, boolean) to authenticated;

-- ------------------------------------------------------------------------------
-- 6. Canonical Modules Overview View
-- ------------------------------------------------------------------------------
create or replace view public.modules_overview as
select
  m.id,
  m.cohort_id,
  m.course_id,
  coalesce(c.title, 'Unassigned Cohort') as cohort_title,
  coalesce(cr.title, 'Unassigned Course') as course_title,
  m.title,
  m.description,
  m.position,
  m.status,
  m.created_at,
  m.updated_at,
  count(distinct l.id) as lessons_count,
  count(distinct a.id) as assignments_count,
  count(distinct lr.id) as resources_count
from public.modules m
left join public.cohorts c on c.id = m.cohort_id
left join public.courses cr on cr.id = m.course_id
left join public.lessons l on l.module_id = m.id
left join public.assignments a on a.lesson_id = l.id
left join public.lesson_resources lr on lr.lesson_id = l.id
group by m.id, m.cohort_id, m.course_id, c.title, cr.title, m.title, m.description, m.position, m.status, m.created_at, m.updated_at;

grant select on public.modules_overview to authenticated;

