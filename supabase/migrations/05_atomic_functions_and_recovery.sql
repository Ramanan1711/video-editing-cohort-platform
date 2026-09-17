-- 05_atomic_functions_and_recovery.sql
-- Atomic review & feedback transaction RPC and missing-profile recovery RPC.

-- 1. Atomic review submission & feedback creation
create or replace function public.review_submission_atomic(
  p_submission_id uuid,
  p_mentor_id uuid,
  p_status text,
  p_feedback text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid := auth.uid();
  v_submission record;
  v_feedback_record record;
  v_clean_feedback text;
begin
  -- Validate caller authorization (must be authenticated as mentor or admin)
  if v_caller_id is null or not exists (
    select 1 from public.profiles
    where id = v_caller_id and role in ('mentor', 'admin')
  ) then
    raise exception 'Unauthorized: Only mentors or admins can review submissions';
  end if;

  -- Validate requested review status
  if p_status not in ('reviewed', 'resubmit') then
    raise exception 'Invalid review status: %. Allowed values are reviewed or resubmit', p_status;
  end if;

  -- Atomic update of submission status
  update public.submissions
  set status = p_status
  where id = p_submission_id
  returning id, assignment_id, student_id, file_url, status, created_at
  into v_submission;

  if not found then
    raise exception 'Submission with ID % not found', p_submission_id;
  end if;

  -- Insert feedback if non-empty comments provided
  v_clean_feedback := trim(coalesce(p_feedback, ''));
  if v_clean_feedback <> '' then
    insert into public.feedback (submission_id, mentor_id, comments, created_at)
    values (p_submission_id, coalesce(p_mentor_id, v_caller_id), v_clean_feedback, now())
    returning id, comments, created_at into v_feedback_record;
  end if;

  return jsonb_build_object(
    'id', v_submission.id,
    'assignment_id', v_submission.assignment_id,
    'student_id', v_submission.student_id,
    'file_url', v_submission.file_url,
    'status', v_submission.status,
    'created_at', v_submission.created_at,
    'feedback', nullif(v_clean_feedback, '')
  );
end;
$$;

-- 2. Missing-profile self-recovery RPC
create or replace function public.ensure_current_user_profile()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile record;
  v_email text;
  v_full_name text;
  v_role text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Check if profile already exists
  select id, full_name, email, role into v_profile
  from public.profiles
  where id = v_user_id;

  if found then
    return jsonb_build_object(
      'id', v_profile.id,
      'full_name', v_profile.full_name,
      'email', v_profile.email,
      'role', v_profile.role
    );
  end if;

  -- Extract user information from auth.users
  select
    email,
    coalesce(
      nullif(trim(raw_user_meta_data->>'full_name'), ''),
      split_part(email, '@', 1),
      'Editor'
    ),
    case
      when raw_user_meta_data->>'role' in ('student', 'mentor') then raw_user_meta_data->>'role'
      else 'student'
    end
  into v_email, v_full_name, v_role
  from auth.users
  where id = v_user_id;

  if not found then
    raise exception 'User record not found in auth.users';
  end if;

  -- Insert recovered profile
  insert into public.profiles (id, full_name, email, role, created_at, updated_at)
  values (v_user_id, v_full_name, coalesce(v_email, ''), v_role, now(), now())
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
    updated_at = now()
  returning id, full_name, email, role into v_profile;

  return jsonb_build_object(
    'id', v_profile.id,
    'full_name', v_profile.full_name,
    'email', v_profile.email,
    'role', v_profile.role
  );
end;
$$;

