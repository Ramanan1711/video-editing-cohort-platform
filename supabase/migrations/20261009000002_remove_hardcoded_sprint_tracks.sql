-- Migration: 20261009000002_remove_hardcoded_sprint_tracks.sql
-- Description: Completely removes hardcoded default sprint curricula, drops auto-seeding
--              triggers on cohorts, replaces ensure_cohort_daily_challenges with a no-op,
--              purges all legacy hardcoded sprint track records from public.daily_challenges,
--              and provides admin_clear_cohort_daily_challenges RPC for 100% author control.
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
-- 3. Admin helper RPC to purge all daily challenges for a cohort
-- ------------------------------------------------------------------------------
create or replace function public.admin_clear_cohort_daily_challenges(p_cohort_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
begin
  delete from public.daily_challenges
  where cohort_id = p_cohort_id;

  get diagnostics v_deleted = row_count;

  return jsonb_build_object(
    'success', true,
    'deleted_count', v_deleted,
    'cohort_id', p_cohort_id
  );
end;
$$;

grant execute on function public.admin_clear_cohort_daily_challenges(uuid) to authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. Purge ALL existing hardcoded sprint track values from public.daily_challenges
-- ------------------------------------------------------------------------------
delete from public.daily_challenges
where title in (
  -- Video Editing & Post-Production Hardcoded Tracks (All Variations)
  'Day 01: Production Setup & First Kinetic Cut',
  'Day 01: Workspace Setup, NLE Preferences & Ingestion',
  'Day 02: Pacing, Micro-Transitions & Retention',
  'Day 02: Narrative Pacing, J-Cuts & L-Cuts',
  'Day 03: Sound Design, SFX Stems & Audio Layering',
  'Day 04: Kinetic Typography & Motion Graphics',
  'Day 04: Dynamic B-Roll Ingestion & Speed Ramps',
  'Day 04: B-Roll Selection, Speed Ramps & Flow',
  'Day 05: Sprint 1 Milestone — First Client Simulation',
  'Day 05: Sprint 1 Milestone — First Client Rough Cut',
  'Day 05: Sprint 1 Milestone — First Rough Cut Review',
  'Day 06: Cinematic Color Grading & Tone Curves',
  'Day 06: Multi-Cam Assembly & Audio Syncing',
  'Day 07: Speed Ramping, Optical Flow & Match Cuts',
  'Day 07: Color Correction, Scopes & White Balancing',
  'Day 07: Color Correction & Scopes',
  'Day 08: Visual FX, Green Screen & Rotoscoping',
  'Day 08: Cinematic Color Grading & LUT Workflow',
  'Day 08: Cinematic Color Grading & Creative LUTs',
  'Day 09: Music Video Rhythm & Beat Synchronicity',
  'Day 09: Kinetic Typography & Lower Third Motion',
  'Day 10: Sprint 2 Milestone — Mid-Term Portfolio Review',
  'Day 10: Sprint 2 Milestone — Commercial 30s Cut',
  'Day 10: Sprint 2 Milestone — Commercial Cut Polish',
  'Day 11: Production Capstone — Storyboard & Raw Assembly',
  'Day 11: Visual Effects Cleanup & Masking',
  'Day 12: Production Capstone — Sound Design & Foley Polish',
  'Day 12: Sound Mastering, LUFS & Final Mix',
  'Day 12: Audio Mastering, LUFS & EQ Cleanup',
  'Day 13: Production Capstone — Motion & Color Mastering',
  'Day 13: Final Polish, Color Pass & Audio Mix',
  'Day 13: Vertical Video (9:16) Adaptation & Retention Hacks',
  'Day 13: Multi-Format Delivery (9:16 Reels & 16:9 YouTube)',
  'Day 14: Final Capstone Master Export & Showcase',
  'Day 14: Portfolio Project Showcase & Export',
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
  'Day 10: Sprint 2 Milestone — Mid-Term Integration Review',
  'Day 10: Sprint 2 Milestone — Production Deployment & Observability',
  'Day 11: Production Capstone — System Architecture & Data Model',
  'Day 11: Edge Compute, Middleware & Caching Strategies',
  'Day 12: Production Capstone — Core Business Logic & State Engine',
  'Day 12: Automated Integration Tests & CI/CD Pipeline',
  'Day 13: Production Capstone — Automated Testing & Security Audit',
  'Day 13: Performance Tuning, Core Web Vitals & Bundle Audits',
  'Day 14: Production Capstone — CI/CD Pipeline & Production Deployment',
  'Day 14: Final Capstone Architecture & Showcase Delivery',
  'Day 15: Graduation, Engineering Demo Day & Letter of Recommendation',
  'Day 15: Graduation, Career Portfolio & Tech Interview Readiness',
  'Day 15: Capstone Showcase, Production Audit & Code Review',

  -- Motion Graphics Hardcoded Tracks
  'Day 01: Cinema 4D / Blender Setup & Viewport Navigation',
  'Day 01: Workspace Setup, Keyframe Curves & Velocity',
  'Day 02: Keyframe Interpolation & Graph Editor Physics',
  'Day 02: Kinetic Typography & Expression-Driven Titles',
  'Day 03: Kinetic Title Design & Text Animators',
  'Day 03: Vector Shape Animations & Liquid Morphing',
  'Day 04: Shape Layer Morphing & Vector Transitions',
  'Day 04: Brand Identity & Animated Logo Sting',
  'Day 05: Sprint 1 Milestone — 5-Second Brand Stinger',
  'Day 05: Sprint 1 Milestone — Dynamic 15s Commercial Sting',
  'Day 06: Camera Projection & 2.5D Parallax Scenes',
  'Day 06: Cinema 4D / Blender Integration & 3D Camera Tracking',
  'Day 07: PBR Materials, Lighting & Studio HDRI Rigs',
  'Day 07: PBR Shading, Studio Lighting & Depth Passes',
  'Day 08: Simulation Physics — Rigid Bodies & Cloth',
  'Day 08: Particle Dynamics & Abstract Mograph Simulation',
  'Day 09: Particle Systems & Abstract Motion Backgrounds',
  'Day 09: UI/UX Micro-Interactions & 3D Device Mockups',
  'Day 10: Sprint 2 Milestone — 3D Product Commercial Turnaround',
  'Day 10: Sprint 2 Milestone — Mid-Term Commercial Reel Review',
  'Day 11: Multipass Rendering & OpenEXR Compositing',
  'Day 11: Motion Capstone — 3D Styleframes & Storyboard Deck',
  'Day 12: Color Management — ACES Workflow & Look Dev',
  'Day 12: Motion Capstone — 3D Scene Animation & Camera Blocking',
  'Day 13: Production Capstone — Motion & Color Mastering',
  'Day 13: Motion Capstone — Compositing, Grain & Color Finishing',
  'Day 14: Final Capstone Master Export & Showcase',
  'Day 14: Final Capstone Master Export & Breakdown Reel',
  'Day 15: Graduation Showcase, Final Render & Certification'
)
or description in (
  'Learn fast-paced cuts, J/L audio cuts, and maintaining 70%+ audience watch retention.',
  'Layer whooshes, risers, foley hits, and balance speech volume levels to -6dB True Peak.',
  'Sync word-by-word highlighted captions and title lower-thirds to voice cadence.',
  'Integrate Days 1–4 techniques into a complete 60s vertical product ad or full code module.',
  'Integrate Days 1–4 techniques into a complete 60s vertical product ad or client commercial.',
  'Color balance Log footage, create a moody contrast curve, and export Rec.709 clean grades.',
  'Execute smooth seamless speed-ramps between action sequences using bezier handles.',
  'Execute smooth seamless speed-ramps between action sequences using bezier curve handles.',
  'Mask foreground subjects, layer background lighting effects, and clean edge bleed.',
  'Mask foreground subjects, layer background lighting effects, and clean edge bleed with matte choke.',
  'Cut to dynamic tempo shifts and transient drum peaks for maximum emotional punch.',
  'Consolidated commercial cut incorporating color, sound, typography, and speed ramps.',
  'Begin your final 15-day capstone client project. Assemble the A-roll timeline.',
  'Begin your final 15-day capstone client project. Assemble the A-roll narrative timeline.',
  'Add music transitions, SFX sweetening, and vocal clarity EQ pass.',
  'Fine-tune color consistency across all takes, add typography overlays, and sharpen details.',
  'Deliver the client-ready 4K and vertical master exports with complete source project bundle.',
  'Final mentor grading, portfolio verification, and release of your verified Internship Certificate.'
);
