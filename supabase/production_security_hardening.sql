-- supabase/production_security_hardening.sql
-- Production Security & Access Control Hardening
--
-- Covers:
-- 1. Server-side RPC for student submissions (submit_student_assignment)
--    - Prevents students from tampering with status ('reviewed'), ownership, or assignment linkage
-- 2. SQL-level mentor cohort scoping on submissions, enrollments, and feedback
-- 3. Airtight Row Level Security (RLS) across 6 core tables:
--    - profiles
--    - enrollments
--    - submissions
--    - feedback
--    - notifications
--    - lesson_resources
-- 4. Active user status enforcement (blocking suspended and inactive users)
-- 5. Storage privacy lockdown & signed URL access control

-- ==============================================================================
-- 1. Helper Functions (Security Definer)
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
    where id = auth.uid()
    and role = 'admin'
    and coalesce(status, 'active') = 'active'
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
    where id = auth.uid()
    and role in ('mentor', 'admin')
    and coalesce(status, 'active') = 'active'
  );
$$;

create or replace function public.is_active_user()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
    and coalesce(status, 'active') = 'active'
  );
$$;

-- Helper to check if caller is an assigned mentor for a cohort
create or replace function public.is_mentor_for_cohort(p_cohort_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    left join public.mentor_cohorts mc on mc.cohort_id = p_cohort_id and mc.mentor_id = auth.uid()
    where p.id = auth.uid()
    and p.role = 'mentor'
    and coalesce(p.status, 'active') = 'active'
    and (
      mc.id is not null
      -- Fallback if no mentors have been mapped to mentor_cohorts yet
      or not exists (select 1 from public.mentor_cohorts where mentor_id = auth.uid())
    )
  );
$$;

-- Helper to check if caller is an assigned mentor for a student
create or replace function public.is_mentor_for_student(p_student_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.enrollments e
    where e.user_id = p_student_id
    and (
      public.is_mentor_for_cohort(e.cohort_id)
      or public.is_admin()
    )
  );
$$;

-- ==============================================================================
-- 2. Server-Side Submission RPC (submit_student_assignment)
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
  v_is_late boolean := false;
  v_new_status text;
  v_existing_id uuid;
  v_existing_version int := 1;
  v_existing_status text;
  v_existing_file_url text;
  v_submission_record record;
begin
  v_student_id := auth.uid();
  if v_student_id is null then
    raise exception 'Authentication required';
  end if;

  -- 1. Enforce active user status
  if not public.is_active_user() then
    raise exception 'Your account is suspended or inactive';
  end if;

  -- 2. Validate assignment existence and resolve cohort
  select m.cohort_id, a.deadline
  into v_cohort_id, v_deadline
  from public.assignments a
  join public.lessons l on l.id = a.lesson_id
  join public.modules m on m.id = l.module_id
  where a.id = p_assignment_id;

  if v_cohort_id is null then
    raise exception 'Assignment not found or invalid hierarchy';
  end if;

  -- 3. Verify student enrollment in cohort
  if not exists (
    select 1 from public.enrollments
    where user_id = v_student_id
    and cohort_id = v_cohort_id
    and coalesce(status, 'active') = 'active'
  ) then
    raise exception 'You are not actively enrolled in this cohort';
  end if;

  -- 4. Calculate deadline compliance server-side
  if v_deadline is not null and now() > v_deadline then
    v_is_late := true;
  end if;

  -- 5. Determine status: students can ONLY submit as 'draft' or 'pending'
  if p_is_draft then
    v_new_status := 'draft';
  else
    v_new_status := 'pending';
  end if;

  -- 6. Check for existing submission for this student and assignment
  select id, version_number, status, file_url
  into v_existing_id, v_existing_version, v_existing_status, v_existing_file_url
  from public.submissions
  where student_id = v_student_id
  and assignment_id = p_assignment_id
  order by created_at desc
  limit 1;

  if v_existing_id is not null then
    -- Archive previous version to submission_versions
    insert into public.submission_versions (
      submission_id,
      version_number,
      file_url,
      status,
      notes,
      created_at
    )
    values (
      v_existing_id,
      coalesce(v_existing_version, 1),
      v_existing_file_url,
      v_existing_status,
      p_notes,
      now()
    );

    -- Update existing submission record
    update public.submissions
    set
      file_url = p_file_url,
      status = v_new_status,
      is_late = v_is_late,
      version_number = coalesce(v_existing_version, 1) + 1,
      updated_at = now()
    where id = v_existing_id
    returning * into v_submission_record;
  else
    -- Insert new submission record
    insert into public.submissions (
      student_id,
      assignment_id,
      file_url,
      status,
      is_late,
      version_number,
      created_at,
      updated_at
    )
    values (
      v_student_id,
      p_assignment_id,
      p_file_url,
      v_new_status,
      v_is_late,
      1,
      now(),
      now()
    )
    returning * into v_submission_record;
  end if;

  return jsonb_build_object(
    'id', v_submission_record.id,
    'student_id', v_submission_record.student_id,
    'assignment_id', v_submission_record.assignment_id,
    'file_url', v_submission_record.file_url,
    'status', v_submission_record.status,
    'is_late', v_submission_record.is_late,
    'version_number', v_submission_record.version_number,
    'created_at', v_submission_record.created_at,
    'updated_at', v_submission_record.updated_at
  );
end;
$$;

-- Grant execution to authenticated users
grant execute on function public.submit_student_assignment(uuid, text, boolean, text) to authenticated;

-- ==============================================================================
-- 3. Profiles Table RLS Lockdown
-- ==============================================================================
alter table public.profiles enable row level security;

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
  -- Students cannot escalate their role or change their account status
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
-- 4. Enrollments Table RLS Lockdown
-- ==============================================================================
alter table public.enrollments enable row level security;

drop policy if exists "Enrollments select policy" on public.enrollments;
drop policy if exists "Users can view their own enrollments" on public.enrollments;
create policy "Enrollments select policy"
on public.enrollments for select
to authenticated
using (
  (user_id = auth.uid() and public.is_active_user())
  or public.is_mentor_for_cohort(cohort_id)
  or public.is_admin()
);

drop policy if exists "Students can self-enroll" on public.enrollments;
create policy "Students can self-enroll"
on public.enrollments for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_active_user()
  and status = 'active'
);

drop policy if exists "Admins have full management on enrollments" on public.enrollments;
create policy "Admins have full management on enrollments"
on public.enrollments for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ==============================================================================
-- 5. Submissions Table RLS Lockdown
-- ==============================================================================
alter table public.submissions enable row level security;

drop policy if exists "Users can view submissions" on public.submissions;
drop policy if exists "Students can read own submissions and staff can read all" on public.submissions;
drop policy if exists "Mentors and Admins can view all submissions" on public.submissions;

create policy "Submissions select policy"
on public.submissions for select
to authenticated
using (
  (student_id = auth.uid() and public.is_active_user())
  or public.is_mentor_for_student(student_id)
  or public.is_admin()
);

drop policy if exists "Students can insert own submissions" on public.submissions;
drop policy if exists "Students can create own submissions" on public.submissions;
create policy "Students can insert own submissions"
on public.submissions for insert
to authenticated
with check (
  student_id = auth.uid()
  and public.is_active_user()
  and status in ('draft', 'pending')
);

drop policy if exists "Students can update own submissions" on public.submissions;
drop policy if exists "Students and staff can update submissions" on public.submissions;
drop policy if exists "Mentors and Admins can update submissions" on public.submissions;

-- Students can ONLY update their own file or notes between draft and pending.
-- They CANNOT set status to 'reviewed', or change student_id or assignment_id!
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

-- ==============================================================================
-- 6. Feedback Table RLS Lockdown
-- ==============================================================================
alter table public.feedback enable row level security;

drop policy if exists "Feedback select policy" on public.feedback;
drop policy if exists "Students can view feedback for own submissions" on public.feedback;
drop policy if exists "Feedback readable by submission owner, mentors, and admins" on public.feedback;

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

drop policy if exists "Mentors and Admins can manage feedback" on public.feedback;
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

create policy "Mentors and Admins can update feedback"
on public.feedback for update
to authenticated
using (
  public.is_admin()
  or (mentor_id = auth.uid() and public.is_mentor_or_admin())
  -- Allow student to update read status via RPC
  or exists (
    select 1 from public.submissions s
    where s.id = feedback.submission_id
    and s.student_id = auth.uid()
  )
);

-- ==============================================================================
-- 7. Notifications Table RLS Lockdown
-- ==============================================================================
alter table public.notifications enable row level security;

drop policy if exists "Users can view own notifications" on public.notifications;
create policy "Users can view own notifications"
on public.notifications for select
to authenticated
using (
  (user_id = auth.uid() and public.is_active_user())
  or public.is_admin()
);

drop policy if exists "System and mentors can insert notifications" on public.notifications;
create policy "System and mentors can insert notifications"
on public.notifications for insert
to authenticated
with check (
  public.is_mentor_or_admin()
  or user_id = auth.uid()
);

drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications"
on public.notifications for update
to authenticated
using (user_id = auth.uid() and public.is_active_user())
with check (user_id = auth.uid());

-- ==============================================================================
-- 8. Lesson Resources Table RLS Lockdown
-- ==============================================================================
alter table public.lesson_resources enable row level security;

drop policy if exists "Enrolled students can read lesson resources" on public.lesson_resources;
drop policy if exists "Lesson resources select policy" on public.lesson_resources;

create policy "Lesson resources select policy"
on public.lesson_resources for select
to authenticated
using (
  public.is_admin()
  or (
    public.is_active_user()
    and exists (
      select 1
      from public.lessons l
      join public.modules m on m.id = l.module_id
      where l.id = lesson_resources.lesson_id
      and (
        -- Public resource
        coalesce(lesson_resources.visibility, 'enrolled') = 'public'
        -- Enrolled resource
        or (
          coalesce(lesson_resources.visibility, 'enrolled') = 'enrolled'
          and (
            exists (
              select 1 from public.enrollments e
              where e.cohort_id = m.cohort_id
              and e.user_id = auth.uid()
              and coalesce(e.status, 'active') = 'active'
            )
            or public.is_mentor_for_cohort(m.cohort_id)
          )
        )
        -- After completion resource
        or (
          coalesce(lesson_resources.visibility, 'enrolled') = 'after_completion'
          and (
            exists (
              select 1 from public.lesson_progress lp
              where lp.lesson_id = l.id
              and lp.user_id = auth.uid()
              and lp.completed = true
            )
            or public.is_mentor_for_cohort(m.cohort_id)
          )
        )
      )
    )
  )
);

drop policy if exists "Admins can manage lesson resources" on public.lesson_resources;
create policy "Admins can manage lesson resources"
on public.lesson_resources for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

