-- 00_full_schema.sql
-- Master consolidated migration for Cut / Craft platform (Phase 1: Foundation and Security).
-- Idempotent, ordered, and safe to execute repeatedly in Supabase SQL Editor.

-- ============================================================================
-- 1. CORE TABLES, CONSTRAINTS, INDEXES
-- ============================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  role text not null default 'student' check (role in ('student', 'mentor', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_email on public.profiles(email);

create table if not exists public.cohorts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cohorts_title on public.cohorts(title);

create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  title text not null,
  description text,
  position integer not null default 1 check (position >= 1),
  created_at timestamptz not null default now()
);

create index if not exists idx_modules_cohort_id on public.modules(cohort_id);
create index if not exists idx_modules_cohort_position on public.modules(cohort_id, position);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  title text not null,
  description text,
  video_url text,
  duration_minutes integer check (duration_minutes is null or duration_minutes >= 0),
  position integer not null default 1 check (position >= 1),
  created_at timestamptz not null default now()
);

create index if not exists idx_lessons_module_id on public.lessons(module_id);
create index if not exists idx_lessons_module_position on public.lessons(module_id, position);

create table if not exists public.lesson_resources (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  name text not null,
  url text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_lesson_resources_lesson_id on public.lesson_resources(lesson_id);

create table if not exists public.enrollments (
  user_id uuid not null references auth.users(id) on delete cascade,
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'completed', 'dropped')),
  created_at timestamptz not null default now(),
  primary key (user_id, cohort_id)
);

create index if not exists idx_enrollments_user_status on public.enrollments(user_id, status);
create index if not exists idx_enrollments_cohort_id on public.enrollments(cohort_id);

create table if not exists public.lesson_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create index if not exists idx_lesson_progress_user_id on public.lesson_progress(user_id);
create index if not exists idx_lesson_progress_lesson_id on public.lesson_progress(lesson_id);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  title text not null,
  instructions text,
  deadline timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_assignments_lesson_id on public.assignments(lesson_id);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  file_url text not null,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'resubmit')),
  created_at timestamptz not null default now()
);

create index if not exists idx_submissions_assignment_id on public.submissions(assignment_id);
create index if not exists idx_submissions_student_id on public.submissions(student_id);
create index if not exists idx_submissions_status on public.submissions(status);

-- Prevent duplicate pending submissions for the same assignment by the same student
create unique index if not exists unique_pending_submission_per_student_assignment
  on public.submissions (student_id, assignment_id)
  where (status = 'pending');

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  mentor_id uuid not null references auth.users(id) on delete cascade,
  comments text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_feedback_submission_id on public.feedback(submission_id);
create index if not exists idx_feedback_mentor_id on public.feedback(mentor_id);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_announcements_author_id on public.announcements(author_id);
create index if not exists idx_announcements_published on public.announcements(published);

create table if not exists public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  starts_at timestamptz not null,
  meeting_url text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_live_sessions_starts_at on public.live_sessions(starts_at);

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_community_posts_author_id on public.community_posts(author_id);

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_community_comments_post_id on public.community_comments(post_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_user_read on public.notifications(user_id, read_at);

-- ============================================================================
-- 2. PROFILE CREATION TRIGGER
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_full_name text;
begin
  v_role := coalesce(new.raw_user_meta_data->>'role', 'student');
  if v_role not in ('student', 'mentor', 'admin') then
    v_role := 'student';
  end if;

  v_full_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    split_part(new.email, '@', 1),
    'Editor'
  );

  insert into public.profiles (id, full_name, email, role, created_at, updated_at)
  values (
    new.id,
    v_full_name,
    coalesce(new.email, ''),
    v_role,
    now(),
    now()
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
    role = coalesce(public.profiles.role, excluded.role),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- 3. STORAGE CONFIGURATION & BUCKET POLICIES
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('submissions', 'submissions', false)
on conflict (id) do update set public = false;

insert into storage.buckets (id, name, public)
values ('course-assets', 'course-assets', true)
on conflict (id) do update set public = true;

drop policy if exists "Students can upload their submissions" on storage.objects;
create policy "Students can upload their submissions"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'submissions'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Authenticated users can read submissions" on storage.objects;
drop policy if exists "Authorized users can read submissions" on storage.objects;
create policy "Authorized users can read submissions"
on storage.objects for select
to authenticated
using (
  bucket_id = 'submissions'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('mentor', 'admin')
    )
  )
);

drop policy if exists "Users can update their own submissions" on storage.objects;
create policy "Users can update their own submissions"
on storage.objects for update
to authenticated
using (
  bucket_id = 'submissions'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
);

drop policy if exists "Users can delete their own submissions" on storage.objects;
create policy "Users can delete their own submissions"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'submissions'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
);

drop policy if exists "Admins can upload course assets" on storage.objects;
create policy "Admins can upload course assets"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'course-assets'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "Admins can update course assets" on storage.objects;
create policy "Admins can update course assets"
on storage.objects for update
to authenticated
using (
  bucket_id = 'course-assets'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "Admins can delete course assets" on storage.objects;
create policy "Admins can delete course assets"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'course-assets'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "Authenticated users can read course assets" on storage.objects;
create policy "Authenticated users can read course assets"
on storage.objects for select
to authenticated
using (bucket_id = 'course-assets');

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.cohorts enable row level security;
alter table public.modules enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_resources enable row level security;
alter table public.enrollments enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.feedback enable row level security;
alter table public.announcements enable row level security;
alter table public.live_sessions enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.notifications enable row level security;

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role <> old.role then
    if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
      new.role := old.role;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tr_protect_profile_role on public.profiles;
create trigger tr_protect_profile_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- Profiles
drop policy if exists "Profiles are readable by authenticated users" on public.profiles;
create policy "Profiles are readable by authenticated users"
  on public.profiles for select to authenticated using (true);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (auth.uid() = id or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "Admins can delete profiles" on public.profiles;
create policy "Admins can delete profiles"
  on public.profiles for delete to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Cohorts
drop policy if exists "Cohorts readable by authenticated users" on public.cohorts;
create policy "Cohorts readable by authenticated users"
  on public.cohorts for select to authenticated using (true);

drop policy if exists "Admins can manage cohorts" on public.cohorts;
create policy "Admins can manage cohorts"
  on public.cohorts for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Modules
drop policy if exists "Modules readable by enrolled students, mentors and admins" on public.modules;
create policy "Modules readable by enrolled students, mentors and admins"
  on public.modules for select to authenticated
  using (
    exists (
      select 1 from public.enrollments e
      where e.cohort_id = modules.cohort_id and e.user_id = auth.uid() and e.status = 'active'
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('mentor', 'admin'))
  );

drop policy if exists "Admins can manage modules" on public.modules;
create policy "Admins can manage modules"
  on public.modules for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Lessons
drop policy if exists "Lessons readable by enrolled students, mentors and admins" on public.lessons;
create policy "Lessons readable by enrolled students, mentors and admins"
  on public.lessons for select to authenticated
  using (
    exists (
      select 1 from public.modules m
      join public.enrollments e on e.cohort_id = m.cohort_id
      where m.id = lessons.module_id and e.user_id = auth.uid() and e.status = 'active'
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('mentor', 'admin'))
  );

drop policy if exists "Admins can manage lessons" on public.lessons;
create policy "Admins can manage lessons"
  on public.lessons for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Lesson resources
drop policy if exists "Lesson resources readable by enrolled students, mentors and admins" on public.lesson_resources;
create policy "Lesson resources readable by enrolled students, mentors and admins"
  on public.lesson_resources for select to authenticated
  using (
    exists (
      select 1 from public.lessons l
      join public.modules m on m.id = l.module_id
      join public.enrollments e on e.cohort_id = m.cohort_id
      where l.id = lesson_resources.lesson_id and e.user_id = auth.uid() and e.status = 'active'
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('mentor', 'admin'))
  );

drop policy if exists "Admins can manage lesson resources" on public.lesson_resources;
create policy "Admins can manage lesson resources"
  on public.lesson_resources for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Enrollments
drop policy if exists "Students can read own enrollments and staff can read all" on public.enrollments;
create policy "Students can read own enrollments and staff can read all"
  on public.enrollments for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('mentor', 'admin'))
  );

drop policy if exists "Students can enroll themselves" on public.enrollments;
create policy "Students can enroll themselves"
  on public.enrollments for insert to authenticated
  with check (user_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "Users can update own enrollment or admin manage" on public.enrollments;
create policy "Users can update own enrollment or admin manage"
  on public.enrollments for update to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (user_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "Admins or owners can delete enrollments" on public.enrollments;
create policy "Admins or owners can delete enrollments"
  on public.enrollments for delete to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Lesson progress
drop policy if exists "Users can read own progress and staff can read all" on public.lesson_progress;
create policy "Users can read own progress and staff can read all"
  on public.lesson_progress for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('mentor', 'admin'))
  );

drop policy if exists "Users can insert own progress" on public.lesson_progress;
create policy "Users can insert own progress"
  on public.lesson_progress for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update own progress" on public.lesson_progress;
create policy "Users can update own progress"
  on public.lesson_progress for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete own progress" on public.lesson_progress;
create policy "Users can delete own progress"
  on public.lesson_progress for delete to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Assignments
drop policy if exists "Assignments readable by enrolled students, mentors and admins" on public.assignments;
create policy "Assignments readable by enrolled students, mentors and admins"
  on public.assignments for select to authenticated
  using (
    exists (
      select 1 from public.lessons l
      join public.modules m on m.id = l.module_id
      join public.enrollments e on e.cohort_id = m.cohort_id
      where l.id = assignments.lesson_id and e.user_id = auth.uid() and e.status = 'active'
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('mentor', 'admin'))
  );

drop policy if exists "Admins can manage assignments" on public.assignments;
create policy "Admins can manage assignments"
  on public.assignments for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Submissions
drop policy if exists "Students can read own submissions and staff can read all" on public.submissions;
create policy "Students can read own submissions and staff can read all"
  on public.submissions for select to authenticated
  using (
    student_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('mentor', 'admin'))
  );

drop policy if exists "Students can create own submissions" on public.submissions;
create policy "Students can create own submissions"
  on public.submissions for insert to authenticated
  with check (student_id = auth.uid());

drop policy if exists "Mentors and admins can update submission status" on public.submissions;
create policy "Mentors and admins can update submission status"
  on public.submissions for update to authenticated
  using (
    student_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('mentor', 'admin'))
  )
  with check (
    student_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('mentor', 'admin'))
  );

drop policy if exists "Students or admins can delete submissions" on public.submissions;
create policy "Students or admins can delete submissions"
  on public.submissions for delete to authenticated
  using (student_id = auth.uid() or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Feedback
drop policy if exists "Feedback readable by submission owner, mentors, and admins" on public.feedback;
create policy "Feedback readable by submission owner, mentors, and admins"
  on public.feedback for select to authenticated
  using (
    exists (
      select 1 from public.submissions s
      where s.id = feedback.submission_id and s.student_id = auth.uid()
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('mentor', 'admin'))
  );

drop policy if exists "Mentors and admins can manage feedback" on public.feedback;
create policy "Mentors and admins can manage feedback"
  on public.feedback for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('mentor', 'admin')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('mentor', 'admin')));

-- Announcements
drop policy if exists "Authenticated users can read announcements" on public.announcements;
create policy "Authenticated users can read announcements"
  on public.announcements for select to authenticated
  using (published or author_id = auth.uid() or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "Admins can manage announcements" on public.announcements;
create policy "Admins can manage announcements"
  on public.announcements for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Live Sessions
drop policy if exists "Authenticated users can read sessions" on public.live_sessions;
create policy "Authenticated users can read sessions"
  on public.live_sessions for select to authenticated using (true);

drop policy if exists "Admins can manage sessions" on public.live_sessions;
create policy "Admins can manage sessions"
  on public.live_sessions for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Community Posts
drop policy if exists "Authenticated users can read posts" on public.community_posts;
create policy "Authenticated users can read posts"
  on public.community_posts for select to authenticated using (true);

drop policy if exists "Users can create posts" on public.community_posts;
create policy "Users can create posts"
  on public.community_posts for insert to authenticated
  with check (author_id = auth.uid());

drop policy if exists "Authors or admins can update posts" on public.community_posts;
create policy "Authors or admins can update posts"
  on public.community_posts for update to authenticated
  using (author_id = auth.uid() or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (author_id = auth.uid() or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "Authors or admins can delete posts" on public.community_posts;
create policy "Authors or admins can delete posts"
  on public.community_posts for delete to authenticated
  using (author_id = auth.uid() or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Community Comments
drop policy if exists "Authenticated users can read comments" on public.community_comments;
create policy "Authenticated users can read comments"
  on public.community_comments for select to authenticated using (true);

drop policy if exists "Users can create comments" on public.community_comments;
create policy "Users can create comments"
  on public.community_comments for insert to authenticated
  with check (author_id = auth.uid());

drop policy if exists "Authors or admins can update comments" on public.community_comments;
create policy "Authors or admins can update comments"
  on public.community_comments for update to authenticated
  using (author_id = auth.uid() or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (author_id = auth.uid() or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "Authors or admins can delete comments" on public.community_comments;
create policy "Authors or admins can delete comments"
  on public.community_comments for delete to authenticated
  using (author_id = auth.uid() or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Notifications
drop policy if exists "Users can read own notifications" on public.notifications;
create policy "Users can read own notifications"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications"
  on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Admins can manage notifications" on public.notifications;
create policy "Admins can manage notifications"
  on public.notifications for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ============================================================================
-- 5. ATOMIC FUNCTIONS AND RECOVERY RPCs
-- ============================================================================

create or replace function public.review_submission_atomic(
  p_submission_id uuid,
  p_mentor_id uuid,
  p_status text,
  p_feedback text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid := auth.uid();
  v_submission record;
  v_feedback_record record;
  v_clean_feedback text;
begin
  if v_caller_id is null or not exists (
    select 1 from public.profiles
    where id = v_caller_id and role in ('mentor', 'admin')
  ) then
    raise exception 'Unauthorized: Only mentors or admins can review submissions';
  end if;

  if p_status not in ('reviewed', 'resubmit') then
    raise exception 'Invalid review status: %. Allowed values are reviewed or resubmit', p_status;
  end if;

  update public.submissions
  set status = p_status
  where id = p_submission_id
  returning id, assignment_id, student_id, file_url, status, created_at
  into v_submission;

  if not found then
    raise exception 'Submission with ID % not found', p_submission_id;
  end if;

  v_clean_feedback := trim(coalesce(p_feedback, ''));
  if v_clean_feedback <> '' then
    insert into public.feedback (submission_id, mentor_id, comments, created_at)
    values (p_submission_id, coalesce(p_mentor_id, v_caller_id), v_clean_feedback, now())
    returning id, comments, created_at into v_feedback_record;
  end if;

  return jsonb_build_object(
    'id', v_submission.id,
    'assignment_id', v_submission.assignment_id,
    'student_id', v_submission.student_id,
    'file_url', v_submission.file_url,
    'status', v_submission.status,
    'created_at', v_submission.created_at,
    'feedback', nullif(v_clean_feedback, '')
  );
end;
$$;

create or replace function public.ensure_current_user_profile()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile record;
  v_email text;
  v_full_name text;
  v_role text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select id, full_name, email, role into v_profile
  from public.profiles
  where id = v_user_id;

  if found then
    return jsonb_build_object(
      'id', v_profile.id,
      'full_name', v_profile.full_name,
      'email', v_profile.email,
      'role', v_profile.role
    );
  end if;

  select
    email,
    coalesce(
      nullif(trim(raw_user_meta_data->>'full_name'), ''),
      split_part(email, '@', 1),
      'Editor'
    ),
    case
      when raw_user_meta_data->>'role' in ('student', 'mentor') then raw_user_meta_data->>'role'
      else 'student'
    end
  into v_email, v_full_name, v_role
  from auth.users
  where id = v_user_id;

  if not found then
    raise exception 'User record not found in auth.users';
  end if;

  insert into public.profiles (id, full_name, email, role, created_at, updated_at)
  values (v_user_id, v_full_name, coalesce(v_email, ''), v_role, now(), now())
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
    updated_at = now()
  returning id, full_name, email, role into v_profile;

  return jsonb_build_object(
    'id', v_profile.id,
    'full_name', v_profile.full_name,
    'email', v_profile.email,
    'role', v_profile.role
  );
end;
$$;

