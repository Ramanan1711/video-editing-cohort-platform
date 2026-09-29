-- ==============================================================================
-- Migration: 20260928000029_fix_internship_reports_audit_trigger_and_lor_column.sql
-- Description: Fix audit trigger on internship_reports & ensure dual column compatibility
-- Resolves:
--   1. Fixes ERROR 42703: record "new" has no field "lor_recommended"
--      caused by fn_audit_internship_reports_trigger referencing lor_recommended
--      instead of lor_eligible.
--   2. Adds lor_recommended column to public.internship_reports alongside lor_eligible
--      with automatic synchronization for 100% dual column compatibility.
--   3. Recreates fn_audit_internship_reports_trigger safely.
-- ==============================================================================

-- 1. Dual column compatibility on public.internship_reports
alter table public.internship_reports add column if not exists lor_eligible boolean not null default false;
alter table public.internship_reports add column if not exists lor_recommended boolean default false;

-- One-time synchronization of existing records
update public.internship_reports
set lor_recommended = lor_eligible
where lor_recommended is distinct from lor_eligible;

-- 2. Bidirectional sync trigger function between lor_eligible and lor_recommended
create or replace function public.sync_internship_report_lor_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (TG_OP = 'INSERT') then
    if new.lor_recommended is not null and new.lor_eligible is null then
      new.lor_eligible := new.lor_recommended;
    elsif new.lor_eligible is not null and new.lor_recommended is null then
      new.lor_recommended := new.lor_eligible;
    end if;
  elsif (TG_OP = 'UPDATE') then
    if new.lor_eligible is distinct from old.lor_eligible then
      new.lor_recommended := new.lor_eligible;
    elsif new.lor_recommended is distinct from old.lor_recommended then
      new.lor_eligible := new.lor_recommended;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_internship_report_lor_columns on public.internship_reports;
create trigger trg_sync_internship_report_lor_columns
  before insert or update on public.internship_reports
  for each row
  execute function public.sync_internship_report_lor_columns();

-- 3. Replace fn_audit_internship_reports_trigger with corrected column references
create or replace function public.fn_audit_internship_reports_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (TG_OP = 'INSERT') then
    perform public.log_audit_event(
      'internship_report.generated',
      'internship_report',
      new.id::text,
      jsonb_build_object(
        'cohort_id', new.cohort_id,
        'student_id', new.student_id,
        'grade', new.grade,
        'composite_score', new.composite_score,
        'lor_eligible', coalesce(new.lor_eligible, new.lor_recommended, false),
        'status', new.status
      ),
      auth.uid()
    );
    return new;
  elsif (TG_OP = 'UPDATE') then
    if (old.status is distinct from new.status and new.status = 'published') then
      perform public.log_audit_event(
        'internship_report.published',
        'internship_report',
        new.id::text,
        jsonb_build_object(
          'cohort_id', new.cohort_id,
          'student_id', new.student_id,
          'grade', new.grade,
          'composite_score', new.composite_score,
          'lor_eligible', coalesce(new.lor_eligible, new.lor_recommended, false)
        ),
        auth.uid()
      );
    elsif (old.grade is distinct from new.grade or old.lor_eligible is distinct from new.lor_eligible) then
      perform public.log_audit_event(
        'internship_report.updated',
        'internship_report',
        new.id::text,
        jsonb_build_object(
          'cohort_id', new.cohort_id,
          'student_id', new.student_id,
          'old_grade', old.grade,
          'new_grade', new.grade,
          'lor_eligible', coalesce(new.lor_eligible, new.lor_recommended, false)
        ),
        auth.uid()
      );
    end if;
    return new;
  elsif (TG_OP = 'DELETE') then
    perform public.log_audit_event(
      'internship_report.deleted',
      'internship_report',
      old.id::text,
      jsonb_build_object(
        'cohort_id', old.cohort_id,
        'student_id', old.student_id
      ),
      auth.uid()
    );
    return old;
  end if;
  return null;
end;
$$;

-- Ensure trigger is active
drop trigger if exists trg_audit_internship_reports on public.internship_reports;
create trigger trg_audit_internship_reports
  after insert or update or delete on public.internship_reports
  for each row
  execute function public.fn_audit_internship_reports_trigger();

