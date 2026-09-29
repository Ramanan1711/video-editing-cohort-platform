-- ==============================================================================
-- Migration: 20260928000031_canonical_storage_security_and_signed_urls.sql
-- Description: Canonical Storage Security & Signed URLs Lockdown:
--              1. Enforces private access (public = false) across both
--                 'course-assets' and 'submissions' buckets in storage.buckets.
--              2. Purges any legacy, overly permissive, or public SELECT policies
--                 on storage.objects that could bypass resource visibility entitlements.
--              3. Hardens public.can_access_course_asset to explicitly verify:
--                 - Public preview folders ('thumbnails', 'covers', 'public')
--                 - Authenticated community media ('community')
--                 - Admin & mentor platform/cohort management privileges
--                 - Enrolled student access to lesson video assets (lessons.video_url)
--                 - Enrolled student access to lesson resources (lesson_resources.url)
--                   with strict lesson completion enforcement for 'after_completion'
--              4. Re-asserts granular RLS policies on storage.objects for submissions
--                 (owner, assigned mentor, admin).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Storage Buckets Privacy Enforcement
-- ------------------------------------------------------------------------------
-- Lock down both course-assets and submissions buckets as strictly private
update storage.buckets
set public = false
where id in ('course-assets', 'submissions');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('course-assets', 'course-assets', false, 524288000, null),
  ('submissions', 'submissions', false, 524288000, null)
on conflict (id) do update set public = false;

-- Allow authenticated users to view bucket metadata (required for getBucket / health checks)
drop policy if exists "Allow authenticated users to view buckets" on storage.buckets;
create policy "Allow authenticated users to view buckets"
  on storage.buckets for select
  to authenticated
  using (true);

-- ------------------------------------------------------------------------------
-- 2. Hardened Storage Access Helper: can_access_course_asset
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
  v_folder text;
begin
  if p_object_name is null or length(trim(p_object_name)) = 0 then
    return false;
  end if;

  -- Extract the root folder from the object path
  v_folder := (storage.foldername(p_object_name))[1];

  -- 1. Public assets (thumbnails, preview covers, public logos) are readable by anyone
  if v_folder in ('thumbnails', 'covers', 'public') then
    return true;
  end if;

  -- All remaining objects require authentication
  if v_uid is null then
    return false;
  end if;

  -- 2. Administrators and mentors have full curriculum access
  if public.is_admin() or public.is_mentor() then
    return true;
  end if;

  -- 3. Community board media is readable by any authenticated member
  if v_folder = 'community' then
    return true;
  end if;

  -- 4. Check if object is linked to a lesson video that the student is enrolled in
  if exists (
    select 1
    from public.lessons l
    join public.modules m on m.id = l.module_id
    where (
      l.video_url like '%' || p_object_name
      or p_object_name like '%' || l.video_url
    )
    and exists (
      select 1 from public.enrollments e
      where e.cohort_id = m.cohort_id
        and e.user_id = v_uid
        and e.status in ('enrolled', 'active', 'completed')
    )
  ) then
    return true;
  end if;

  -- 5. Check if object is linked to an authorized lesson resource
  if exists (
    select 1
    from public.lesson_resources lr
    join public.lessons l on l.id = lr.lesson_id
    join public.modules m on m.id = l.module_id
    where (
      lr.url like '%' || p_object_name
      or p_object_name like '%' || lr.url
      or (lr.file_url is not null and (lr.file_url like '%' || p_object_name or p_object_name like '%' || lr.file_url))
    )
    and (
      lr.visibility = 'public'
      or (
        exists (
          select 1 from public.enrollments e
          where e.cohort_id = m.cohort_id
            and e.user_id = v_uid
            and e.status in ('enrolled', 'active', 'completed')
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
  ) then
    return true;
  end if;

  return false;
end;
$$;

grant execute on function public.can_access_course_asset(text) to authenticated, anon;

-- ------------------------------------------------------------------------------
-- 3. Storage Policies on storage.objects: course-assets
-- ------------------------------------------------------------------------------
-- Drop all legacy and permissive policies
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

-- Strict SELECT policy using canonical authorization helper
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
-- 4. Storage Policies on storage.objects: submissions
-- ------------------------------------------------------------------------------
drop policy if exists "Strict submission access control" on storage.objects;
drop policy if exists "Authenticated users can read submissions" on storage.objects;
drop policy if exists "Students can upload their submissions" on storage.objects;
drop policy if exists "Students can update their submissions" on storage.objects;
drop policy if exists "Users or admins can delete submissions" on storage.objects;

-- Strict read policy: only submission owner, assigned cohort mentor, or admin
create policy "Strict submission access control"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'submissions'
    and public.is_active_user()
    and (
      -- Submission owner
      (storage.foldername(name))[1] = auth.uid()::text
      -- Platform Admin
      or public.is_admin()
      -- Assigned mentor for student or assigned submission review mentor
      or (
        (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and (
          public.is_mentor_for_student(((storage.foldername(name))[1])::uuid)
          or exists (
            select 1 from public.submissions s
            where s.file_url like '%' || name
              and public.is_mentor_assigned_to_submission(s.id)
          )
        )
      )
    )
  );

-- Students can upload into their own folder only
create policy "Students can upload their submissions"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'submissions'
    and public.is_active_user()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Students can update their own uploads
create policy "Students can update their submissions"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'submissions'
    and public.is_active_user()
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'submissions'
    and public.is_active_user()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Students can delete their own uploads, admins can delete any
create policy "Users or admins can delete submissions"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'submissions'
    and (
      public.is_admin()
      or (
        public.is_active_user()
        and (storage.foldername(name))[1] = auth.uid()::text
      )
    )
  );
