-- ==============================================================================
-- supabase/migrations/20260921000003_storage_and_hardening.sql
-- Production Security & Storage Lockdown:
-- 1. Private storage bucket configuration for student submissions
-- 2. Strict signed URL access policies for storage objects (owner, assigned mentor, admin)
-- 3. Submission integrity protection (database trigger preventing status/owner/assignment tampering)
-- 4. Lesson resource visibility enforcement (public, enrolled, after_completion)
-- 5. Airtight Row Level Security across all 7 core entities:
--    - profiles, enrollments, submissions, feedback, notifications, lesson_resources, storage
-- 6. Server-side submission RPC (submit_student_assignment) & versioning archive
-- ==============================================================================

-- ==============================================================================
-- 1. Schema Hardening & Column Compatibility
-- ==============================================================================

-- Ensure submissions table has both version and version_number columns
alter table public.submissions
  add column if not exists version_number integer default 1,
  add column if not exists version integer default 1,
  add column if not exists updated_at timestamptz not null default now();

-- Ensure lesson_resources has all metadata and visibility columns
alter table public.lesson_resources
  add column if not exists name text,
  add column if not exists title text,
  add column if not exists url text,
  add column if not exists file_url text,
  add column if not exists file_size bigint,
  add column if not exists resource_type text not null default 'other',
  add column if not exists visibility text not null default 'enrolled' check (visibility in ('enrolled', 'public', 'after_completion'));

create index if not exists idx_lesson_resources_visibility on public.lesson_resources(visibility);
create index if not exists idx_lesson_resources_lesson_id on public.lesson_resources(lesson_id);

-- Keep name/title and url/file_url synchronized on lesson_resources
create or replace function public.trg_sync_lesson_resource_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.name is null and new.title is not null then
    new.name := new.title;
  elsif new.title is null and new.name is not null then
    new.title := new.name;
  end if;

  if new.url is null and new.file_url is not null then
    new.url := new.file_url;
  elsif new.file_url is null and new.url is not null then
    new.file_url := new.url;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_lesson_resource_columns on public.lesson_resources;
create trigger trg_sync_lesson_resource_columns
  before insert or update on public.lesson_resources
  for each row
  execute function public.trg_sync_lesson_resource_columns();

-- Ensure submission_versions table exists with versioning columns
create table if not exists public.submission_versions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  version_number integer default 1,
  version integer default 1,
  file_url text not null,
  notes text,
  status text not null,
  created_at timestamptz not null default now(),
  submitted_at timestamptz not null default now()
);

create index if not exists idx_submission_versions_submission_id on public.submission_versions(submission_id);
alter table public.submission_versions enable row level security;

-- ==============================================================================
-- 2. Storage Buckets & Strict Storage Policies
-- ==============================================================================

-- A. Lock down submissions bucket as private (public = false)
insert into storage.buckets (id, name, public)
values ('submissions', 'submissions', false)
on conflict (id) do update set public = false;

insert into storage.buckets (id, name, public)
values ('course-assets', 'course-assets', true)
on conflict (id) do update set public = true;

-- B. Strict read policy: only submission owner, assigned cohort mentor, or admin
drop policy if exists "Strict submission access control" on storage.objects;
drop policy if exists "Authenticated users can read submissions" on storage.objects;
create policy "Strict submission access control"
on storage.objects for select
to authenticated
using (
  bucket_id = 'submissions'
  and public.is_active_user()
  and (
    -- Submission owner
    (storage.foldername(name))[1] = auth.uid()::text
    -- Platform Admin
    or public.is_admin()
    -- Assigned mentor for student's cohort
    or exists (
      select 1 from public.submissions s
      join public.assignments a on a.id = s.assignment_id
      where s.student_id = ((storage.foldername(name))[1])::uuid
        and public.is_mentor_for_cohort(a.cohort_id)
    )
  )
);

-- C. Students can upload into their own folder only
drop policy if exists "Students can upload their submissions" on storage.objects;
create policy "Students can upload their submissions"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'submissions'
  and public.is_active_user()
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- D. Students can update their own uploads
drop policy if exists "Students can update their submissions" on storage.objects;
create policy "Students can update their submissions"
on storage.objects for update
to authenticated
using (
  bucket_id = 'submissions'
  and public.is_active_user()
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- E. Course assets storage policies
drop policy if exists "Authenticated users can read course assets" on storage.objects;
create policy "Authenticated users can read course assets"
on storage.objects for select
to authenticated
using (bucket_id = 'course-assets');

drop policy if exists "Admins can upload course assets" on storage.objects;
create policy "Admins can upload course assets"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'course-assets'
  and public.is_admin()
);

drop policy if exists "Admins can update course assets" on storage.objects;
create policy "Admins can update course assets"
on storage.objects for update
to authenticated
using (
  bucket_id = 'course-assets'
  and public.is_admin()
);

drop policy if exists "Admins can delete course assets" on storage.objects;
create policy "Admins can delete course assets"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'course-assets'
  and public.is_admin()
);

-- ==============================================================================
-- 3. Submission Integrity Protection (Database Triggers)
-- ==============================================================================

-- Prevents students from changing submission status to reviewed, altering owner, or tampering with assignment_id
create or replace function public.trg_enforce_submission_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Prevent student_id tampering on existing submission
  if new.student_id <> old.student_id then
    raise exception 'Unauthorized: Cannot modify student_id on an existing submission.'
      using errcode = '42501';
  end if;

  -- Prevent assignment_id tampering on existing submission
  if new.assignment_id <> old.assignment_id then
    raise exception 'Unauthorized: Cannot modify assignment_id on an existing submission.'
      using errcode = '42501';
  end if;

  -- Prevent students from self-approving or setting status to 'reviewed'
  if not public.is_mentor_or_admin() then
    if new.status in ('reviewed', 'approved') and old.status not in ('reviewed', 'approved') then
      raise exception 'Unauthorized: Only designated cohort mentors and platform administrators can mark submissions as reviewed.'
        using errcode = '42501';
    end if;

    -- Students can only transition submissions between draft, pending, and resubmit
    if new.status not in ('draft', 'pending', 'resubmit') then
      raise exception 'Unauthorized: Invalid submission status % requested by student.', new.status
        using errcode = '42501';
    end if;
  end if;

  -- Keep version and version_number in sync
  if new.version_number is not null and (new.version is null or new.version <> new.version_number) then
    new.version := new.version_number;
  elsif new.version is not null and (new.version_number is null or new.version_number <> new.version) then
    new.version_number := new.version;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_enforce_submission_integrity on public.submissions;
create trigger trg_enforce_submission_integrity
  before update on public.submissions
  for each row
  execute function public.trg_enforce_submission_integrity();

-- Enforce integrity on new submissions insert
create or replace function public.trg_enforce_submission_insert_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_mentor_or_admin() then
    if new.student_id <> auth.uid() then
      raise exception 'Unauthorized: Submissions must belong to the authenticated user.'
        using errcode = '42501';
    end if;

    if new.status not in ('draft', 'pending') then
      raise exception 'Unauthorized: New submissions must have draft or pending status.'
        using errcode = '42501';
    end if;
  end if;

  if new.version_number is null then
    new.version_number := coalesce(new.version, 1);
  end if;
  if new.version is null then
    new.version := new.version_number;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_submission_insert_integrity on public.submissions;
create trigger trg_enforce_submission_insert_integrity
  before insert on public.submissions
  for each row
  execute function public.trg_enforce_submission_insert_integrity();

-- ==============================================================================
-- 4. Row Level Security: Submissions & Submission Versions
-- ==============================================================================
alter table public.submissions enable row level security;

-- Submissions Select: Owner, Assigned Mentor, or Admin
drop policy if exists "Submissions select policy" on public.submissions;
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

-- Submissions Insert: Owner only with draft or pending status
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

-- Submissions Update: Student can only update their own draft/pending/resubmit
drop policy if exists "Students can update draft or pending submissions" on public.submissions;
drop policy if exists "Students can update own submissions" on public.submissions;
drop policy if exists "Students and staff can update submissions" on public.submissions;
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

-- Mentors and Admins can update submissions
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

-- Submission Versions: Select policy
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
-- 5. Row Level Security: Lesson Resources (Visibility Enforcement)
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
        -- Public resource: accessible to any active authenticated user
        coalesce(lesson_resources.visibility, 'enrolled') = 'public'
        -- Enrolled resource: accessible to enrolled students in active status or assigned mentors
        or (
          coalesce(lesson_resources.visibility, 'enrolled') = 'enrolled'
          and (
            exists (
              select 1 from public.enrollments e
              where e.cohort_id = m.cohort_id
                and e.user_id = auth.uid()
                and coalesce(e.status, 'active') in ('active', 'enrolled')
            )
            or public.is_mentor_for_cohort(m.cohort_id)
          )
        )
        -- After completion resource: accessible to enrolled students who completed the lesson or assigned mentors
        or (
          coalesce(lesson_resources.visibility, 'enrolled') = 'after_completion'
          and (
            exists (
              select 1 from public.lesson_progress lp
              join public.enrollments e on e.cohort_id = m.cohort_id and e.user_id = auth.uid()
              where lp.lesson_id = l.id
                and lp.user_id = auth.uid()
                and (lp.completed = true or coalesce(lp.watch_percentage, 0) >= 80)
                and coalesce(e.status, 'active') in ('active', 'enrolled')
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

-- ==============================================================================
-- 6. Row Level Security: Profiles, Enrollments, Feedback, Notifications
-- ==============================================================================

-- A. Profiles
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
    and role = (select p.role from public.profiles p where p.id = auth.uid())
    and coalesce(status, 'active') = (select coalesce(p.status, 'active') from public.profiles p where p.id = auth.uid())
  );

drop policy if exists "Admins can update user profiles" on public.profiles;
create policy "Admins can update user profiles"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- B. Enrollments
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
    and status in ('enrolled', 'active')
  );

drop policy if exists "Admins have full management on enrollments" on public.enrollments;
create policy "Admins have full management on enrollments"
  on public.enrollments for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- C. Feedback
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

drop policy if exists "Mentors and Admins can update feedback" on public.feedback;
create policy "Mentors and Admins can update feedback"
  on public.feedback for update
  to authenticated
  using (
    public.is_admin()
    or (mentor_id = auth.uid() and public.is_mentor_or_admin())
    or exists (
      select 1 from public.submissions s
      where s.id = feedback.submission_id
      and s.student_id = auth.uid()
    )
  );

-- D. Notifications
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
-- 7. Server-Side Submission RPC (submit_student_assignment)
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

  -- Resolve cohort and deadline
  select a.cohort_id, a.deadline
  into v_cohort_id, v_deadline
  from public.assignments a
  where a.id = p_assignment_id;

  if v_cohort_id is null then
    -- Fallback: resolve via module
    select m.cohort_id, a.deadline
    into v_cohort_id, v_deadline
    from public.assignments a
    left join public.lessons l on l.id = a.lesson_id
    left join public.modules m on m.id = coalesce(a.module_id, l.module_id)
    where a.id = p_assignment_id;
  end if;

  if v_cohort_id is null then
    raise exception 'Assignment % not found.', p_assignment_id
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
