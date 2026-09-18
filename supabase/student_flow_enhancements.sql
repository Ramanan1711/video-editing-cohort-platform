-- ==============================================================================
-- supabase/student_flow_enhancements.sql
-- Comprehensive Student Flow Enhancements Migration
--
-- 1. Lesson Progress Tracking (Watch %, Last Position, Resource Completion)
-- 2. Submissions & Version History (Drafts, Late Flags, Versions)
-- 3. Feedback Dialogues & Replies (Bidirectional Student-Mentor Threads)
-- 4. Authoritative Certificate Validation & Verification RPC
-- 5. Community Architecture (Cohort Discussions, Lesson Q&A, Reactions, Reports)
-- ==============================================================================

-- ==============================================================================
-- 1. Lesson Progress: Watch Percentage & Tracking
-- ==============================================================================
alter table public.lesson_progress
  add column if not exists watch_percentage numeric not null default 0,
  add column if not exists last_position_seconds numeric not null default 0,
  add column if not exists completed_resources jsonb not null default '[]'::jsonb;

-- Index for analytics and streak calculation
create index if not exists idx_lesson_progress_user_watch
  on public.lesson_progress(user_id, watch_percentage);

-- ==============================================================================
-- 2. Submissions Enhancements & Version History
-- ==============================================================================
-- Update check constraint on submissions status to allow 'draft'
alter table public.submissions
  drop constraint if exists submissions_status_check;

alter table public.submissions
  add constraint submissions_status_check
  check (status in ('draft', 'pending', 'reviewed', 'resubmit'));

alter table public.submissions
  add column if not exists is_late boolean not null default false,
  add column if not exists version_number int not null default 1;

-- Submission Versions Archive
create table if not exists public.submission_versions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  version_number int not null,
  file_url text not null,
  status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_submission_versions_sub
  on public.submission_versions(submission_id, version_number);

alter table public.submission_versions enable row level security;

drop policy if exists "Users and staff can view submission versions" on public.submission_versions;
create policy "Users and staff can view submission versions"
  on public.submission_versions for select
  to authenticated
  using (
    exists (
      select 1 from public.submissions s
      where s.id = submission_versions.submission_id
        and (s.student_id = auth.uid() or exists (
          select 1 from public.profiles p where p.id = auth.uid() and p.role in ('mentor', 'admin')
        ))
    )
  );

drop policy if exists "Users can insert own submission versions" on public.submission_versions;
create policy "Users can insert own submission versions"
  on public.submission_versions for insert
  to authenticated
  with check (
    exists (
      select 1 from public.submissions s
      where s.id = submission_versions.submission_id and s.student_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.role in ('mentor', 'admin')
    )
  );

-- ==============================================================================
-- 3. Feedback Replies (Student-Mentor Discussion Loop)
-- ==============================================================================
create table if not exists public.feedback_replies (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.feedback(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_feedback_replies_feedback
  on public.feedback_replies(feedback_id, created_at);

alter table public.feedback_replies enable row level security;

drop policy if exists "Feedback replies readable by thread participants and staff" on public.feedback_replies;
create policy "Feedback replies readable by thread participants and staff"
  on public.feedback_replies for select
  to authenticated
  using (
    exists (
      select 1 from public.feedback f
      join public.submissions s on s.id = f.submission_id
      where f.id = feedback_replies.feedback_id
        and (s.student_id = auth.uid() or f.mentor_id = auth.uid() or exists (
          select 1 from public.profiles p where p.id = auth.uid() and p.role in ('mentor', 'admin')
        ))
    )
  );

drop policy if exists "Users can post feedback replies on own submissions" on public.feedback_replies;
create policy "Users can post feedback replies on own submissions"
  on public.feedback_replies for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.feedback f
      join public.submissions s on s.id = f.submission_id
      where f.id = feedback_replies.feedback_id
        and (s.student_id = auth.uid() or exists (
          select 1 from public.profiles p where p.id = auth.uid() and p.role in ('mentor', 'admin')
        ))
    )
  );

-- ==============================================================================
-- 4. Authoritative Certificate Generation & Eligibility Verification
-- ==============================================================================
create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  certificate_number text unique not null,
  student_id uuid not null references auth.users(id) on delete cascade,
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  issued_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint unique_student_cohort_cert unique (student_id, cohort_id)
);

create index if not exists idx_certificates_student on public.certificates(student_id);
create index if not exists idx_certificates_cohort on public.certificates(cohort_id);

alter table public.certificates enable row level security;

drop policy if exists "Certificates readable by student and staff" on public.certificates;
create policy "Certificates readable by student and staff"
  on public.certificates for select
  to authenticated
  using (
    student_id = auth.uid()
    or exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.role in ('mentor', 'admin')
    )
  );

-- PostgreSQL RPC: Verify & Issue Certificate Authoritatively
create or replace function public.verify_and_issue_certificate(
  p_student_id uuid,
  p_cohort_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enrolled boolean;
  v_total_lessons int;
  v_completed_lessons int;
  v_total_assignments int;
  v_approved_assignments int;
  v_existing_cert record;
  v_cert_number text;
  v_new_cert record;
begin
  -- 1. Check enrollment
  select exists (
    select 1 from public.enrollments
    where user_id = p_student_id and cohort_id = p_cohort_id and status in ('active', 'completed')
  ) into v_enrolled;

  if not v_enrolled then
    return jsonb_build_object(
      'eligible', false,
      'reason', 'Student is not actively enrolled in this cohort.'
    );
  end if;

  -- 2. Count published lessons & completed lessons
  select count(l.id)
  into v_total_lessons
  from public.lessons l
  join public.modules m on m.id = l.module_id
  where m.cohort_id = p_cohort_id;

  select count(distinct lp.lesson_id)
  into v_completed_lessons
  from public.lesson_progress lp
  join public.lessons l on l.id = lp.lesson_id
  join public.modules m on m.id = l.module_id
  where lp.user_id = p_student_id
    and m.cohort_id = p_cohort_id
    and lp.completed = true;

  if v_total_lessons > 0 and v_completed_lessons < v_total_lessons then
    return jsonb_build_object(
      'eligible', false,
      'reason', format('Only %s of %s lessons completed.', v_completed_lessons, v_total_lessons),
      'completed_lessons', v_completed_lessons,
      'total_lessons', v_total_lessons
    );
  end if;

  -- 3. Count assignments and approved submissions
  select count(id)
  into v_total_assignments
  from public.assignments
  where cohort_id = p_cohort_id;

  select count(distinct s.assignment_id)
  into v_approved_assignments
  from public.submissions s
  join public.assignments a on a.id = s.assignment_id
  where s.student_id = p_student_id
    and a.cohort_id = p_cohort_id
    and s.status = 'reviewed';

  if v_total_assignments > 0 and v_approved_assignments < v_total_assignments then
    return jsonb_build_object(
      'eligible', false,
      'reason', format('Only %s of %s assignments approved by mentor.', v_approved_assignments, v_total_assignments),
      'approved_assignments', v_approved_assignments,
      'total_assignments', v_total_assignments
    );
  end if;

  -- 4. Check if certificate already issued
  select * from public.certificates
  where student_id = p_student_id and cohort_id = p_cohort_id
  into v_existing_cert;

  if v_existing_cert.id is not null then
    return jsonb_build_object(
      'eligible', true,
      'already_issued', true,
      'certificate_number', v_existing_cert.certificate_number,
      'issued_at', v_existing_cert.issued_at
    );
  end if;

  -- 5. Issue new authoritative certificate
  v_cert_number := 'CC-' || to_char(now(), 'YYYYMM') || '-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));

  insert into public.certificates (certificate_number, student_id, cohort_id, issued_at, metadata)
  values (
    v_cert_number,
    p_student_id,
    p_cohort_id,
    now(),
    jsonb_build_object(
      'total_lessons', v_total_lessons,
      'total_assignments', v_total_assignments,
      'verified_by', 'system'
    )
  )
  returning * into v_new_cert;

  -- Update enrollment status to completed
  update public.enrollments
  set status = 'completed'
  where user_id = p_student_id and cohort_id = p_cohort_id;

  return jsonb_build_object(
    'eligible', true,
    'already_issued', false,
    'certificate_number', v_new_cert.certificate_number,
    'issued_at', v_new_cert.issued_at
  );
end;
$$;

-- ==============================================================================
-- 5. Community Architecture: Discussions, Q&A, Reactions, Reports
-- ==============================================================================
alter table public.community_posts
  add column if not exists cohort_id uuid references public.cohorts(id) on delete cascade,
  add column if not exists lesson_id uuid references public.lessons(id) on delete cascade,
  add column if not exists title text,
  add column if not exists is_pinned boolean not null default false,
  add column if not exists moderation_status text not null default 'published';

-- Constraint for moderation status
alter table public.community_posts
  drop constraint if exists community_posts_moderation_check;
alter table public.community_posts
  add constraint community_posts_moderation_check
  check (moderation_status in ('published', 'flagged', 'hidden'));

create index if not exists idx_community_posts_cohort on public.community_posts(cohort_id, created_at desc);
create index if not exists idx_community_posts_lesson on public.community_posts(lesson_id);

-- Read access for community posts
drop policy if exists "Authenticated users can read published cohort posts" on public.community_posts;
create policy "Authenticated users can read published cohort posts"
  on public.community_posts for select
  to authenticated
  using (
    moderation_status != 'hidden'
    or author_id = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and role in ('mentor', 'admin'))
  );

drop policy if exists "Enrolled students and staff can create posts" on public.community_posts;
create policy "Enrolled students and staff can create posts"
  on public.community_posts for insert
  to authenticated
  with check (
    author_id = auth.uid()
  );

drop policy if exists "Authors can update own community posts" on public.community_posts;
create policy "Authors can update own community posts"
  on public.community_posts for update
  to authenticated
  using (author_id = auth.uid() or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (author_id = auth.uid() or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Community Comments Policies
drop policy if exists "Authenticated users can read comments" on public.community_comments;
create policy "Authenticated users can read comments"
  on public.community_comments for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can insert comments" on public.community_comments;
create policy "Authenticated users can insert comments"
  on public.community_comments for insert
  to authenticated
  with check (author_id = auth.uid());

-- Community Reactions Table
create table if not exists public.community_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  constraint unique_post_user_emoji unique (post_id, user_id, emoji)
);

create index if not exists idx_community_reactions_post on public.community_reactions(post_id);

alter table public.community_reactions enable row level security;

drop policy if exists "Reactions viewable by all authenticated users" on public.community_reactions;
create policy "Reactions viewable by all authenticated users"
  on public.community_reactions for select
  to authenticated
  using (true);

drop policy if exists "Users can manage own reactions" on public.community_reactions;
create policy "Users can manage own reactions"
  on public.community_reactions for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Community Reports Table (Moderation Queue)
create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_community_reports_post on public.community_reports(post_id);

alter table public.community_reports enable row level security;

drop policy if exists "Staff can view and manage reports" on public.community_reports;
create policy "Staff can view and manage reports"
  on public.community_reports for all
  to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('mentor', 'admin'))
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('mentor', 'admin'))
  );

drop policy if exists "Users can submit reports" on public.community_reports;
create policy "Users can submit reports"
  on public.community_reports for insert
  to authenticated
  with check (reporter_id = auth.uid());

