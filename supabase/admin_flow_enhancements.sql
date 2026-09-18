-- supabase/admin_flow_enhancements.sql
-- Migration Script: Comprehensive Admin Flow & Governance Suite
--
-- Enables:
-- 1. Audit logs table (public.audit_logs) for sensitive admin actions
-- 2. Cohort capacity, visibility, and enrollment dates
-- 3. Course and lesson publishing states (draft, published, archived)
-- 4. Enrollment waitlist status support
-- 5. Granular admin permissions (admin_role on profiles)

-- ==============================================================================
-- 1. Audit Logs Table & RLS Policies
-- ==============================================================================
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_action on public.audit_logs(action);
create index if not exists idx_audit_logs_entity on public.audit_logs(entity_type, entity_id);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);

alter table public.audit_logs enable row level security;

drop policy if exists "Admins can view audit logs" on public.audit_logs;
create policy "Admins can view audit logs"
  on public.audit_logs for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins and system can insert audit logs" on public.audit_logs;
create policy "Admins and system can insert audit logs"
  on public.audit_logs for insert
  to authenticated
  with check (public.is_admin());

-- ==============================================================================
-- 2. Cohort Settings: Status, Capacity, Visibility, and Enrollment Dates
-- ==============================================================================
alter table public.cohorts
  add column if not exists status text not null default 'published',
  add column if not exists capacity integer not null default 30,
  add column if not exists visibility text not null default 'public',
  add column if not exists enrollment_start timestamptz,
  add column if not exists enrollment_end timestamptz;

alter table public.cohorts drop constraint if exists cohorts_status_check;
alter table public.cohorts add constraint cohorts_status_check
  check (status in ('draft', 'published', 'archived'));

alter table public.cohorts drop constraint if exists cohorts_visibility_check;
alter table public.cohorts add constraint cohorts_visibility_check
  check (visibility in ('public', 'private', 'unlisted'));

-- ==============================================================================
-- 3. Lesson Publishing States
-- ==============================================================================
alter table public.lessons
  add column if not exists status text not null default 'published';

alter table public.lessons drop constraint if exists lessons_status_check;
alter table public.lessons add constraint lessons_status_check
  check (status in ('draft', 'published', 'archived'));

create index if not exists idx_lessons_status on public.lessons(status);

-- ==============================================================================
-- 4. Enrollment Waitlist Support
-- ==============================================================================
alter table public.enrollments drop constraint if exists enrollments_status_check;
alter table public.enrollments add constraint enrollments_status_check
  check (status in ('active', 'completed', 'dropped', 'waitlisted'));

-- ==============================================================================
-- 5. Granular Administrative Sub-Roles
-- ==============================================================================
alter table public.profiles
  add column if not exists admin_role text default 'super_admin';

alter table public.profiles drop constraint if exists profiles_admin_role_check;
alter table public.profiles add constraint profiles_admin_role_check
  check (admin_role in ('super_admin', 'content_admin', 'operations_admin', 'moderator'));

