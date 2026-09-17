-- 01_core_tables.sql
-- Idempotent schema definitions, foreign keys, indexes, and constraints for all core tables.

-- 1. Profiles (linked to auth.users)
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

-- 2. Cohorts
create table if not exists public.cohorts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cohorts_title on public.cohorts(title);

-- 3. Modules
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

-- 4. Lessons
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

-- 5. Lesson Resources
create table if not exists public.lesson_resources (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  name text not null,
  url text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_lesson_resources_lesson_id on public.lesson_resources(lesson_id);

-- 6. Enrollments (Compound Primary Key prevents duplicate enrollments per user & cohort)
create table if not exists public.enrollments (
  user_id uuid not null references auth.users(id) on delete cascade,
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'completed', 'dropped')),
  created_at timestamptz not null default now(),
  primary key (user_id, cohort_id)
);

create index if not exists idx_enrollments_user_status on public.enrollments(user_id, status);
create index if not exists idx_enrollments_cohort_id on public.enrollments(cohort_id);

-- 7. Lesson Progress
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

-- 8. Assignments
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  title text not null,
  instructions text,
  deadline timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_assignments_lesson_id on public.assignments(lesson_id);

-- 9. Submissions
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

-- 10. Feedback
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  mentor_id uuid not null references auth.users(id) on delete cascade,
  comments text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_feedback_submission_id on public.feedback(submission_id);
create index if not exists idx_feedback_mentor_id on public.feedback(mentor_id);

-- 11. Announcements
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

-- 12. Live Sessions
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

-- 13. Community Posts
create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_community_posts_author_id on public.community_posts(author_id);

-- 14. Community Comments
create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_community_comments_post_id on public.community_comments(post_id);

-- 15. Notifications
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

