-- Optional lesson resources used by the student player.
create table if not exists public.lesson_resources (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  name text not null,
  url text not null,
  created_at timestamptz not null default now()
);

create index if not exists lesson_resources_lesson_id_idx on public.lesson_resources(lesson_id);

alter table public.lesson_resources enable row level security;

create policy "Enrolled students can read lesson resources"
on public.lesson_resources for select
using (
  exists (
    select 1
    from public.lessons l
    join public.modules m on m.id = l.module_id
    join public.enrollments e on e.cohort_id = m.cohort_id
    where l.id = lesson_resources.lesson_id
      and e.user_id = auth.uid()
      and e.status = 'active'
  )
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "Admins can manage lesson resources"
on public.lesson_resources for all
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
