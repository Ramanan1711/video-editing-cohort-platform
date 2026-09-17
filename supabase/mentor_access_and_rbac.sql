-- supabase/mentor_access_and_rbac.sql
-- Production Security & RBAC: Secure Registration & Mentor Promotion Flow
--
-- Flow:
-- 1. Public registration defaults strictly to 'student' role.
-- 2. Admins review users and promote trusted editors to 'mentor'.
-- 3. Mentors have access to review student submissions and leave feedback.
-- 4. Atomic PostgreSQL RPC (review_submission) ensures transaction safety and prevents ID spoofing.

-- ==============================================================================
-- 1. Role Helper Functions (Security Definer to avoid RLS recursion)
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
    where id = auth.uid() and role = 'admin'
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
    where id = auth.uid() and role in ('mentor', 'admin')
  );
$$;

-- ==============================================================================
-- 2. Profiles Table: RLS, Backfill & Policies
-- ==============================================================================
alter table public.profiles enable row level security;

-- Backfill any existing auth users who do not have a public.profiles row yet
insert into public.profiles (id, full_name, email, role, created_at, updated_at)
select
  u.id,
  coalesce(nullif(trim(u.raw_user_meta_data->>'full_name'), ''), split_part(u.email, '@', 1), 'Editor'),
  coalesce(u.email, ''),
  'student',
  now(),
  now()
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- Authenticated users can read all profiles (needed for names, authors, and admin user list)
drop policy if exists "Authenticated users can read profiles" on public.profiles;
create policy "Authenticated users can read profiles"
  on public.profiles for select
  to authenticated
  using (true);

-- Authenticated users can insert their own initial profile if missing
drop policy if exists "Users can insert own initial profile" on public.profiles;
create policy "Users can insert own initial profile"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

-- Only admins can update user profiles (including promoting/demoting roles)
drop policy if exists "Admins can update user profiles" on public.profiles;
create policy "Admins can update user profiles"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Users can update their own profile name
drop policy if exists "Users can update own display name" on public.profiles;
create policy "Users can update own display name"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ==============================================================================
-- 3. Trigger: Enforce that all new public signups default strictly to 'student'
-- ==============================================================================
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

-- ==============================================================================
-- 4. Submissions Table: Constraints & RLS
-- ==============================================================================
alter table public.submissions enable row level security;

-- Ensure updated_at timestamp exists on submissions
alter table public.submissions
  add column if not exists updated_at timestamptz not null default now();

-- Ensure status check constraint allows 'reviewed' and 'resubmit'
alter table public.submissions drop constraint if exists submissions_status_check;
alter table public.submissions add constraint submissions_status_check
  check (status in ('pending', 'reviewed', 'resubmit'));

drop policy if exists "Students can read own submissions and staff can read all" on public.submissions;
create policy "Students can read own submissions and staff can read all"
  on public.submissions for select
  to authenticated
  using (
    student_id = auth.uid()
    or public.is_mentor_or_admin()
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
    or public.is_mentor_or_admin()
  )
  with check (
    student_id = auth.uid()
    or public.is_mentor_or_admin()
  );

-- ==============================================================================
-- 5. Feedback Table: Table Creation, Indexing & RLS
-- ==============================================================================
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  mentor_id uuid not null references auth.users(id) on delete cascade,
  comments text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_feedback_submission_id on public.feedback(submission_id);
create index if not exists idx_feedback_mentor_id on public.feedback(mentor_id);

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
    or public.is_mentor_or_admin()
  );

drop policy if exists "Mentors and admins can insert feedback" on public.feedback;
create policy "Mentors and admins can insert feedback"
  on public.feedback for insert
  to authenticated
  with check (
    public.is_mentor_or_admin()
  );

-- ==============================================================================
-- 6. Atomic Review RPC Function (Recommended Production Option 2)
-- ==============================================================================
create or replace function public.review_submission(
  p_submission_id uuid,
  p_status text,
  p_comments text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'You must be logged in';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = v_user_id
      and role in ('mentor', 'admin')
  ) then
    raise exception 'Only mentors or admins can review submissions';
  end if;

  if p_status not in ('reviewed', 'resubmit') then
    raise exception 'Invalid review status';
  end if;

  if not exists (
    select 1
    from public.submissions
    where id = p_submission_id
  ) then
    raise exception 'Submission not found';
  end if;

  if trim(coalesce(p_comments, '')) <> '' then
    insert into public.feedback (
      submission_id,
      mentor_id,
      comments
    )
    values (
      p_submission_id,
      v_user_id,
      trim(p_comments)
    );
  end if;

  update public.submissions
  set status = p_status
  where id = p_submission_id;
end;
$$;

grant execute
on function public.review_submission(uuid, text, text)
to authenticated;

-- ==============================================================================
-- 7. Storage policies for submissions bucket
-- ==============================================================================
drop policy if exists "Staff can view submissions" on storage.objects;
create policy "Staff can view submissions"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'submissions'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_mentor_or_admin()
    )
  );

-- ==============================================================================
-- 8. Verification & Promotion Helpers
-- ==============================================================================
-- To promote an existing user to Mentor:
-- UPDATE public.profiles SET role = 'mentor', updated_at = now() WHERE email = 'mentor_email@example.com';
--
-- To promote an existing user to Admin:
-- UPDATE public.profiles SET role = 'admin', updated_at = now() WHERE email = 'admin_email@example.com';
--
-- To verify all user roles:
-- SELECT id, email, full_name, role FROM public.profiles ORDER BY role, email;
