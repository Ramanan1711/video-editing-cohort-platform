-- ==============================================================================
-- Canonical Migration: Authoritative User Registration Status Check RPC
--
-- Provides an authoritative, secure database function to check whether an email
-- belongs to a registered user or an unregistered user before triggering recovery
-- workflows like 6-digit OTP dispatch on /forgot-password.
-- ==============================================================================

drop function if exists public.check_user_registration_status(text);

create or replace function public.check_user_registration_status(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_normalized_email text;
  v_user_id uuid;
  v_role text;
  v_status text;
begin
  -- Validate input presence
  if p_email is null or trim(p_email) = '' then
    return jsonb_build_object(
      'is_registered', false,
      'status', 'invalid_input',
      'message', 'Please enter a valid email address.'
    );
  end if;

  v_normalized_email := lower(trim(p_email));

  -- 1. Check in public.profiles first
  select id, role, coalesce(status, 'active')
  into v_user_id, v_role, v_status
  from public.profiles
  where lower(trim(email)) = v_normalized_email
  limit 1;

  -- 2. If not found in public.profiles, check in auth.users
  if v_user_id is null then
    select id into v_user_id
    from auth.users
    where lower(trim(email)) = v_normalized_email
    limit 1;

    if v_user_id is not null then
      v_role := 'student';
      v_status := 'active';
    end if;
  end if;

  -- 3. If neither table has this email, the user is unregistered
  if v_user_id is null then
    return jsonb_build_object(
      'is_registered', false,
      'status', 'unregistered',
      'message', 'No account found with this email address. Please check your email or register.'
    );
  end if;

  -- 4. Account suspended safeguard
  if v_status = 'suspended' then
    return jsonb_build_object(
      'is_registered', true,
      'status', 'suspended',
      'message', 'This account has been suspended. Please contact platform support.'
    );
  end if;

  -- 5. User is registered and active
  return jsonb_build_object(
    'is_registered', true,
    'status', coalesce(v_status, 'active'),
    'role', coalesce(v_role, 'student'),
    'message', 'User account verified.'
  );
end;
$$;

-- Grant execution to anon (public visitor requesting recovery) and authenticated
grant execute on function public.check_user_registration_status(text) to anon, authenticated;

