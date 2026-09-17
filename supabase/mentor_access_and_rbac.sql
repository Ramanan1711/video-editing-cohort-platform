-- supabase/mentor_access_and_rbac.sql
-- Production Security & RBAC: Secure Registration & Mentor Promotion Flow
--
-- Flow:
-- 1. Public registration defaults strictly to 'student' role.
-- 2. Admins review users and promote trusted editors to 'mentor'.
-- 3. Mentors have access to review student submissions and leave feedback.

-- 1. Ensure profiles table has proper constraints and RLS
alter table public.profiles enable row level security;

-- Authenticated users can read all profiles (needed for names, authors, and admin user list)
drop policy if exists "Authenticated users can read profiles" on public.profiles;
create policy "Authenticated users can read profiles"
  on public.profiles for select
  to authenticated
  using (true);

-- Only admins can update user profiles (including promoting/demoting roles)
-- Users can only update their own full_name, but NEVER elevate their own role
drop policy if exists "Admins can update user profiles" on public.profiles;
create policy "Admins can update user profiles"
  on public.profiles for update
  to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- 2. Trigger: Enforce that all new public signups default strictly to 'student'
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text;
begin
  -- Default full name from metadata or email username
  v_full_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    split_part(new.email, '@', 1),
    'Editor'
  );

  -- Production security: Ignore client-supplied 'role' in raw_user_meta_data.
  -- All public registrations MUST start as 'student'.
  -- Only existing administrators can promote a profile to 'mentor' or 'admin'.
  insert into public.profiles (id, full_name, email, role, created_at, updated_at)
  values (
    new.id,
    v_full_name,
    coalesce(new.email, ''),
    'student',
    now(),
    now()
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. Submissions Table RLS: Allow mentors & admins to read all and update review status
alter table public.submissions enable row level security;

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

drop policy if exists "Students and staff can update submissions" on public.submissions;
create policy "Students and staff can update submissions"
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

-- 4. Feedback Table RLS: Allow mentors & admins to create feedback and students to read their feedback
alter table public.feedback enable row level security;

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

drop policy if exists "Mentors and admins can insert feedback" on public.feedback;
create policy "Mentors and admins can insert feedback"
  on public.feedback for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('mentor', 'admin')
    )
  );

-- 5. Storage policies for submissions bucket
drop policy if exists "Staff can view submissions" on storage.objects;
create policy "Staff can view submissions"
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

