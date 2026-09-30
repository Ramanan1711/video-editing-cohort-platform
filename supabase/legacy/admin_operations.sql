create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  starts_at timestamptz not null,
  meeting_url text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;
alter table public.live_sessions enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.notifications enable row level security;

create policy "Authenticated users can read announcements" on public.announcements for select to authenticated using (published or author_id = auth.uid());
create policy "Admins can manage announcements" on public.announcements for all to authenticated using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')) with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "Authenticated users can read sessions" on public.live_sessions for select to authenticated using (true);
create policy "Admins can manage sessions" on public.live_sessions for all to authenticated using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')) with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "Authenticated users can read posts" on public.community_posts for select to authenticated using (true);
create policy "Users can create posts" on public.community_posts for insert to authenticated with check (author_id = auth.uid());
create policy "Authenticated users can read comments" on public.community_comments for select to authenticated using (true);
create policy "Users can create comments" on public.community_comments for insert to authenticated with check (author_id = auth.uid());
create policy "Users can read own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "Admins can manage notifications" on public.notifications for all to authenticated using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')) with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
