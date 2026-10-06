-- Migration: 20261006000002_harden_challenge_unlock_permissions.sql
-- Description: Revoke public execution from anonymous clients and enforce role-based
--              access control on automated challenge unlock RPCs (unlock_scheduled_daily_challenges
--              and unlock_cohort_daily_challenges).

-- ------------------------------------------------------------------------------
-- 1. Harden public.unlock_scheduled_daily_challenges()
-- ------------------------------------------------------------------------------

create or replace function public.unlock_scheduled_daily_challenges()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day_one_count integer := 0;
  v_scheduled_count integer := 0;
  v_cohorts_count integer := 0;
  v_caller_role text;
begin
  -- Caller Authorization Guard
  v_caller_role := coalesce(current_setting('request.jwt.claim.role', true), '');
  if v_caller_role = 'anon' then
    raise exception 'Permission denied: anonymous execution is prohibited.' using errcode = '42501';
  elsif v_caller_role = 'authenticated' and not public.is_admin() then
    raise exception 'Permission denied: only administrators may trigger global scheduled challenge unlocks.' using errcode = '42501';
  end if;

  -- 1. Ensure Day 1 challenges are published for all cohorts
  with day_one_unlocks as (
    update public.daily_challenges
    set is_published = true,
        unlocked_at = coalesce(unlocked_at, now())
    where day_number = 1
      and is_published = false
    returning id
  )
  select count(*) into v_day_one_count from day_one_unlocks;

  -- 2. Unlock scheduled challenges where current_date >= (cohort.start_date::date + day_number - 1)
  with eligible_challenges as (
    select dc.id, c.id as cohort_id
    from public.daily_challenges dc
    join public.cohorts c on c.id = dc.cohort_id
    where dc.is_published = false
      and c.start_date is not null
      and current_date >= (c.start_date::date + (dc.day_number - 1))
  ),
  updated as (
    update public.daily_challenges dc
    set is_published = true,
        unlocked_at = now()
    from eligible_challenges ec
    where dc.id = ec.id
    returning dc.id, ec.cohort_id
  )
  select count(*), count(distinct cohort_id)
  into v_scheduled_count, v_cohorts_count
  from updated;

  return jsonb_build_object(
    'success', true,
    'total_unlocked', v_day_one_count + v_scheduled_count,
    'day_one_unlocked', v_day_one_count,
    'scheduled_unlocked', v_scheduled_count,
    'cohorts_affected', v_cohorts_count,
    'executed_at', now()
  );
end;
$$;

-- Revoke anonymous access; permit authenticated staff and background service_role
revoke execute on function public.unlock_scheduled_daily_challenges() from anon;
grant execute on function public.unlock_scheduled_daily_challenges() to authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. Harden public.unlock_cohort_daily_challenges(uuid)
-- ------------------------------------------------------------------------------

create or replace function public.unlock_cohort_daily_challenges(p_cohort_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unlocked_count integer := 0;
  v_cohort_start timestamptz;
  v_caller_role text;
begin
  -- Caller Authorization Guard
  v_caller_role := coalesce(current_setting('request.jwt.claim.role', true), '');
  if v_caller_role = 'anon' then
    raise exception 'Permission denied: anonymous execution is prohibited.' using errcode = '42501';
  elsif v_caller_role = 'authenticated' and not (public.is_admin() or public.is_mentor_for_cohort(p_cohort_id)) then
    raise exception 'Permission denied: only cohort mentors and administrators may unlock cohort challenges.' using errcode = '42501';
  end if;

  select start_date into v_cohort_start
  from public.cohorts
  where id = p_cohort_id;

  with updated as (
    update public.daily_challenges dc
    set is_published = true,
        unlocked_at = coalesce(dc.unlocked_at, now())
    where dc.cohort_id = p_cohort_id
      and dc.is_published = false
      and (
        dc.day_number = 1
        or (
          v_cohort_start is not null
          and current_date >= (v_cohort_start::date + (dc.day_number - 1))
        )
      )
    returning dc.id
  )
  select count(*) into v_unlocked_count from updated;

  return jsonb_build_object(
    'success', true,
    'cohort_id', p_cohort_id,
    'unlocked_challenges', v_unlocked_count,
    'executed_at', now()
  );
end;
$$;

-- Revoke anonymous access; permit authenticated mentors/admins and background service_role
revoke execute on function public.unlock_cohort_daily_challenges(uuid) from anon;
grant execute on function public.unlock_cohort_daily_challenges(uuid) to authenticated, service_role;
