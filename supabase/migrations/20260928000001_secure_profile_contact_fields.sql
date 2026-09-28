-- ==============================================================================
-- Migration: 20260928000001_secure_profile_contact_fields.sql
-- Description: Locks down public.profiles table so arbitrary authenticated users
-- cannot scrape private contact fields (email, whatsapp_number, whatsapp_opt_in).
-- Exposes sanitized public_profiles view for community/peer author display.
-- ==============================================================================

-- 1. Ensure mentor_cohorts mapping table exists
create table if not exists public.mentor_cohorts (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.profiles(id) on delete cascade,
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (mentor_id, cohort_id)
);

create index if not exists idx_mentor_cohorts_mentor on public.mentor_cohorts(mentor_id);
create index if not exists idx_mentor_cohorts_cohort on public.mentor_cohorts(cohort_id);
alter table public.mentor_cohorts enable row level security;

-- 2. Authorization Helper Functions (Security Definer to prevent recursive RLS)
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and coalesce(status, 'active') = 'active'
  );
$$;

create or replace function public.is_mentor_for_student(p_student_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.enrollments e
    join public.mentor_cohorts mc on mc.cohort_id = e.cohort_id
    join public.profiles p on p.id = mc.mentor_id
    where e.user_id = p_student_id
      and mc.mentor_id = auth.uid()
      and coalesce(p.status, 'active') = 'active'
  );
$$;

grant execute on function public.is_admin() to authenticated, anon;
grant execute on function public.is_mentor_for_student(uuid) to authenticated, anon;

-- 3. Ensure RLS is active on profiles
alter table public.profiles enable row level security;

-- 4. Drop existing overly permissive policies
drop policy if exists "Authenticated users can read profiles" on public.profiles;
drop policy if exists "Users can read own full profile" on public.profiles;
drop policy if exists "Admins can read all profiles" on public.profiles;
drop policy if exists "Mentors can read cohort student profiles" on public.profiles;

-- 5. Policy: Authenticated users can read their OWN full profile (including contact fields)
create policy "Users can read own full profile"
on public.profiles for select
to authenticated
using (id = auth.uid());

-- 6. Policy: Administrators can read ALL profiles for user management and RBAC operations
create policy "Admins can read all profiles"
on public.profiles for select
to authenticated
using (public.is_admin());

-- 7. Policy: Mentors can read full profiles of students enrolled in cohorts they actively mentor
create policy "Mentors can read cohort student profiles"
on public.profiles for select
to authenticated
using (public.is_mentor_for_student(id));

-- 8. Create Sanitized Public Profile View for Social / Peer Displays
-- Omits: email, whatsapp_number, whatsapp_opt_in, role/status vulnerabilities
create or replace view public.public_profiles with (security_invoker = false) as
select
  id,
  full_name,
  role,
  created_at
from public.profiles
where coalesce(status, 'active') = 'active';

grant select on public.public_profiles to authenticated, anon;

-- 9. Security Definer RPC helper for batch public author resolution
create or replace function public.get_public_profiles(user_ids uuid[])
returns table (
  id uuid,
  full_name text,
  role text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.full_name, p.role, p.created_at
  from public.profiles p
  where p.id = any(user_ids)
  and coalesce(p.status, 'active') = 'active';
$$;

grant execute on function public.get_public_profiles(uuid[]) to authenticated, anon;
