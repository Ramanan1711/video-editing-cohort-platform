-- ==============================================================================
-- Migration: 20261027000001_fix_can_access_course_asset_for_students.sql
-- Description:
--   Restores student access to lesson videos, lesson resources, and sprint starters
--   in public.can_access_course_asset.
--   Migration 20261008000003 accidentally overwrote can_access_course_asset without
--   the enrollment verification for lessons and lesson resources, causing Supabase
--   Storage to reject signed URL requests with 400 Bad Request / 404 NoSuchKey.
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

  -- 1. Public assets (thumbnails, preview covers, public logos, advertisements, challenges, sprint-starters) are readable
  if v_folder in ('thumbnails', 'covers', 'public', 'advertisements', 'community', 'challenges', 'sprint-starters') then
    return true;
  end if;

  -- All remaining objects (lessons, resources) require an authenticated user
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
    and (
      -- Student enrolled in the cohort directly or via shared master course
      exists (
        select 1 from public.enrollments e
        left join public.cohorts c on c.id = e.cohort_id
        where (
          e.cohort_id = m.cohort_id
          or (m.course_id is not null and c.course_id = m.course_id)
          or (m.cohort_id is not null and exists (
            select 1 from public.cohorts mc where mc.id = m.cohort_id and mc.course_id is not null and mc.course_id = c.course_id
          ))
        )
        and e.user_id = v_uid
        and e.status in ('enrolled', 'active', 'completed', 'inactive')
      )
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
      or (lr.file_url is not null and (lr.file_url like '%' || p_object_name or p_object_name like '%' || lr.file_url))
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

