-- ==============================================================================
-- Migration: 20261008000002_allow_community_storage_read_and_signed_urls.sql
-- Description: Allow community assets in course-assets storage to be read
--              via signed URLs and public storage access so student project
--              videos, images, and attachments never fail with 400 Bad Request.
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
  v_folder text;
begin
  if p_object_name is null or length(trim(p_object_name)) = 0 then
    return false;
  end if;

  -- Extract the root folder from the object path
  v_folder := (storage.foldername(p_object_name))[1];

  -- 1. Public assets (thumbnails, preview covers, public logos, advertisements, community media) are readable by anyone
  if v_folder in ('thumbnails', 'covers', 'public', 'advertisements', 'community') then
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

  -- 3. Check if object is linked to a lesson video that the student is enrolled in
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

  -- 4. Check if object is linked to an authorized lesson resource
  if exists (
    select 1
    from public.lesson_resources lr
    join public.lessons l on l.id = lr.lesson_id
    join public.modules m on m.id = l.module_id
    where (
      lr.url like '%' || p_object_name
      or p_object_name like '%' || lr.url
    )
    and exists (
      select 1 from public.enrollments e
      where e.cohort_id = m.cohort_id
        and e.user_id = v_uid
        and e.status in ('enrolled', 'active', 'completed')
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
  ) then
    return true;
  end if;

  return false;
end;
$$;

grant execute on function public.can_access_course_asset(text) to authenticated, anon;

