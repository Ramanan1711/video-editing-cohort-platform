-- ==============================================================================
-- Migration: 20261009000003_fix_daily_challenges_rls_and_purge_all_hardcoded_sprints.sql
-- Description: 
--   1. Drops cohort auto-seeding triggers permanently.
--   2. Ensures ensure_cohort_daily_challenges is a pure no-op (no default seeding).
--   3. Upgrades is_mentor_or_admin() to check BOTH public.profiles and auth.jwt() claims.
--   4. Hardens RLS on public.daily_challenges and adds security-definer admin RPCs.
--   5. Purges ALL legacy hardcoded default challenges from public.daily_challenges.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Drop auto-seeding triggers on cohorts
-- ------------------------------------------------------------------------------
drop trigger if exists trg_ensure_cohort_daily_challenges on public.cohorts;
drop function if exists public.trigger_ensure_cohort_daily_challenges() cascade;

-- ------------------------------------------------------------------------------
-- 2. Make ensure_cohort_daily_challenges a complete no-op
-- ------------------------------------------------------------------------------
create or replace function public.ensure_cohort_daily_challenges(p_cohort_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return jsonb_build_object('success', true, 'cohort_id', p_cohort_id, 'seeded', false);
end;
$$;

grant execute on function public.ensure_cohort_daily_challenges(uuid) to authenticated, anon, service_role;

-- ------------------------------------------------------------------------------
-- 3. Upgrade is_mentor_or_admin() to recognize JWT metadata & profiles
-- ------------------------------------------------------------------------------
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
  )
  or coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') in ('mentor', 'admin')
  or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('mentor', 'admin')
  or coalesce(auth.jwt() ->> 'role', '') in ('service_role', 'supabase_admin');
$$;

grant execute on function public.is_mentor_or_admin() to authenticated, anon, service_role;

-- ------------------------------------------------------------------------------
-- 4. Harden RLS on public.daily_challenges
-- ------------------------------------------------------------------------------
alter table public.daily_challenges enable row level security;

drop policy if exists "Authenticated users can read daily challenges" on public.daily_challenges;
drop policy if exists "Anyone can read daily challenges" on public.daily_challenges;
create policy "Anyone can read daily challenges"
  on public.daily_challenges for select
  using (true);

drop policy if exists "Mentors and Admins can manage daily challenges" on public.daily_challenges;
drop policy if exists "Mentors and Admins can insert daily challenges" on public.daily_challenges;
drop policy if exists "Mentors and Admins can update daily challenges" on public.daily_challenges;
drop policy if exists "Mentors and Admins can delete daily challenges" on public.daily_challenges;

create policy "Mentors and Admins can manage daily challenges"
  on public.daily_challenges for all
  to authenticated
  using (public.is_mentor_or_admin())
  with check (public.is_mentor_or_admin());

-- ------------------------------------------------------------------------------
-- 5. Security-Definer RPCs for Admin/Mentor operations
-- ------------------------------------------------------------------------------

-- Admin clear all challenges for a cohort
create or replace function public.admin_clear_cohort_daily_challenges(p_cohort_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.daily_challenges
  where cohort_id = p_cohort_id;

  return jsonb_build_object('success', true, 'cohort_id', p_cohort_id);
end;
$$;

grant execute on function public.admin_clear_cohort_daily_challenges(uuid) to authenticated, service_role;

-- Admin delete single challenge
create or replace function public.admin_delete_daily_challenge(p_challenge_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.daily_challenges
  where id = p_challenge_id;

  return jsonb_build_object('success', true, 'challenge_id', p_challenge_id);
end;
$$;

grant execute on function public.admin_delete_daily_challenge(uuid) to authenticated, service_role;

-- Admin bulk upsert challenges
create or replace function public.admin_bulk_upsert_daily_challenges(
  p_cohort_id uuid,
  p_challenges jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_inserted int := 0;
begin
  for v_item in select * from jsonb_array_elements(p_challenges)
  loop
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
    ) values (
      p_cohort_id,
      (v_item->>'day_number')::int,
      coalesce(v_item->>'title', 'Day ' || (v_item->>'day_number')),
      v_item->>'description',
      v_item->>'instructions',
      v_item->>'starter_files_url',
      coalesce(v_item->>'track_type', 'general'),
      coalesce(v_item->>'submission_type', 'drive_link'),
      coalesce((v_item->>'deadline_hours')::int, 24),
      coalesce((v_item->>'is_published')::boolean, true),
      case when coalesce((v_item->>'is_published')::boolean, true) then now() else null end
    )
    on conflict (cohort_id, day_number) do update set
      title = excluded.title,
      description = excluded.description,
      instructions = excluded.instructions,
      starter_files_url = excluded.starter_files_url,
      track_type = excluded.track_type,
      submission_type = excluded.submission_type,
      deadline_hours = excluded.deadline_hours,
      is_published = excluded.is_published,
      unlocked_at = excluded.unlocked_at;

    v_inserted := v_inserted + 1;
  end loop;

  return jsonb_build_object('success', true, 'count', v_inserted, 'cohort_id', p_cohort_id);
end;
$$;

grant execute on function public.admin_bulk_upsert_daily_challenges(uuid, jsonb) to authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 6. Purge ALL legacy default/hardcoded daily challenge records
-- ------------------------------------------------------------------------------
delete from public.daily_challenges
where title in (
  -- Video Editing Hardcoded Tracks
  'Day 01: Production Setup & First Kinetic Cut',
  'Day 01: Workspace Setup, NLE Preferences & Ingestion',
  'Day 02: Pacing, Micro-Transitions & Retention',
  'Day 02: Narrative Pacing, J-Cuts & L-Cuts',
  'Day 03: Sound Design, SFX Stems & Audio Layering',
  'Day 04: Kinetic Typography & Motion Graphics',
  'Day 04: Dynamic B-Roll Ingestion & Speed Ramps',
  'Day 04: B-Roll Selection, Speed Ramps & Flow',
  'Day 05: Sprint 1 Milestone — First Client Simulation',
  'Day 05: Sprint 1 Milestone — First Client Rough Cut',
  'Day 05: Sprint 1 Milestone — First Rough Cut Review',
  'Day 06: Cinematic Color Grading & Tone Curves',
  'Day 06: Multi-Cam Assembly & Audio Syncing',
  'Day 07: Speed Ramping, Optical Flow & Match Cuts',
  'Day 07: Color Correction, Scopes & White Balancing',
  'Day 07: Color Correction & Scopes',
  'Day 08: Visual FX, Green Screen & Rotoscoping',
  'Day 08: Cinematic Color Grading & LUT Workflow',
  'Day 08: Cinematic Color Grading & Creative LUTs',
  'Day 09: Music Video Rhythm & Beat Synchronicity',
  'Day 09: Kinetic Typography & Lower Third Motion',
  'Day 10: Sprint 2 Milestone — Mid-Term Portfolio Review',
  'Day 10: Sprint 2 Milestone — Commercial 30s Cut',
  'Day 10: Sprint 2 Milestone — Commercial Cut Polish',
  'Day 11: Production Capstone — Storyboard & Raw Assembly',
  'Day 11: Visual Effects Cleanup & Masking',
  'Day 12: Production Capstone — Sound Design & Foley Polish',
  'Day 12: Sound Mastering, LUFS & Final Mix',
  'Day 12: Audio Mastering, LUFS & EQ Cleanup',
  'Day 13: Production Capstone — Motion & Color Mastering',
  'Day 13: Final Polish, Color Pass & Audio Mix',
  'Day 13: Vertical Video (9:16) Adaptation & Retention Hacks',
  'Day 13: Multi-Format Delivery (9:16 Reels & 16:9 YouTube)',
  'Day 14: Final Capstone Master Export & Showcase',
  'Day 14: Portfolio Project Showcase & Export',
  'Day 14: Portfolio Project Final Polish',
  'Day 15: Graduation Showcase & Certification',
  'Day 15: Final Certification, Reel Polish & Showcase',
  -- Coding track defaults
  'Day 01: Dev Environment & Git Setup',
  'Day 02: Syntax Fundamentals & Variables',
  'Day 03: Control Flow & Logic Operators',
  'Day 04: Functions, Scope & Modules',
  'Day 05: Sprint 1 Milestone — Algorithm Challenges',
  'Day 06: Data Structures — Arrays & HashMaps',
  'Day 07: Object-Oriented Programming & Classes',
  'Day 08: Error Handling & Debugging Techniques',
  'Day 09: Asynchronous Programming & Promises',
  'Day 10: Sprint 2 Milestone — REST API Client',
  'Day 11: Production Capstone — Project Architecture & Setup',
  'Day 12: Production Capstone — Core Features Implementation',
  'Day 13: Production Capstone — Testing & Refactoring',
  'Day 14: Production Capstone — CI/CD & Deployment',
  'Day 15: Code Review, Portfolio & Certification',
  -- Motion graphics defaults
  'Day 01: Motion Software Setup & Keyframing Basics',
  'Day 02: Graph Editor, Easing & Spatial Interpolation',
  'Day 03: Shape Layers, Modifiers & Repeater Tools',
  'Day 04: Kinetic Typography & Text Animators',
  'Day 05: Sprint 1 Milestone — Animated Logo Reveal',
  'Day 06: Masking, Track Mattes & Pre-Comps',
  'Day 07: 3D Layers, Cameras & Lighting Space',
  'Day 08: Character Rigging & Puppet Pin Animations',
  'Day 09: Particle Systems & Visual Simulation Passes',
  'Day 10: Sprint 2 Milestone — 15s Product Promo Motion',
  'Day 11: Production Capstone — Concept, Design & Styleframes',
  'Day 12: Production Capstone — Animation Phase 1',
  'Day 13: Production Capstone — Secondary Motion & Polish',
  'Day 14: Production Capstone — Sound Sync & Motion Export',
  'Day 15: Motion Portfolio Review & Certification'
);

