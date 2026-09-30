-- Run once in Supabase SQL Editor for uploaded assignment files and status normalization.

insert into storage.buckets (id, name, public)
values ('submissions', 'submissions', false)
on conflict (id) do update set public = false;

insert into storage.buckets (id, name, public)
values ('course-assets', 'course-assets', true)
on conflict (id) do update set public = true;

drop policy if exists "Admins can upload course assets" on storage.objects;
create policy "Admins can upload course assets"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'course-assets'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

drop policy if exists "Authenticated users can read course assets" on storage.objects;
create policy "Authenticated users can read course assets"
on storage.objects for select to authenticated
using (bucket_id = 'course-assets');

drop policy if exists "Students can upload their submissions" on storage.objects;
create policy "Students can upload their submissions"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'submissions'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Authenticated users can read submissions" on storage.objects;
drop policy if exists "Strict submission access control" on storage.objects;
create policy "Strict submission access control"
on storage.objects for select
to authenticated
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

-- Existing rows from an earlier status vocabulary can be normalized safely.
update public.submissions set status = 'reviewed' where status = 'approved';
update public.submissions set status = 'resubmit' where status = 'needs_revision';

-- Optional constraint: keep future values inside the requested workflow.
alter table public.submissions drop constraint if exists submissions_status_check;
alter table public.submissions add constraint submissions_status_check
check (status in ('pending', 'reviewed', 'resubmit'));
