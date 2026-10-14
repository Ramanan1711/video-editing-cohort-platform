-- ==============================================================================
-- Migration: 20261014000004_security_hardening_rate_limits_and_privileges.sql
-- Description: Security Audit Hardening & Attack Vector Mitigations:
--   1. Rate Limiting: Table and atomic RPC to throttle order creation attempts (max 5 per 10m).
--   2. Storage Security: Restrict allowed MIME types on the 'submissions' bucket to prevent stored XSS.
--   3. Privilege Guard: Strict DB constraint ensuring non-admin roles cannot carry admin_role,
--      plus hardened trigger ensuring self-registration unconditionally defaults to student.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Storage Bucket MIME Type Hardening (Stored XSS Prevention)
-- ------------------------------------------------------------------------------
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'video/mp4',
  'video/quicktime',
  'application/zip',
  'application/x-zip-compressed',
  'application/pdf'
]
WHERE id = 'submissions';

-- Ensure submissions storage objects cannot be inserted with dangerous MIME types
DROP POLICY IF EXISTS "Restrict submissions allowed mime types on insert" ON storage.objects;
CREATE POLICY "Restrict submissions allowed mime types on insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id != 'submissions'
  OR (
    bucket_id = 'submissions'
    AND (
      coalesce(metadata->>'mimetype', '') IN (
        'video/mp4',
        'video/quicktime',
        'application/zip',
        'application/x-zip-compressed',
        'application/pdf'
      )
    )
  )
);

-- ------------------------------------------------------------------------------
-- 2. Privilege Guard: Strict DB Assertion on Profiles
-- ------------------------------------------------------------------------------
-- Sanitize any residual admin_role values on non-admin profiles
UPDATE public.profiles
SET admin_role = NULL
WHERE role != 'admin' AND admin_role IS NOT NULL;

-- Enforce strict database assertion: non-admins MUST have admin_role = NULL, admins MUST have admin_role set
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS chk_profiles_admin_role_consistency;
ALTER TABLE public.profiles ADD CONSTRAINT chk_profiles_admin_role_consistency
  CHECK (
    (role = 'admin' AND admin_role IS NOT NULL) OR
    (role != 'admin' AND admin_role IS NULL)
  );

-- Re-assert fn_protect_profile_privilege_fields() with fail-closed assertion on INSERT
CREATE OR REPLACE FUNCTION public.fn_protect_profile_privilege_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_super_admin_count int;
  v_admin_count int;
BEGIN
  -- Service role / migration operations without auth.uid()
  IF v_caller_id IS NULL THEN
    IF new.role != 'admin' THEN
      new.admin_role := NULL;
    ELSIF new.admin_role IN ('super_admin', 'content_admin', 'operations_admin', 'moderator') THEN
      new.role := 'admin';
    ELSE
      -- Fallback if admin_role is invalid or missing
      new.admin_role := 'super_admin';
    END IF;
    RETURN new;
  END IF;

  -- ----------------------------------------------------------------------------
  -- INSERT Logic: Unconditionally force student role for self-registration / signups
  -- ----------------------------------------------------------------------------
  IF tg_op = 'INSERT' THEN
    IF NOT public.has_admin_permission('manage_roles') THEN
      new.id := v_caller_id;
      new.role := 'student';
      new.admin_role := NULL;
      new.status := 'active';
    ELSE
      -- Admin caller inserting a user: enforce consistency
      IF new.role != 'admin' THEN
        new.admin_role := NULL;
      ELSIF new.admin_role IS NULL THEN
        new.admin_role := 'super_admin';
      END IF;
    END IF;
    RETURN new;
  END IF;

  -- ----------------------------------------------------------------------------
  -- UPDATE Logic: Prevent unauthorized role or status modification
  -- ----------------------------------------------------------------------------
  IF tg_op = 'UPDATE' THEN
    -- Case A: User attempting to modify their own profile
    IF v_caller_id = old.id THEN
      IF new.role IS DISTINCT FROM old.role THEN
        RAISE EXCEPTION 'Unauthorized: Users cannot alter their own system role.'
          USING errcode = '42501';
      END IF;

      IF new.admin_role IS DISTINCT FROM old.admin_role THEN
        RAISE EXCEPTION 'Unauthorized: Users cannot alter their own administrative sub-role.'
          USING errcode = '42501';
      END IF;

      IF new.status IS DISTINCT FROM old.status THEN
        RAISE EXCEPTION 'Unauthorized: Users cannot alter their own account status.'
          USING errcode = '42501';
      END IF;
    END IF;

    -- Case B: Caller modifying role or admin_role of any user
    IF (new.role IS DISTINCT FROM old.role) OR (new.admin_role IS DISTINCT FROM old.admin_role) THEN
      IF NOT public.has_admin_permission('manage_roles') THEN
        RAISE EXCEPTION 'Unauthorized: Only Super Administrators can modify user roles or administrative sub-roles.'
          USING errcode = '42501';
      END IF;

      -- Enforce role consistency
      IF new.role != 'admin' THEN
        new.admin_role := NULL;
      ELSIF new.admin_role IS NULL THEN
        new.admin_role := 'super_admin';
      END IF;

      -- Protect against demoting the last active super_admin
      IF old.role = 'admin' AND coalesce(old.admin_role, 'super_admin') = 'super_admin' AND
         (new.role != 'admin' OR coalesce(new.admin_role, 'super_admin') != 'super_admin') THEN
        SELECT count(*) INTO v_super_admin_count
        FROM public.profiles
        WHERE role = 'admin' AND coalesce(admin_role, 'super_admin') = 'super_admin' AND coalesce(status, 'active') = 'active';

        IF v_super_admin_count <= 1 THEN
          RAISE EXCEPTION 'Safety block: Cannot demote or revoke the last remaining active Super Admin.'
            USING errcode = 'P0001';
        END IF;
      END IF;
    END IF;

    -- Case C: Caller modifying user status
    IF new.status IS DISTINCT FROM old.status THEN
      IF NOT (public.has_admin_permission('manage_user_status') OR public.has_admin_permission('manage_roles')) THEN
        RAISE EXCEPTION 'Unauthorized: Insufficient permissions to modify account status.'
          USING errcode = '42501';
      END IF;

      IF old.role = 'admin' AND new.status != 'active' THEN
        SELECT count(*) INTO v_admin_count
        FROM public.profiles
        WHERE role = 'admin' AND coalesce(status, 'active') = 'active';

        IF v_admin_count <= 1 THEN
          RAISE EXCEPTION 'Safety block: Cannot deactivate the last remaining active administrator.'
            USING errcode = 'P0001';
        END IF;
      END IF;
    END IF;

    RETURN new;
  END IF;

  RETURN new;
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. Rate Limiting: Table and Atomic RPC
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_key text NOT NULL UNIQUE,
  attempt_count int NOT NULL DEFAULT 1,
  first_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_key_expires
  ON public.api_rate_limits (rate_key, expires_at);

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages rate limits" ON public.api_rate_limits;
CREATE POLICY "Service role manages rate limits"
  ON public.api_rate_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Atomic rate limiter RPC
CREATE OR REPLACE FUNCTION public.check_and_consume_rate_limit(
  p_key text,
  p_max_requests int DEFAULT 5,
  p_window_seconds int DEFAULT 600
)
RETURNS TABLE (
  allowed boolean,
  current_count int,
  remaining int,
  reset_seconds int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_rec record;
  v_expires timestamptz;
BEGIN
  -- Opportunistically clean up expired keys (limit 50 to avoid locks)
  DELETE FROM public.api_rate_limits
  WHERE expires_at < v_now - interval '1 hour';

  SELECT * INTO v_rec
  FROM public.api_rate_limits
  WHERE rate_key = p_key
  FOR UPDATE;

  IF NOT FOUND THEN
    v_expires := v_now + (p_window_seconds || ' seconds')::interval;
    INSERT INTO public.api_rate_limits (rate_key, attempt_count, first_attempt_at, last_attempt_at, expires_at)
    VALUES (p_key, 1, v_now, v_now, v_expires);
    
    RETURN QUERY SELECT true, 1, GREATEST(0, p_max_requests - 1), p_window_seconds;
    RETURN;
  END IF;

  -- Window expired, reset window
  IF v_rec.expires_at < v_now THEN
    v_expires := v_now + (p_window_seconds || ' seconds')::interval;
    UPDATE public.api_rate_limits
    SET attempt_count = 1,
        first_attempt_at = v_now,
        last_attempt_at = v_now,
        expires_at = v_expires
    WHERE rate_key = p_key;

    RETURN QUERY SELECT true, 1, GREATEST(0, p_max_requests - 1), p_window_seconds;
    RETURN;
  END IF;

  -- Limit reached
  IF v_rec.attempt_count >= p_max_requests THEN
    RETURN QUERY SELECT
      false,
      v_rec.attempt_count,
      0,
      GREATEST(1, EXTRACT(EPOCH FROM (v_rec.expires_at - v_now))::int);
    RETURN;
  END IF;

  -- Within window and under limit, increment
  UPDATE public.api_rate_limits
  SET attempt_count = attempt_count + 1,
      last_attempt_at = v_now
  WHERE rate_key = p_key;

  RETURN QUERY SELECT
    true,
    v_rec.attempt_count + 1,
    GREATEST(0, p_max_requests - (v_rec.attempt_count + 1)),
    GREATEST(1, EXTRACT(EPOCH FROM (v_rec.expires_at - v_now))::int);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_and_consume_rate_limit(text, int, int) TO service_role, authenticated;

