-- Migration: 20261009000002_remove_hardcoded_sprint_tracks.sql
-- Description: Completely removes hardcoded default sprint curricula, drops auto-seeding
--              triggers on cohorts, replaces ensure_cohort_daily_challenges with a no-op,
--              and purges all legacy hardcoded sprint track records from public.daily_challenges.
--              Sprint tasks are now 100% author-driven and authored per course/cohort.

-- ------------------------------------------------------------------------------
-- 1. Drop the cohort auto-seeding trigger and function
-- ------------------------------------------------------------------------------
drop trigger if exists trg_ensure_cohort_daily_challenges on public.cohorts;
drop function if exists public.trigger_ensure_cohort_daily_challenges();

-- ------------------------------------------------------------------------------
-- 2. Replace ensure_cohort_daily_challenges with a harmless no-op
-- ------------------------------------------------------------------------------
create or replace function public.ensure_cohort_daily_challenges(p_cohort_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  -- No default seeding: return the existing count of author-uploaded challenges
  select count(*) into v_count
  from public.daily_challenges
  where cohort_id = p_cohort_id;

  return jsonb_build_object(
    'success', true,
    'count', v_count,
    'seeded', false,
    'message', 'Default seeding is disabled. Challenges are 100% author-managed.'
  );
end;
$$;

grant execute on function public.ensure_cohort_daily_challenges(uuid) to authenticated, anon, service_role;

-- ------------------------------------------------------------------------------
-- 3. Purge existing hardcoded sprint track values from public.daily_challenges
-- ------------------------------------------------------------------------------
delete from public.daily_challenges
where title in (
  -- Video Editing & Post-Production Hardcoded Tracks
  'Day 01: Production Setup & First Kinetic Cut',
  'Day 01: Workspace Setup, NLE Preferences & Ingestion',
  'Day 02: Narrative Pacing, J-Cuts & L-Cuts',
  'Day 03: Sound Design, SFX Stems & Audio Layering',
  'Day 04: Dynamic B-Roll Ingestion & Speed Ramps',
  'Day 04: B-Roll Selection, Speed Ramps & Flow',
  'Day 05: Sprint 1 Milestone — First Client Rough Cut',
  'Day 05: Sprint 1 Milestone — First Rough Cut Review',
  'Day 06: Multi-Cam Assembly & Audio Syncing',
  'Day 07: Color Correction, Scopes & White Balancing',
  'Day 07: Color Correction & Scopes',
  'Day 08: Cinematic Color Grading & LUT Workflow',
  'Day 08: Cinematic Color Grading & Creative LUTs',
  'Day 09: Kinetic Typography & Lower Third Motion',
  'Day 09: Kinetic Typography & Motion Graphics',
  'Day 10: Sprint 2 Milestone — Commercial 30s Cut',
  'Day 10: Sprint 2 Milestone — Commercial Cut Polish',
  'Day 11: Visual Effects Cleanup & Masking',
  'Day 12: Sound Mastering, LUFS & Final Mix',
  'Day 12: Audio Mastering, LUFS & EQ Cleanup',
  'Day 13: Vertical Video (9:16) Adaptation & Retention Hacks',
  'Day 13: Multi-Format Delivery (9:16 Reels & 16:9 YouTube)',
  'Day 14: Final Capstone Master Export & Showcase',
  'Day 14: Portfolio Project Final Polish',
  'Day 15: Graduation, Exit Evaluation & Letter of Recommendation',
  'Day 15: Capstone Showcase, Exit Survey & Certification',

  -- Full-Stack Coding Hardcoded Tracks
  'Day 01: Git Workflow, Dev Environment & Initial Commit',
  'Day 02: Relational Modeling & Row-Level Security (RLS)',
  'Day 03: Strongly Typed REST Endpoints & Zod Validation',
  'Day 04: Frontend State Architecture & Optimistic Mutations',
  'Day 05: Sprint 1 Milestone — Authenticated CRUD Feature',
  'Day 06: WebSocket Real-Time Sync & Live Subscriptions',
  'Day 07: Role-Based Access Control (RBAC) & Route Guards',
  'Day 08: Payment Webhook Processing & Idempotency',
  'Day 09: Background Job Queues & Rate Limiting',
  'Day 10: Sprint 2 Milestone — Production Deployment & Observability',
  'Day 11: Edge Compute, Middleware & Caching Strategies',
  'Day 12: Automated Integration Tests & CI/CD Pipeline',
  'Day 13: Performance Tuning, Core Web Vitals & Bundle Audits',
  'Day 14: Final Capstone Architecture & Showcase Delivery',
  'Day 15: Graduation, Career Portfolio & Tech Interview Readiness',
  'Day 15: Capstone Showcase, Production Audit & Code Review',

  -- Motion Graphics Hardcoded Tracks
  'Day 01: Cinema 4D / Blender Setup & Viewport Navigation',
  'Day 02: Keyframe Interpolation & Graph Editor Physics',
  'Day 03: Kinetic Title Design & Text Animators',
  'Day 04: Shape Layer Morphing & Vector Transitions',
  'Day 05: Sprint 1 Milestone — 5-Second Brand Stinger',
  'Day 06: Camera Projection & 2.5D Parallax Scenes',
  'Day 07: PBR Materials, Lighting & Studio HDRI Rigs',
  'Day 08: Simulation Physics — Rigid Bodies & Cloth',
  'Day 09: Particle Systems & Abstract Motion Backgrounds',
  'Day 10: Sprint 2 Milestone — 3D Product Commercial Turnaround',
  'Day 11: Multipass Rendering & OpenEXR Compositing',
  'Day 12: Color Management — ACES Workflow & Look Dev',
  'Day 13: Production Capstone — Motion & Color Mastering',
  'Day 14: Final Capstone Master Export & Showcase',
  'Day 15: Graduation Showcase, Final Render & Certification'
);

