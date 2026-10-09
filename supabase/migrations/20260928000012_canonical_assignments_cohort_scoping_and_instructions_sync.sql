-- ==============================================================================
-- Migration: 20260928000012_canonical_assignments_cohort_scoping_and_instructions_sync.sql
-- Description: Resolves Assignments Schema & Client Incompatibilities:
--              1. Reconciles dual-column schema by ensuring both 'instructions' and
--                 'description' columns exist and are kept synchronized via trigger.
--              2. Ensures 'cohort_id' and 'module_id' are automatically populated
--                 and kept in sync with the lesson hierarchy (lesson -> module -> cohort).
--              3. Relaxes strict NOT NULL constraint on 'cohort_id' so drafts / course
--                 templates do not fail, while automatically populating 'cohort_id'
--                 for all cohort-scoped assignments.
--              4. Deploys authoritative trigger: trg_sync_assignment_fields.
--              5. Re-establishes canonical Row-Level Security (RLS) policies for
--                 students, mentors, and admins.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Schema Hardening on public.assignments
-- ------------------------------------------------------------------------------

-- Ensure instructions, description, cohort_id, module_id exist
alter table public.assignments
  add column if not exists instructions text,
  add column if not exists description text,
  add column if not exists cohort_id uuid references public.cohorts(id) on delete cascade,
  add column if not exists module_id uuid references public.modules(id) on delete set null,
  add column if not exists lesson_id uuid references public.lessons(id) on delete set null,
  add column if not exists deadline timestamptz,
  add column if not exists rubric jsonb default '[]'::jsonb,
  add column if not exists created_at timestamptz not null default now();

-- Drop NOT NULL on cohort_id if present to allow trigger-based auto-derivation
-- and support standalone course template assignments without breaking constraints
alter table public.assignments
  alter column cohort_id drop not null;

-- Synchronize existing rows: instructions <-> description
update public.assignments
set instructions = description
where instructions is null and description is not null;

update public.assignments
set description = instructions
where description is null and instructions is not null;

-- Backfill cohort_id and module_id from lessons -> modules hierarchy
update public.assignments a
set
  cohort_id = coalesce(a.cohort_id, m.cohort_id),
  module_id = coalesce(a.module_id, l.module_id)
from public.lessons l
join public.modules m on m.id = l.module_id
where a.lesson_id = l.id
  and (a.cohort_id is null or a.module_id is null);

-- Secondary backfill: if module_id is populated but cohort_id is not
update public.assignments a
set cohort_id = m.cohort_id
from public.modules m
where a.module_id = m.id
  and a.cohort_id is null
  and m.cohort_id is not null;

-- Indexes for performance
create index if not exists idx_assignments_cohort_id on public.assignments(cohort_id);
create index if not exists idx_assignments_lesson_id on public.assignments(lesson_id);
create index if not exists idx_assignments_module_id on public.assignments(module_id);
create index if not exists idx_assignments_deadline on public.assignments(deadline);

-- ------------------------------------------------------------------------------
-- 2. Trigger: Automatic Cohort Scoping & Instructions/Description Dual Sync
-- ------------------------------------------------------------------------------

create or replace function public.sync_assignment_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_derived_cohort_id uuid;
  v_derived_module_id uuid;
begin
  -- 1. Dual sync between instructions and description
  if new.instructions is not null and (new.description is null or btrim(new.description) = '') then
    new.description := new.instructions;
  elsif new.description is not null and (new.instructions is null or btrim(new.instructions) = '') then
    new.instructions := new.description;
  end if;

  -- 2. Auto-derive module_id from lesson if not provided
  if new.module_id is null and new.lesson_id is not null then
    select l.module_id
    into v_derived_module_id
    from public.lessons l
    where l.id = new.lesson_id;

    if v_derived_module_id is not null then
      new.module_id := v_derived_module_id;
    end if;
  end if;

  -- 3. Auto-derive cohort_id from lesson -> module hierarchy if omitted
  if new.cohort_id is null and new.lesson_id is not null then
    select m.cohort_id
    into v_derived_cohort_id
    from public.lessons l
    join public.modules m on m.id = l.module_id
    where l.id = new.lesson_id;

    if v_derived_cohort_id is not null then
      new.cohort_id := v_derived_cohort_id;
    end if;
  end if;

  -- 4. If cohort_id is still null but module_id is present, derive from module
  if new.cohort_id is null and new.module_id is not null then
    select m.cohort_id
    into v_derived_cohort_id
    from public.modules m
    where m.id = new.module_id;

    if v_derived_cohort_id is not null then
      new.cohort_id := v_derived_cohort_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_assignment_fields on public.assignments;
create trigger trg_sync_assignment_fields
  before insert or update on public.assignments
  for each row
  execute function public.sync_assignment_fields();

-- ------------------------------------------------------------------------------
-- 3. Canonical Row-Level Security (RLS) on public.assignments
-- ------------------------------------------------------------------------------

-- Ensure helper functions exist for safe execution in any environment
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and coalesce(status, 'active') = 'active'
  );
$$;

create or replace function public.is_mentor_or_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('mentor', 'admin')
      and coalesce(status, 'active') = 'active'
  );
$$;

create or replace function public.is_mentor_for_cohort(p_cohort_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.mentor_cohorts mc
    join public.profiles p on p.id = mc.mentor_id
    where mc.mentor_id = auth.uid()
      and mc.cohort_id = p_cohort_id
      and p.role in ('mentor', 'admin')
      and coalesce(p.status, 'active') = 'active'
  );
$$;

create or replace function public.is_enrolled_in_cohort(p_cohort_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.enrollments
    where user_id = auth.uid()
      and cohort_id = p_cohort_id
      and status in ('enrolled', 'active')
  );
$$;

create or replace function public.is_student_in_cohort(p_cohort_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_enrolled_in_cohort(p_cohort_id);
$$;

alter table public.assignments enable row level security;

-- Drop legacy / conflicting policies
drop policy if exists "Assignments viewable by enrolled students, mentors, and admins" on public.assignments;
drop policy if exists "Assignments manageable by cohort mentors and admins" on public.assignments;
drop policy if exists "Admins and mentors can manage assignments" on public.assignments;
drop policy if exists "Students can view assignments in their cohorts" on public.assignments;
drop policy if exists "Mentors can view assignments in assigned cohorts" on public.assignments;
drop policy if exists "Mentors can manage assignments in assigned cohorts" on public.assignments;
drop policy if exists "Authenticated users can view assignments" on public.assignments;
drop policy if exists "Staff can manage assignments" on public.assignments;

-- SELECT policy: Viewable by admins, assigned mentors, enrolled students, or course templates
create policy "Assignments viewable by enrolled students, mentors, and admins"
on public.assignments for select
to authenticated
using (
  public.is_admin()
  or (cohort_id is not null and public.is_mentor_for_cohort(cohort_id))
  or (cohort_id is not null and public.is_enrolled_in_cohort(cohort_id))
  or (
    cohort_id is null and (
      public.is_mentor_or_admin()
      or exists (
        select 1 from public.lessons l
        join public.modules m on m.id = l.module_id
        join public.cohorts c on c.id = m.cohort_id
        where l.id = assignments.lesson_id
          and (public.is_mentor_for_cohort(c.id) or public.is_enrolled_in_cohort(c.id))
      )
    )
  )
);

-- INSERT / UPDATE / DELETE policy: Manageable by admins and assigned mentors for the cohort
create policy "Assignments manageable by cohort mentors and admins"
on public.assignments for all
to authenticated
using (
  public.is_admin()
  or (cohort_id is not null and public.is_mentor_for_cohort(cohort_id))
  or (
    cohort_id is null and (
      public.is_admin()
      or exists (
        select 1 from public.lessons l
        join public.modules m on m.id = l.module_id
        where l.id = assignments.lesson_id
          and public.is_mentor_for_cohort(m.cohort_id)
      )
    )
  )
)
with check (
  public.is_admin()
  or (cohort_id is not null and public.is_mentor_for_cohort(cohort_id))
  or (
    cohort_id is null and (
      public.is_admin()
      or exists (
        select 1 from public.lessons l
        join public.modules m on m.id = l.module_id
        where l.id = assignments.lesson_id
          and public.is_mentor_for_cohort(m.cohort_id)
      )
    )
  )
);

-- ------------------------------------------------------------------------------
-- 4. Verification and Helper View
-- ------------------------------------------------------------------------------

drop view if exists public.assignment_details_view cascade;
create or replace view public.assignment_details_view as
select
  a.id,
  a.title,
  coalesce(a.instructions, a.description) as instructions,
  coalesce(a.description, a.instructions) as description,
  a.deadline,
  a.rubric,
  a.lesson_id,
  l.title as lesson_title,
  a.module_id,
  m.title as module_title,
  a.cohort_id,
  c.name as cohort_name,
  count(s.id) filter (where s.status = 'reviewed') as approved_submissions_count,
  count(s.id) as total_submissions_count,
  a.created_at
from public.assignments a
left join public.lessons l on l.id = a.lesson_id
left join public.modules m on m.id = coalesce(a.module_id, l.module_id)
left join public.cohorts c on c.id = coalesce(a.cohort_id, m.cohort_id)
left join public.submissions s on s.assignment_id = a.id
group by a.id, a.title, a.instructions, a.description, a.deadline, a.rubric, a.lesson_id, l.title, a.module_id, m.title, a.cohort_id, c.name, a.created_at;

comment on view public.assignment_details_view is 'Aggregated view of assignments with hierarchy, cohort names, and submission status counts.';
