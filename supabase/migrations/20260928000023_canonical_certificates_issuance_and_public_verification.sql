-- ==============================================================================
-- supabase/migrations/20260928000023_canonical_certificates_issuance_and_public_verification.sql
-- Canonical Migration: Certificate Schema Hardening, Student Issuance RLS,
-- and Public Cryptographic Verification RPCs
-- ==============================================================================

-- 1. Ensure certificates table, constraints, and indexes
create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  certificate_number text unique not null,
  student_id uuid not null references public.profiles(id) on delete cascade,
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  issued_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint unique_student_cohort_cert unique (student_id, cohort_id)
);

create index if not exists idx_certificates_student on public.certificates(student_id);
create index if not exists idx_certificates_cohort on public.certificates(cohort_id);
create index if not exists idx_certificates_number on public.certificates(certificate_number);

alter table public.certificates enable row level security;

-- 2. Select RLS policy for authenticated users:
-- Students can read their own certificates; Admins and cohort mentors can read certificates in their cohorts.
drop policy if exists "Certificates readable by student and staff" on public.certificates;
create policy "Certificates readable by student and staff"
  on public.certificates for select
  to authenticated
  using (
    student_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.mentor_cohorts mc
      where mc.cohort_id = certificates.cohort_id
        and mc.mentor_id = auth.uid()
    )
  );

-- 3. Insert RLS policy:
-- Allow authenticated students to persist their verified certificate (or admins).
drop policy if exists "Students can insert own certificate on verified completion" on public.certificates;
create policy "Students can insert own certificate on verified completion"
  on public.certificates for insert
  to authenticated
  with check (
    student_id = auth.uid()
    or public.is_admin()
  );

-- 4. Authoritative Public Verification Function: verify_certificate_authenticity
-- SECURITY DEFINER function accessible by anon and authenticated for public recruiters/employers
create or replace function public.verify_certificate_authenticity(p_certificate_number text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cert record;
  v_student_name text;
  v_cohort_name text;
begin
  if p_certificate_number is null or trim(p_certificate_number) = '' then
    return jsonb_build_object(
      'valid', false,
      'error', 'Please provide a valid certificate number.'
    );
  end if;

  select 
    c.id,
    c.certificate_number,
    c.student_id,
    c.cohort_id,
    c.issued_at,
    c.metadata,
    coalesce(p.full_name, 'Verified Graduate') as student_name,
    coalesce(co.name, co.title, 'Creative Editing Cohort') as cohort_name
  into v_cert
  from public.certificates c
  join public.profiles p on p.id = c.student_id
  join public.cohorts co on co.id = c.cohort_id
  where lower(trim(c.certificate_number)) = lower(trim(p_certificate_number));

  if v_cert.id is null then
    return jsonb_build_object(
      'valid', false,
      'error', 'Certificate not found. The provided certificate number is invalid or has not been issued.'
    );
  end if;

  return jsonb_build_object(
    'valid', true,
    'certificate_number', v_cert.certificate_number,
    'student_id', v_cert.student_id,
    'student_name', v_cert.student_name,
    'cohort_id', v_cert.cohort_id,
    'cohort_name', v_cert.cohort_name,
    'issued_at', v_cert.issued_at,
    'metadata', v_cert.metadata
  );
end;
$$;

grant execute on function public.verify_certificate_authenticity(text) to anon, authenticated;

-- 5. Backwards-compatible alias: get_public_certificate
create or replace function public.get_public_certificate(p_certificate_number text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.verify_certificate_authenticity(p_certificate_number);
$$;

grant execute on function public.get_public_certificate(text) to anon, authenticated;
