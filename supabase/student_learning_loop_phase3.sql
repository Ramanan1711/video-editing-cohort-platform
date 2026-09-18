-- supabase/student_learning_loop_phase3.sql
-- Migration script for Phase 3: Student Learning Loop
--
-- Enables:
-- 1. Lesson progress tracking with completed_at timestamps and student self-management
-- 2. Student self-enrollment and multi-cohort discovery
-- 3. Student notification center read/update policies
-- 4. Student access to assignment feedback history
-- 5. Student access to published announcements and live sessions

-- ==============================================================================
-- 1. Lesson Progress Table & Policies
-- ==============================================================================
create table if not exists public.lesson_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed boolean not null default true,
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

-- Ensure completed_at column exists if table was created previously
alter table public.lesson_progress
  add column if not exists completed_at timestamptz not null default now();

create index if not exists idx_lesson_progress_user on public.lesson_progress(user_id);
create index if not exists idx_lesson_progress_completed on public.lesson_progress(user_id, completed);

alter table public.lesson_progress enable row level security;

drop policy if exists "Users can manage own lesson progress" on public.lesson_progress;
create policy "Users can manage own lesson progress"
  on public.lesson_progress for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Staff can view all lesson progress" on public.lesson_progress;
create policy "Staff can view all lesson progress"
  on public.lesson_progress for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('mentor', 'admin')
    )
  );

-- ==============================================================================
-- 2. Enrollments Table & Self-Enrollment Policies
-- ==============================================================================
create table if not exists public.enrollments (
  user_id uuid not null references auth.users(id) on delete cascade,
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'completed', 'dropped')),
  created_at timestamptz not null default now(),
  primary key (user_id, cohort_id)
);

create index if not exists idx_enrollments_user on public.enrollments(user_id);
create index if not exists idx_enrollments_cohort on public.enrollments(cohort_id);

alter table public.enrollments enable row level security;

drop policy if exists "Students can read own enrollments and staff can read all" on public.enrollments;
create policy "Students can read own enrollments and staff can read all"
  on public.enrollments for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('mentor', 'admin')
    )
  );

drop policy if exists "Students can enroll themselves" on public.enrollments;
create policy "Students can enroll themselves"
  on public.enrollments for insert
  to authenticated
  with check (user_id = auth.uid());

-- ==============================================================================
-- 3. Notifications Table & User Update Policy
-- ==============================================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user on public.notifications(user_id, read_at);

alter table public.notifications enable row level security;

drop policy if exists "Users can read own notifications" on public.notifications;
create policy "Users can read own notifications"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Admins can manage notifications" on public.notifications;
create policy "Admins can manage notifications"
  on public.notifications for all
  to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ==============================================================================
-- 4. Feedback Table: Ensure Student Read Access to Feedback on Own Submissions
-- ==============================================================================
alter table public.feedback enable row level security;

drop policy if exists "Students can read feedback on own submissions" on public.feedback;
create policy "Students can read feedback on own submissions"
  on public.feedback for select
  to authenticated
  using (
    exists (
      select 1 from public.submissions s
      where s.id = feedback.submission_id and s.student_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('mentor', 'admin')
    )
  );

-- ==============================================================================
-- 5. Announcements & Live Sessions Read Policies for Students
-- ==============================================================================
alter table public.announcements enable row level security;

drop policy if exists "Authenticated users can read announcements" on public.announcements;
create policy "Authenticated users can read announcements"
  on public.announcements for select
  to authenticated
  using (published = true or author_id = auth.uid());

alter table public.live_sessions enable row level security;

drop policy if exists "Authenticated users can read sessions" on public.live_sessions;
create policy "Authenticated users can read sessions"
  on public.live_sessions for select
  to authenticated
  using (true);

