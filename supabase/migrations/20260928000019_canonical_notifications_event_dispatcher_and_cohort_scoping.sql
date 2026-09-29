-- ==============================================================================
-- Migration: 20260928000019_canonical_notifications_event_dispatcher_and_cohort_scoping.sql
-- Description:
-- 1. Authoritative Event Dispatcher RPCs:
--    - public.dispatch_notification(p_user_id, p_title, p_body, p_category, p_action_url)
--    - public.send_cohort_notification(p_cohort_id, p_title, p_body, p_category, p_action_url, p_target_role)
-- 2. Reliable Database-Level Automated Event Dispatchers:
--    - trg_notify_on_submission: Dispatches notifications on assignment submission/resubmission
--      STRICTLY scoped to mentors assigned to that cohort via public.mentor_cohorts.
--    - trg_notify_on_feedback_reply: Dispatches bidirectional notifications between mentors
--      and students when replies are posted in public.feedback_replies.
--    - trg_notify_on_live_session: Dispatches scheduled workshop reminders to enrolled cohort
--      students and assigned mentors.
-- 3. Schema & Index Hardening on public.notifications:
--    - Fast indexes on user_id, read_at, category, and created_at.
--    - Comprehensive RLS policies covering SELECT, INSERT, UPDATE, and DELETE.
--    - Supabase Realtime publication registration for instantaneous delivery.
-- ==============================================================================

-- 1. Ensure Table Structure & Indexes on public.notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  category text not null default 'system',
  action_url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- Performance and filter indexes
create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_user_unread on public.notifications(user_id) where read_at is null;
create index if not exists idx_notifications_created_at on public.notifications(created_at desc);
create index if not exists idx_notifications_category on public.notifications(category);

-- Dual column compatibility on notifications
alter table public.notifications add column if not exists message text;
alter table public.notifications add column if not exists type text;
alter table public.notifications add column if not exists metadata jsonb default '{}'::jsonb;

-- 2. Authoritative 6-Argument Dispatcher RPC with Metadata Payload
create or replace function public.dispatch_notification(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_category text,
  p_action_url text,
  p_metadata jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notif_id uuid;
  v_clean_title text;
  v_clean_body text;
  v_clean_category text;
begin
  if p_user_id is null or length(trim(coalesce(p_title, ''))) = 0 then
    return null;
  end if;

  v_clean_title := trim(p_title);
  v_clean_body := trim(coalesce(p_body, ''));
  v_clean_category := coalesce(nullif(trim(p_category), ''), 'system');

  insert into public.notifications (
    user_id,
    title,
    body,
    message,
    category,
    type,
    action_url,
    metadata,
    created_at
  )
  values (
    p_user_id,
    v_clean_title,
    v_clean_body,
    v_clean_body,
    v_clean_category,
    v_clean_category,
    p_action_url,
    coalesce(p_metadata, '{}'::jsonb),
    now()
  )
  returning id into v_notif_id;

  return v_notif_id;
end;
$$;

-- 2b. Authoritative 5-Argument Dispatcher RPC (Forwards to 6-arg version with empty metadata)
create or replace function public.dispatch_notification(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_category text default 'system',
  p_action_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.dispatch_notification(
    p_user_id,
    p_title,
    p_body,
    p_category,
    p_action_url,
    '{}'::jsonb
  );
end;
$$;

grant execute on function public.dispatch_notification(uuid, text, text, text, text, jsonb) to authenticated, anon;
grant execute on function public.dispatch_notification(uuid, text, text, text, text) to authenticated, anon;

-- 3. Cohort-Scoped Broadcast Dispatcher RPC
create or replace function public.send_cohort_notification(
  p_cohort_id uuid,
  p_title text,
  p_body text,
  p_category text default 'system',
  p_action_url text default null,
  p_target_role text default 'all'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid := auth.uid();
  v_is_authorized boolean := false;
  v_total_dispatched integer := 0;
  v_inserted_count integer := 0;
begin
  if v_caller_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  -- Verify administrative or cohort-assigned mentor authorization
  if public.is_admin() then
    v_is_authorized := true;
  elsif exists (
    select 1 from public.mentor_cohorts mc
    where mc.cohort_id = p_cohort_id and mc.mentor_id = v_caller_id
  ) then
    v_is_authorized := true;
  end if;

  if not v_is_authorized then
    raise exception 'Unauthorized: Only administrators or assigned cohort mentors can broadcast cohort notifications.'
      using errcode = '42501';
  end if;

  if not exists (select 1 from public.cohorts where id = p_cohort_id) then
    raise exception 'Target cohort % does not exist.', p_cohort_id
      using errcode = '23503';
  end if;

  -- A. Target Students enrolled in this cohort
  if p_target_role in ('students', 'all') then
    insert into public.notifications (
      user_id,
      title,
      body,
      category,
      action_url,
      created_at
    )
    select distinct
      e.user_id,
      trim(p_title),
      trim(coalesce(p_body, '')),
      coalesce(p_category, 'system'),
      p_action_url,
      now()
    from public.enrollments e
    join public.profiles p on p.id = e.user_id
    where e.cohort_id = p_cohort_id
      and e.status in ('enrolled', 'active', 'completed')
      and coalesce(p.status, 'active') = 'active';

    get diagnostics v_inserted_count = row_count;
    v_total_dispatched := v_total_dispatched + v_inserted_count;
  end if;

  -- B. Target Mentors assigned to this cohort via mentor_cohorts
  if p_target_role in ('mentors', 'all') then
    insert into public.notifications (
      user_id,
      title,
      body,
      category,
      action_url,
      created_at
    )
    select distinct
      mc.mentor_id,
      trim(p_title),
      trim(coalesce(p_body, '')),
      coalesce(p_category, 'system'),
      p_action_url,
      now()
    from public.mentor_cohorts mc
    join public.profiles p on p.id = mc.mentor_id
    where mc.cohort_id = p_cohort_id
      and coalesce(p.status, 'active') = 'active';

    get diagnostics v_inserted_count = row_count;
    v_total_dispatched := v_total_dispatched + v_inserted_count;
  end if;

  return v_total_dispatched;
end;
$$;

grant execute on function public.send_cohort_notification(uuid, text, text, text, text, text) to authenticated;

-- 4. Database Trigger A: Assignment Submission Event (Cohort-Scoped Mentor Targeting)
create or replace function public.fn_notify_on_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cohort_id uuid;
  v_student_name text;
  v_assignment_title text;
  v_version int;
begin
  -- Only trigger when a submission enters 'pending' review state
  if new.status = 'pending' and (tg_op = 'INSERT' or (tg_op = 'UPDATE' and old.status is distinct from new.status)) then
    -- Resolve cohort_id from assignment or module
    select coalesce(a.cohort_id, m.cohort_id), a.title
    into v_cohort_id, v_assignment_title
    from public.assignments a
    left join public.lessons l on l.id = a.lesson_id
    left join public.modules m on m.id = l.module_id
    where a.id = new.assignment_id;

    -- Fallback: resolve cohort_id from student active enrollment
    if v_cohort_id is null then
      select e.cohort_id into v_cohort_id
      from public.enrollments e
      where e.user_id = new.student_id
        and e.status in ('enrolled', 'active')
      order by e.created_at desc
      limit 1;
    end if;

    -- Retrieve student name
    select coalesce(full_name, 'A student') into v_student_name
    from public.profiles where id = new.student_id;

    v_version := coalesce(new.version_number, new.version, 1);

    -- Cohort-scoped mentor targeting: Dispatch ONLY to mentors assigned to this specific cohort
    if v_cohort_id is not null then
      insert into public.notifications (
        user_id,
        title,
        body,
        category,
        action_url,
        created_at
      )
      select distinct
        mc.mentor_id,
        'Submission for Review: ' || left(coalesce(v_assignment_title, 'Assignment'), 45),
        coalesce(v_student_name, 'Student') || ' uploaded cut (v' || v_version || ') ready for critique.',
        'review',
        '/review/submissions?submission=' || new.id,
        now()
      from public.mentor_cohorts mc
      join public.profiles p on p.id = mc.mentor_id
      where mc.cohort_id = v_cohort_id
        and coalesce(p.status, 'active') = 'active';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_on_submission on public.submissions;
create trigger trg_notify_on_submission
  after insert or update on public.submissions
  for each row
  execute function public.fn_notify_on_submission();

-- 5. Database Trigger B: Feedback Reply Event (Bidirectional Student <-> Mentor)
create or replace function public.fn_notify_on_feedback_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission_id uuid;
  v_mentor_id uuid;
  v_student_id uuid;
  v_author_name text;
  v_assignment_title text;
begin
  -- Resolve feedback, submission, and author details
  select
    f.submission_id,
    f.mentor_id,
    s.student_id,
    a.title
  into
    v_submission_id,
    v_mentor_id,
    v_student_id,
    v_assignment_title
  from public.feedback f
  join public.submissions s on s.id = f.submission_id
  left join public.assignments a on a.id = s.assignment_id
  where f.id = new.feedback_id;

  select coalesce(full_name, 'A user') into v_author_name
  from public.profiles where id = new.author_id;

  -- If author is student, notify the mentor who authored the feedback
  if new.author_id = v_student_id and v_mentor_id is not null then
    insert into public.notifications (
      user_id,
      title,
      body,
      category,
      action_url,
      created_at
    )
    values (
      v_mentor_id,
      'New Critique Reply: ' || left(coalesce(v_assignment_title, 'Assignment'), 45),
      v_author_name || ': "' || left(new.message, 80) || '"',
      'review',
      '/review/submissions?submission=' || v_submission_id,
      now()
    );
  -- If author is mentor or staff, notify the student
  elsif new.author_id <> v_student_id and v_student_id is not null then
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
      'Mentor Replied on Critique',
      v_author_name || ': "' || left(new.message, 80) || '"',
      'review',
      '/student/dashboard?tab=assignments',
      now()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_on_feedback_reply on public.feedback_replies;
create trigger trg_notify_on_feedback_reply
  after insert on public.feedback_replies
  for each row
  execute function public.fn_notify_on_feedback_reply();

-- 6. Database Trigger C: Live Workshop Event (Cohort Audience & Assigned Mentors)
create or replace function public.fn_notify_on_live_session()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.cohort_id is not null then
    -- Notify active enrolled students in this cohort
    insert into public.notifications (
      user_id,
      title,
      body,
      category,
      action_url,
      created_at
    )
    select distinct
      e.user_id,
      'Live Workshop: ' || left(new.title, 50),
      'Scheduled for ' || to_char(new.starts_at, 'Mon DD at HH24:MI') || ' UTC. Join your cohort!',
      'deadline',
      '/workshops',
      now()
    from public.enrollments e
    join public.profiles p on p.id = e.user_id
    where e.cohort_id = new.cohort_id
      and e.status in ('enrolled', 'active', 'completed')
      and coalesce(p.status, 'active') = 'active';

    -- Cohort-scoped mentor targeting: Notify mentors assigned to this cohort
    insert into public.notifications (
      user_id,
      title,
      body,
      category,
      action_url,
      created_at
    )
    select distinct
      mc.mentor_id,
      'Workshop Scheduled: ' || left(new.title, 50),
      'Scheduled for cohort on ' || to_char(new.starts_at, 'Mon DD at HH24:MI') || ' UTC.',
      'system',
      '/workshops',
      now()
    from public.mentor_cohorts mc
    join public.profiles p on p.id = mc.mentor_id
    where mc.cohort_id = new.cohort_id
      and coalesce(p.status, 'active') = 'active';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_on_live_session on public.live_sessions;
create trigger trg_notify_on_live_session
  after insert on public.live_sessions
  for each row
  execute function public.fn_notify_on_live_session();

-- 7. Canonical Row Level Security (RLS) on public.notifications
alter table public.notifications enable row level security;

drop policy if exists "Users can view own notifications" on public.notifications;
drop policy if exists "System and mentors can insert notifications" on public.notifications;
drop policy if exists "Users can update own notifications" on public.notifications;
drop policy if exists "Users can delete own notifications" on public.notifications;

create policy "Users can view own notifications"
  on public.notifications for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
  );

create policy "System and mentors can insert notifications"
  on public.notifications for insert
  to authenticated
  with check (
    public.is_mentor_or_admin()
    or user_id = auth.uid()
  );

create policy "Users can update own notifications"
  on public.notifications for update
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
  )
  with check (
    user_id = auth.uid()
    or public.is_admin()
  );

create policy "Users can delete own notifications"
  on public.notifications for delete
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
  );

-- 8. Enable Realtime Publications for Instantaneous Web Push
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.notifications;
    exception when duplicate_object then
      null;
    end;
  end if;
end;
$$;
