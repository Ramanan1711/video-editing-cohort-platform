-- ==============================================================================
-- Migration: 20261026000003_mentor_cohort_review_and_approval_flow.sql
-- Description:
-- Mentor-created cohorts with Admin review & approval flow:
--   1. Adds created_by, review_feedback, reviewed_by, reviewed_at to public.cohorts.
--   2. Expands cohorts_status_check to support:
--      'draft', 'reviewing', 'review', 'approved', 'rejected', 'published', 'archived', 'upcoming', 'active', 'completed'.
--   3. Adds RLS policies for mentors to create draft cohorts and update approved cohorts.
--   4. RPCs: public.mentor_create_cohort, public.admin_review_cohort, public.mentor_publish_cohort.
-- ==============================================================================

-- 1. Add review & attribution columns to public.cohorts
alter table public.cohorts add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.cohorts add column if not exists review_feedback text;
alter table public.cohorts add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;
alter table public.cohorts add column if not exists reviewed_at timestamptz;

-- 2. Update status check constraint on public.cohorts
alter table public.cohorts drop constraint if exists cohorts_status_check;
alter table public.cohorts add constraint cohorts_status_check
  check (status in ('draft', 'reviewing', 'review', 'approved', 'rejected', 'published', 'archived', 'upcoming', 'active', 'completed'));

-- 3. RLS Policies
drop policy if exists "Mentors can read own created or assigned cohorts" on public.cohorts;
create policy "Mentors can read own created or assigned cohorts"
  on public.cohorts for select
  to authenticated
  using (
    created_by = auth.uid()
    or id in (select cohort_id from public.mentor_cohorts where mentor_id = auth.uid())
  );

drop policy if exists "Mentors can insert draft cohorts" on public.cohorts;
create policy "Mentors can insert draft cohorts"
  on public.cohorts for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('mentor', 'admin') and coalesce(status, 'active') = 'active'
    )
    and status in ('draft', 'reviewing')
  );

drop policy if exists "Mentors can update own draft or approved cohorts" on public.cohorts;
create policy "Mentors can update own draft or approved cohorts"
  on public.cohorts for update
  to authenticated
  using (created_by = auth.uid())
  with check (
    created_by = auth.uid()
  );

-- 4. RPC public.mentor_create_cohort
create or replace function public.mentor_create_cohort(
  p_name text,
  p_description text default null,
  p_duration_days int default 15,
  p_price_inr int default 4999,
  p_track_type text default 'general'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_profile record;
  v_new_cohort record;
begin
  select id, role, status into v_caller_profile
  from public.profiles
  where id = auth.uid();

  if not found or coalesce(v_caller_profile.status, 'active') != 'active' or v_caller_profile.role not in ('mentor', 'admin') then
    raise exception 'Unauthorized: Only mentors or administrators can create cohorts.'
      using errcode = '42501';
  end if;

  insert into public.cohorts (
    name,
    title,
    description,
    duration_days,
    price_inr,
    track_type,
    status,
    visibility,
    created_by,
    created_at,
    updated_at
  ) values (
    p_name,
    p_name,
    p_description,
    coalesce(p_duration_days, 15),
    coalesce(p_price_inr, 4999),
    coalesce(p_track_type, 'general'),
    'draft',
    'public',
    auth.uid(),
    now(),
    now()
  )
  returning * into v_new_cohort;

  -- Auto-map the mentor to the cohort
  insert into public.mentor_cohorts (mentor_id, cohort_id, created_at, assigned_at)
  values (auth.uid(), v_new_cohort.id, now(), now())
  on conflict do nothing;

  -- Log audit
  perform public.log_audit_event(
    'cohort.created_by_mentor',
    'cohort',
    v_new_cohort.id::text,
    jsonb_build_object(
      'name', p_name,
      'status', 'draft',
      'created_by', auth.uid()
    )
  );

  return to_jsonb(v_new_cohort);
end;
$$;

-- 5. RPC public.admin_review_cohort
create or replace function public.admin_review_cohort(
  p_cohort_id uuid,
  p_decision text,
  p_feedback text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_profile record;
  v_updated record;
begin
  -- Caller must be admin (parent_super_admin or child_super_admin)
  select id, role, admin_role, status into v_caller_profile
  from public.profiles
  where id = auth.uid();

  if not found or coalesce(v_caller_profile.status, 'active') != 'active' or v_caller_profile.role != 'admin' then
    raise exception 'Unauthorized: Only Parent Super Admin or Child Super Admin can review cohorts.'
      using errcode = '42501';
  end if;

  if p_decision not in ('reviewing', 'approved', 'rejected') then
    raise exception 'Invalid decision: % must be reviewing, approved, or rejected.', p_decision
      using errcode = '22000';
  end if;

  update public.cohorts
  set
    status = p_decision,
    review_feedback = p_feedback,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now()
  where id = p_cohort_id
  returning * into v_updated;

  if not found then
    raise exception 'Cohort % not found.', p_cohort_id
      using errcode = 'P0002';
  end if;

  -- Audit log
  perform public.log_audit_event(
    'cohort.reviewed',
    'cohort',
    p_cohort_id::text,
    jsonb_build_object(
      'decision', p_decision,
      'feedback', p_feedback,
      'reviewed_by', v_caller_profile.id
    )
  );

  return to_jsonb(v_updated);
end;
$$;

-- 6. RPC public.mentor_publish_cohort
create or replace function public.mentor_publish_cohort(
  p_cohort_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_profile record;
  v_cohort record;
  v_updated record;
begin
  select id, role, admin_role, status into v_caller_profile
  from public.profiles
  where id = auth.uid();

  if not found or coalesce(v_caller_profile.status, 'active') != 'active' then
    raise exception 'Unauthorized.'
      using errcode = '42501';
  end if;

  select * into v_cohort
  from public.cohorts
  where id = p_cohort_id;

  if not found then
    raise exception 'Cohort % not found.', p_cohort_id
      using errcode = 'P0002';
  end if;

  -- Permission: Caller must be creator mentor or an admin
  if v_cohort.created_by != auth.uid() and v_caller_profile.role != 'admin' then
    raise exception 'Unauthorized: Only the cohort creator mentor or an administrator can publish this cohort.'
      using errcode = '42501';
  end if;

  -- Approval gate: Status MUST be 'approved' (admins can bypass if necessary)
  if v_cohort.status != 'approved' and v_caller_profile.role != 'admin' then
    raise exception 'Cannot publish cohort: Cohort must be approved by an administrator before publishing (current status: %).', v_cohort.status
      using errcode = 'P0001';
  end if;

  update public.cohorts
  set
    status = 'published',
    updated_at = now()
  where id = p_cohort_id
  returning * into v_updated;

  -- Audit log
  perform public.log_audit_event(
    'cohort.published',
    'cohort',
    p_cohort_id::text,
    jsonb_build_object(
      'status', 'published',
      'published_by', auth.uid()
    )
  );

  return to_jsonb(v_updated);
end;
$$;

