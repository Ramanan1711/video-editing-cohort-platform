-- 02_profile_trigger.sql
-- Automated profile creation trigger for new Supabase Auth users.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_full_name text;
begin
  -- Validate and normalize role (default to student, allow student or mentor from registration)
  v_role := coalesce(new.raw_user_meta_data->>'role', 'student');
  if v_role not in ('student', 'mentor', 'admin') then
    v_role := 'student';
  end if;

  -- Default full name to metadata full_name or user part of email
  v_full_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    split_part(new.email, '@', 1),
    'Editor'
  );

  insert into public.profiles (id, full_name, email, role, created_at, updated_at)
  values (
    new.id,
    v_full_name,
    coalesce(new.email, ''),
    v_role,
    now(),
    now()
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
    role = coalesce(public.profiles.role, excluded.role),
    updated_at = now();

  return new;
end;
$$;

-- Idempotent trigger binding
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

