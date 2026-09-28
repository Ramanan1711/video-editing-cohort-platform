-- ==============================================================================
-- Migration: 20260928000007_canonical_courses_entity_and_curriculum.sql
-- Description: Establishes first-class Course entity, decoupling course containers
--              from scheduled cohorts (Course -> Cohorts -> Modules -> Lessons).
-- Resolves:
--   1. Creates public.courses as the canonical syllabus & master curriculum container.
--   2. Links public.cohorts to public.courses via course_id with backfill and auto-linking triggers.
--   3. Links public.modules to public.courses via course_id with backfill and triggers.
--   4. Provides clone_course_curriculum_to_cohort RPC to instantiate course curricula for new cohorts.
--   5. Implements RLS policies and diagnostic views for courses.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Create public.courses Table
-- ------------------------------------------------------------------------------
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Master Course',
  slug text unique,
  description text,
  thumbnail_url text,
  status text not null default 'published' check (status in ('draft', 'review', 'published', 'archived')),
  difficulty_level text default 'all_levels' check (difficulty_level in ('beginner', 'intermediate', 'advanced', 'all_levels')),
  estimated_hours integer default 20,
  track_type text default 'general' check (track_type in ('coding', 'non_coding', 'general')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure all columns exist defensively
alter table public.courses add column if not exists title text not null default 'Master Course';
alter table public.courses add column if not exists slug text;
alter table public.courses add column if not exists description text;
alter table public.courses add column if not exists thumbnail_url text;
alter table public.courses add column if not exists status text not null default 'published';
alter table public.courses add column if not exists difficulty_level text default 'all_levels';
alter table public.courses add column if not exists estimated_hours integer default 20;
alter table public.courses add column if not exists track_type text default 'general';
alter table public.courses add column if not exists created_at timestamptz not null default now();
alter table public.courses add column if not exists updated_at timestamptz not null default now();

-- Unique constraint on slug if provided
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'courses_slug_key'
  ) then
    alter table public.courses add constraint courses_slug_key unique (slug);
  end if;
exception when others then
  null;
end $$;

-- ------------------------------------------------------------------------------
-- 2. Link public.cohorts to public.courses (course_id)
-- ------------------------------------------------------------------------------
alter table public.cohorts add column if not exists course_id uuid references public.courses(id) on delete set null;
create index if not exists idx_cohorts_course_id on public.cohorts(course_id);

-- Backfill: create a master course for any existing cohort lacking course_id
do $$
declare
  r record;
  v_course_id uuid;
  v_slug text;
begin
  for r in select id, title, description, status, track_type from public.cohorts where course_id is null loop
    -- Generate clean slug
    v_slug := lower(regexp_replace(coalesce(r.title, 'course'), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(r.id::text, 1, 8);

    insert into public.courses (title, slug, description, status, track_type, created_at, updated_at)
    values (
      coalesce(r.title, 'Master Course'),
      v_slug,
      r.description,
      case when r.status in ('draft', 'review', 'published', 'archived') then r.status else 'published' end,
      coalesce(r.track_type, 'general'),
      now(),
      now()
    )
    returning id into v_course_id;

    update public.cohorts set course_id = v_course_id where id = r.id;
  end loop;
end $$;

-- Trigger: auto-link or auto-create course_id for cohorts if omitted
create or replace function public.sync_cohort_course_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
  v_slug text;
begin
  if new.course_id is null then
    -- Check if a master course with the same title already exists
    select id into v_course_id
    from public.courses
    where title = new.title
    order by created_at desc
    limit 1;

    if v_course_id is not null then
      new.course_id := v_course_id;
    else
      v_slug := lower(regexp_replace(coalesce(new.title, 'course'), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(new.id::text, 1, 8);
      insert into public.courses (title, slug, description, status, track_type, created_at, updated_at)
      values (
        coalesce(new.title, 'Master Course'),
        v_slug,
        new.description,
        case when new.status in ('draft', 'review', 'published', 'archived') then new.status else 'published' end,
        coalesce(new.track_type, 'general'),
        now(),
        now()
      )
      returning id into v_course_id;

      new.course_id := v_course_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_cohort_course_id on public.cohorts;
create trigger trg_sync_cohort_course_id
  before insert on public.cohorts
  for each row
  execute function public.sync_cohort_course_id();

-- ------------------------------------------------------------------------------
-- 3. Link public.modules to public.courses (course_id)
-- ------------------------------------------------------------------------------
alter table public.modules add column if not exists course_id uuid references public.courses(id) on delete cascade;
alter table public.modules alter column cohort_id drop not null;
create index if not exists idx_modules_course_id on public.modules(course_id);

-- Backfill modules course_id from their parent cohort
update public.modules m
set course_id = c.course_id
from public.cohorts c
where m.cohort_id = c.id
  and m.course_id is null
  and c.course_id is not null;

-- Trigger: populate module course_id if cohort_id is set
create or replace function public.sync_module_course_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
begin
  if new.course_id is null and new.cohort_id is not null then
    select course_id into v_course_id from public.cohorts where id = new.cohort_id;
    new.course_id := v_course_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_module_course_id on public.modules;
create trigger trg_sync_module_course_id
  before insert on public.modules
  for each row
  execute function public.sync_module_course_id();

-- ------------------------------------------------------------------------------
-- 4. RPC: clone_course_curriculum_to_cohort
-- ------------------------------------------------------------------------------
create or replace function public.clone_course_curriculum_to_cohort(
  p_course_id uuid,
  p_cohort_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course record;
  v_cohort record;
  v_module record;
  v_lesson record;
  v_new_module_id uuid;
  v_modules_cloned integer := 0;
  v_lessons_cloned integer := 0;
begin
  if not (public.is_admin() and public.is_active_user()) then
    raise exception 'Unauthorized: Only active administrators can clone course curricula.'
      using errcode = '42501';
  end if;

  select * into v_course from public.courses where id = p_course_id;
  if not found then
    raise exception 'Course % not found.', p_course_id using errcode = 'P0002';
  end if;

  select * into v_cohort from public.cohorts where id = p_cohort_id;
  if not found then
    raise exception 'Cohort % not found.', p_cohort_id using errcode = 'P0002';
  end if;

  -- Associate cohort with this course
  update public.cohorts set course_id = p_course_id where id = p_cohort_id;

  -- Iterate through modules belonging to this course
  for v_module in
    select * from public.modules
    where course_id = p_course_id
      and (cohort_id is null or cohort_id != p_cohort_id)
    order by position asc
  loop
    -- Insert cloned module scoped to the cohort
    insert into public.modules (
      cohort_id,
      course_id,
      title,
      description,
      position,
      created_at
    )
    values (
      p_cohort_id,
      p_course_id,
      v_module.title,
      v_module.description,
      v_module.position,
      now()
    )
    returning id into v_new_module_id;

    v_modules_cloned := v_modules_cloned + 1;

    -- Clone lessons for this module
    for v_lesson in
      select * from public.lessons
      where module_id = v_module.id
      order by position asc
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
        v_new_module_id,
        v_lesson.title,
        v_lesson.description,
        v_lesson.video_url,
        v_lesson.duration_minutes,
        v_lesson.position,
        v_lesson.status,
        now()
      );

      v_lessons_cloned := v_lessons_cloned + 1;
    end loop;
  end loop;

  perform public.log_audit_event(
    'course.curriculum_cloned_to_cohort',
    'cohort',
    p_cohort_id::text,
    jsonb_build_object(
      'course_id', p_course_id,
      'modules_cloned', v_modules_cloned,
      'lessons_cloned', v_lessons_cloned
    )
  );

  return jsonb_build_object(
    'success', true,
    'course_id', p_course_id,
    'cohort_id', p_cohort_id,
    'modules_cloned', v_modules_cloned,
    'lessons_cloned', v_lessons_cloned,
    'message', 'Course curriculum cloned to cohort successfully.'
  );
end;
$$;

grant execute on function public.clone_course_curriculum_to_cohort(uuid, uuid) to authenticated;

-- ------------------------------------------------------------------------------
-- 5. Row Level Security for public.courses
-- ------------------------------------------------------------------------------
alter table public.courses enable row level security;

drop policy if exists "Courses select policy" on public.courses;
create policy "Courses select policy"
  on public.courses for select
  to authenticated
  using (
    status in ('published', 'active')
    or public.is_admin()
  );

drop policy if exists "Admins can manage courses" on public.courses;
create policy "Admins can manage courses"
  on public.courses for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------------------------------------
-- 6. Canonical Courses Overview View
-- ------------------------------------------------------------------------------
create or replace view public.courses_overview as
select
  c.id,
  c.title,
  c.slug,
  c.description,
  c.thumbnail_url,
  c.status,
  c.difficulty_level,
  c.estimated_hours,
  c.track_type,
  c.created_at,
  c.updated_at,
  count(distinct co.id) as cohorts_count,
  count(distinct m.id) as modules_count,
  count(distinct e.user_id) filter (where e.status in ('enrolled', 'active')) as total_active_students
from public.courses c
left join public.cohorts co on co.course_id = c.id
left join public.modules m on m.course_id = c.id
left join public.enrollments e on e.cohort_id = co.id
group by c.id, c.title, c.slug, c.description, c.thumbnail_url, c.status, c.difficulty_level, c.estimated_hours, c.track_type, c.created_at, c.updated_at;

grant select on public.courses_overview to authenticated;

