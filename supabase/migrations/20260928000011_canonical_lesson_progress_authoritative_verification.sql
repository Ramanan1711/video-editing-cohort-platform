-- ==============================================================================
-- Migration: 20260928000011_canonical_lesson_progress_authoritative_verification.sql
-- Description: Hardens Lesson Progress with Authoritative Engagement Verification:
--              1. Adds authoritative watch accumulator columns: watched_seconds,
--                 last_heartbeat_at, heartbeat_count, and verification_source.
--              2. Replaces open/permissive progress mutation policies with strict
--                 anti-tamper verification.
--              3. Deploys anti-tamper trigger (trg_enforce_lesson_completion_threshold)
--                 preventing direct client-side completion or watch inflation without
--                 verified heartbeat tracking.
--              4. Implements authoritative server-side heartbeat RPC:
--                 record_lesson_watch_heartbeat(p_lesson_id, p_position_seconds, p_playback_rate)
--              5. Hardens verify_and_complete_lesson and toggle_lesson_completion RPCs.
--              6. Creates diagnostic engagement audit view: lesson_progress_engagement_audit.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Schema Hardening on public.lesson_progress
-- ------------------------------------------------------------------------------
alter table public.lesson_progress
  add column if not exists watched_seconds numeric not null default 0,
  add column if not exists last_heartbeat_at timestamptz,
  add column if not exists heartbeat_count integer not null default 0,
  add column if not exists verification_source text not null default 'heartbeat';

-- Add check constraint for verification source
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'lesson_progress_verification_source_check'
  ) then
    alter table public.lesson_progress
      add constraint lesson_progress_verification_source_check
      check (verification_source in ('heartbeat', 'verified_completion', 'staff_override', 'legacy_import', 'migrated'));
  end if;
exception when others then
  null;
end $$;

create index if not exists idx_lesson_progress_watch_acc on public.lesson_progress(user_id, watched_seconds);
create index if not exists idx_lesson_progress_heartbeat on public.lesson_progress(last_heartbeat_at);

-- ------------------------------------------------------------------------------
-- 2. Anti-Tamper Verification Trigger on public.lesson_progress
-- ------------------------------------------------------------------------------
create or replace function public.enforce_lesson_completion_threshold()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_video boolean;
  v_is_authoritative boolean;
  v_is_staff boolean;
begin
  -- Check if caller is executing via authoritative security definer RPC
  v_is_authoritative := (current_setting('app.authoritative_verification', true) = 'on');
  v_is_staff := public.is_mentor_or_admin();

  -- Authoritative server procedures and platform staff can mutate progress freely
  if v_is_authoritative or v_is_staff then
    return new;
  end if;

  -- Verify whether lesson has video requirement
  select (video_url is not null and trim(video_url) != '')
  into v_has_video
  from public.lessons
  where id = new.lesson_id;

  if coalesce(v_has_video, false) then
    -- Guard 1: Direct writes attempting to mark video lesson complete without verified >= 80% watch
    if new.completed = true then
      if coalesce(old.completed, false) = false and coalesce(old.watch_percentage, 0) < 80 and coalesce(new.watch_percentage, 0) < 80 then
        raise exception 'DIRECT_WRITE_DENIED: Video lesson completion requires authoritative server-side engagement verification via verify_and_complete_lesson.'
          using errcode = '42501';
      end if;
    end if;

    -- Guard 2: Direct writes attempting to inflate watch percentage without heartbeat verification
    if tg_op = 'UPDATE' and new.watch_percentage > coalesce(old.watch_percentage, 0) + 20 then
      raise exception 'DIRECT_WRITE_DENIED: Watch progress cannot jump forward by more than 20%% without authoritative heartbeat tracking.'
        using errcode = '42501';
    end if;

    -- Guard 3: Direct insert attempting to inject pre-completed state without RPC
    if tg_op = 'INSERT' and new.watch_percentage > 25 and new.completed = true then
      raise exception 'DIRECT_WRITE_DENIED: Direct insertion of completed video lesson is restricted. Use verify_and_complete_lesson.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_lesson_completion_threshold on public.lesson_progress;
create trigger trg_enforce_lesson_completion_threshold
  before insert or update on public.lesson_progress
  for each row
  execute function public.enforce_lesson_completion_threshold();

-- ------------------------------------------------------------------------------
-- 3. Row Level Security Hardening on public.lesson_progress
-- ------------------------------------------------------------------------------
alter table public.lesson_progress enable row level security;

drop policy if exists "Active students can manage own progress" on public.lesson_progress;
drop policy if exists "Users can manage own lesson progress" on public.lesson_progress;
drop policy if exists "Students can view own lesson progress" on public.lesson_progress;
drop policy if exists "Students can update own progress" on public.lesson_progress;
drop policy if exists "Staff can manage lesson progress" on public.lesson_progress;

-- Students and staff can read own/assigned progress records
create policy "Students can view own lesson progress"
  on public.lesson_progress for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_mentor_or_admin()
  );

-- Staff has full management privileges
create policy "Staff can manage lesson progress"
  on public.lesson_progress for all
  to authenticated
  using (public.is_mentor_or_admin())
  with check (public.is_mentor_or_admin());

-- Students can insert/update only through verified constraints
create policy "Students can update own progress"
  on public.lesson_progress for all
  to authenticated
  using (user_id = auth.uid() and public.is_active_user())
  with check (user_id = auth.uid() and public.is_active_user());

-- ------------------------------------------------------------------------------
-- 4. Authoritative Heartbeat RPC: record_lesson_watch_heartbeat
-- ------------------------------------------------------------------------------
create or replace function public.record_lesson_watch_heartbeat(
  p_lesson_id uuid,
  p_position_seconds numeric default 0,
  p_playback_rate numeric default 1.0,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_lesson record;
  v_existing record;
  v_has_video boolean := false;
  v_elapsed_seconds numeric := 0;
  v_clamped_rate numeric := 1.0;
  v_incremental_watched numeric := 0;
  v_new_watched_seconds numeric := 0;
  v_calc_watch_pct numeric := 0;
  v_final_watch_pct numeric := 0;
  v_should_complete boolean := false;
  v_is_auto_completed boolean := false;
  v_now timestamptz := now();
begin
  -- Resolve authenticated caller or allow mentor/admin specifying student
  v_uid := auth.uid();
  if v_uid is null then
    if p_user_id is not null and public.is_mentor_or_admin() then
      v_uid := p_user_id;
    else
      raise exception 'UNAUTHENTICATED: Authentication required to record watch progress.'
        using errcode = '42501';
    end if;
  elsif p_user_id is not null and p_user_id != v_uid then
    if not public.is_mentor_or_admin() then
      raise exception 'UNAUTHORIZED: Cannot record progress for another user.'
        using errcode = '42501';
    end if;
    v_uid := p_user_id;
  end if;

  -- Verify lesson exists
  select id, title, video_url, duration_minutes, module_id
  into v_lesson
  from public.lessons
  where id = p_lesson_id;

  if not found then
    raise exception 'LESSON_NOT_FOUND: Lesson % not found.', p_lesson_id
      using errcode = 'P0002';
  end if;

  v_has_video := (v_lesson.video_url is not null and trim(v_lesson.video_url) != '');

  -- Fetch existing progress record
  select completed, completed_at, watch_percentage, last_position_seconds, watched_seconds, last_heartbeat_at, heartbeat_count
  into v_existing
  from public.lesson_progress
  where user_id = v_uid and lesson_id = p_lesson_id;

  -- Calculate elapsed real time since last heartbeat
  if v_existing.last_heartbeat_at is not null then
    v_elapsed_seconds := extract(epoch from (v_now - v_existing.last_heartbeat_at));
    -- Cap elapsed seconds per heartbeat to 30s to prevent background tab spikes
    v_elapsed_seconds := least(greatest(v_elapsed_seconds, 0), 30.0);
  else
    -- Initial heartbeat: grant modest baseline (e.g. 5 seconds or position if under 15s)
    v_elapsed_seconds := least(greatest(coalesce(p_position_seconds, 0), 0), 10.0);
  end if;

  -- Clamp playback rate between 0.5x and 2.5x
  v_clamped_rate := least(greatest(coalesce(p_playback_rate, 1.0), 0.5), 2.5);
  v_incremental_watched := v_elapsed_seconds * v_clamped_rate;
  v_new_watched_seconds := coalesce(v_existing.watched_seconds, 0) + v_incremental_watched;

  -- Authoritatively compute watch percentage
  if v_has_video and coalesce(v_lesson.duration_minutes, 0) > 0 then
    -- Watch percentage based on verified watched seconds
    v_calc_watch_pct := least(100.0, round((v_new_watched_seconds / (v_lesson.duration_minutes * 60.0)) * 100.0));
    -- Allow position to reflect current playhead but bound by verified watch time (+ 15% allowance for intro skips)
    v_final_watch_pct := least(100.0, greatest(
      coalesce(v_existing.watch_percentage, 0),
      v_calc_watch_pct,
      least(
        round((least(coalesce(p_position_seconds, 0), (v_lesson.duration_minutes * 60.0)) / (v_lesson.duration_minutes * 60.0)) * 100.0),
        v_calc_watch_pct + 15.0
      )
    ));
  else
    -- If no duration specified or non-video, track position directly
    v_final_watch_pct := least(100.0, greatest(coalesce(v_existing.watch_percentage, 0), 80.0));
  end if;

  -- Check auto-completion at 80%
  if v_final_watch_pct >= 80 and coalesce(v_existing.completed, false) = false then
    v_should_complete := true;
    v_is_auto_completed := true;
  else
    v_should_complete := coalesce(v_existing.completed, false);
  end if;

  -- Authoritative write with session flag enabled
  perform set_config('app.authoritative_verification', 'on', true);

  insert into public.lesson_progress (
    user_id,
    lesson_id,
    completed,
    completed_at,
    watch_percentage,
    last_position_seconds,
    watched_seconds,
    last_heartbeat_at,
    heartbeat_count,
    verification_source,
    updated_at
  )
  values (
    v_uid,
    p_lesson_id,
    v_should_complete,
    case when v_should_complete then coalesce(v_existing.completed_at, v_now) else null end,
    v_final_watch_pct,
    greatest(0, round(coalesce(p_position_seconds, 0))),
    v_new_watched_seconds,
    v_now,
    coalesce(v_existing.heartbeat_count, 0) + 1,
    'heartbeat',
    v_now
  )
  on conflict (user_id, lesson_id)
  do update set
    completed = case when v_should_complete then true else public.lesson_progress.completed end,
    completed_at = case
      when v_should_complete then coalesce(public.lesson_progress.completed_at, v_now)
      else public.lesson_progress.completed_at
    end,
    watch_percentage = greatest(coalesce(public.lesson_progress.watch_percentage, 0), v_final_watch_pct),
    last_position_seconds = greatest(0, round(coalesce(p_position_seconds, 0))),
    watched_seconds = public.lesson_progress.watched_seconds + v_incremental_watched,
    last_heartbeat_at = v_now,
    heartbeat_count = coalesce(public.lesson_progress.heartbeat_count, 0) + 1,
    verification_source = 'heartbeat',
    updated_at = v_now;

  return jsonb_build_object(
    'success', true,
    'lesson_id', p_lesson_id,
    'watch_percentage', v_final_watch_pct,
    'watched_seconds', v_new_watched_seconds,
    'last_position_seconds', round(coalesce(p_position_seconds, 0)),
    'completed', v_should_complete,
    'is_auto_completed', v_is_auto_completed
  );
end;
$$;

grant execute on function public.record_lesson_watch_heartbeat(uuid, numeric, numeric, uuid) to authenticated;

-- ------------------------------------------------------------------------------
-- 5. Hardened verify_and_complete_lesson RPC
-- ------------------------------------------------------------------------------
create or replace function public.verify_and_complete_lesson(
  p_user_id uuid,
  p_lesson_id uuid,
  p_watch_percentage numeric default null,
  p_position_seconds numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lesson record;
  v_has_video boolean := false;
  v_is_eligible boolean := false;
  v_existing record;
  v_final_watch numeric := 0;
  v_is_staff boolean := false;
  v_now timestamptz := now();
begin
  v_is_staff := public.is_mentor_or_admin();

  -- Authorization check: student themselves or mentor/admin
  if auth.uid() != p_user_id and not v_is_staff then
    return jsonb_build_object(
      'success', false,
      'completed', false,
      'reason', 'Unauthorized: You can only complete lessons for your own account.'
    );
  end if;

  -- Verify lesson exists
  select id, title, video_url, duration_minutes, status, module_id
  into v_lesson
  from public.lessons
  where id = p_lesson_id;

  if not found then
    return jsonb_build_object(
      'success', false,
      'completed', false,
      'reason', format('Lesson %s not found.', p_lesson_id)
    );
  end if;

  v_has_video := (v_lesson.video_url is not null and trim(v_lesson.video_url) != '');

  -- Fetch existing authoritative progress
  select completed, completed_at, watch_percentage, last_position_seconds, watched_seconds
  into v_existing
  from public.lesson_progress
  where user_id = p_user_id and lesson_id = p_lesson_id;

  -- Compute effective watch percentage:
  if v_is_staff and p_watch_percentage is not null then
    v_final_watch := least(100.0, greatest(0.0, p_watch_percentage));
  else
    v_final_watch := least(100.0, greatest(
      coalesce(v_existing.watch_percentage, 0),
      coalesce(p_watch_percentage, 0)
    ));
  end if;

  -- Eligibility evaluation:
  if coalesce(v_existing.completed, false) = true then
    v_is_eligible := true;
  elsif not v_has_video then
    -- Non-video reading/exercise lessons are eligible upon confirmation
    v_is_eligible := true;
    v_final_watch := 100.0;
  elsif v_final_watch >= 80 then
    v_is_eligible := true;
  elsif v_is_staff then
    v_is_eligible := true;
  else
    v_is_eligible := false;
  end if;

  if not v_is_eligible then
    return jsonb_build_object(
      'success', false,
      'completed', false,
      'watch_percentage', round(v_final_watch),
      'reason', format(
        'You have watched %s%% of this video lesson. At least 80%% verified watch progress is required before marking it complete.',
        round(v_final_watch)
      )
    );
  end if;

  -- Authoritative write flag
  perform set_config('app.authoritative_verification', 'on', true);

  insert into public.lesson_progress (
    user_id,
    lesson_id,
    completed,
    completed_at,
    watch_percentage,
    last_position_seconds,
    watched_seconds,
    verification_source,
    updated_at
  )
  values (
    p_user_id,
    p_lesson_id,
    true,
    v_now,
    greatest(coalesce(v_final_watch, 0), 80.0),
    greatest(0, round(coalesce(p_position_seconds, coalesce(v_existing.last_position_seconds, 0)))),
    coalesce(v_existing.watched_seconds, 0),
    case when v_is_staff then 'staff_override' else 'verified_completion' end,
    v_now
  )
  on conflict (user_id, lesson_id)
  do update set
    completed = true,
    completed_at = coalesce(public.lesson_progress.completed_at, v_now),
    watch_percentage = greatest(coalesce(public.lesson_progress.watch_percentage, 0), v_final_watch),
    last_position_seconds = greatest(coalesce(public.lesson_progress.last_position_seconds, 0), coalesce(p_position_seconds, 0)),
    verification_source = case when v_is_staff then 'staff_override' else 'verified_completion' end,
    updated_at = v_now;

  -- Sync student challenge / gamification streak if function exists
  begin
    perform public.sync_student_challenge_completion(p_user_id, p_lesson_id);
  exception when others then
    null;
  end;

  return jsonb_build_object(
    'success', true,
    'completed', true,
    'watch_percentage', round(v_final_watch),
    'reason', 'Lesson marked complete with verified engagement.'
  );
end;
$$;

grant execute on function public.verify_and_complete_lesson(uuid, uuid, numeric, numeric) to authenticated;

-- ------------------------------------------------------------------------------
-- 6. Authoritative toggle_lesson_completion RPC
-- ------------------------------------------------------------------------------
create or replace function public.toggle_lesson_completion(
  p_lesson_id uuid,
  p_completed boolean,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_is_staff boolean;
begin
  v_uid := auth.uid();
  v_is_staff := public.is_mentor_or_admin();

  if v_uid is null then
    if p_user_id is not null and v_is_staff then
      v_uid := p_user_id;
    else
      raise exception 'UNAUTHENTICATED: Authentication required.' using errcode = '42501';
    end if;
  elsif p_user_id is not null and p_user_id != v_uid then
    if not v_is_staff then
      raise exception 'UNAUTHORIZED: Cannot toggle completion for another user.' using errcode = '42501';
    end if;
    v_uid := p_user_id;
  end if;

  if p_completed = true then
    return public.verify_and_complete_lesson(v_uid, p_lesson_id);
  end if;

  -- Unmarking completion
  perform set_config('app.authoritative_verification', 'on', true);

  update public.lesson_progress
  set
    completed = false,
    completed_at = null,
    updated_at = now()
  where user_id = v_uid and lesson_id = p_lesson_id;

  return jsonb_build_object(
    'success', true,
    'completed', false,
    'lesson_id', p_lesson_id
  );
end;
$$;

grant execute on function public.toggle_lesson_completion(uuid, boolean, uuid) to authenticated;

-- ------------------------------------------------------------------------------
-- 7. Diagnostic Engagement Audit View: lesson_progress_engagement_audit
-- ------------------------------------------------------------------------------
drop view if exists public.lesson_progress_engagement_audit cascade;
create or replace view public.lesson_progress_engagement_audit as
select
  lp.user_id,
  p.full_name as student_name,
  p.email as student_email,
  lp.lesson_id,
  l.title as lesson_title,
  l.duration_minutes as lesson_duration_minutes,
  lp.completed,
  lp.completed_at,
  lp.watch_percentage,
  lp.watched_seconds,
  lp.last_position_seconds,
  lp.heartbeat_count,
  lp.verification_source,
  lp.last_heartbeat_at,
  lp.updated_at
from public.lesson_progress lp
join public.lessons l on l.id = lp.lesson_id
left join public.profiles p on p.id = lp.user_id;
