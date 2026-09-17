-- 04_rls_policies.sql
-- Complete Row Level Security (RLS) policies for students, mentors, and admins across all core tables.

-- Enable RLS across all tables
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

-- Helper role protection trigger
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

-- ----------------------------------------------------
-- 1. PROFILES
-- ----------------------------------------------------
drop policy if exists "Profiles are readable by authenticated users" on public.profiles;
create policy "Profiles are readable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (auth.uid() = id or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "Admins can delete profiles" on public.profiles;
create policy "Admins can delete profiles"
  on public.profiles for delete
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ----------------------------------------------------
-- 2. COHORTS
-- ----------------------------------------------------
drop policy if exists "Cohorts readable by authenticated users" on public.cohorts;
create policy "Cohorts readable by authenticated users"
  on public.cohorts for select
  to authenticated
  using (true);

drop policy if exists "Admins can manage cohorts" on public.cohorts;
create policy "Admins can manage cohorts"
  on public.cohorts for all
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ----------------------------------------------------
-- 3. MODULES
-- ----------------------------------------------------
drop policy if exists "Modules readable by enrolled students, mentors and admins" on public.modules;
create policy "Modules readable by enrolled students, mentors and admins"
  on public.modules for select
  to authenticated
  using (
    exists (
      select 1 from public.enrollments e
      where e.cohort_id = modules.cohort_id
        and e.user_id = auth.uid()
        and e.status = 'active'
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('mentor', 'admin')
    )
  );

drop policy if exists "Admins can manage modules" on public.modules;
create policy "Admins can manage modules"
  on public.modules for all
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ----------------------------------------------------
-- 4. LESSONS
-- ----------------------------------------------------
drop policy if exists "Lessons readable by enrolled students, mentors and admins" on public.lessons;
create policy "Lessons readable by enrolled students, mentors and admins"
  on public.lessons for select
  to authenticated
  using (
    exists (
      select 1 from public.modules m
      join public.enrollments e on e.cohort_id = m.cohort_id
      where m.id = lessons.module_id
        and e.user_id = auth.uid()
        and e.status = 'active'
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('mentor', 'admin')
    )
  );

drop policy if exists "Admins can manage lessons" on public.lessons;
create policy "Admins can manage lessons"
  on public.lessons for all
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ----------------------------------------------------
-- 5. LESSON RESOURCES
-- ----------------------------------------------------
drop policy if exists "Enrolled students can read lesson resources" on public.lesson_resources;
drop policy if exists "Lesson resources readable by enrolled students, mentors and admins" on public.lesson_resources;
create policy "Lesson resources readable by enrolled students, mentors and admins"
  on public.lesson_resources for select
  to authenticated
  using (
    exists (
      select 1 from public.lessons l
      join public.modules m on m.id = l.module_id
      join public.enrollments e on e.cohort_id = m.cohort_id
      where l.id = lesson_resources.lesson_id
        and e.user_id = auth.uid()
        and e.status = 'active'
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('mentor', 'admin')
    )
  );

drop policy if exists "Admins can manage lesson resources" on public.lesson_resources;
create policy "Admins can manage lesson resources"
  on public.lesson_resources for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ----------------------------------------------------
-- 6. ENROLLMENTS
-- ----------------------------------------------------
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
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "Users can update own enrollment or admin manage" on public.enrollments;
create policy "Users can update own enrollment or admin manage"
  on public.enrollments for update
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "Admins or owners can delete enrollments" on public.enrollments;
create policy "Admins or owners can delete enrollments"
  on public.enrollments for delete
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ----------------------------------------------------
-- 7. LESSON PROGRESS
-- ----------------------------------------------------
drop policy if exists "Users can read own progress and staff can read all" on public.lesson_progress;
create policy "Users can read own progress and staff can read all"
  on public.lesson_progress for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('mentor', 'admin')
    )
  );

drop policy if exists "Users can insert own progress" on public.lesson_progress;
create policy "Users can insert own progress"
  on public.lesson_progress for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update own progress" on public.lesson_progress;
create policy "Users can update own progress"
  on public.lesson_progress for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete own progress" on public.lesson_progress;
create policy "Users can delete own progress"
  on public.lesson_progress for delete
  to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ----------------------------------------------------
-- 8. ASSIGNMENTS
-- ----------------------------------------------------
drop policy if exists "Assignments readable by enrolled students, mentors and admins" on public.assignments;
create policy "Assignments readable by enrolled students, mentors and admins"
  on public.assignments for select
  to authenticated
  using (
    exists (
      select 1 from public.lessons l
      join public.modules m on m.id = l.module_id
      join public.enrollments e on e.cohort_id = m.cohort_id
      where l.id = assignments.lesson_id
        and e.user_id = auth.uid()
        and e.status = 'active'
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('mentor', 'admin')
    )
  );

drop policy if exists "Admins can manage assignments" on public.assignments;
create policy "Admins can manage assignments"
  on public.assignments for all
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ----------------------------------------------------
-- 9. SUBMISSIONS
-- ----------------------------------------------------
drop policy if exists "Students can read own submissions and staff can read all" on public.submissions;
create policy "Students can read own submissions and staff can read all"
  on public.submissions for select
  to authenticated
  using (
    student_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('mentor', 'admin')
    )
  );

drop policy if exists "Students can create own submissions" on public.submissions;
create policy "Students can create own submissions"
  on public.submissions for insert
  to authenticated
  with check (
    student_id = auth.uid()
  );

drop policy if exists "Mentors and admins can update submission status" on public.submissions;
create policy "Mentors and admins can update submission status"
  on public.submissions for update
  to authenticated
  using (
    student_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('mentor', 'admin')
    )
  )
  with check (
    student_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('mentor', 'admin')
    )
  );

drop policy if exists "Students or admins can delete submissions" on public.submissions;
create policy "Students or admins can delete submissions"
  on public.submissions for delete
  to authenticated
  using (
    student_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ----------------------------------------------------
-- 10. FEEDBACK
-- ----------------------------------------------------
drop policy if exists "Feedback readable by submission owner, mentors, and admins" on public.feedback;
create policy "Feedback readable by submission owner, mentors, and admins"
  on public.feedback for select
  to authenticated
  using (
    exists (
      select 1 from public.submissions s
      where s.id = feedback.submission_id
        and s.student_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('mentor', 'admin')
    )
  );

drop policy if exists "Mentors and admins can manage feedback" on public.feedback;
create policy "Mentors and admins can manage feedback"
  on public.feedback for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('mentor', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('mentor', 'admin')
    )
  );

-- ----------------------------------------------------
-- 11. ANNOUNCEMENTS
-- ----------------------------------------------------
drop policy if exists "Authenticated users can read announcements" on public.announcements;
create policy "Authenticated users can read announcements"
  on public.announcements for select
  to authenticated
  using (published or author_id = auth.uid() or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "Admins can manage announcements" on public.announcements;
create policy "Admins can manage announcements"
  on public.announcements for all
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ----------------------------------------------------
-- 12. LIVE SESSIONS
-- ----------------------------------------------------
drop policy if exists "Authenticated users can read sessions" on public.live_sessions;
create policy "Authenticated users can read sessions"
  on public.live_sessions for select
  to authenticated
  using (true);

drop policy if exists "Admins can manage sessions" on public.live_sessions;
create policy "Admins can manage sessions"
  on public.live_sessions for all
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ----------------------------------------------------
-- 13. COMMUNITY POSTS
-- ----------------------------------------------------
drop policy if exists "Authenticated users can read posts" on public.community_posts;
create policy "Authenticated users can read posts"
  on public.community_posts for select
  to authenticated
  using (true);

drop policy if exists "Users can create posts" on public.community_posts;
create policy "Users can create posts"
  on public.community_posts for insert
  to authenticated
  with check (author_id = auth.uid());

drop policy if exists "Authors or admins can update posts" on public.community_posts;
create policy "Authors or admins can update posts"
  on public.community_posts for update
  to authenticated
  using (author_id = auth.uid() or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (author_id = auth.uid() or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "Authors or admins can delete posts" on public.community_posts;
create policy "Authors or admins can delete posts"
  on public.community_posts for delete
  to authenticated
  using (author_id = auth.uid() or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ----------------------------------------------------
-- 14. COMMUNITY COMMENTS
-- ----------------------------------------------------
drop policy if exists "Authenticated users can read comments" on public.community_comments;
create policy "Authenticated users can read comments"
  on public.community_comments for select
  to authenticated
  using (true);

drop policy if exists "Users can create comments" on public.community_comments;
create policy "Users can create comments"
  on public.community_comments for insert
  to authenticated
  with check (author_id = auth.uid());

drop policy if exists "Authors or admins can update comments" on public.community_comments;
create policy "Authors or admins can update comments"
  on public.community_comments for update
  to authenticated
  using (author_id = auth.uid() or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (author_id = auth.uid() or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "Authors or admins can delete comments" on public.community_comments;
create policy "Authors or admins can delete comments"
  on public.community_comments for delete
  to authenticated
  using (author_id = auth.uid() or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ----------------------------------------------------
-- 15. NOTIFICATIONS
-- ----------------------------------------------------
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
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

