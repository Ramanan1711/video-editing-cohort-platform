-- supabase/security_and_storage_hardening.sql
-- Hardening migration for:
-- 1. Storage bucket privacy & strict access policies for student submissions
-- 2. Strict status verification (enforcing 'active' and rejecting 'suspended'/'inactive' accounts)
-- 3. Hardening RLS policies across submissions, feedback, community, and storage
-- 4. Enabling Supabase Realtime publication for notifications and community interactions

-- ==============================================================================
-- 1. Storage Bucket Privacy: Switch submissions to private
-- ==============================================================================
update storage.buckets
set public = false
where id = 'submissions';

insert into storage.buckets (id, name, public)
values ('submissions', 'submissions', false)
on conflict (id) do update set public = false;

-- Drop permissive open read policy
drop policy if exists "Authenticated users can read submissions" on storage.objects;
drop policy if exists "Anyone can read submissions" on storage.objects;
drop policy if exists "Students can upload their submissions" on storage.objects;
drop policy if exists "Students can update their submissions" on storage.objects;
drop policy if exists "Users or admins can delete submissions" on storage.objects;

-- 1.1 Upload policy: Authenticated, non-suspended students can only upload to their own folder
create policy "Students can upload their submissions"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'submissions'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and coalesce(p.status, 'active') = 'active'
  )
);

-- 1.2 Update policy: Authenticated, non-suspended students can only update files in their own folder
create policy "Students can update their submissions"
on storage.objects for update to authenticated
using (
  bucket_id = 'submissions'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and coalesce(p.status, 'active') = 'active'
  )
);

-- 1.3 Delete policy: Active students can delete their own files, or active admins can delete
create policy "Users or admins can delete submissions"
on storage.objects for delete to authenticated
using (
  bucket_id = 'submissions'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and coalesce(p.status, 'active') = 'active'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or p.role = 'admin'
    )
  )
);

-- 1.4 Strict Read / Select policy:
-- Allows:
--  a) The student who uploaded the file (folder name matches auth.uid())
--  b) Active platform administrators
--  c) Active mentors assigned to the student's cohort (or any active mentor if unassigned)
drop policy if exists "Strict submission access control" on storage.objects;
create policy "Strict submission access control"
on storage.objects for select to authenticated
using (
  bucket_id = 'submissions'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and coalesce(p.status, 'active') = 'active'
    and (
      -- Student accessing their own folder
      (storage.foldername(name))[1] = auth.uid()::text
      -- Or platform admin
      or p.role = 'admin'
      -- Or assigned cohort mentor
      or (
        p.role = 'mentor'
        and (
          exists (
            select 1
            from public.enrollments e
            join public.mentor_cohorts mc on mc.cohort_id = e.cohort_id
            where e.user_id = ((storage.foldername(name))[1])::uuid
            and mc.mentor_id = auth.uid()
          )
          -- Fallback if mentor_cohorts table is empty/unconfigured: allow active mentor
          or not exists (select 1 from public.mentor_cohorts where mentor_id = auth.uid())
        )
      )
    )
  )
);

-- ==============================================================================
-- 2. Hardening Security Functions: Require Non-Suspended Active Status
-- ==============================================================================
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
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
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role in ('mentor', 'admin')
    and coalesce(status, 'active') = 'active'
  );
$$;

-- Helper to check if current caller is an active non-suspended user
create or replace function public.is_active_user()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
    and coalesce(status, 'active') = 'active'
  );
$$;

-- ==============================================================================
-- 3. Hardening Table RLS Policies to Block Suspended Users
-- ==============================================================================

-- 3.1 Submissions table
drop policy if exists "Mentors and Admins can view all submissions" on public.submissions;
drop policy if exists "Students can insert own submissions" on public.submissions;
drop policy if exists "Students can update own submissions" on public.submissions;
drop policy if exists "Users can view submissions" on public.submissions;

create policy "Users can view submissions"
on public.submissions for select to authenticated
using (
  (student_id = auth.uid() and public.is_active_user())
  or public.is_mentor_or_admin()
);

create policy "Students can insert own submissions"
on public.submissions for insert to authenticated
with check (
  student_id = auth.uid()
  and public.is_active_user()
);

create policy "Students can update own submissions"
on public.submissions for update to authenticated
using (
  (student_id = auth.uid() and public.is_active_user())
  or public.is_mentor_or_admin()
)
with check (
  (student_id = auth.uid() and public.is_active_user())
  or public.is_mentor_or_admin()
);

-- 3.2 Feedback table
alter table public.feedback enable row level security;
drop policy if exists "Mentors and Admins can manage feedback" on public.feedback;
drop policy if exists "Students can view feedback for own submissions" on public.feedback;

create policy "Students can view feedback for own submissions"
on public.feedback for select to authenticated
using (
  public.is_mentor_or_admin()
  or (
    public.is_active_user()
    and exists (
      select 1 from public.submissions s
      where s.id = feedback.submission_id
      and s.student_id = auth.uid()
    )
  )
);

create policy "Mentors and Admins can manage feedback"
on public.feedback for all to authenticated
using (public.is_mentor_or_admin())
with check (public.is_mentor_or_admin());

-- 3.3 Community Posts & Comments (Block suspended users from posting or reading)
alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;

drop policy if exists "Active users can view posts" on public.community_posts;
create policy "Active users can view posts"
on public.community_posts for select to authenticated
using (public.is_active_user() and moderation_status != 'hidden');

drop policy if exists "Active users can insert posts" on public.community_posts;
create policy "Active users can insert posts"
on public.community_posts for insert to authenticated
with check (
  author_id = auth.uid()
  and public.is_active_user()
);

drop policy if exists "Active users can view comments" on public.community_comments;
create policy "Active users can view comments"
on public.community_comments for select to authenticated
using (public.is_active_user());

drop policy if exists "Active users can insert comments" on public.community_comments;
create policy "Active users can insert comments"
on public.community_comments for insert to authenticated
with check (
  author_id = auth.uid()
  and public.is_active_user()
);

-- 3.4 Lesson Progress (Block suspended users from logging progress)
alter table public.lesson_progress enable row level security;
drop policy if exists "Active students can manage own progress" on public.lesson_progress;
create policy "Active students can manage own progress"
on public.lesson_progress for all to authenticated
using (user_id = auth.uid() and public.is_active_user())
with check (user_id = auth.uid() and public.is_active_user());

-- ==============================================================================
-- 4. Enable Supabase Realtime Publication for Notifications & Community
-- ==============================================================================
do $$
begin
  -- Ensure tables have full replica identity for realtime streaming
  execute 'alter table if exists public.notifications replica identity full';
  execute 'alter table if exists public.community_posts replica identity full';
  execute 'alter table if exists public.community_comments replica identity full';
  execute 'alter table if exists public.community_reactions replica identity full';

  -- Add to supabase_realtime publication if not already included
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      execute 'alter publication supabase_realtime add table public.notifications';
    exception when duplicate_object then null;
    end;
    begin
      execute 'alter publication supabase_realtime add table public.community_posts';
    exception when duplicate_object then null;
    end;
    begin
      execute 'alter publication supabase_realtime add table public.community_comments';
    exception when duplicate_object then null;
    end;
    begin
      execute 'alter publication supabase_realtime add table public.community_reactions';
    exception when duplicate_object then null;
    end;
  end if;
end;
$$;

