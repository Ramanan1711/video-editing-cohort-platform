-- ==============================================================================
-- Migration: 20260928000015_canonical_submission_review_and_feedback_rpcs.sql
-- Description: Canonical Mentor Review RPCs (review_submission & review_submission_v2)
--   1. Authoritative Schema & Indices: Ensures required columns on feedback & submissions
--      (rubric, rubric_scores, comments, comment, timestamped_notes, private_notes, sla_target_hours).
--   2. Cohort Scoping Authorization Helpers:
--      - public.is_mentor_assigned_to_cohort(uuid): checks admin role and mentor_cohorts junction table.
--      - public.is_mentor_assigned_to_submission(uuid): checks admin role,
--        public.is_mentor_for_student(), direct a.cohort_id, module hierarchy m.cohort_id,
--        and student active enrollments via mentor_cohorts.
--   3. Canonical Atomic Review RPC v2 (review_submission_v2):
--      - Atomic transaction: inserts structured feedback (rubric, comments, timestamped notes)
--      - Updates submission status ('reviewed', 'resubmit') and private_notes
--      - Delivers fail-safe student notification
--   4. Canonical Backward-Compatible Review RPC (review_submission):
--      - Clean delegation to review_submission_v2
--   5. Permissions & RLS Alignment:
--      - Grants execute to authenticated role
--      - Harmonizes feedback & submissions update RLS policies
-- ==============================================================================

-- 1. Ensure feedback & submissions columns exist
alter table public.submissions
  add column if not exists sla_target_hours integer not null default 24,
  add column if not exists escalated_at timestamptz,
  add column if not exists escalation_reason text,
  add column if not exists escalated_by uuid references public.profiles(id),
  add column if not exists private_notes text;

create index if not exists idx_submissions_escalated on public.submissions(escalated_at) where escalated_at is not null;

alter table public.feedback
  add column if not exists comments text,
  add column if not exists comment text,
  add column if not exists rubric jsonb not null default '{}'::jsonb,
  add column if not exists rubric_scores jsonb default '{}'::jsonb,
  add column if not exists timestamped_notes jsonb not null default '[]'::jsonb,
  add column if not exists private_notes text;

-- Safely drop NOT NULL on comment/comments if present
do $$
begin
  alter table public.feedback alter column comment drop not null;
exception
  when others then null;
end $$;

do $$
begin
  alter table public.feedback alter column comments drop not null;
exception
  when others then null;
end $$;

-- 2. Cohort Assignment Authorization Helpers

create or replace function public.is_mentor_assigned_to_cohort(p_cohort_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.status, 'active') = 'active'
      and (
        p.role = 'admin'
        or (
          p.role = 'mentor'
          and exists (
            select 1 from public.mentor_cohorts mc
            where mc.cohort_id = p_cohort_id
              and mc.mentor_id = auth.uid()
          )
        )
      )
  );
$$;

create or replace function public.is_mentor_assigned_to_submission(p_submission_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.status, 'active') = 'active'
      and (
        p.role = 'admin'
        or (
          p.role = 'mentor'
          and (
            -- 1. Direct student mentor assignment via is_mentor_for_student
            exists (
              select 1 from public.submissions s
              where s.id = p_submission_id
                and public.is_mentor_for_student(s.student_id)
            )
            -- 2. Assignment scoped directly to a cohort mentor manages
            or exists (
              select 1
              from public.submissions s
              join public.assignments a on a.id = s.assignment_id
              join public.mentor_cohorts mc on mc.cohort_id = a.cohort_id
              where s.id = p_submission_id
                and mc.mentor_id = auth.uid()
            )
            -- 3. Assignment scoped via lesson -> module -> cohort mentor manages
            or exists (
              select 1
              from public.submissions s
              join public.assignments a on a.id = s.assignment_id
              join public.lessons l on l.id = a.lesson_id
              join public.modules m on m.id = l.module_id
              join public.mentor_cohorts mc on mc.cohort_id = m.cohort_id
              where s.id = p_submission_id
                and mc.mentor_id = auth.uid()
            )
            -- 4. Student enrolled in a cohort mentor manages
            or exists (
              select 1
              from public.submissions s
              join public.enrollments e on e.user_id = s.student_id
              join public.mentor_cohorts mc on mc.cohort_id = e.cohort_id
              where s.id = p_submission_id
                and mc.mentor_id = auth.uid()
            )
          )
        )
      )
  );
$$;

grant execute on function public.is_mentor_assigned_to_cohort(uuid) to authenticated;
grant execute on function public.is_mentor_assigned_to_submission(uuid) to authenticated;

-- 3. Canonical Atomic Review RPC v2 (review_submission_v2)
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
  v_user_id uuid;
  v_student_id uuid;
  v_normalized_status text;
  v_is_assigned boolean;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required: You must be logged in'
      using errcode = '42501';
  end if;

  -- Validate role and active status
  if not exists (
    select 1
    from public.profiles
    where id = v_user_id
      and role in ('mentor', 'admin')
      and coalesce(status, 'active') = 'active'
  ) then
    raise exception 'Access denied: Only active mentors or administrators can review submissions'
      using errcode = '42501';
  end if;

  -- Normalize incoming review status ('reviewed', 'resubmit', 'approved', 'accepted', 'resubmit_requested', 'needs_revision', 'needs_work')
  v_normalized_status := lower(trim(p_status));
  if v_normalized_status in ('resubmit_requested', 'needs_revision', 'needs_work') then
    v_normalized_status := 'resubmit';
  elsif v_normalized_status in ('approved', 'accepted') then
    v_normalized_status := 'reviewed';
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

  -- Insert student notification (fail-safe)
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
      'assignment',
      '/assignments',
      now()
    );
  exception
    when others then
      null;
  end;
end;
$$;

grant execute on function public.review_submission_v2(uuid, text, text, jsonb, jsonb, text) to authenticated;

-- 4. Canonical Backward-Compatible Review RPC (review_submission)
create or replace function public.review_submission(
  p_submission_id uuid,
  p_status text,
  p_comments text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.review_submission_v2(
    p_submission_id => p_submission_id,
    p_status => p_status,
    p_comments => p_comments,
    p_rubric => '{}'::jsonb,
    p_timestamped_notes => '[]'::jsonb,
    p_private_notes => null
  );
end;
$$;

grant execute on function public.review_submission(uuid, text, text) to authenticated;

-- 5. RLS Policy Hardening for Feedback and Submissions

-- Feedback insert policy: Assigned mentors and admins
drop policy if exists "Mentors and Admins can insert feedback" on public.feedback;
create policy "Mentors and Admins can insert feedback"
  on public.feedback for insert
  to authenticated
  with check (
    mentor_id = auth.uid()
    and (
      public.is_admin()
      or exists (
        select 1 from public.submissions s
        where s.id = feedback.submission_id
        and (
          public.is_mentor_for_student(s.student_id)
          or public.is_mentor_assigned_to_submission(s.id)
        )
      )
    )
  );

-- Feedback update policy: Authoring mentor or admin
drop policy if exists "Mentors and Admins can update feedback" on public.feedback;
create policy "Mentors and Admins can update feedback"
  on public.feedback for update
  to authenticated
  using (
    public.is_admin()
    or (
      mentor_id = auth.uid()
      and exists (
        select 1 from public.submissions s
        where s.id = feedback.submission_id
        and (
          public.is_mentor_for_student(s.student_id)
          or public.is_mentor_assigned_to_submission(s.id)
        )
      )
    )
  )
  with check (
    public.is_admin()
    or (
      mentor_id = auth.uid()
      and exists (
        select 1 from public.submissions s
        where s.id = feedback.submission_id
        and (
          public.is_mentor_for_student(s.student_id)
          or public.is_mentor_assigned_to_submission(s.id)
        )
      )
    )
  );

-- Submissions update policy for mentors & admins: allows updating status & private_notes
drop policy if exists "Mentors and Admins can update submissions" on public.submissions;
create policy "Mentors and Admins can update submissions"
  on public.submissions for update
  to authenticated
  using (
    public.is_admin()
    or public.is_mentor_for_student(student_id)
    or public.is_mentor_assigned_to_submission(id)
  )
  with check (
    public.is_admin()
    or public.is_mentor_for_student(student_id)
    or public.is_mentor_assigned_to_submission(id)
  );

