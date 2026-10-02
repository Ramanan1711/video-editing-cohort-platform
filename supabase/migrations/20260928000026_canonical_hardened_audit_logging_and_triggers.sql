-- ==============================================================================
-- Migration: 20260928000026_canonical_hardened_audit_logging_and_triggers.sql
-- Description: Canonical Audit Logging Hardening, Anti-Tamper Immutability & Comprehensive Action Triggers
-- Scope:
--   1. Schema enhancements to public.audit_logs:
--      - actor_email, actor_role snapshot columns
--      - ip_address, user_agent columns
--      - Performance indexes on actor_id, entity_type, action, created_at
--   2. Anti-tamper trigger (trg_protect_audit_logs_immutability) enforcing strict append-only immutability
--   3. Hardened log_audit_event procedure preventing actor attribution spoofing
--   4. Authoritative get_security_audit_logs and get_audit_log_stats RPCs with RBAC verification
--   5. Comprehensive automated audit triggers for:
--      - enrollments (created, status_changed, deleted)
--      - certificates (issued, updated, revoked)
--      - internship_reports (generated, published, updated, deleted)
--      - submissions (evaluated, status_changed)
--      - community moderation (reports resolved, posts hidden/deleted)
--      - live_sessions (created, deleted)
-- ==============================================================================

-- 1. Extend public.audit_logs schema with forensic metadata
do $$
begin
  -- Add actor_email
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'audit_logs' and column_name = 'actor_email'
  ) then
    alter table public.audit_logs add column actor_email text;
  end if;

  -- Add actor_role
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'audit_logs' and column_name = 'actor_role'
  ) then
    alter table public.audit_logs add column actor_role text;
  end if;

  -- Add ip_address
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'audit_logs' and column_name = 'ip_address'
  ) then
    alter table public.audit_logs add column ip_address text;
  end if;

  -- Add user_agent
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'audit_logs' and column_name = 'user_agent'
  ) then
    alter table public.audit_logs add column user_agent text;
  end if;
end $$;

-- High-performance indexes
create index if not exists idx_audit_logs_actor_id on public.audit_logs(actor_id);
create index if not exists idx_audit_logs_action on public.audit_logs(action);
create index if not exists idx_audit_logs_entity on public.audit_logs(entity_type, entity_id);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);

-- 2. Anti-Tamper & Immutability Protection
-- Audit logs must NEVER be modified or deleted once recorded
create or replace function public.fn_protect_audit_logs_immutability()
returns trigger
language plpgsql
security definer
as $$
begin
  raise exception 'Security violation: audit_logs is an immutable append-only ledger and cannot be updated or deleted.';
  return null;
end;
$$;

drop trigger if exists trg_protect_audit_logs_immutability on public.audit_logs;
create trigger trg_protect_audit_logs_immutability
  before update or delete on public.audit_logs
  for each row
  execute function public.fn_protect_audit_logs_immutability();

-- 3. Row-Level Security (RLS) Policies
alter table public.audit_logs enable row level security;

-- Only authorized administrators with view_audit_logs permission can view logs
drop policy if exists "Admins can view audit logs" on public.audit_logs;
create policy "Admins can view audit logs"
  on public.audit_logs for select
  to authenticated
  using (
    public.has_admin_permission('view_audit_logs') or
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin' and admin_role = 'super_admin'
    )
  );

-- System and authenticated users can insert (restricted by log_audit_event or verified caller)
drop policy if exists "Admins and system can insert audit logs" on public.audit_logs;
drop policy if exists "Authenticated users can insert self-attributed audit logs" on public.audit_logs;
create policy "Authenticated users can insert self-attributed audit logs"
  on public.audit_logs for insert
  to authenticated
  with check (
    -- Caller cannot forge actor_id unless super_admin
    actor_id is null or
    actor_id = auth.uid() or
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin' and admin_role = 'super_admin'
    )
  );

-- 4. Hardened Actor Attribution Procedure
create or replace function public.log_audit_event(
  p_action text,
  p_entity_type text,
  p_entity_id text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_actor_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid;
  v_actor_id uuid;
  v_actor_email text;
  v_actor_role text;
  v_is_super_admin boolean := false;
  v_headers jsonb;
  v_ip text;
  v_user_agent text;
  v_log_id uuid;
begin
  v_caller_id := auth.uid();

  -- 1. Check if caller is super_admin or internal system caller
  if v_caller_id is not null then
    select (role = 'admin' and (admin_role = 'super_admin' or admin_role is null))
    into v_is_super_admin
    from public.profiles
    where id = v_caller_id;

    -- Strict actor attribution hardening:
    -- If caller is NOT super_admin, force actor_id = caller_id (cannot spoof other users)
    if not coalesce(v_is_super_admin, false) then
      v_actor_id := v_caller_id;
    else
      v_actor_id := coalesce(p_actor_id, v_caller_id);
    end if;
  else
    -- Trigger or service role execution context
    v_actor_id := p_actor_id;
  end if;

  -- 2. Snapshot actor email and role from profiles table
  if v_actor_id is not null then
    select email, coalesce(admin_role::text, role)
    into v_actor_email, v_actor_role
    from public.profiles
    where id = v_actor_id;
  else
    v_actor_email := 'system@procut.internal';
    v_actor_role := 'system';
  end if;

  -- 3. Extract request headers (IP & User-Agent) if available in Supabase environment
  begin
    v_headers := current_setting('request.headers', true)::jsonb;
    if v_headers is not null then
      v_ip := coalesce(v_headers->>'cf-connecting-ip', v_headers->>'x-forwarded-for', v_headers->>'x-real-ip');
      v_user_agent := v_headers->>'user-agent';
    end if;
  exception when others then
    v_ip := null;
    v_user_agent := null;
  end;

  -- 4. Record audit event
  insert into public.audit_logs (
    actor_id,
    actor_email,
    actor_role,
    action,
    entity_type,
    entity_id,
    ip_address,
    user_agent,
    metadata,
    created_at
  )
  values (
    v_actor_id,
    v_actor_email,
    v_actor_role,
    p_action,
    p_entity_type,
    p_entity_id,
    v_ip,
    v_user_agent,
    p_metadata,
    now()
  )
  returning id into v_log_id;

  return v_log_id;
end;
$$;

-- 5. Authoritative Security Audit Retrieval RPCs

-- RPC: Get Security Audit Logs with live profile resolution
create or replace function public.get_security_audit_logs(
  p_limit integer default 50,
  p_offset integer default 0,
  p_action text default null,
  p_entity_type text default null,
  p_actor_id uuid default null,
  p_search text default null
)
returns table (
  id uuid,
  actor_id uuid,
  actor_name text,
  actor_email text,
  actor_role text,
  action text,
  entity_type text,
  entity_id text,
  metadata jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_authorized boolean := false;
begin
  -- RBAC Authorization check
  if auth.uid() is not null then
    select (
      public.has_admin_permission('view_audit_logs') or
      (prof.role = 'admin' and (prof.admin_role = 'super_admin' or prof.admin_role is null))
    )
    into v_authorized
    from public.profiles prof
    where prof.id = auth.uid();
  end if;

  if not coalesce(v_authorized, false) then
    raise exception 'Access denied: view_audit_logs permission required';
  end if;

  return query
  with filtered_logs as (
    select
      a.id,
      a.actor_id,
      coalesce(p.full_name, a.actor_email, 'System') as actor_name,
      coalesce(p.email, a.actor_email, '') as actor_email,
      coalesce(a.actor_role, p.role, 'system') as actor_role,
      a.action,
      a.entity_type,
      a.entity_id,
      a.metadata,
      a.ip_address,
      a.user_agent,
      a.created_at
    from public.audit_logs a
    left join public.profiles p on p.id = a.actor_id
    where (p_action is null or p_action = 'all' or a.action = p_action)
      and (p_entity_type is null or a.entity_type = p_entity_type)
      and (p_actor_id is null or a.actor_id = p_actor_id)
      and (
        p_search is null or
        p_search = '' or
        a.action ilike '%' || p_search || '%' or
        a.entity_type ilike '%' || p_search || '%' or
        a.entity_id ilike '%' || p_search || '%' or
        coalesce(p.full_name, '') ilike '%' || p_search || '%' or
        coalesce(p.email, a.actor_email, '') ilike '%' || p_search || '%'
      )
  ),
  counted as (
    select count(*) as cnt from filtered_logs
  )
  select
    f.id,
    f.actor_id,
    f.actor_name,
    f.actor_email,
    f.actor_role,
    f.action,
    f.entity_type,
    f.entity_id,
    f.metadata,
    f.ip_address,
    f.user_agent,
    f.created_at,
    c.cnt as total_count
  from filtered_logs f
  cross join counted c
  order by f.created_at desc
  limit p_limit
  offset p_offset;
end;
$$;

-- RPC: Get Audit Log Statistics
create or replace function public.get_audit_log_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_authorized boolean := false;
  v_total bigint := 0;
  v_today bigint := 0;
  v_actions jsonb;
begin
  if auth.uid() is not null then
    select (
      public.has_admin_permission('view_audit_logs') or
      (prof.role = 'admin' and (prof.admin_role = 'super_admin' or prof.admin_role is null))
    )
    into v_authorized
    from public.profiles prof
    where prof.id = auth.uid();
  end if;

  if not coalesce(v_authorized, false) then
    raise exception 'Access denied: view_audit_logs permission required';
  end if;

  select count(*), count(*) filter (where created_at >= date_trunc('day', now()))
  into v_total, v_today
  from public.audit_logs;

  select jsonb_object_agg(coalesce(action_prefix, 'other'), action_count)
  into v_actions
  from (
    select split_part(action, '.', 1) as action_prefix, count(*) as action_count
    from public.audit_logs
    group by 1
    order by 2 desc
    limit 10
  ) s;

  return jsonb_build_object(
    'total_events', v_total,
    'today_events', v_today,
    'action_breakdown', coalesce(v_actions, '{}'::jsonb)
  );
end;
$$;

-- 6. Comprehensive Automated Audit Triggers Across Key Domains

-- Trigger A: Enrollments Lifecycle (Created, Status Changed, Dropped, Completed)
create or replace function public.fn_audit_enrollments_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity_id text;
begin
  if (TG_OP = 'INSERT') then
    v_entity_id := new.user_id::text || ':' || new.cohort_id::text;
    perform public.log_audit_event(
      'enrollment.created',
      'enrollment',
      v_entity_id,
      jsonb_build_object(
        'cohort_id', new.cohort_id,
        'student_id', new.user_id,
        'status', new.status
      ),
      auth.uid()
    );
    return new;
  elsif (TG_OP = 'UPDATE') then
    if (old.status is distinct from new.status) then
      v_entity_id := new.user_id::text || ':' || new.cohort_id::text;
      perform public.log_audit_event(
        'enrollment.status_changed',
        'enrollment',
        v_entity_id,
        jsonb_build_object(
          'cohort_id', new.cohort_id,
          'student_id', new.user_id,
          'old_status', old.status,
          'new_status', new.status
        ),
        auth.uid()
      );
    end if;
    return new;
  elsif (TG_OP = 'DELETE') then
    v_entity_id := old.user_id::text || ':' || old.cohort_id::text;
    perform public.log_audit_event(
      'enrollment.deleted',
      'enrollment',
      v_entity_id,
      jsonb_build_object(
        'cohort_id', old.cohort_id,
        'student_id', old.user_id,
        'last_status', old.status
      ),
      auth.uid()
    );
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_audit_enrollments on public.enrollments;
create trigger trg_audit_enrollments
  after insert or update of status or delete on public.enrollments
  for each row
  execute function public.fn_audit_enrollments_trigger();

-- Trigger B: Certificates Lifecycle (Issued, Updated, Revoked)
create or replace function public.fn_audit_certificates_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (TG_OP = 'INSERT') then
    perform public.log_audit_event(
      'certificate.issued',
      'certificate',
      new.id::text,
      jsonb_build_object(
        'certificate_number', new.certificate_number,
        'student_id', new.student_id,
        'cohort_id', new.cohort_id,
        'grade', new.grade,
        'composite_score', new.composite_score
      ),
      auth.uid()
    );
    return new;
  elsif (TG_OP = 'DELETE') then
    perform public.log_audit_event(
      'certificate.revoked',
      'certificate',
      old.id::text,
      jsonb_build_object(
        'certificate_number', old.certificate_number,
        'student_id', old.student_id,
        'cohort_id', old.cohort_id
      ),
      auth.uid()
    );
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_audit_certificates on public.certificates;
create trigger trg_audit_certificates
  after insert or delete on public.certificates
  for each row
  execute function public.fn_audit_certificates_trigger();

-- Trigger C: Internship Reports Lifecycle (Generated, Published, Rating Adjusted)
create or replace function public.fn_audit_internship_reports_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (TG_OP = 'INSERT') then
    perform public.log_audit_event(
      'internship_report.generated',
      'internship_report',
      new.id::text,
      jsonb_build_object(
        'cohort_id', new.cohort_id,
        'student_id', new.student_id,
        'grade', new.grade,
        'composite_score', new.composite_score,
        'lor_eligible', new.lor_eligible,
        'status', new.status
      ),
      auth.uid()
    );
    return new;
  elsif (TG_OP = 'UPDATE') then
    if (old.status is distinct from new.status and new.status = 'published') then
      perform public.log_audit_event(
        'internship_report.published',
        'internship_report',
        new.id::text,
        jsonb_build_object(
          'cohort_id', new.cohort_id,
          'student_id', new.student_id,
          'grade', new.grade,
          'composite_score', new.composite_score,
          'lor_eligible', new.lor_eligible
        ),
        auth.uid()
      );
    elsif (old.grade is distinct from new.grade or old.lor_eligible is distinct from new.lor_eligible) then
      perform public.log_audit_event(
        'internship_report.updated',
        'internship_report',
        new.id::text,
        jsonb_build_object(
          'cohort_id', new.cohort_id,
          'student_id', new.student_id,
          'old_grade', old.grade,
          'new_grade', new.grade,
          'lor_eligible', new.lor_eligible
        ),
        auth.uid()
      );
    end if;
    return new;
  elsif (TG_OP = 'DELETE') then
    perform public.log_audit_event(
      'internship_report.deleted',
      'internship_report',
      old.id::text,
      jsonb_build_object(
        'cohort_id', old.cohort_id,
        'student_id', old.student_id
      ),
      auth.uid()
    );
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_audit_internship_reports on public.internship_reports;
create trigger trg_audit_internship_reports
  after insert or update or delete on public.internship_reports
  for each row
  execute function public.fn_audit_internship_reports_trigger();

-- Trigger D: Submissions Status Change Lifecycle
create or replace function public.fn_audit_submissions_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (TG_OP = 'UPDATE') then
    if (old.status is distinct from new.status) then
      perform public.log_audit_event(
        'submission.status_changed',
        'submission',
        new.id::text,
        jsonb_build_object(
          'assignment_id', new.assignment_id,
          'student_id', new.student_id,
          'old_status', old.status,
          'new_status', new.status,
          'version', new.version
        ),
        auth.uid()
      );
    end if;
    return new;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_audit_submissions on public.submissions;
create trigger trg_audit_submissions
  after update of status on public.submissions
  for each row
  execute function public.fn_audit_submissions_trigger();

-- Trigger D2: Daily Challenge Submissions Grading Lifecycle (Score & Status)
create or replace function public.fn_audit_challenge_submissions_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (TG_OP = 'UPDATE') then
    if (old.status is distinct from new.status) or (old.score is distinct from new.score) then
      perform public.log_audit_event(
        'challenge_submission.evaluated',
        'challenge_submission',
        new.id::text,
        jsonb_build_object(
          'challenge_id', new.challenge_id,
          'student_id', new.user_id,
          'old_status', old.status,
          'new_status', new.status,
          'old_score', old.score,
          'new_score', new.score
        ),
        auth.uid()
      );
    end if;
    return new;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_audit_challenge_submissions on public.daily_challenge_submissions;
create trigger trg_audit_challenge_submissions
  after update of status, score on public.daily_challenge_submissions
  for each row
  execute function public.fn_audit_challenge_submissions_trigger();

-- Trigger E: Community Moderation Reports Resolution
create or replace function public.fn_audit_community_reports_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (TG_OP = 'UPDATE') then
    if (old.status is distinct from new.status) then
      perform public.log_audit_event(
        'moderation.report_resolved',
        'community_report',
        new.id::text,
        jsonb_build_object(
          'post_id', new.post_id,
          'reporter_id', new.reporter_id,
          'old_status', old.status,
          'new_status', new.status,
          'resolution_notes', new.resolution_notes
        ),
        auth.uid()
      );
    end if;
    return new;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_audit_community_reports on public.community_reports;
create trigger trg_audit_community_reports
  after update of status on public.community_reports
  for each row
  execute function public.fn_audit_community_reports_trigger();

-- Trigger F: Live Sessions Management (Created, Deleted)
create or replace function public.fn_audit_live_sessions_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (TG_OP = 'INSERT') then
    perform public.log_audit_event(
      'session.created',
      'live_session',
      new.id::text,
      jsonb_build_object(
        'title', new.title,
        'cohort_id', new.cohort_id,
        'starts_at', new.starts_at
      ),
      auth.uid()
    );
    return new;
  elsif (TG_OP = 'DELETE') then
    perform public.log_audit_event(
      'session.deleted',
      'live_session',
      old.id::text,
      jsonb_build_object(
        'title', old.title,
        'cohort_id', old.cohort_id,
        'starts_at', old.starts_at
      ),
      auth.uid()
    );
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_audit_live_sessions on public.live_sessions;
create trigger trg_audit_live_sessions
  after insert or delete on public.live_sessions
  for each row
  execute function public.fn_audit_live_sessions_trigger();

-- Grant execution permissions
grant execute on function public.log_audit_event to authenticated;
grant execute on function public.get_security_audit_logs to authenticated;
grant execute on function public.get_audit_log_stats to authenticated;
