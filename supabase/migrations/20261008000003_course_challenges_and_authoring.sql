-- ==============================================================================
-- Migration: 20261008000003_course_challenges_and_authoring.sql
-- Description: Dynamic Course Challenges Schema, RLS, and Authoring:
--              1. Creates public.course_challenges for per-course dynamic challenges.
--              2. Creates public.course_challenge_participants and submissions.
--              3. Authorizes the 'challenges' storage folder in can_access_course_asset.
-- ==============================================================================

-- 1. Table: public.course_challenges
create table if not exists public.course_challenges (
  id text primary key,
  cohort_id uuid references public.cohorts(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  type text not null check (type in ('PROJECT', 'TASK')),
  week text not null default 'WEEK 1',
  title text not null,
  description text,
  start_date text not null,
  end_date text not null,
  duration_label text not null default '7 days',
  status text not null check (status in ('active', 'upcoming', 'completed')) default 'active',
  participants_joined integer not null default 0,
  pro_reward integer not null default 50,
  asset_url text,
  asset_name text,
  asset_size text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_course_challenges_cohort on public.course_challenges(cohort_id);
create index if not exists idx_course_challenges_status on public.course_challenges(status);

-- 2. Table: public.course_challenge_participants
create table if not exists public.course_challenge_participants (
  id uuid primary key default gen_random_uuid(),
  challenge_id text not null references public.course_challenges(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  constraint course_challenge_participants_unique unique (challenge_id, user_id)
);

create index if not exists idx_challenge_participants_user on public.course_challenge_participants(user_id);
create index if not exists idx_challenge_participants_challenge on public.course_challenge_participants(challenge_id);

-- 3. Table: public.course_challenge_submissions
create table if not exists public.course_challenge_submissions (
  id uuid primary key default gen_random_uuid(),
  challenge_id text not null references public.course_challenges(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  submission_url text not null,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'accepted', 'resubmit')),
  score integer check (score between 0 and 100),
  feedback text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint course_challenge_submissions_unique unique (challenge_id, user_id)
);

create index if not exists idx_challenge_subs_user on public.course_challenge_submissions(user_id);
create index if not exists idx_challenge_subs_challenge on public.course_challenge_submissions(challenge_id);

-- 4. Enable Row Level Security
alter table public.course_challenges enable row level security;
alter table public.course_challenge_participants enable row level security;
alter table public.course_challenge_submissions enable row level security;

-- Policies for course_challenges
drop policy if exists "Authenticated users can read course challenges" on public.course_challenges;
create policy "Authenticated users can read course challenges"
  on public.course_challenges for select
  to authenticated
  using (true);

drop policy if exists "Mentors and admins can manage course challenges" on public.course_challenges;
create policy "Mentors and admins can manage course challenges"
  on public.course_challenges for all
  to authenticated
  using (public.is_admin() or public.is_mentor())
  with check (public.is_admin() or public.is_mentor());

-- Policies for participants
drop policy if exists "Users can view challenge participants" on public.course_challenge_participants;
create policy "Users can view challenge participants"
  on public.course_challenge_participants for select
  to authenticated
  using (true);

drop policy if exists "Users can join challenges" on public.course_challenge_participants;
create policy "Users can join challenges"
  on public.course_challenge_participants for insert
  to authenticated
  with check (auth.uid() = user_id or public.is_admin());

-- Policies for submissions
drop policy if exists "Users can view their own submissions or staff" on public.course_challenge_submissions;
create policy "Users can view their own submissions or staff"
  on public.course_challenge_submissions for select
  to authenticated
  using (auth.uid() = user_id or public.is_admin() or public.is_mentor());

drop policy if exists "Users can submit challenge deliverables" on public.course_challenge_submissions;
create policy "Users can submit challenge deliverables"
  on public.course_challenge_submissions for insert
  to authenticated
  with check (auth.uid() = user_id);

-- 5. Authorize challenges folder in storage
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

  v_folder := (storage.foldername(p_object_name))[1];

  -- Public assets and challenge deliverables can be read
  if v_folder in ('thumbnails', 'covers', 'public', 'advertisements', 'community', 'challenges') then
    return true;
  end if;

  if v_uid is null then
    return false;
  end if;

  if public.is_admin() or public.is_mentor() then
    return true;
  end if;

  return false;
end;
$$;

grant execute on function public.can_access_course_asset(text) to authenticated, anon;

