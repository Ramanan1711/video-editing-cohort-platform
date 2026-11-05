-- ==============================================================================
-- supabase/migrations/20261105000004_fix_certificates_audit_trigger_missing_grade_column.sql
-- Fix: Add missing grade and composite_score columns to certificates and patch
-- fn_audit_certificates_trigger() so certificate issuance does not fail with 42703.
-- ==============================================================================

-- 1. Ensure grade and composite_score columns exist on public.certificates
alter table public.certificates add column if not exists grade text;
alter table public.certificates add column if not exists composite_score numeric;

-- 2. Upgrade fn_audit_certificates_trigger() to safely log audit events
create or replace function public.fn_audit_certificates_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (TG_OP = 'INSERT') then
    perform public.log_audit_event(
      'certificate.issued',
      'certificate',
      new.id::text,
      jsonb_build_object(
        'certificate_number', new.certificate_number,
        'student_id', new.student_id,
        'cohort_id', new.cohort_id,
        'grade', new.grade,
        'composite_score', new.composite_score,
        'issued_at', new.issued_at,
        'metadata', new.metadata
      ),
      auth.uid()
    );
    return new;
  elsif (TG_OP = 'DELETE') then
    perform public.log_audit_event(
      'certificate.revoked',
      'certificate',
      old.id::text,
      jsonb_build_object(
        'certificate_number', old.certificate_number,
        'student_id', old.student_id,
        'cohort_id', old.cohort_id
      ),
      auth.uid()
    );
    return old;
  end if;
  return null;
end;
$$;

-- 3. Re-bind the trigger to ensure clean execution
drop trigger if exists trg_audit_certificates on public.certificates;
create trigger trg_audit_certificates
  after insert or delete on public.certificates
  for each row
  execute function public.fn_audit_certificates_trigger();

