-- Run once in Supabase SQL Editor for uploaded assignment files and status normalization.

insert into storage.buckets (id, name, public)
values ('submissions', 'submissions', true)
on conflict (id) do update set public = true;

create policy "Students can upload their submissions"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'submissions'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Authenticated users can read submissions"
on storage.objects for select
to authenticated
using (bucket_id = 'submissions');

-- Existing rows from an earlier status vocabulary can be normalized safely.
update public.submissions set status = 'reviewed' where status = 'approved';
update public.submissions set status = 'resubmit' where status = 'needs_revision';

-- Optional constraint: keep future values inside the requested workflow.
alter table public.submissions drop constraint if exists submissions_status_check;
alter table public.submissions add constraint submissions_status_check
check (status in ('pending', 'reviewed', 'resubmit'));
