-- ==============================================================================
-- Migration: 20260928000033_canonical_automated_midnight_challenge_unlock.sql
-- Description: Automated Midnight Challenge Unlock (pg_cron & Edge Function compatible RPCs):
--              1. Adds is_published (boolean) and unlocked_at (timestamptz) columns to public.daily_challenges.
--              2. Ensures Day 1 is published by default and synchronizes existing challenge statuses.
--              3. Creates public.unlock_scheduled_daily_challenges() RPC to automatically set
--                 is_published = true when current date reaches cohort start_date + day_number - 1.
--              4. Creates public.unlock_cohort_daily_challenges(p_cohort_id uuid) RPC.
--              5. Creates public.set_daily_challenge_publication_status(p_challenge_id uuid, p_is_published boolean)
--                 for manual mentor/admin publication overrides.
--              6. Safely provisions scheduled pg_cron job at midnight UTC (0 0 * * *) if extension is available.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Schema Extensions on public.daily_challenges
-- ------------------------------------------------------------------------------

alter table public.daily_challenges
  add column if not exists is_published boolean not null default false,
  add column if not exists unlocked_at timestamptz;

create index if not exists idx_daily_challenges_cohort_published
  on public.daily_challenges(cohort_id, is_published, day_number);

-- Day 1 is always unlocked by default for active cohorts
update public.daily_challenges
set is_published = true,
    unlocked_at = coalesce(unlocked_at, created_at)
where day_number = 1
  and is_published = false;

-- Unlock challenges whose cohort start_date has already elapsed past day_number - 1
update public.daily_challenges dc
set is_published = true,
    unlocked_at = coalesce(dc.unlocked_at, now())
from public.cohorts c
where c.id = dc.cohort_id
  and c.start_date is not null
  and current_date >= (c.start_date::date + (dc.day_number - 1))
  and dc.is_published = false;

-- ------------------------------------------------------------------------------
-- 2. Authoritative Scheduled Unlock RPCs
-- ------------------------------------------------------------------------------

/**
 * public.unlock_scheduled_daily_challenges()
 * Scans all cohorts and unlocks challenges whose start_date + (day_number - 1) has arrived.
 * Callable by pg_cron, Supabase Edge Functions, or authenticated maintenance workers.
 */
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
begin
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

grant execute on function public.unlock_scheduled_daily_challenges() to authenticated, service_role, anon;

/**
 * public.unlock_cohort_daily_challenges(p_cohort_id uuid)
 * Unlocks all eligible challenges for a single specified cohort.
 */
create or replace function public.unlock_cohort_daily_challenges(p_cohort_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unlocked_count integer := 0;
  v_cohort_start timestamptz;
begin
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

grant execute on function public.unlock_cohort_daily_challenges(uuid) to authenticated, service_role, anon;

/**
 * public.set_daily_challenge_publication_status(p_challenge_id uuid, p_is_published boolean)
 * Allows cohort mentors and admins to manually toggle publication/unlock status.
 */
create or replace function public.set_daily_challenge_publication_status(
  p_challenge_id uuid,
  p_is_published boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_challenge public.daily_challenges%rowtype;
  v_is_staff boolean;
begin
  select * into v_challenge
  from public.daily_challenges
  where id = p_challenge_id;

  if not found then
    raise exception 'Challenge % not found', p_challenge_id;
  end if;

  -- Verify caller is admin or mentor for this cohort
  v_is_staff := public.is_admin() or public.is_mentor_for_cohort(v_challenge.cohort_id);
  if not v_is_staff then
    raise exception 'Unauthorized: Only cohort mentors and admins can modify challenge publication status';
  end if;

  update public.daily_challenges
  set is_published = p_is_published,
      unlocked_at = case when p_is_published then coalesce(unlocked_at, now()) else null end
  where id = p_challenge_id
  returning * into v_challenge;

  return jsonb_build_object(
    'success', true,
    'id', v_challenge.id,
    'day_number', v_challenge.day_number,
    'is_published', v_challenge.is_published,
    'unlocked_at', v_challenge.unlocked_at
  );
end;
$$;

grant execute on function public.set_daily_challenge_publication_status(uuid, boolean) to authenticated;

-- ------------------------------------------------------------------------------
-- 3. Update ensure_cohort_daily_challenges Seeding Function
-- ------------------------------------------------------------------------------

create or replace function public.ensure_cohort_daily_challenges(p_cohort_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_cohort_start timestamptz;
begin
  select count(*) into v_count
  from public.daily_challenges
  where cohort_id = p_cohort_id;

  if v_count >= 15 then
    return jsonb_build_object('success', true, 'count', v_count, 'seeded', false);
  end if;

  select start_date into v_cohort_start
  from public.cohorts
  where id = p_cohort_id;

  insert into public.daily_challenges (
    cohort_id,
    day_number,
    title,
    description,
    instructions,
    starter_files_url,
    track_type,
    submission_type,
    deadline_hours,
    is_published,
    unlocked_at
  )
  values
    (p_cohort_id, 1, 'Day 01: Production Setup & First Kinetic Cut', 'Establish project directory structure, import raw footage/starter repo, and ship first edit.', 'Submit your Day 1 repository PR or Google Drive cut link before midnight.', 'https://drive.google.com/drive/folders/sample-day-1', 'general', 'drive_link', 24, true, now()),
    (p_cohort_id, 2, 'Day 02: Pacing, Micro-Transitions & Retention', 'Learn fast-paced cuts, J/L audio cuts, and maintaining 70%+ audience watch retention.', 'Produce a 30-second timeline maintaining retention peaks at seconds 3, 7, and 15.', null, 'general', 'drive_link', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 1)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 1)) then now() else null end),
    (p_cohort_id, 3, 'Day 03: Sound Design, SFX Stems & Audio Layering', 'Layer whooshes, risers, foley hits, and balance speech volume levels to -6dB True Peak.', 'Include at least 4 distinct audio stem layers and export your clean WAV/MP4 master.', null, 'general', 'drive_link', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 2)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 2)) then now() else null end),
    (p_cohort_id, 4, 'Day 04: Kinetic Typography & Motion Graphics', 'Sync word-by-word highlighted captions and title lower-thirds to voice cadence.', 'Submit a 45-second commercial segment featuring dynamic kinetic typography.', null, 'general', 'drive_link', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 3)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 3)) then now() else null end),
    (p_cohort_id, 5, 'Day 05: Sprint 1 Milestone — First Client Simulation', 'Integrate Days 1–4 techniques into a complete 60s vertical product ad or full code module.', 'Submit your Sprint 1 final export for weekend mentor live grading.', null, 'general', 'drive_link', 48, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 4)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 4)) then now() else null end),
    (p_cohort_id, 6, 'Day 06: Cinematic Color Grading & Tone Curves', 'Color balance Log footage, create a moody contrast curve, and export Rec.709 clean grades.', 'Submit a side-by-side Before/After color comparison video.', null, 'general', 'drive_link', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 5)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 5)) then now() else null end),
    (p_cohort_id, 7, 'Day 07: Speed Ramping, Optical Flow & Match Cuts', 'Execute smooth seamless speed-ramps between action sequences using bezier handles.', 'Deliver a 20-second dynamic sports or fitness montage with 3 speed ramps.', null, 'general', 'drive_link', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 6)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 6)) then now() else null end),
    (p_cohort_id, 8, 'Day 08: Visual FX, Green Screen & Rotoscoping', 'Mask foreground subjects, layer background lighting effects, and clean edge bleed.', 'Submit your composite shot file and render proof.', null, 'general', 'drive_link', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 7)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 7)) then now() else null end),
    (p_cohort_id, 9, 'Day 09: Music Video Rhythm & Beat Synchronicity', 'Cut to dynamic tempo shifts and transient drum peaks for maximum emotional punch.', 'Sync 8 fast-cut b-roll scenes to acoustic/electronic tempo drop.', null, 'general', 'drive_link', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 8)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 8)) then now() else null end),
    (p_cohort_id, 10, 'Day 10: Sprint 2 Milestone — Mid-Term Portfolio Review', 'Consolidated commercial cut incorporating color, sound, typography, and speed ramps.', 'Submit for mid-term mentor feedback audit and cohort leaderboard score.', null, 'general', 'drive_link', 48, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 9)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 9)) then now() else null end),
    (p_cohort_id, 11, 'Day 11: Production Capstone — Storyboard & Raw Assembly', 'Begin your final 15-day capstone client project. Assemble the A-roll timeline.', 'Submit rough narrative sequence cut.', null, 'general', 'drive_link', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 10)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 10)) then now() else null end),
    (p_cohort_id, 12, 'Day 12: Production Capstone — Sound Design & Foley Polish', 'Add music transitions, SFX sweetening, and vocal clarity EQ pass.', 'Submit second cut with completed audio stems.', null, 'general', 'drive_link', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 11)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 11)) then now() else null end),
    (p_cohort_id, 13, 'Day 13: Production Capstone — Motion & Color Mastering', 'Fine-tune color consistency across all takes, add typography overlays, and sharpen details.', 'Submit near-final client master for preliminary mentor critique.', null, 'general', 'drive_link', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 12)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 12)) then now() else null end),
    (p_cohort_id, 14, 'Day 14: Final Capstone Master Export & Showcase', 'Deliver the client-ready 4K and vertical master exports with complete source project bundle.', 'Submit high-bitrate export link along with written production notes.', null, 'general', 'drive_link', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 13)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 13)) then now() else null end),
    (p_cohort_id, 15, 'Day 15: Graduation, Exit Evaluation & Letter of Recommendation', 'Final mentor grading, portfolio verification, and release of your verified Internship Certificate.', 'Complete the exit survey and claim your verifiable digital certificate.', null, 'general', 'text', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 14)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 14)) then now() else null end)
  on conflict (cohort_id, day_number) do nothing;

  select count(*) into v_count
  from public.daily_challenges
  where cohort_id = p_cohort_id;

  return jsonb_build_object('success', true, 'count', v_count, 'seeded', true);
end;
$$;

-- ------------------------------------------------------------------------------
-- 4. Lightweight Scheduled pg_cron Configuration
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
      -- Automatically reschedule midnight unlock job (runs daily at 00:00 UTC)
      perform cron.unschedule('unlock-daily-challenges')
        where exists (select 1 from cron.job where jobname = 'unlock-daily-challenges');
      perform cron.schedule(
        'unlock-daily-challenges',
        '0 0 * * *',
        'select public.unlock_scheduled_daily_challenges();'
      );
    end if;
  end if;
exception when others then
  raise notice 'pg_cron registration skipped: %', sqlerrm;
end;
$$;
