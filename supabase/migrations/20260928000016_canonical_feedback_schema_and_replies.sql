-- ==============================================================================
-- Migration: 20260928000016_canonical_feedback_schema_and_replies.sql
-- Description: Canonical Feedback Schema Reconciliation, Replies, and Read Status
--   1. Dual-Column Feedback Schema Reconciliation:
--      - Guarantees comment, comments, rubric, rubric_scores, timestamped_notes,
--        private_notes, and student_read_at exist on public.feedback.
--      - Drops strict NOT NULL constraint on comment & comments so either can be supplied.
--      - Authoritative trigger trg_sync_feedback_columns bidirectionally synchronizes
--        comment <-> comments and rubric <-> rubric_scores on INSERT or UPDATE.
--      - Backfills existing feedback records to ensure complete parity.
--   2. Canonical Feedback Replies Table (public.feedback_replies):
--      - Formalizes feedback_replies into canonical migrations.
--      - Foreign keys to feedback(id) and profiles(id) with CASCADE deletion.
--      - High-performance indexes on (feedback_id, created_at) and (author_id).
--      - Granular RLS policies for thread participants (students, mentors, admins).
--   3. Authoritative Read Tracking & Acknowledgments:
--      - RLS policy allowing students to update student_read_at on their own feedback.
--      - Canonical RPC public.mark_feedback_as_read(p_feedback_id uuid) with
--        authorization guards and security definer execution.
-- ==============================================================================

-- 1. Ensure all canonical feedback columns exist
alter table public.feedback
  add column if not exists comment text,
  add column if not exists comments text,
  add column if not exists rubric jsonb not null default '{}'::jsonb,
  add column if not exists rubric_scores jsonb default '{}'::jsonb,
  add column if not exists timestamped_notes jsonb not null default '[]'::jsonb,
  add column if not exists private_notes text,
  add column if not exists student_read_at timestamptz default null;

-- Safely drop NOT NULL on comment and comments if present
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

-- 2. Bidirectional Dual-Column Synchronization Trigger
create or replace function public.fn_sync_feedback_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Bidirectional sync for comment <-> comments
  if new.comments is not null and (new.comment is null or new.comment = '') then
    new.comment := new.comments;
  elsif new.comment is not null and (new.comments is null or new.comments = '') then
    new.comments := new.comment;
  elsif TG_OP = 'UPDATE' then
    if new.comments is distinct from old.comments and new.comment is not distinct from old.comment then
      new.comment := new.comments;
    elsif new.comment is distinct from old.comment and new.comments is not distinct from old.comments then
      new.comments := new.comment;
    end if;
  end if;

  -- Default to empty string if both remain null
  if new.comment is null and new.comments is null then
    new.comment := '';
    new.comments := '';
  end if;

  -- Bidirectional sync for rubric <-> rubric_scores
  if new.rubric is not null and new.rubric != '{}'::jsonb and (new.rubric_scores is null or new.rubric_scores = '{}'::jsonb) then
    new.rubric_scores := new.rubric;
  elsif new.rubric_scores is not null and new.rubric_scores != '{}'::jsonb and (new.rubric is null or new.rubric = '{}'::jsonb) then
    new.rubric := new.rubric_scores;
  elsif TG_OP = 'UPDATE' then
    if new.rubric is distinct from old.rubric and new.rubric_scores is not distinct from old.rubric_scores then
      new.rubric_scores := new.rubric;
    elsif new.rubric_scores is distinct from old.rubric_scores and new.rubric is not distinct from old.rubric then
      new.rubric := new.rubric_scores;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_feedback_columns on public.feedback;
create trigger trg_sync_feedback_columns
  before insert or update on public.feedback
  for each row
  execute function public.fn_sync_feedback_columns();

-- One-time backfill of existing feedback records for dual-column consistency
update public.feedback
set
  comment = coalesce(nullif(comment, ''), comments, ''),
  comments = coalesce(nullif(comments, ''), comment, ''),
  rubric = coalesce(nullif(rubric, '{}'::jsonb), rubric_scores, '{}'::jsonb),
  rubric_scores = coalesce(nullif(rubric_scores, '{}'::jsonb), rubric, '{}'::jsonb)
where
  (comment is null or comments is null or comment = '' or comments = '')
  or (rubric is distinct from rubric_scores);

-- Performance indices for feedback queries
create index if not exists idx_feedback_submission_created
  on public.feedback(submission_id, created_at desc);

create index if not exists idx_feedback_student_read
  on public.feedback(submission_id, student_read_at);

create index if not exists idx_feedback_mentor
  on public.feedback(mentor_id);

-- 3. Canonical Feedback Replies Table
create table if not exists public.feedback_replies (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.feedback(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_feedback_replies_feedback
  on public.feedback_replies(feedback_id, created_at asc);

create index if not exists idx_feedback_replies_author
  on public.feedback_replies(author_id);

alter table public.feedback_replies enable row level security;

-- 4. Granular RLS Policies for feedback_replies

-- SELECT Policy: Thread participants, assigned mentors, and admins
drop policy if exists "Feedback replies select policy" on public.feedback_replies;
drop policy if exists "Feedback replies readable by thread participants and staff" on public.feedback_replies;
create policy "Feedback replies select policy"
  on public.feedback_replies for select
  to authenticated
  using (
    public.is_admin()
    or author_id = auth.uid()
    or exists (
      select 1
      from public.feedback f
      join public.submissions s on s.id = f.submission_id
      where f.id = feedback_replies.feedback_id
        and (
          s.student_id = auth.uid()
          or f.mentor_id = auth.uid()
          or public.is_mentor_for_student(s.student_id)
          or public.is_mentor_assigned_to_submission(s.id)
        )
    )
  );

-- INSERT Policy: Thread participants posting as themselves
drop policy if exists "Feedback replies insert policy" on public.feedback_replies;
drop policy if exists "Users can post feedback replies on own submissions" on public.feedback_replies;
create policy "Feedback replies insert policy"
  on public.feedback_replies for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and (
      public.is_admin()
      or exists (
        select 1
        from public.feedback f
        join public.submissions s on s.id = f.submission_id
        where f.id = feedback_replies.feedback_id
          and (
            s.student_id = auth.uid()
            or f.mentor_id = auth.uid()
            or public.is_mentor_for_student(s.student_id)
            or public.is_mentor_assigned_to_submission(s.id)
          )
      )
    )
  );

-- UPDATE Policy: Reply author or admin can update
drop policy if exists "Feedback replies update policy" on public.feedback_replies;
create policy "Feedback replies update policy"
  on public.feedback_replies for update
  to authenticated
  using (
    public.is_admin() or author_id = auth.uid()
  )
  with check (
    public.is_admin() or author_id = auth.uid()
  );

-- DELETE Policy: Reply author or admin can delete
drop policy if exists "Feedback replies delete policy" on public.feedback_replies;
create policy "Feedback replies delete policy"
  on public.feedback_replies for delete
  to authenticated
  using (
    public.is_admin() or author_id = auth.uid()
  );

-- 5. Student Read Tracking & Acknowledgment on Feedback

-- RLS Update Policy: Allow students to update student_read_at on their own feedback
drop policy if exists "Students can mark feedback as read" on public.feedback;
create policy "Students can mark feedback as read"
  on public.feedback for update
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.submissions s
      where s.id = feedback.submission_id
        and s.student_id = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.submissions s
      where s.id = feedback.submission_id
        and s.student_id = auth.uid()
    )
  );

-- Authoritative RPC to mark feedback as read
create or replace function public.mark_feedback_as_read(
  p_feedback_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  update public.feedback
  set student_read_at = now()
  where id = p_feedback_id
    and (
      public.is_admin()
      or exists (
        select 1 from public.submissions s
        where s.id = feedback.submission_id
          and s.student_id = v_user_id
      )
    );

  if not found then
    raise exception 'Feedback % not found or permission denied', p_feedback_id
      using errcode = 'P0002';
  end if;
end;
$$;

grant execute on function public.mark_feedback_as_read(uuid) to authenticated;

