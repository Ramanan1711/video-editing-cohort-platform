-- ==============================================================================
-- supabase/migrations/20260921000005_rls_policy_cleanup.sql
-- Production Security Consolidation:
-- Removes redundant, conflicting, and insecure legacy RLS policies
-- Enforces strict P0 requirements across all entities
-- ==============================================================================

-- ==============================================================================
-- 0. STORAGE: Bucket Creation and Bucket-Level Access Policy
-- Resolves "NoSuchBucket" (400/404) by creating the private bucket and
-- granting authenticated users SELECT permissions on storage.buckets so
-- health checks and getBucket API calls can read bucket metadata.
-- ==============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('submissions', 'submissions', false, 524288000, null)
on conflict (id) do update set public = false;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('course-assets', 'course-assets', true, 524288000, null)
on conflict (id) do update set public = true;

drop policy if exists "Allow authenticated users to view buckets" on storage.buckets;
create policy "Allow authenticated users to view buckets"
on storage.buckets for select
to authenticated
using (true);

-- Ensure notes and versioning columns exist on submissions & submission_versions
alter table public.submissions
  add column if not exists notes text,
  add column if not exists version_number integer default 1,
  add column if not exists version integer default 1,
  add column if not exists updated_at timestamptz not null default now();

alter table public.submission_versions
  add column if not exists version integer default 1,
  add column if not exists submitted_at timestamptz not null default now();

-- ==============================================================================
-- 1. PROFILES: Eliminate privilege escalation loopholes
-- Vulnerability fixed: "Users can update their own profile" allowed users
-- to update their own 'role' to 'admin' or reset their 'status' from 'suspended'.
-- ==============================================================================
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Admins can update profiles" on public.profiles;
drop policy if exists "Users can view their own profile" on public.profiles;

-- Ensure canonical profiles policies exist and are strict
drop policy if exists "Authenticated users can read profiles" on public.profiles;
create policy "Authenticated users can read profiles"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "Users can insert own initial profile" on public.profiles;
create policy "Users can insert own initial profile"
  on public.profiles for insert
  to authenticated
  with check (
    id = auth.uid()
    and role = 'student'
    and coalesce(status, 'active') = 'active'
  );

drop policy if exists "Users can update own display name" on public.profiles;
create policy "Users can update own display name"
  on public.profiles for update
  to authenticated
  using (id = auth.uid() and public.is_active_user())
  with check (
    id = auth.uid()
    and role = (select p.role from public.profiles p where p.id = auth.uid())
    and coalesce(status, 'active') = (select coalesce(p.status, 'active') from public.profiles p where p.id = auth.uid())
  );

drop policy if exists "Admins can update user profiles" on public.profiles;
create policy "Admins can update user profiles"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ==============================================================================
-- 2. SUBMISSIONS: Enforce Owner + Assigned Mentor + Admin only
-- Vulnerability fixed: "Students can update their submissions" allowed students
-- to change status to 'reviewed'. "Students can view their submissions" allowed
-- any mentor to view all student submissions across cohorts.
-- ==============================================================================
drop policy if exists "Students can create their submissions" on public.submissions;
drop policy if exists "Active students can submit assignments" on public.submissions;
drop policy if exists "Students can create own submissions" on public.submissions;
drop policy if exists "Students can update their submissions" on public.submissions;
drop policy if exists "Students can update own submissions" on public.submissions;
drop policy if exists "Students and staff can update submissions" on public.submissions;
drop policy if exists "Submissions updatable by student owner, assigned mentors, and a" on public.submissions;
drop policy if exists "Students can view their submissions" on public.submissions;
drop policy if exists "Users can view submissions" on public.submissions;
drop policy if exists "Students can read own submissions and staff can read all" on public.submissions;
drop policy if exists "Mentors and Admins can view all submissions" on public.submissions;
drop policy if exists "Submissions readable by student owner, assigned mentors, and ad" on public.submissions;

-- Canonical Submissions Select: Owner, Assigned Mentor, or Admin
drop policy if exists "Submissions select policy" on public.submissions;
create policy "Submissions select policy"
  on public.submissions for select
  to authenticated
  using (
    (student_id = auth.uid() and public.is_active_user())
    or public.is_mentor_for_student(student_id)
    or public.is_admin()
  );

-- Canonical Submissions Insert: Owner only, active user, draft/pending only
drop policy if exists "Students can insert own submissions" on public.submissions;
create policy "Students can insert own submissions"
  on public.submissions for insert
  to authenticated
  with check (
    student_id = auth.uid()
    and public.is_active_user()
    and status in ('draft', 'pending')
  );

-- Canonical Submissions Update (Student): Can only modify draft/pending/resubmit
drop policy if exists "Students can update draft or pending submissions" on public.submissions;
create policy "Students can update draft or pending submissions"
  on public.submissions for update
  to authenticated
  using (
    student_id = auth.uid()
    and public.is_active_user()
    and status in ('draft', 'pending', 'resubmit')
  )
  with check (
    student_id = auth.uid()
    and public.is_active_user()
    and status in ('draft', 'pending')
  );

-- Canonical Submissions Update (Mentor/Admin): Assigned Mentor or Admin
drop policy if exists "Mentors and Admins can update submissions" on public.submissions;
create policy "Mentors and Admins can update submissions"
  on public.submissions for update
  to authenticated
  using (
    public.is_admin()
    or public.is_mentor_for_student(student_id)
  )
  with check (
    public.is_admin()
    or public.is_mentor_for_student(student_id)
  );

-- Canonical Submissions Delete: Admin only
drop policy if exists "Admins can delete submissions" on public.submissions;
create policy "Admins can delete submissions"
  on public.submissions for delete
  to authenticated
  using (public.is_admin());


-- ==============================================================================
-- 3. FEEDBACK: Enforce Assigned Mentor + Admin only
-- Vulnerability fixed: "Mentors can create feedback" allowed any mentor
-- to review submissions outside their assigned cohort.
-- ==============================================================================
drop policy if exists "Assigned mentors and admins can insert feedback" on public.feedback;
drop policy if exists "Mentors can create feedback" on public.feedback;
drop policy if exists "Feedback readable by submission owner, assigned mentors, and ad" on public.feedback;
drop policy if exists "Feedback readable by submission owner, mentors, and admins" on public.feedback;
drop policy if exists "Students can view feedback" on public.feedback;
drop policy if exists "Students can view feedback for own submissions" on public.feedback;
drop policy if exists "Mentors can update feedback" on public.feedback;

-- Canonical Feedback Select
drop policy if exists "Feedback select policy" on public.feedback;
create policy "Feedback select policy"
  on public.feedback for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.submissions s
      where s.id = feedback.submission_id
      and (
        (s.student_id = auth.uid() and public.is_active_user())
        or public.is_mentor_for_student(s.student_id)
      )
    )
  );

-- Canonical Feedback Insert
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
        and public.is_mentor_for_student(s.student_id)
      )
    )
  );

-- Canonical Feedback Update
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
        and public.is_mentor_for_student(s.student_id)
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
        and public.is_mentor_for_student(s.student_id)
      )
    )
  );


-- ==============================================================================
-- 4. ENROLLMENTS: Remove duplicate and loose self-enroll policies
-- ==============================================================================
drop policy if exists "Admins can manage enrollments" on public.enrollments;
drop policy if exists "Students can enroll themselves" on public.enrollments;
drop policy if exists "Users can view their enrollments" on public.enrollments;
drop policy if exists "Users can view their own enrollments" on public.enrollments;

-- Canonical Enrollments Select
drop policy if exists "Enrollments select policy" on public.enrollments;
create policy "Enrollments select policy"
  on public.enrollments for select
  to authenticated
  using (
    (user_id = auth.uid() and public.is_active_user())
    or public.is_mentor_for_cohort(cohort_id)
    or public.is_admin()
  );

-- Canonical Enrollments Insert
drop policy if exists "Students can self-enroll" on public.enrollments;
create policy "Students can self-enroll"
  on public.enrollments for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.is_active_user()
    and status in ('enrolled', 'active')
  );

-- Canonical Enrollments Admin Management
drop policy if exists "Admins have full management on enrollments" on public.enrollments;
create policy "Admins have full management on enrollments"
  on public.enrollments for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ==============================================================================
-- 5. LESSON PROGRESS: Consolidate redundant policies
-- ==============================================================================
drop policy if exists "Users can create their progress" on public.lesson_progress;
drop policy if exists "Users can update their progress" on public.lesson_progress;
drop policy if exists "Users can view their progress" on public.lesson_progress;

drop policy if exists "Active students can manage own progress" on public.lesson_progress;
create policy "Active students can manage own progress"
  on public.lesson_progress for all
  to authenticated
  using (user_id = auth.uid() and public.is_active_user())
  with check (user_id = auth.uid() and public.is_active_user());


-- ==============================================================================
-- 6. SUBMISSION VERSIONS: Remove duplicate policies
-- ==============================================================================
drop policy if exists "Users and staff can view submission versions" on public.submission_versions;
drop policy if exists "Users can insert own submission versions" on public.submission_versions;

drop policy if exists "Students can view own submission versions" on public.submission_versions;
create policy "Students can view own submission versions"
  on public.submission_versions for select
  to authenticated
  using (
    exists (
      select 1 from public.submissions s
      where s.id = submission_versions.submission_id
      and (
        (s.student_id = auth.uid() and public.is_active_user())
        or public.is_mentor_for_student(s.student_id)
        or public.is_admin()
      )
    )
  );


-- ==============================================================================
-- 7. NOTIFICATIONS: Remove duplicate read policy
-- ==============================================================================
drop policy if exists "Users can read own notifications" on public.notifications;

drop policy if exists "Users can view own notifications" on public.notifications;
create policy "Users can view own notifications"
  on public.notifications for select
  to authenticated
  using (
    (user_id = auth.uid() and public.is_active_user())
    or public.is_admin()
  );


-- ==============================================================================
-- 8. COMMUNITY POSTS & COMMENTS: Deduplicate and enforce active moderation
-- ==============================================================================
drop policy if exists "Users can create posts" on public.community_posts;
drop policy if exists "Enrolled students and staff can create posts" on public.community_posts;
drop policy if exists "Active users can insert posts" on public.community_posts;
drop policy if exists "Authenticated users can read posts" on public.community_posts;
drop policy if exists "Authenticated users can read published cohort posts" on public.community_posts;

drop policy if exists "Active users can view posts" on public.community_posts;
create policy "Active users can view posts"
  on public.community_posts for select
  to authenticated
  using (
    public.is_active_user()
    and (moderation_status <> 'hidden' or author_id = auth.uid() or public.is_mentor_or_admin())
  );

drop policy if exists "Active users can insert community posts" on public.community_posts;
create policy "Active users can insert community posts"
  on public.community_posts for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and public.is_active_user()
  );

-- Deduplicate community comments
drop policy if exists "Authenticated users can read comments" on public.community_comments;
drop policy if exists "Authenticated users can insert comments" on public.community_comments;
drop policy if exists "Users can create comments" on public.community_comments;

drop policy if exists "Active users can view comments" on public.community_comments;
create policy "Active users can view comments"
  on public.community_comments for select
  to authenticated
  using (public.is_active_user());

drop policy if exists "Active users can insert comments" on public.community_comments;
create policy "Active users can insert comments"
  on public.community_comments for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and public.is_active_user()
  );

-- ==============================================================================
-- 9. Server-Side Submission RPC (submit_student_assignment)
-- ==============================================================================
create or replace function public.submit_student_assignment(
  p_assignment_id uuid,
  p_file_url text,
  p_is_draft boolean default false,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
  v_cohort_id uuid;
  v_deadline timestamptz;
  v_new_status text;
  v_is_late boolean := false;
  v_existing record;
  v_new_version integer := 1;
  v_result record;
begin
  v_student_id := auth.uid();
  if v_student_id is null then
    raise exception 'Authentication required to submit assignment.'
      using errcode = '42501';
  end if;

  if not public.is_active_user() then
    raise exception 'Account is not active. Submissions are disabled.'
      using errcode = 'P0001';
  end if;

  -- Resolve cohort and deadline via lesson and module hierarchy
  select m.cohort_id, a.deadline
  into v_cohort_id, v_deadline
  from public.assignments a
  left join public.lessons l on l.id = a.lesson_id
  left join public.modules m on m.id = l.module_id
  where a.id = p_assignment_id;

  if v_cohort_id is null then
    raise exception 'Assignment % not found or invalid hierarchy.', p_assignment_id
      using errcode = 'P0002';
  end if;

  -- Ensure student is actively enrolled
  if not exists (
    select 1 from public.enrollments
    where cohort_id = v_cohort_id
      and user_id = v_student_id
      and status in ('enrolled', 'active')
  ) and not public.is_admin() then
    raise exception 'You must be actively enrolled in this cohort to submit assignments.'
      using errcode = '42501';
  end if;

  if v_deadline is not null and now() > v_deadline then
    v_is_late := true;
  end if;

  if p_is_draft then
    v_new_status := 'draft';
  else
    v_new_status := 'pending';
  end if;

  select id, coalesce(version_number, version, 1) as ver, file_url, notes, status
  into v_existing
  from public.submissions
  where assignment_id = p_assignment_id and student_id = v_student_id;

  if found then
    v_new_version := coalesce(v_existing.ver, 1) + 1;

    insert into public.submission_versions (
      submission_id,
      version_number,
      version,
      file_url,
      notes,
      status,
      created_at,
      submitted_at
    )
    values (
      v_existing.id,
      coalesce(v_existing.ver, 1),
      coalesce(v_existing.ver, 1),
      v_existing.file_url,
      v_existing.notes,
      v_existing.status,
      now(),
      now()
    );

    update public.submissions
    set
      file_url = p_file_url,
      status = v_new_status,
      notes = p_notes,
      is_late = v_is_late,
      version_number = v_new_version,
      version = v_new_version,
      updated_at = now()
    where id = v_existing.id
    returning * into v_result;
  else
    insert into public.submissions (
      assignment_id,
      student_id,
      file_url,
      status,
      notes,
      is_late,
      version_number,
      version,
      created_at,
      updated_at
    )
    values (
      p_assignment_id,
      v_student_id,
      p_file_url,
      v_new_status,
      p_notes,
      v_is_late,
      1,
      1,
      now(),
      now()
    )
    returning * into v_result;
  end if;

  return to_jsonb(v_result);
end;
$$;

grant execute on function public.submit_student_assignment(uuid, text, boolean, text) to authenticated;

-- ==============================================================================
-- 10. Feedback Column Harmonization & Audit Trigger Fix
-- Fixes: record "new" has no field "rubric_scores" when review_submission_v2 is called
-- ==============================================================================
alter table public.feedback
  add column if not exists rubric jsonb default '{}'::jsonb,
  add column if not exists rubric_scores jsonb default '{}'::jsonb;

update public.feedback
set rubric_scores = rubric
where (rubric_scores is null or rubric_scores = '{}'::jsonb) and rubric is not null;

create or replace function public.fn_audit_feedback_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rubric jsonb;
  v_record_json jsonb;
begin
  if (TG_OP = 'INSERT') then
    v_record_json := to_jsonb(new);
    v_rubric := coalesce(v_record_json->'rubric', v_record_json->'rubric_scores', '{}'::jsonb);

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
        'rubric', v_rubric
      ),
      now()
    );
  end if;
  return new;
end;
$$;

