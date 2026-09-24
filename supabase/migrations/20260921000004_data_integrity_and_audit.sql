-- ==============================================================================
-- supabase/migrations/20260921000004_data_integrity_and_audit.sql
-- Production Checklist 2: Data Integrity & Reliability
-- 
-- 1. Automated Database-Level Audit Logging Triggers & Centralized Helper
-- 2. Backend Validation for Critical Mutations:
--    - admin_update_user_role (guards last super_admin & valid roles)
--    - admin_update_user_status (guards active admins & valid statuses)
--    - enroll_student_in_cohort (guards capacity, enrollment window, active user)
--    - admin_delete_cohort (guards accidental data wipe of active cohorts)
--    - publish_announcement (guards author identity & content length)
-- ==============================================================================

-- Ensure audit_logs table exists and has proper indexes
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

-- Admins can view all audit logs
drop policy if exists "Admins can view audit logs" on public.audit_logs;
create policy "Admins can view audit logs"
  on public.audit_logs for select
  to authenticated
  using (public.is_admin());

-- Dedicated security definer procedure for logging audit events from any role/trigger
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
  v_actor_id uuid;
  v_log_id uuid;
begin
  v_actor_id := coalesce(p_actor_id, auth.uid());

  insert into public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata,
    created_at
  )
  values (
    v_actor_id,
    p_action,
    p_entity_type,
    p_entity_id,
    p_metadata,
    now()
  )
  returning id into v_log_id;

  return v_log_id;
end;
$$;

-- ==============================================================================
-- 1. Critical Mutation Validation: Role & Status Updates
-- ==============================================================================

create or replace function public.admin_update_user_role(
  p_user_id uuid,
  p_new_role text,
  p_new_admin_role text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_is_admin boolean;
  v_target_profile record;
  v_super_admin_count integer;
  v_updated record;
begin
  -- 1. Ensure caller is authenticated and is an active admin
  v_caller_is_admin := public.is_admin() and public.is_active_user();
  if not v_caller_is_admin then
    raise exception 'Unauthorized: Only active administrators can modify user roles.'
      using errcode = '42501';
  end if;

  -- 2. Validate target role
  if p_new_role not in ('student', 'mentor', 'admin') then
    raise exception 'Invalid role: % is not a recognized system role.', p_new_role
      using errcode = '22000';
  end if;

  -- 3. Validate admin sub-role if specified
  if p_new_admin_role is not null and p_new_admin_role not in ('super_admin', 'content_admin', 'operations_admin', 'moderator') then
    raise exception 'Invalid admin_role: % is not a recognized admin role.', p_new_admin_role
      using errcode = '22000';
  end if;

  -- 4. Load target user
  select id, email, role, admin_role, status
  into v_target_profile
  from public.profiles
  where id = p_user_id;

  if not found then
    raise exception 'User profile % not found.', p_user_id
      using errcode = 'P0002';
  end if;

  -- 5. Protection: Prevent demoting the last super_admin
  if v_target_profile.admin_role = 'super_admin' and (p_new_role != 'admin' or p_new_admin_role != 'super_admin') then
    select count(*)
    into v_super_admin_count
    from public.profiles
    where role = 'admin' and admin_role = 'super_admin' and status = 'active';

    if v_super_admin_count <= 1 then
      raise exception 'Cannot demote the last remaining active Super Admin.'
        using errcode = 'P0001';
    end if;
  end if;

  -- 6. Apply update
  update public.profiles
  set
    role = p_new_role,
    admin_role = case when p_new_role = 'admin' then coalesce(p_new_admin_role, admin_role, 'content_admin') else null end,
    updated_at = now()
  where id = p_user_id
  returning id, full_name, email, role, admin_role, status, updated_at
  into v_updated;

  -- 7. Audit log is automatically handled by trigger or explicit log
  perform public.log_audit_event(
    'user.role_changed',
    'user',
    p_user_id::text,
    jsonb_build_object(
      'previous_role', v_target_profile.role,
      'previous_admin_role', v_target_profile.admin_role,
      'new_role', v_updated.role,
      'new_admin_role', v_updated.admin_role,
      'user_email', v_updated.email
    )
  );

  return to_jsonb(v_updated);
end;
$$;

create or replace function public.admin_update_user_status(
  p_user_id uuid,
  p_new_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_is_admin boolean;
  v_target_profile record;
  v_admin_count integer;
  v_updated record;
begin
  -- 1. Ensure caller is an active admin
  v_caller_is_admin := public.is_admin() and public.is_active_user();
  if not v_caller_is_admin then
    raise exception 'Unauthorized: Only active administrators can modify account status.'
      using errcode = '42501';
  end if;

  -- 2. Validate status
  if p_new_status not in ('active', 'suspended', 'inactive') then
    raise exception 'Invalid status: % is not a recognized status.', p_new_status
      using errcode = '22000';
  end if;

  -- 3. Load target profile
  select id, email, role, admin_role, status
  into v_target_profile
  from public.profiles
  where id = p_user_id;

  if not found then
    raise exception 'User profile % not found.', p_user_id
      using errcode = 'P0002';
  end if;

  -- 4. Protection: Cannot suspend self if caller is target and last admin
  if p_user_id = auth.uid() and p_new_status != 'active' and v_target_profile.role = 'admin' then
    select count(*)
    into v_admin_count
    from public.profiles
    where role = 'admin' and status = 'active';

    if v_admin_count <= 1 then
      raise exception 'Safety block: Cannot suspend the last active administrator account.'
        using errcode = 'P0001';
    end if;
  end if;

  -- 5. Apply update
  update public.profiles
  set
    status = p_new_status,
    updated_at = now()
  where id = p_user_id
  returning id, full_name, email, role, admin_role, status, updated_at
  into v_updated;

  -- 6. Audit log
  perform public.log_audit_event(
    'user.status_changed',
    'user',
    p_user_id::text,
    jsonb_build_object(
      'previous_status', v_target_profile.status,
      'new_status', p_new_status,
      'user_email', v_updated.email
    )
  );

  return to_jsonb(v_updated);
end;
$$;

-- ==============================================================================
-- 2. Critical Mutation Validation: Cohort Enrollment
-- ==============================================================================

create or replace function public.enroll_student_in_cohort(
  p_cohort_id uuid,
  p_student_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_student_id uuid;
  v_cohort record;
  v_current_enrollments integer;
  v_existing_enrollment record;
  v_enrollment_status text := 'enrolled';
  v_new_enrollment record;
begin
  -- 1. Determine student ID and verify authorization
  v_target_student_id := coalesce(p_student_id, auth.uid());

  if v_target_student_id is null then
    raise exception 'Authentication required to enroll in cohort.'
      using errcode = '42501';
  end if;

  -- If enrolling another student, caller must be an active admin
  if v_target_student_id != auth.uid() and not (public.is_admin() and public.is_active_user()) then
    raise exception 'Unauthorized: Only administrators can enroll other students.'
      using errcode = '42501';
  end if;

  -- 2. Check student active account status
  if not exists (
    select 1 from public.profiles
    where id = v_target_student_id and coalesce(status, 'active') = 'active'
  ) then
    raise exception 'Cannot enroll: Student account is suspended or inactive.'
      using errcode = 'P0001';
  end if;

  -- 3. Verify cohort existence and publishing/enrollment rules
  select id, title, status, capacity, visibility, enrollment_start, enrollment_end
  into v_cohort
  from public.cohorts
  where id = p_cohort_id;

  if not found then
    raise exception 'Cohort % not found.', p_cohort_id
      using errcode = 'P0002';
  end if;

  -- If non-admin, verify cohort is published and enrollment window is open
  if not public.is_admin() then
    if v_cohort.status not in ('published') then
      raise exception 'Cohort is not currently open for enrollment (Status: %).', v_cohort.status
        using errcode = 'P0001';
    end if;

    if v_cohort.enrollment_start is not null and now() < v_cohort.enrollment_start then
      raise exception 'Enrollment for this cohort has not started yet (Opens: %).', v_cohort.enrollment_start
        using errcode = 'P0001';
    end if;

    if v_cohort.enrollment_end is not null and now() > v_cohort.enrollment_end then
      raise exception 'Enrollment for this cohort closed on %.', v_cohort.enrollment_end
        using errcode = 'P0001';
    end if;
  end if;

  -- 4. Check for existing enrollment
  select id, cohort_id, user_id, status
  into v_existing_enrollment
  from public.enrollments
  where cohort_id = p_cohort_id and user_id = v_target_student_id;

  if found then
    if v_existing_enrollment.status in ('enrolled', 'waitlist') then
      return jsonb_build_object(
        'success', true,
        'already_enrolled', true,
        'enrollment_id', v_existing_enrollment.id,
        'status', v_existing_enrollment.status,
        'message', 'User is already enrolled in this cohort.'
      );
    else
      -- Re-activate dropped enrollment
      v_enrollment_status := 'enrolled';
      update public.enrollments
      set status = 'enrolled', enrolled_at = now()
      where id = v_existing_enrollment.id
      returning * into v_new_enrollment;

      perform public.log_audit_event(
        'enrollment.reactivated',
        'enrollment',
        v_new_enrollment.id::text,
        jsonb_build_object('cohort_id', p_cohort_id, 'student_id', v_target_student_id)
      );

      return jsonb_build_object(
        'success', true,
        'enrollment_id', v_new_enrollment.id,
        'status', 'enrolled',
        'message', 'Enrollment reactivated successfully.'
      );
    end if;
  end if;

  -- 5. Capacity Check
  select count(*)
  into v_current_enrollments
  from public.enrollments
  where cohort_id = p_cohort_id and status = 'enrolled';

  if v_cohort.capacity is not null and v_current_enrollments >= v_cohort.capacity then
    -- Route to waitlist if capacity reached
    v_enrollment_status := 'waitlist';
  else
    v_enrollment_status := 'enrolled';
  end if;

  -- 6. Insert enrollment
  insert into public.enrollments (
    cohort_id,
    user_id,
    status,
    enrolled_at
  )
  values (
    p_cohort_id,
    v_target_student_id,
    v_enrollment_status,
    now()
  )
  returning * into v_new_enrollment;

  -- 7. Audit log
  perform public.log_audit_event(
    'enrollment.created',
    'enrollment',
    v_new_enrollment.id::text,
    jsonb_build_object(
      'cohort_id', p_cohort_id,
      'cohort_title', v_cohort.title,
      'student_id', v_target_student_id,
      'status', v_enrollment_status
    )
  );

  return jsonb_build_object(
    'success', true,
    'enrollment_id', v_new_enrollment.id,
    'status', v_enrollment_status,
    'message', case
      when v_enrollment_status = 'waitlist'
      then 'Cohort capacity reached. You have been placed on the priority waitlist.'
      else 'Successfully enrolled in cohort.'
    end
  );
end;
$$;

-- ==============================================================================
-- 3. Critical Mutation Validation: Cohort Deletion Guard
-- ==============================================================================

create or replace function public.admin_delete_cohort(
  p_cohort_id uuid,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cohort record;
  v_active_enrollments integer := 0;
  v_submission_count integer := 0;
begin
  -- 1. Check authorization
  if not (public.is_admin() and public.is_active_user()) then
    raise exception 'Unauthorized: Only active administrators can delete cohorts.'
      using errcode = '42501';
  end if;

  -- 2. Verify cohort exists
  select id, title, status
  into v_cohort
  from public.cohorts
  where id = p_cohort_id;

  if not found then
    raise exception 'Cohort % not found.', p_cohort_id
      using errcode = 'P0002';
  end if;

  -- 3. Check active student enrollments
  select count(*)
  into v_active_enrollments
  from public.enrollments
  where cohort_id = p_cohort_id and status != 'dropped';

  -- 4. Check submissions linked to cohort assignments
  select count(s.id)
  into v_submission_count
  from public.submissions s
  join public.assignments a on s.assignment_id = a.id
  left join public.lessons l on l.id = a.lesson_id
  left join public.modules m on m.id = l.module_id
  where m.cohort_id = p_cohort_id;

  -- 5. Safety check: If active enrollments or submissions exist and force is not specified
  if (v_active_enrollments > 0 or v_submission_count > 0) and not p_force then
    -- Safely archive cohort to prevent data loss
    update public.cohorts
    set status = 'archived'
    where id = p_cohort_id;

    perform public.log_audit_event(
      'cohort.archived_safely',
      'cohort',
      p_cohort_id::text,
      jsonb_build_object(
        'title', v_cohort.title,
        'active_enrollments', v_active_enrollments,
        'submissions', v_submission_count,
        'reason', 'Preserved student records; cohort status switched to archived.'
      )
    );

    return jsonb_build_object(
      'success', true,
      'action', 'archived',
      'message', format(
        'Cohort "%s" contains %s active enrollment(s) and %s student submission(s). To protect learner data, it has been marked as Archived rather than deleted.',
        v_cohort.title,
        v_active_enrollments,
        v_submission_count
      )
    );
  end if;

  -- 6. Execute deletion if zero active data or explicitly forced
  delete from public.cohorts
  where id = p_cohort_id;

  perform public.log_audit_event(
    'cohort.deleted',
    'cohort',
    p_cohort_id::text,
    jsonb_build_object(
      'title', v_cohort.title,
      'forced', p_force,
      'previous_active_enrollments', v_active_enrollments
    )
  );

  return jsonb_build_object(
    'success', true,
    'action', 'deleted',
    'message', format('Cohort "%s" was successfully deleted.', v_cohort.title)
  );
end;
$$;

-- ==============================================================================
-- 4. Critical Mutation Validation: Announcement Publishing
-- ==============================================================================

create or replace function public.publish_announcement(
  p_title text,
  p_body text,
  p_published boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid;
  v_is_staff boolean;
  v_inserted record;
begin
  v_caller_id := auth.uid();
  if v_caller_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  -- Check staff / moderator role
  select exists (
    select 1 from public.profiles
    where id = v_caller_id
      and coalesce(status, 'active') = 'active'
      and (role = 'admin' or admin_role in ('super_admin', 'content_admin', 'operations_admin', 'moderator'))
  ) into v_is_staff;

  if not v_is_staff then
    raise exception 'Unauthorized: Only authorized staff members can publish announcements.'
      using errcode = '42501';
  end if;

  -- Validate title & body
  if length(trim(coalesce(p_title, ''))) < 3 then
    raise exception 'Announcement title must be at least 3 characters long.'
      using errcode = '22000';
  end if;

  if length(trim(coalesce(p_body, ''))) < 5 then
    raise exception 'Announcement body must be at least 5 characters long.'
      using errcode = '22000';
  end if;

  -- Insert announcement
  insert into public.announcements (
    author_id,
    title,
    body,
    published,
    created_at
  )
  values (
    v_caller_id,
    trim(p_title),
    trim(p_body),
    p_published,
    now()
  )
  returning id, author_id, title, body, published, created_at
  into v_inserted;

  -- Audit log
  perform public.log_audit_event(
    'announcement.created',
    'announcement',
    v_inserted.id::text,
    jsonb_build_object('title', v_inserted.title, 'published', v_inserted.published)
  );

  return to_jsonb(v_inserted);
end;
$$;

-- ==============================================================================
-- 5. Automated Database Triggers for Core Audit Trails
-- ==============================================================================

-- A. Profile Role & Status Changes Trigger
create or replace function public.fn_audit_profiles_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (old.role is distinct from new.role) or (old.admin_role is distinct from new.admin_role) or (old.status is distinct from new.status) then
    insert into public.audit_logs (
      actor_id,
      action,
      entity_type,
      entity_id,
      metadata,
      created_at
    )
    values (
      coalesce(auth.uid(), new.id),
      case
        when old.role is distinct from new.role then 'user.role_changed'
        when old.status is distinct from new.status then 'user.status_changed'
        else 'user.admin_role_changed'
      end,
      'user',
      new.id::text,
      jsonb_build_object(
        'email', new.email,
        'old_role', old.role,
        'new_role', new.role,
        'old_admin_role', old.admin_role,
        'new_admin_role', new.admin_role,
        'old_status', old.status,
        'new_status', new.status
      ),
      now()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_audit_profiles on public.profiles;
create trigger trg_audit_profiles
  after update of role, admin_role, status on public.profiles
  for each row
  execute function public.fn_audit_profiles_trigger();

-- B. Cohort Modification & Deletion Trigger
create or replace function public.fn_audit_cohorts_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (TG_OP = 'DELETE') then
    insert into public.audit_logs (
      actor_id,
      action,
      entity_type,
      entity_id,
      metadata,
      created_at
    )
    values (
      auth.uid(),
      'cohort.deleted',
      'cohort',
      old.id::text,
      jsonb_build_object('title', old.title, 'status', old.status),
      now()
    );
    return old;
  elsif (TG_OP = 'UPDATE') then
    if (old.status is distinct from new.status) or (old.capacity is distinct from new.capacity) or (old.title is distinct from new.title) then
      insert into public.audit_logs (
        actor_id,
        action,
        entity_type,
        entity_id,
        metadata,
        created_at
      )
      values (
        auth.uid(),
        'cohort.updated',
        'cohort',
        new.id::text,
        jsonb_build_object(
          'old_title', old.title,
          'new_title', new.title,
          'old_status', old.status,
          'new_status', new.status,
          'old_capacity', old.capacity,
          'new_capacity', new.capacity
        ),
        now()
      );
    end if;
    return new;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_audit_cohorts on public.cohorts;
create trigger trg_audit_cohorts
  after update or delete on public.cohorts
  for each row
  execute function public.fn_audit_cohorts_trigger();

-- C. Submission Feedback & Review Audit Trigger
create or replace function public.fn_audit_feedback_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (TG_OP = 'INSERT') then
    insert into public.audit_logs (
      actor_id,
      action,
      entity_type,
      entity_id,
      metadata,
      created_at
    )
    values (
      coalesce(new.mentor_id, auth.uid()),
      'submission.reviewed',
      'feedback',
      new.id::text,
      jsonb_build_object(
        'submission_id', new.submission_id,
        'mentor_id', new.mentor_id,
        'rubric_scores', new.rubric_scores
      ),
      now()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_audit_feedback on public.feedback;
create trigger trg_audit_feedback
  after insert on public.feedback
  for each row
  execute function public.fn_audit_feedback_trigger();

