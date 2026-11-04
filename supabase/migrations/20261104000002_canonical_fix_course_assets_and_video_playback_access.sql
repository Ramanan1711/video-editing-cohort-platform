-- ==============================================================================
-- Migration: 20261104000002_canonical_fix_course_assets_and_video_playback_access.sql
-- Description:
--   Restores and hardens public.can_access_course_asset for all students.
--   Prevents "Playback session expired or chunk fetch failed (HTTP 403)" errors
--   by ensuring that lesson video signing and streaming strictly validates:
--   1. Public folders (thumbnails, covers, public, advertisements, community, challenges, sprint-starters)
--   2. Platform administrators and mentors (full curriculum access)
--   3. Authenticated enrolled students for lesson videos (lessons.video_url matching
--      by relative object path, full storage URL, or filename across enrolled/active/completed cohorts)
--   4. Authenticated enrolled students for lesson resources (lesson_resources matching
--      with enrolled/after_completion gates)
-- ==============================================================================

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

  -- All remaining objects (lessons, lesson resources) require an authenticated user
  if v_uid is null then
    return false;
  end if;

  -- 3. Administrators and mentors have full platform curriculum access
  if public.is_admin() or public.is_mentor() then
    return true;
  end if;

  -- 4. Check if object is linked to a lesson video that the student is enrolled in
  if exists (
    select 1
    from public.lessons l
    join public.modules m on m.id = l.module_id
    where (
      -- Match against cleaned storage path, raw object name, or isolated filename
      l.video_url like '%' || v_clean_path
      or v_clean_path like '%' || l.video_url
      or l.video_url like '%' || p_object_name
      or p_object_name like '%' || l.video_url
      or (length(v_filename) > 10 and l.video_url like '%' || v_filename)
    )
    and (
      -- Student is enrolled in the cohort directly or via associated master course
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
  ) then
    return true;
  end if;

  return false;
end;
$$;

grant execute on function public.can_access_course_asset(text) to authenticated, anon;

-- Ensure storage policy on course-assets enforces this canonical helper
drop policy if exists "Authorized users can select course assets" on storage.objects;
create policy "Authorized users can select course assets"
  on storage.objects for select
  to authenticated, anon
  using (
    bucket_id = 'course-assets'
    and public.can_access_course_asset(name)
  );

