-- ==============================================================================
-- Migration: 20261104000001_default_practice_footage_and_project_files_to_enrolled.sql
-- Description: Unlocks practice footage, project templates (.prproj, .drp), sound effects,
--              and LUTs for immediate download by enrolled students at lesson start.
--              Reserves 'after_completion' strictly for solution files and benchmarks.
-- ==============================================================================

-- 1. Ensure table column default is 'enrolled'
alter table public.lesson_resources 
  alter column visibility set default 'enrolled';

-- 2. Migrate existing practice footage and project files to 'enrolled' visibility
-- so enrolled students can practice alongside the video without waiting for 80% completion.
update public.lesson_resources
set visibility = 'enrolled'
where visibility = 'after_completion'
  and lower(name) not like '%solution%'
  and lower(name) not like '%benchmark%'
  and lower(name) not like '%answer%'
  and lower(name) not like '%completed%';

-- 3. Document visibility policy on lesson_resources
comment on column public.lesson_resources.visibility is 
  'Access visibility rule: enrolled (practice footage & project templates accessible immediately to enrolled students), public (exploratory previews), after_completion (strictly reserved for solution files and benchmark timelines).';

