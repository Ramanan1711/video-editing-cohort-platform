-- Migration: 20261007000001_canonical_homepage_advertisements.sql
-- Description: Canonical schema, storage and RLS for homepage advertisements and promotional campaigns.

-- 1. Create homepage_advertisements table
create table if not exists public.homepage_advertisements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) > 0),
  tagline text,
  description text,
  image_url text,
  cta_text text default 'Learn More',
  cta_link text default '#pricing',
  badge_text text default 'SPECIAL OFFER',
  display_type text default 'popup' check (display_type in ('popup', 'banner', 'floating_card')),
  is_active boolean default true not null,
  priority integer default 0 not null,
  starts_at timestamptz default now() not null,
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 2. Performance indexes
create index if not exists idx_homepage_ads_active_priority
  on public.homepage_advertisements (is_active, priority desc, created_at desc);

create index if not exists idx_homepage_ads_expires_at
  on public.homepage_advertisements (expires_at);

-- 3. Enable Row Level Security
alter table public.homepage_advertisements enable row level security;

-- 4. RLS Policies
-- Public / Anon / Students can view active, non-expired advertisements
drop policy if exists "Public can view active advertisements" on public.homepage_advertisements;
create policy "Public can view active advertisements"
  on public.homepage_advertisements
  for select
  using (
    is_active = true
    and (expires_at is null or expires_at > now())
    and starts_at <= now()
  );

-- Admins can view all advertisements
drop policy if exists "Admins can view all advertisements" on public.homepage_advertisements;
create policy "Admins can view all advertisements"
  on public.homepage_advertisements
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- Admins can insert advertisements
drop policy if exists "Admins can insert advertisements" on public.homepage_advertisements;
create policy "Admins can insert advertisements"
  on public.homepage_advertisements
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- Admins can update advertisements
drop policy if exists "Admins can update advertisements" on public.homepage_advertisements;
create policy "Admins can update advertisements"
  on public.homepage_advertisements
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- Admins can delete advertisements
drop policy if exists "Admins can delete advertisements" on public.homepage_advertisements;
create policy "Admins can delete advertisements"
  on public.homepage_advertisements
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- 5. Updated_at Trigger
create or replace function public.set_advertisement_timestamp()
returns trigger
language plpgsql
security definer
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_homepage_advertisements_updated_at on public.homepage_advertisements;
create trigger trg_homepage_advertisements_updated_at
  before update on public.homepage_advertisements
  for each row
  execute function public.set_advertisement_timestamp();

