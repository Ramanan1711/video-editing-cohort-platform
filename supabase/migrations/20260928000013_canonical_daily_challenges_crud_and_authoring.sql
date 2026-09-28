-- ==============================================================================
-- Migration: 20260928000013_canonical_daily_challenges_crud_and_authoring.sql
-- Description: Canonical Daily Challenges Authoring, Database Persistence & RLS:
--              1. Hardens public.daily_challenges schema with full constraints and indices.
--              2. Ensures idempotent seed RPC: ensure_cohort_daily_challenges(p_cohort_id uuid).
--              3. Establishes canonical RLS policies for daily challenges and submissions.
--              4. Eliminates reliance on synthetic non-database IDs for sprint challenges.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Schema Hardening on public.daily_challenges
-- ------------------------------------------------------------------------------

create table if not exists public.daily_challenges (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  day_number integer not null check (day_number between 1 and 100),
  title text not null,
  description text,
  instructions text,
  starter_files_url text,
  track_type text not null default 'general',
  submission_type text not null default 'drive_link',
  deadline_hours integer not null default 24,
  created_at timestamptz not null default now(),
  constraint daily_challenges_cohort_day_unique unique (cohort_id, day_number)
);

-- Ensure all columns exist if table was partially created
alter table public.daily_challenges
  add column if not exists description text,
  add column if not exists instructions text,
  add column if not exists starter_files_url text,
  add column if not exists track_type text not null default 'general',
  add column if not exists submission_type text not null default 'drive_link',
  add column if not exists deadline_hours integer not null default 24,
  add column if not exists created_at timestamptz not null default now();

create index if not exists idx_daily_challenges_cohort_day on public.daily_challenges(cohort_id, day_number);

-- Ensure daily_challenge_submissions exists
create table if not exists public.daily_challenge_submissions (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.daily_challenges(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  submission_url text not null,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'resubmit', 'accepted')),
  score integer check (score between 0 and 100),
  mentor_feedback text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint daily_challenge_submissions_unique unique (challenge_id, user_id)
);

create index if not exists idx_daily_challenge_subs_user on public.daily_challenge_submissions(user_id);
create index if not exists idx_daily_challenge_subs_challenge on public.daily_challenge_submissions(challenge_id);
create index if not exists idx_daily_challenge_subs_status on public.daily_challenge_submissions(status);

-- ------------------------------------------------------------------------------
-- 2. Canonical Seed Function for 15-Day Challenges per Cohort
-- ------------------------------------------------------------------------------

create or replace function public.ensure_cohort_daily_challenges(p_cohort_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  select count(*) into v_count
  from public.daily_challenges
  where cohort_id = p_cohort_id;

  if v_count >= 15 then
    return jsonb_build_object('success', true, 'count', v_count, 'seeded', false);
  end if;

  insert into public.daily_challenges (
    cohort_id,
    day_number,
    title,
    description,
    instructions,
    starter_files_url,
    track_type,
    submission_type,
    deadline_hours
  )
  values
    (p_cohort_id, 1, 'Day 01: Production Setup & First Kinetic Cut', 'Establish project directory structure, import raw footage/starter repo, and ship first edit.', 'Submit your Day 1 repository PR or Google Drive cut link before midnight.', 'https://drive.google.com/drive/folders/sample-day-1', 'general', 'drive_link', 24),
    (p_cohort_id, 2, 'Day 02: Pacing, Micro-Transitions & Retention', 'Learn fast-paced cuts, J/L audio cuts, and maintaining 70%+ audience watch retention.', 'Produce a 30-second timeline maintaining retention peaks at seconds 3, 7, and 15.', null, 'general', 'drive_link', 24),
    (p_cohort_id, 3, 'Day 03: Sound Design, SFX Stems & Audio Layering', 'Layer whooshes, risers, foley hits, and balance speech volume levels to -6dB True Peak.', 'Include at least 4 distinct audio stem layers and export your clean WAV/MP4 master.', null, 'general', 'drive_link', 24),
    (p_cohort_id, 4, 'Day 04: Kinetic Typography & Motion Graphics', 'Sync word-by-word highlighted captions and title lower-thirds to voice cadence.', 'Submit a 45-second commercial segment featuring dynamic kinetic typography.', null, 'general', 'drive_link', 24),
    (p_cohort_id, 5, 'Day 05: Sprint 1 Milestone — First Client Simulation', 'Integrate Days 1–4 techniques into a complete 60s vertical product ad or full code module.', 'Submit your Sprint 1 final export for weekend mentor live grading.', null, 'general', 'drive_link', 48),
    (p_cohort_id, 6, 'Day 06: Cinematic Color Grading & Tone Curves', 'Color balance Log footage, create a moody contrast curve, and export Rec.709 clean grades.', 'Submit a side-by-side Before/After color comparison video.', null, 'general', 'drive_link', 24),
    (p_cohort_id, 7, 'Day 07: Speed Ramping, Optical Flow & Match Cuts', 'Execute smooth seamless speed-ramps between action sequences using bezier handles.', 'Deliver a 20-second dynamic sports or fitness montage with 3 speed ramps.', null, 'general', 'drive_link', 24),
    (p_cohort_id, 8, 'Day 08: Visual FX, Green Screen & Rotoscoping', 'Mask foreground subjects, layer background lighting effects, and clean edge bleed.', 'Submit your composite shot file and render proof.', null, 'general', 'drive_link', 24),
    (p_cohort_id, 9, 'Day 09: Music Video Rhythm & Beat Synchronicity', 'Cut to dynamic tempo shifts and transient drum peaks for maximum emotional punch.', 'Sync 8 fast-cut b-roll scenes to acoustic/electronic tempo drop.', null, 'general', 'drive_link', 24),
    (p_cohort_id, 10, 'Day 10: Sprint 2 Milestone — Mid-Term Portfolio Review', 'Consolidated commercial cut incorporating color, sound, typography, and speed ramps.', 'Submit for mid-term mentor feedback audit and cohort leaderboard score.', null, 'general', 'drive_link', 48),
    (p_cohort_id, 11, 'Day 11: Production Capstone — Storyboard & Raw Assembly', 'Begin your final 15-day capstone client project. Assemble the A-roll timeline.', 'Submit rough narrative sequence cut.', null, 'general', 'drive_link', 24),
    (p_cohort_id, 12, 'Day 12: Production Capstone — Sound Design & Foley Polish', 'Add music transitions, SFX sweetening, and vocal clarity EQ pass.', 'Submit second cut with completed audio stems.', null, 'general', 'drive_link', 24),
    (p_cohort_id, 13, 'Day 13: Production Capstone — Motion & Color Mastering', 'Fine-tune color consistency across all takes, add typography overlays, and sharpen details.', 'Submit near-final client master for preliminary mentor critique.', null, 'general', 'drive_link', 24),
    (p_cohort_id, 14, 'Day 14: Final Capstone Master Export & Showcase', 'Deliver the client-ready 4K and vertical master exports with complete source project bundle.', 'Submit high-bitrate export link along with written production notes.', null, 'general', 'drive_link', 24),
    (p_cohort_id, 15, 'Day 15: Graduation, Exit Evaluation & Letter of Recommendation', 'Final mentor grading, portfolio verification, and release of your verified Internship Certificate.', 'Complete the exit survey and claim your verifiable digital certificate.', null, 'general', 'text', 24)
  on conflict (cohort_id, day_number) do nothing;

  select count(*) into v_count
  from public.daily_challenges
  where cohort_id = p_cohort_id;

  return jsonb_build_object('success', true, 'count', v_count, 'seeded', true);
end;
$$;

grant execute on function public.ensure_cohort_daily_challenges(uuid) to authenticated;

-- ------------------------------------------------------------------------------
-- 3. Row-Level Security Policies
-- ------------------------------------------------------------------------------

-- Ensure helper functions exist
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and coalesce(status, 'active') = 'active'
  );
$$;

create or replace function public.is_mentor_or_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('mentor', 'admin')
      and coalesce(status, 'active') = 'active'
  );
$$;

alter table public.daily_challenges enable row level security;
alter table public.daily_challenge_submissions enable row level security;

-- daily_challenges RLS
drop policy if exists "Authenticated users can read daily challenges" on public.daily_challenges;
create policy "Authenticated users can read daily challenges"
  on public.daily_challenges for select
  to authenticated
  using (true);

drop policy if exists "Mentors and Admins can manage daily challenges" on public.daily_challenges;
create policy "Mentors and Admins can manage daily challenges"
  on public.daily_challenges for all
  to authenticated
  using (public.is_mentor_or_admin())
  with check (public.is_mentor_or_admin());

-- daily_challenge_submissions RLS
drop policy if exists "Students can manage own challenge submissions" on public.daily_challenge_submissions;
create policy "Students can manage own challenge submissions"
  on public.daily_challenge_submissions for all
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_mentor_or_admin()
  )
  with check (
    user_id = auth.uid()
    or public.is_mentor_or_admin()
  );
