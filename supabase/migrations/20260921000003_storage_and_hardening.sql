-- ==============================================================================
-- supabase/migrations/20260921000003_storage_and_hardening.sql
-- Storage Privacy Lockdown, Signed URL Policies, and Secure Mutation RPCs
-- ==============================================================================

-- 1. Lock down submissions bucket (private)
insert into storage.buckets (id, name, public)
values ('submissions', 'submissions', false)
on conflict (id) do update set public = false;

insert into storage.buckets (id, name, public)
values ('course-assets', 'course-assets', true)
on conflict (id) do update set public = true;

-- 2. Strict read policy for student submissions in storage
drop policy if exists "Strict submission access control" on storage.objects;
drop policy if exists "Authenticated users can read submissions" on storage.objects;
create policy "Strict submission access control"
on storage.objects for select
to authenticated
using (
  bucket_id = 'submissions'
  and (
    -- Case A: The authenticated user is the student who owns the folder
    (storage.foldername(name))[1] = auth.uid()::text
    -- Case B: The authenticated user is an active administrator
    or public.is_admin()
    -- Case C: The authenticated user is an active mentor assigned to the student's cohort
    or exists (
      select 1 from public.submissions s
      join public.assignments a on a.id = s.assignment_id
      where s.student_id = ((storage.foldername(name))[1])::uuid
        and public.is_mentor_for_cohort(a.cohort_id)
    )
  )
);

-- 3. Submission Versions Table (Revisions Archive)
create table if not exists public.submission_versions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  version integer not null,
  file_url text not null,
  notes text,
  status text not null,
  submitted_at timestamptz not null default now()
);

alter table public.submission_versions enable row level security;

drop policy if exists "Students can view own submission versions" on public.submission_versions;
create policy "Students can view own submission versions"
  on public.submission_versions for select
  to authenticated
  using (
    exists (
      select 1 from public.submissions s
      where s.id = submission_versions.submission_id
        and (s.student_id = auth.uid() or public.is_mentor_for_student(s.student_id) or public.is_admin())
    )
  );

-- 4. Server-Side Submission RPC (Guarantees integrity, prevents status escalation)
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
  v_assignment record;
  v_existing record;
  v_new_status text;
  v_is_late boolean := false;
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

  select id, cohort_id, deadline
  into v_assignment
  from public.assignments
  where id = p_assignment_id;

  if not found then
    raise exception 'Assignment % not found.', p_assignment_id
      using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.enrollments
    where cohort_id = v_assignment.cohort_id
      and user_id = v_student_id
      and status in ('enrolled', 'active')
  ) and not public.is_admin() then
    raise exception 'You must be actively enrolled in this cohort to submit assignments.'
      using errcode = '42501';
  end if;

  if v_assignment.deadline is not null and now() > v_assignment.deadline then
    v_is_late := true;
  end if;

  if p_is_draft then
    v_new_status := 'draft';
  else
    v_new_status := 'pending';
  end if;

  select id, version, file_url, notes, status
  into v_existing
  from public.submissions
  where assignment_id = p_assignment_id and student_id = v_student_id;

  if found then
    v_new_version := coalesce(v_existing.version, 1) + 1;

    insert into public.submission_versions (
      submission_id,
      version,
      file_url,
      notes,
      status,
      submitted_at
    )
    values (
      v_existing.id,
      coalesce(v_existing.version, 1),
      v_existing.file_url,
      v_existing.notes,
      v_existing.status,
      now()
    );

    update public.submissions
    set
      file_url = p_file_url,
      status = v_new_status,
      notes = p_notes,
      is_late = v_is_late,
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
      now(),
      now()
    )
    returning * into v_result;
  end if;

  return to_jsonb(v_result);
end;
$$;

