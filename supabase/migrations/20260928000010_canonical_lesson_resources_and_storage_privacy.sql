-- ==============================================================================
-- Migration: 20260928000010_canonical_lesson_resources_and_storage_privacy.sql
-- Description: Hardens Lesson Resources & Course Assets storage security:
--              1. Sets 'course-assets' storage bucket to private (public = false)
--                 preventing direct, unauthenticated CDN access to protected downloads.
--              2. Removes overly permissive SELECT policies on storage.objects.
--              3. Implements strict, visibility-aware storage RLS for course-assets:
--                 - Public folders ('thumbnails', 'covers', 'public') readable by all.
--                 - Mentors and Admins have full read/write management.
--                 - Community media uploads readable by authenticated users.
--                 - Restricted lesson resources: 'enrolled' (practice footage, project
--                   templates, sound effects, LUTs) are accessible immediately to all
--                   actively enrolled students at lesson start; 'after_completion' is
--                   strictly reserved for solution files and benchmark project timelines,
--                   requiring completed lesson_progress before download URL resolution.
--              4. Provides server-side RPC get_lesson_resource_download_url(p_resource_id)
--                 for authorized URL resolution and locked-state verification.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Storage Bucket Privacy Lockdown
-- ------------------------------------------------------------------------------
-- Lock down course-assets bucket as private (public = false)
update storage.buckets
set public = false
where id = 'course-assets';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('course-assets', 'course-assets', false, 524288000, null)
on conflict (id) do update set public = false;

-- ------------------------------------------------------------------------------
-- 2. Storage Helper Function: can_access_course_asset
-- ------------------------------------------------------------------------------
create or replace function public.can_access_course_asset(p_object_name text)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_clean_path text;
  v_folder text;
  v_filename text;
begin
  if p_object_name is null or length(trim(p_object_name)) = 0 then
    return false;
  end if;

  -- 1. Sanitize object path: strip query params, hashes, leading slashes, and full URL prefixes
  v_clean_path := trim(p_object_name);
  v_clean_path := split_part(v_clean_path, '?', 1);
  v_clean_path := split_part(v_clean_path, '#', 1);
  v_clean_path := regexp_replace(v_clean_path, '^https?://[^/]+/storage/v1/object/(public|sign|authenticated)/course-assets/', '');
  v_clean_path := regexp_replace(v_clean_path, '^course-assets/', '');
  v_clean_path := regexp_replace(v_clean_path, '^/+', '');

  -- Extract root folder and filename
  v_folder := split_part(v_clean_path, '/', 1);
  v_filename := split_part(v_clean_path, '/', -1);

  -- 2. Public folders: readable by any client (unauthenticated or authenticated)
  if v_folder in ('thumbnails', 'covers', 'public', 'advertisements', 'community', 'challenges', 'sprint-starters') then
    return true;
  end if;

  -- All remaining objects require authentication
  if v_uid is null then
    return false;
  end if;

  -- 3. Administrators and mentors have platform-wide or curriculum access
  if public.is_admin() or public.is_mentor() then
    return true;
  end if;

  -- 4. Check if object is linked to a lesson video that the student is enrolled in
  if exists (
    select 1
    from public.lessons l
    join public.modules m on m.id = l.module_id
    where (
      l.video_url like '%' || v_clean_path
      or v_clean_path like '%' || l.video_url
      or l.video_url like '%' || p_object_name
      or p_object_name like '%' || l.video_url
      or (length(v_filename) > 10 and l.video_url like '%' || v_filename)
    )
    and exists (
      select 1 from public.enrollments e
      left join public.cohorts c on c.id = e.cohort_id
      where (
        e.cohort_id = m.cohort_id
        or (m.course_id is not null and c.course_id = m.course_id)
        or (m.cohort_id is not null and exists (
          select 1 from public.cohorts mc 
          where mc.id = m.cohort_id 
            and mc.course_id is not null 
            and mc.course_id = c.course_id
        ))
      )
      and e.user_id = v_uid
      and e.status in ('enrolled', 'active', 'completed', 'inactive')
    )
  ) then
    return true;
  end if;

  -- 5. Check if object is linked to an authorized lesson resource
  return exists (
    select 1
    from public.lesson_resources lr
    join public.lessons l on l.id = lr.lesson_id
    join public.modules m on m.id = l.module_id
    where (
      lr.url like '%' || v_clean_path
      or v_clean_path like '%' || lr.url
      or lr.url like '%' || p_object_name
      or p_object_name like '%' || lr.url
      or (lr.file_url is not null and (
        lr.file_url like '%' || v_clean_path
        or v_clean_path like '%' || lr.file_url
        or lr.file_url like '%' || p_object_name
        or p_object_name like '%' || lr.file_url
      ))
      or (length(v_filename) > 10 and (
        lr.url like '%' || v_filename
        or (lr.file_url is not null and lr.file_url like '%' || v_filename)
      ))
    )
    and (
      lr.visibility = 'public'
      or (
        exists (
          select 1 from public.enrollments e
          left join public.cohorts c on c.id = e.cohort_id
          where (
            e.cohort_id = m.cohort_id
            or (m.course_id is not null and c.course_id = m.course_id)
            or (m.cohort_id is not null and exists (
              select 1 from public.cohorts mc 
              where mc.id = m.cohort_id 
                and mc.course_id is not null 
                and mc.course_id = c.course_id
            ))
          )
          and e.user_id = v_uid
          and e.status in ('enrolled', 'active', 'completed', 'inactive')
        )
        and (
          lr.visibility = 'enrolled'
          or (
            lr.visibility = 'after_completion'
            and exists (
              select 1 from public.lesson_progress lp
              where lp.lesson_id = l.id
                and lp.user_id = v_uid
                and lp.completed = true
            )
          )
        )
      )
    )
  );
end;
$$;

-- ------------------------------------------------------------------------------
-- 3. Storage Policies on storage.objects
-- ------------------------------------------------------------------------------
-- Clean up all legacy / overly permissive policies on course-assets
drop policy if exists "Authenticated users can read course assets" on storage.objects;
drop policy if exists "Course assets are viewable by everyone" on storage.objects;
drop policy if exists "Anyone can read course assets" on storage.objects;
drop policy if exists "Public course assets are viewable by everyone" on storage.objects;
drop policy if exists "Admins can upload course assets" on storage.objects;
drop policy if exists "Admins can update course assets" on storage.objects;
drop policy if exists "Admins can delete course assets" on storage.objects;
drop policy if exists "Staff can upload course assets" on storage.objects;
drop policy if exists "Staff can update course assets" on storage.objects;
drop policy if exists "Staff can delete course assets" on storage.objects;
drop policy if exists "Staff can manage course assets" on storage.objects;
drop policy if exists "Authorized users can select course assets" on storage.objects;
drop policy if exists "Authenticated users can upload community media" on storage.objects;

-- Strict SELECT policy using granular authorization helper
create policy "Authorized users can select course assets"
  on storage.objects for select
  to public
  using (
    bucket_id = 'course-assets'
    and public.can_access_course_asset(name)
  );

-- Staff (Admins and Mentors) full CRUD management on course assets
create policy "Staff can manage course assets"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'course-assets'
    and (public.is_admin() or public.is_mentor())
  )
  with check (
    bucket_id = 'course-assets'
    and (public.is_admin() or public.is_mentor())
  );

-- Authenticated students can upload community attachments only
create policy "Authenticated users can upload community media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'course-assets'
    and (storage.foldername(name))[1] = 'community'
  );

-- ------------------------------------------------------------------------------
-- 4. Canonical RLS Policies on public.lesson_resources
-- ------------------------------------------------------------------------------
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
        (m.cohort_id is not null and public.is_mentor_for_cohort(m.cohort_id))
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
drop policy if exists "Staff can manage lesson resources" on public.lesson_resources;
create policy "Staff can manage lesson resources"
  on public.lesson_resources for all
  to authenticated
  using (
    public.is_admin()
    or (
      public.is_mentor()
      and exists (
        select 1 from public.lessons l
        join public.modules m on m.id = l.module_id
        where l.id = lesson_resources.lesson_id
          and m.cohort_id is not null
          and public.is_mentor_for_cohort(m.cohort_id)
      )
    )
  )
  with check (
    public.is_admin()
    or (
      public.is_mentor()
      and exists (
        select 1 from public.lessons l
        join public.modules m on m.id = l.module_id
        where l.id = lesson_resources.lesson_id
          and m.cohort_id is not null
          and public.is_mentor_for_cohort(m.cohort_id)
      )
    )
  );

-- ------------------------------------------------------------------------------
-- 5. Server-Side RPC: get_lesson_resource_download_url
-- ------------------------------------------------------------------------------
create or replace function public.get_lesson_resource_download_url(
  p_resource_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res record;
  v_uid uuid := auth.uid();
  v_is_enrolled boolean := false;
  v_is_completed boolean := false;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED: Authentication required to download lesson resources.'
      using errcode = '42501';
  end if;

  select
    lr.id,
    lr.lesson_id,
    lr.name,
    lr.url,
    lr.visibility,
    lr.resource_type,
    lr.file_size,
    m.cohort_id
  into v_res
  from public.lesson_resources lr
  join public.lessons l on l.id = lr.lesson_id
  join public.modules m on m.id = l.module_id
  where lr.id = p_resource_id;

  if not found then
    raise exception 'RESOURCE_NOT_FOUND: Lesson resource % does not exist.', p_resource_id
      using errcode = 'P0002';
  end if;

  -- 1. Administrators have unrestricted access
  if public.is_admin() then
    return jsonb_build_object(
      'success', true,
      'resource_id', v_res.id,
      'name', v_res.name,
      'url', v_res.url,
      'visibility', v_res.visibility,
      'authorized_as', 'admin'
    );
  end if;

  -- 2. Cohort Mentors have unrestricted access
  if v_res.cohort_id is not null and public.is_mentor_for_cohort(v_res.cohort_id) then
    return jsonb_build_object(
      'success', true,
      'resource_id', v_res.id,
      'name', v_res.name,
      'url', v_res.url,
      'visibility', v_res.visibility,
      'authorized_as', 'mentor'
    );
  end if;

  -- 3. Public preview resources can be downloaded by any user
  if v_res.visibility = 'public' then
    return jsonb_build_object(
      'success', true,
      'resource_id', v_res.id,
      'name', v_res.name,
      'url', v_res.url,
      'visibility', v_res.visibility,
      'authorized_as', 'public'
    );
  end if;

  -- 4. Check active cohort enrollment
  select exists (
    select 1 from public.enrollments e
    where e.cohort_id = v_res.cohort_id
      and e.user_id = v_uid
      and e.status in ('enrolled', 'active', 'completed')
  ) into v_is_enrolled;

  if not v_is_enrolled then
    raise exception 'UNAUTHORIZED: You must be actively enrolled in this cohort to download this resource.'
      using errcode = '42501';
  end if;

  -- 5. Enforce completion rule if visibility is 'after_completion'
  if v_res.visibility = 'after_completion' then
    select exists (
      select 1 from public.lesson_progress lp
      where lp.lesson_id = v_res.lesson_id
        and lp.user_id = v_uid
        and lp.completed = true
    ) into v_is_completed;

    if not v_is_completed then
      raise exception 'LOCKED_RESOURCE: You must complete this lesson before accessing this download.'
        using errcode = '42501';
    end if;
  end if;

  return jsonb_build_object(
    'success', true,
    'resource_id', v_res.id,
    'name', v_res.name,
    'url', v_res.url,
    'visibility', v_res.visibility,
    'authorized_as', 'student'
  );
end;
$$;

grant execute on function public.get_lesson_resource_download_url(uuid) to authenticated;

-- ------------------------------------------------------------------------------
-- 6. Diagnostic Security Audit View: lesson_resources_security_audit
-- ------------------------------------------------------------------------------
drop view if exists public.lesson_resources_security_audit cascade;
create or replace view public.lesson_resources_security_audit as
select
  lr.id as resource_id,
  lr.name as resource_name,
  lr.url,
  lr.visibility,
  lr.resource_type,
  lr.file_size,
  l.id as lesson_id,
  l.title as lesson_title,
  m.id as module_id,
  m.title as module_title,
  m.cohort_id,
  c.name as cohort_name,
  case
    when lr.url like '%course-assets%' or lr.url like '%/storage/v1/object/%' then true
    else false
  end as is_storage_asset
from public.lesson_resources lr
join public.lessons l on l.id = lr.lesson_id
join public.modules m on m.id = l.module_id
left join public.cohorts c on c.id = m.cohort_id;
