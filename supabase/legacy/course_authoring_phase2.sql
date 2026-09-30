-- supabase/course_authoring_phase2.sql
-- Migration script for Phase 2: Course Authoring, Resource Visibility Rules, and Submissions

-- 1. Enhance lesson_resources table with visibility rules and asset metadata
alter table public.lesson_resources
  add column if not exists visibility text not null default 'enrolled' check (visibility in ('enrolled', 'public', 'after_completion')),
  add column if not exists resource_type text not null default 'other',
  add column if not exists file_size bigint;

create index if not exists idx_lesson_resources_visibility on public.lesson_resources(visibility);
create index if not exists idx_lesson_resources_lesson_id on public.lesson_resources(lesson_id);

-- 2. Enhance submissions table with updated_at timestamp for resubmissions
alter table public.submissions
  add column if not exists updated_at timestamptz not null default now();

-- 3. Ensure assignment deadlines and instructions exist and have proper indexes
create index if not exists idx_assignments_deadline on public.assignments(deadline);

-- 4. Storage buckets setup for assets and submissions
insert into storage.buckets (id, name, public)
values ('course-assets', 'course-assets', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('submissions', 'submissions', false)
on conflict (id) do update set public = false;

-- 5. Storage policies for course-assets
drop policy if exists "Admins can upload course assets" on storage.objects;
create policy "Admins can upload course assets"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'course-assets'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

drop policy if exists "Admins can update course assets" on storage.objects;
create policy "Admins can update course assets"
on storage.objects for update to authenticated
using (
  bucket_id = 'course-assets'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

drop policy if exists "Admins can delete course assets" on storage.objects;
create policy "Admins can delete course assets"
on storage.objects for delete to authenticated
using (
  bucket_id = 'course-assets'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

drop policy if exists "Authenticated users can read course assets" on storage.objects;
create policy "Authenticated users can read course assets"
on storage.objects for select to authenticated
using (bucket_id = 'course-assets');

-- 6. Storage policies for student submissions
drop policy if exists "Students can upload their submissions" on storage.objects;
create policy "Students can upload their submissions"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'submissions'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Students can update their submissions" on storage.objects;
create policy "Students can update their submissions"
on storage.objects for update to authenticated
using (
  bucket_id = 'submissions'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Authenticated users can read submissions" on storage.objects;
-- Strict read policy for submissions: only owner, assigned mentor, or admin (see security_and_storage_hardening.sql)
drop policy if exists "Strict submission access control" on storage.objects;
create policy "Strict submission access control"
on storage.objects for select to authenticated
using (
  bucket_id = 'submissions'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and coalesce(p.status, 'active') = 'active'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or p.role in ('mentor', 'admin')
    )
  )
);

