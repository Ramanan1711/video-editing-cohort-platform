-- ==============================================================================
-- supabase/migrations/20260921000005_rls_policy_cleanup.sql
-- Production Security Consolidation:
-- Removes redundant, conflicting, and insecure legacy RLS policies
-- Enforces strict P0 requirements across all entities
-- ==============================================================================

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

