-- ==============================================================================
-- supabase/migrations/20260921000001_core_schema.sql
-- Baseline Database Schema for CUT / CRAFT Video Editing Cohort Platform
-- ==============================================================================

-- 1. Profiles Table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'student' check (role in ('student', 'mentor', 'admin')),
  admin_role text check (admin_role in ('super_admin', 'content_admin', 'operations_admin', 'moderator')),
  status text not null default 'active' check (status in ('active', 'suspended', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- 2. Cohorts Table
create table if not exists public.cohorts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'published' check (status in ('draft', 'review', 'published', 'archived')),
  capacity integer not null default 30,
  visibility text not null default 'public' check (visibility in ('public', 'private', 'unlisted')),
  enrollment_start timestamptz,
  enrollment_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cohorts enable row level security;

-- 3. Enrollments Table
create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'enrolled' check (status in ('enrolled', 'waitlist', 'completed', 'dropped')),
  enrolled_at timestamptz not null default now(),
  unique (cohort_id, user_id)
);

alter table public.enrollments enable row level security;

-- 4. Modules Table
create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  title text not null,
  description text,
  position integer not null default 1,
  created_at timestamptz not null default now()
);

alter table public.modules enable row level security;

-- 5. Lessons Table
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  title text not null,
  description text,
  video_url text,
  duration_minutes integer default 0,
  position integer not null default 1,
  status text not null default 'published' check (status in ('draft', 'review', 'published', 'archived')),
  created_at timestamptz not null default now()
);

alter table public.lessons enable row level security;

-- 6. Lesson Progress Table
create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  watch_percentage numeric default 0,
  last_position_seconds numeric default 0,
  unique (user_id, lesson_id)
);

alter table public.lesson_progress enable row level security;

-- 7. Lesson Resources Table
create table if not exists public.lesson_resources (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  title text not null,
  file_url text not null,
  file_size bigint,
  resource_type text not null default 'other',
  visibility text not null default 'enrolled' check (visibility in ('enrolled', 'public', 'after_completion')),
  created_at timestamptz not null default now()
);

alter table public.lesson_resources enable row level security;

-- 8. Assignments Table
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  module_id uuid references public.modules(id) on delete set null,
  lesson_id uuid references public.lessons(id) on delete set null,
  title text not null,
  description text,
  rubric jsonb default '[]'::jsonb,
  deadline timestamptz,
  created_at timestamptz not null default now()
);

alter table public.assignments enable row level security;

-- 9. Submissions Table
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  file_url text not null,
  status text not null default 'pending' check (status in ('draft', 'pending', 'reviewed', 'resubmit_requested')),
  notes text,
  is_late boolean default false,
  version integer default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);

alter table public.submissions enable row level security;

-- 10. Feedback Table
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  mentor_id uuid not null references public.profiles(id) on delete cascade,
  rating integer check (rating between 1 and 5),
  rubric_scores jsonb default '{}'::jsonb,
  comment text not null,
  student_read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

-- 11. Announcements Table
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  cohort_id uuid references public.cohorts(id) on delete cascade,
  title text not null,
  body text not null,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

-- 12. Live Sessions Table
create table if not exists public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid references public.cohorts(id) on delete cascade,
  title text not null,
  description text,
  meeting_url text,
  starts_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.live_sessions enable row level security;

-- 13. Notifications Table
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  category text not null default 'system',
  action_url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

