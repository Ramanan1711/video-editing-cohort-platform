-- 03_storage_and_submissions.sql
-- Storage buckets and private submissions access policies.

-- 1. Ensure buckets exist with correct visibility
insert into storage.buckets (id, name, public)
values ('submissions', 'submissions', false)
on conflict (id) do update set public = false;

insert into storage.buckets (id, name, public)
values ('course-assets', 'course-assets', true)
on conflict (id) do update set public = true;

-- 2. Submissions Bucket Policies (Private: Owner student + Mentors + Admins)
drop policy if exists "Students can upload their submissions" on storage.objects;
create policy "Students can upload their submissions"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'submissions'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Authenticated users can read submissions" on storage.objects;
drop policy if exists "Authorized users can read submissions" on storage.objects;
create policy "Authorized users can read submissions"
on storage.objects for select
to authenticated
using (
  bucket_id = 'submissions'
  and (
    -- Owner student can read their own submission
    (storage.foldername(name))[1] = auth.uid()::text
    -- Mentors and admins can read all submissions
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('mentor', 'admin')
    )
  )
);

drop policy if exists "Users can update their own submissions" on storage.objects;
create policy "Users can update their own submissions"
on storage.objects for update
to authenticated
using (
  bucket_id = 'submissions'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
);

drop policy if exists "Users can delete their own submissions" on storage.objects;
create policy "Users can delete their own submissions"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'submissions'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
);

-- 3. Course Assets Bucket Policies (Public read, Admin manage)
drop policy if exists "Admins can upload course assets" on storage.objects;
create policy "Admins can upload course assets"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'course-assets'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "Admins can update course assets" on storage.objects;
create policy "Admins can update course assets"
on storage.objects for update
to authenticated
using (
  bucket_id = 'course-assets'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "Admins can delete course assets" on storage.objects;
create policy "Admins can delete course assets"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'course-assets'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "Authenticated users can read course assets" on storage.objects;
create policy "Authenticated users can read course assets"
on storage.objects for select
to authenticated
using (bucket_id = 'course-assets');

