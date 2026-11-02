-- ==============================================================================
-- Canonical Database Migration: Fix Assignment Review Notification Action URL & Category
-- Version: 20261102000001
--
-- Purpose:
--   1. Replaces dead action_url '/assignments' in review_submission_v2 RPC with
--      the canonical route '/student/dashboard?view=player&tab=assignments'.
--   2. Normalizes category from 'assignment' to 'review' so mentor feedback
--      correctly populates under the 'Reviews' filter tab with emerald badge.
--   3. Backfills existing legacy notification rows in public.notifications.
-- ==============================================================================

-- 1. Update review_submission_v2 RPC
create or replace function public.review_submission_v2(
  p_submission_id uuid,
  p_status text,
  p_comments text default null,
  p_rubric jsonb default '{}'::jsonb,
  p_timestamped_notes jsonb default '[]'::jsonb,
  p_private_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_student_id uuid;
  v_normalized_status text;
  v_is_assigned boolean;
begin
  if v_user_id is null then
    raise exception 'Unauthorized: Must be logged in to review submissions'
      using errcode = '42501';
  end if;

  v_normalized_status := lower(trim(p_status));
  if v_normalized_status in ('passed', 'approved', 'complete', 'completed') then
    v_normalized_status := 'reviewed';
  elsif v_normalized_status in ('rejected', 'needs_revision', 'retry', 're-submit') then
    v_normalized_status := 'resubmit';
  end if;

  if v_normalized_status not in ('reviewed', 'resubmit') then
    raise exception 'Invalid review status: Status must be "reviewed" or "resubmit"'
      using errcode = '22023';
  end if;

  -- Verify submission exists and fetch student_id
  select student_id into v_student_id
  from public.submissions
  where id = p_submission_id;

  if v_student_id is null then
    raise exception 'Submission % not found', p_submission_id
      using errcode = 'P0002';
  end if;

  -- Verify cohort assignment authorization
  v_is_assigned := public.is_mentor_assigned_to_submission(p_submission_id);
  if not v_is_assigned then
    raise exception 'Access denied: You are not assigned to mentor the cohort for this submission'
      using errcode = '42501';
  end if;

  -- Record feedback entry (dual-column compatibility for comments and rubric)
  insert into public.feedback (
    submission_id,
    mentor_id,
    comment,
    comments,
    rubric,
    rubric_scores,
    timestamped_notes,
    private_notes,
    created_at
  )
  values (
    p_submission_id,
    v_user_id,
    coalesce(trim(p_comments), ''),
    coalesce(trim(p_comments), ''),
    coalesce(p_rubric, '{}'::jsonb),
    coalesce(p_rubric, '{}'::jsonb),
    coalesce(p_timestamped_notes, '[]'::jsonb),
    p_private_notes,
    now()
  );

  -- Update submission status and private note
  update public.submissions
  set
    status = v_normalized_status,
    private_notes = coalesce(p_private_notes, private_notes),
    updated_at = now()
  where id = p_submission_id;

  -- Insert student notification with canonical route and review category
  begin
    insert into public.notifications (
      user_id,
      title,
      body,
      category,
      action_url,
      created_at
    )
    values (
      v_student_id,
      case when v_normalized_status = 'reviewed' then 'Assignment Approved!' else 'Revision Requested' end,
      case when v_normalized_status = 'reviewed'
        then 'Your mentor has reviewed and approved your submission.'
        else 'Your mentor reviewed your submission and requested revisions.'
      end,
      'review',
      '/student/dashboard?view=player&tab=assignments',
      now()
    );
  exception
    when others then
      null;
  end;
end;
$$;

grant execute on function public.review_submission_v2(uuid, text, text, jsonb, jsonb, text) to authenticated;

-- 2. Backfill existing legacy notifications in public.notifications
update public.notifications
set action_url = '/student/dashboard?view=player&tab=assignments'
where action_url = '/assignments' or action_url like '/assignments?%';

update public.notifications
set category = 'review'
where category = 'assignment';

