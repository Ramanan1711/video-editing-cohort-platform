-- Migration: 20260925000002_internship_challenges_and_whatsapp.sql
-- Description: Adds WhatsApp communication fields, 15-day internship sprint challenges, submissions, and notification logs.

-- 1. Profiles Table Extension
alter table public.profiles
  add column if not exists whatsapp_number text,
  add column if not exists whatsapp_opt_in boolean default true;

-- 2. Cohorts Table Extension (Track type & sprint duration)
alter table public.cohorts
  add column if not exists track_type text default 'general',
  add column if not exists duration_days integer default 15;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'cohorts_track_type_check'
  ) then
    alter table public.cohorts
      add constraint cohorts_track_type_check
      check (track_type in ('coding', 'non_coding', 'general'));
  end if;
end $$;

-- 3. Daily Challenges Table
create table if not exists public.daily_challenges (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid references public.cohorts(id) on delete cascade,
  day_number integer not null check (day_number between 1 and 30),
  title text not null,
  description text,
  instructions text,
  starter_files_url text,
  track_type text not null default 'general' check (track_type in ('coding', 'non_coding', 'general')),
  submission_type text not null default 'github_pr' check (submission_type in ('github_pr', 'drive_link', 'loom_video', 'text', 'file')),
  deadline_hours integer not null default 24,
  created_at timestamptz not null default now(),
  constraint daily_challenges_cohort_day_unique unique (cohort_id, day_number)
);

create index if not exists idx_daily_challenges_cohort_day on public.daily_challenges(cohort_id, day_number);

-- 4. Daily Challenge Submissions Table
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

create index if not exists idx_challenge_submissions_user on public.daily_challenge_submissions(user_id);
create index if not exists idx_challenge_submissions_challenge on public.daily_challenge_submissions(challenge_id);
create index if not exists idx_challenge_submissions_status on public.daily_challenge_submissions(status);

-- 5. WhatsApp Notifications Log Table
create table if not exists public.whatsapp_notifications_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  recipient_phone text not null,
  event_type text not null check (event_type in ('welcome', 'daily_challenge', 'workshop_alert', 'inactivity_nudge', 'feedback', 'graduation', 'custom')),
  message_body text not null,
  status text not null default 'sent' check (status in ('queued', 'sent', 'delivered', 'failed')),
  error_details text,
  created_at timestamptz not null default now()
);

create index if not exists idx_wa_log_user on public.whatsapp_notifications_log(user_id);
create index if not exists idx_wa_log_created_at on public.whatsapp_notifications_log(created_at desc);

-- 6. Row Level Security Policies
alter table public.daily_challenges enable row level security;
alter table public.daily_challenge_submissions enable row level security;
alter table public.whatsapp_notifications_log enable row level security;

-- Challenges Policies
drop policy if exists "Authenticated users can read daily challenges" on public.daily_challenges;
create policy "Authenticated users can read daily challenges"
  on public.daily_challenges for select
  to authenticated
  using (true);

drop policy if exists "Mentors and Admins can manage daily challenges" on public.daily_challenges;
create policy "Mentors and Admins can manage daily challenges"
  on public.daily_challenges for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'mentor')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'mentor')
    )
  );

-- Submissions Policies
drop policy if exists "Students can view and manage their own challenge submissions" on public.daily_challenge_submissions;
create policy "Students can view and manage their own challenge submissions"
  on public.daily_challenge_submissions for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Mentors and Admins can view and grade all challenge submissions" on public.daily_challenge_submissions;
create policy "Mentors and Admins can view and grade all challenge submissions"
  on public.daily_challenge_submissions for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'mentor')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'mentor')
    )
  );

-- WhatsApp Log Policies
drop policy if exists "Users can view their own WhatsApp message logs" on public.whatsapp_notifications_log;
create policy "Users can view their own WhatsApp message logs"
  on public.whatsapp_notifications_log for select
  to authenticated
  using (
    user_id = auth.uid() or
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'mentor')
    )
  );

drop policy if exists "System and Admins can record WhatsApp messages" on public.whatsapp_notifications_log;
create policy "System and Admins can record WhatsApp messages"
  on public.whatsapp_notifications_log for insert
  to authenticated
  with check (true);

