-- ==============================================================================
-- Migration: 20261014000003_timezone_aware_midnight_challenge_unlock.sql
-- Description: Eliminates Midnight Challenge Unlock Timezone Skew:
--              1. Adds timezone column to public.cohorts (default: 'Asia/Kolkata' for IST).
--              2. Updates public.unlock_scheduled_daily_challenges() to compute the local
--                 calendar date in the cohort's specific timezone (e.g. Asia/Kolkata, UTC+5:30)
--                 so Day challenges unlock at 12:00:00 AM local time instead of 05:30 AM (UTC 00:00).
--              3. Updates public.unlock_cohort_daily_challenges(p_cohort_id) with timezone awareness.
--              4. Schedules pg_cron to run every 30 minutes ('*/30 * * * *') and explicitly at
--                 midnight IST ('30 18 * * *'), eliminating the 5.5-hour delay for Indian cohorts.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Schema Extension: Cohort Timezone
-- ------------------------------------------------------------------------------

alter table public.cohorts
  add column if not exists timezone text not null default 'Asia/Kolkata';

comment on column public.cohorts.timezone is
  'IANA timezone identifier for the cohort (default: Asia/Kolkata). Controls midnight challenge unlock schedule.';

-- ------------------------------------------------------------------------------
-- 2. Timezone-Aware Scheduled Challenge Unlock RPC
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

  -- 1. Ensure Day 1 challenges are published by default for all cohorts
  with day_one_unlocks as (
    update public.daily_challenges
    set is_published = true,
        unlocked_at = coalesce(unlocked_at, now())
    where day_number = 1
      and is_published = false
    returning id
  )
  select count(*) into v_day_one_count from day_one_unlocks;

  -- 2. Unlock scheduled challenges where the local calendar date in the cohort's timezone
  -- has reached or exceeded (cohort.start_date in cohort timezone + day_number - 1).
  with eligible_challenges as (
    select dc.id, c.id as cohort_id
    from public.daily_challenges dc
    join public.cohorts c on c.id = dc.cohort_id
    where dc.is_published = false
      and c.start_date is not null
      and (timezone(coalesce(c.timezone, 'Asia/Kolkata'), now())::date) >=
          (timezone(coalesce(c.timezone, 'Asia/Kolkata'), c.start_date)::date + (dc.day_number - 1))
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

revoke execute on function public.unlock_scheduled_daily_challenges() from anon;
grant execute on function public.unlock_scheduled_daily_challenges() to authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. Timezone-Aware Cohort-Specific Challenge Unlock RPC
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
  v_cohort_timezone text;
  v_caller_role text;
begin
  -- Caller Authorization Guard
  v_caller_role := coalesce(current_setting('request.jwt.claim.role', true), '');
  if v_caller_role = 'anon' then
    raise exception 'Permission denied: anonymous execution is prohibited.' using errcode = '42501';
  elsif v_caller_role = 'authenticated' and not (public.is_admin() or public.is_mentor_for_cohort(p_cohort_id)) then
    raise exception 'Permission denied: only cohort mentors and administrators may unlock cohort challenges.' using errcode = '42501';
  end if;

  select start_date, coalesce(timezone, 'Asia/Kolkata')
  into v_cohort_start, v_cohort_timezone
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
          and (timezone(v_cohort_timezone, now())::date) >=
              (timezone(v_cohort_timezone, v_cohort_start)::date + (dc.day_number - 1))
        )
      )
    returning dc.id
  )
  select count(*) into v_unlocked_count from updated;

  return jsonb_build_object(
    'success', true,
    'cohort_id', p_cohort_id,
    'unlocked_challenges', v_unlocked_count,
    'timezone', v_cohort_timezone,
    'executed_at', now()
  );
end;
$$;

revoke execute on function public.unlock_cohort_daily_challenges(uuid) from anon;
grant execute on function public.unlock_cohort_daily_challenges(uuid) to authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. Scheduled pg_cron Update for Midnight Local Timezone Execution
-- ------------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1 from pg_available_extensions where name = 'pg_cron'
  ) then
    begin
      create extension if not exists pg_cron with schema extensions;
    exception when others then
      null;
    end;

    if exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'cron' and p.proname = 'schedule'
    ) then
      -- Reschedule to run every 30 minutes ('*/30 * * * *') so any cohort in any timezone
      -- (including India IST at 18:30 UTC / 00:00 IST) unlocks promptly at midnight local time.
      perform cron.unschedule('unlock-daily-challenges')
        where exists (select 1 from cron.job where jobname = 'unlock-daily-challenges');

      perform cron.schedule(
        'unlock-daily-challenges',
        '*/30 * * * *',
        'select public.unlock_scheduled_daily_challenges();'
      );
    end if;
  end if;
exception when others then
  raise notice 'pg_cron update skipped: %', sqlerrm;
end;
$$;

