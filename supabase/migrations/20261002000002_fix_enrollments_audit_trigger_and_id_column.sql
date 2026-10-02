-- ==============================================================================
-- Migration: 20261002000002_fix_enrollments_audit_trigger_and_id_column.sql
-- Description: Fix "record 'new' has no field 'id'" error on public.enrollments.
--              1. Adds synthetic default id to public.enrollments for backward compatibility.
--              2. Fixes fn_audit_enrollments_trigger to use composite key (user_id:cohort_id).
-- ==============================================================================

-- 1. Ensure public.enrollments has an id column
alter table public.enrollments add column if not exists id uuid default gen_random_uuid();

-- 2. Fortify fn_audit_enrollments_trigger to safely resolve entity ID
create or replace function public.fn_audit_enrollments_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity_id text;
begin
  if (TG_OP = 'INSERT') then
    v_entity_id := new.user_id::text || ':' || new.cohort_id::text;
    perform public.log_audit_event(
      'enrollment.created',
      'enrollment',
      v_entity_id,
      jsonb_build_object(
        'cohort_id', new.cohort_id,
        'student_id', new.user_id,
        'status', new.status
      ),
      auth.uid()
    );
    return new;
  elsif (TG_OP = 'UPDATE') then
    if (old.status is distinct from new.status) then
      v_entity_id := new.user_id::text || ':' || new.cohort_id::text;
      perform public.log_audit_event(
        'enrollment.status_changed',
        'enrollment',
        v_entity_id,
        jsonb_build_object(
          'cohort_id', new.cohort_id,
          'student_id', new.user_id,
          'old_status', old.status,
          'new_status', new.status
        ),
        auth.uid()
      );
    end if;
    return new;
  elsif (TG_OP = 'DELETE') then
    v_entity_id := old.user_id::text || ':' || old.cohort_id::text;
    perform public.log_audit_event(
      'enrollment.deleted',
      'enrollment',
      v_entity_id,
      jsonb_build_object(
        'cohort_id', old.cohort_id,
        'student_id', old.user_id,
        'last_status', old.status
      ),
      auth.uid()
    );
    return old;
  end if;
  return null;
end;
$$;

-- Ensure trigger is active
drop trigger if exists trg_audit_enrollments on public.enrollments;
create trigger trg_audit_enrollments
  after insert or update of status or delete on public.enrollments
  for each row
  execute function public.fn_audit_enrollments_trigger();
