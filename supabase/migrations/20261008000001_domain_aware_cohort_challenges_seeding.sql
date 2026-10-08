-- Migration: 20261008000001_domain_aware_cohort_challenges_seeding.sql
-- Description: Updates ensure_cohort_daily_challenges(p_cohort_id) to inspect the cohort's
--              track_type, title, name, and parent course track to seed domain-driven syllabi:
--              1. Full-Stack Coding & Engineering (15 Days)
--              2. Motion Graphics & 3D Design (15 Days)
--              3. Video Editing & Post-Production (15 Days)
--              Adds an automated AFTER INSERT trigger on public.cohorts so newly created
--              cohorts automatically have their track-specific 15-day sprint challenges seeded.

-- ------------------------------------------------------------------------------
-- 1. Domain-Aware ensure_cohort_daily_challenges(p_cohort_id uuid)
-- ------------------------------------------------------------------------------

create or replace function public.ensure_cohort_daily_challenges(p_cohort_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_cohort_start timestamptz;
  v_cohort_track text;
  v_cohort_title text;
  v_cohort_name text;
  v_course_track text;
  v_course_title text;
  v_search_text text;
  v_selected_track text;
begin
  -- 1. Check if cohort already has 15 or more challenges
  select count(*) into v_count
  from public.daily_challenges
  where cohort_id = p_cohort_id;

  if v_count >= 15 then
    return jsonb_build_object(
      'success', true,
      'count', v_count,
      'seeded', false,
      'message', 'Challenges already seeded'
    );
  end if;

  -- 2. Retrieve cohort and optional parent course metadata
  select
    c.track_type,
    c.title,
    c.name,
    c.start_date,
    cr.track_type,
    cr.title
  into
    v_cohort_track,
    v_cohort_title,
    v_cohort_name,
    v_cohort_start,
    v_course_track,
    v_course_title
  from public.cohorts c
  left join public.courses cr on cr.id = c.course_id
  where c.id = p_cohort_id;

  if not found then
    return jsonb_build_object(
      'success', false,
      'error', 'Cohort not found',
      'cohort_id', p_cohort_id
    );
  end if;

  -- 3. Determine syllabus domain based on track_type and title keywords
  v_search_text := lower(coalesce(v_cohort_title, '') || ' ' || coalesce(v_cohort_name, '') || ' ' || coalesce(v_course_title, ''));

  if coalesce(v_cohort_track, '') = 'coding'
     or coalesce(v_course_track, '') = 'coding'
     or v_search_text ~* '(code|coding|python|java|web|fullstack|software|backend|frontend|react|node)' then
    v_selected_track := 'coding';
  elsif v_search_text ~* '(motion|3d|animation|after effects|blender|cinema 4d|c4d|vfx)' then
    v_selected_track := 'motion_graphics';
  else
    v_selected_track := 'video_editing';
  end if;

  -- 4. Seed the domain-specific 15-day curriculum
  if v_selected_track = 'coding' then
    insert into public.daily_challenges (
      cohort_id, day_number, title, description, instructions, starter_files_url,
      track_type, submission_type, deadline_hours, is_published, unlocked_at
    )
    values
      (p_cohort_id, 1, 'Day 01: Git Workflow, Dev Environment & Initial Commit', 'Set up development workspace, initialize strict TypeScript configuration, configure ESLint/Prettier, and open your initial feature branch PR.', 'Submit a GitHub repository or Pull Request link with clean branch structure and passing baseline checks.', 'https://github.com/procuthub/starter-fullstack-template', 'coding', 'github_pr', 24, true, now()),
      (p_cohort_id, 2, 'Day 02: Relational Modeling & Row-Level Security (RLS)', 'Design 3NF relational schema in PostgreSQL, create migration scripts, and enforce strict Row-Level Security policies with zero data leak vectors.', 'Submit migration SQL files or PR link implementing user-scoped access control policies.', null, 'coding', 'github_pr', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 1)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 1)) then now() else null end),
      (p_cohort_id, 3, 'Day 03: Strongly Typed REST Endpoints & Zod Validation', 'Author production REST/RPC handler functions, integrate Zod request body validation, and return RFC 7807 compliant error payloads.', 'Submit API handler PR with comprehensive boundary tests and payload validation.', null, 'coding', 'github_pr', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 2)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 2)) then now() else null end),
      (p_cohort_id, 4, 'Day 04: Frontend State Architecture & Optimistic Mutations', 'Implement TanStack Query or SWR hooks with optimistic UI rollback, background cache revalidation, and zero layout shift.', 'Submit frontend branch PR connecting reactive states to backend endpoints.', null, 'coding', 'github_pr', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 3)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 3)) then now() else null end),
      (p_cohort_id, 5, 'Day 05: Sprint 1 Milestone — Authenticated CRUD Feature', 'Consolidate Days 1–4 into an end-to-end user feature with secure authentication tokens, RLS enforcement, and optimistic feedback.', 'Submit complete PR with passing integration tests for weekend mentor code review.', null, 'coding', 'github_pr', 48, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 4)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 4)) then now() else null end),
      (p_cohort_id, 6, 'Day 06: WebSocket Real-Time Sync & Live Subscriptions', 'Subscribe to PostgreSQL CDC replication streams or Supabase Realtime channels with reconnection backoff and heartbeat verification.', 'Submit PR demonstrating multi-tab collaborative updates without manual browser refresh.', null, 'coding', 'github_pr', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 5)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 5)) then now() else null end),
      (p_cohort_id, 7, 'Day 07: Role-Based Access Control (RBAC) & Route Guards', 'Implement hierarchical roles (student, mentor, admin) with route-level protection, JWT claims verification, and security middleware.', 'Submit PR with authorization matrix tests asserting unauthorized attempts return 403 Forbidden.', null, 'coding', 'github_pr', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 6)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 6)) then now() else null end),
      (p_cohort_id, 8, 'Day 08: Payment Webhook Processing & Idempotency', 'Construct resilient webhook handler verifying cryptographic signatures, enforcing atomic idempotency keys, and handling retries gracefully.', 'Submit webhook service PR with mock replay tests proving idempotent execution.', null, 'coding', 'github_pr', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 7)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 7)) then now() else null end),
      (p_cohort_id, 9, 'Day 09: Background Job Queues & Rate Limiting', 'Design asynchronous task queues for email/notification dispatch and attach token-bucket rate limiters across public API endpoints.', 'Submit PR demonstrating queue retry backoff and rate limiter 429 response under load.', null, 'coding', 'github_pr', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 8)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 8)) then now() else null end),
      (p_cohort_id, 10, 'Day 10: Sprint 2 Milestone — Mid-Term Integration Review', 'Consolidated full-stack service incorporating real-time feeds, webhooks, rate limiting, and RBAC security.', 'Submit production-grade pull request for mid-term architectural review and leaderboard scoring.', null, 'coding', 'github_pr', 48, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 9)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 9)) then now() else null end),
      (p_cohort_id, 11, 'Day 11: Production Capstone — System Architecture & Data Model', 'Kick off the 5-day software engineering capstone client brief. Author architecture diagram, schema DDL, and API contracts.', 'Submit RFC/Architecture document and baseline entity relationship diagrams in PR.', null, 'coding', 'github_pr', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 10)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 10)) then now() else null end),
      (p_cohort_id, 12, 'Day 12: Production Capstone — Core Business Logic & State Engine', 'Implement primary workflow algorithms, transactional invariants, and complex optimistic state transitions.', 'Submit backend and frontend core functionality PR with unit test coverage > 80%.', null, 'coding', 'github_pr', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 11)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 11)) then now() else null end),
      (p_cohort_id, 13, 'Day 13: Production Capstone — Automated Testing & Security Audit', 'Achieve comprehensive unit, integration, and E2E coverage. Run automated static security scans and fix vulnerabilities.', 'Ensure CI passes 100% test assertions with 0 high/critical CVEs reported by security audit tools.', null, 'coding', 'github_pr', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 12)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 12)) then now() else null end),
      (p_cohort_id, 14, 'Day 14: Production Capstone — CI/CD Pipeline & Production Deployment', 'Configure automated build & deployment workflows, edge caching, observability alerts, and ship to production domain.', 'Submit live production deployment URL, health check endpoint, and GitHub Actions workflow status.', null, 'coding', 'github_pr', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 13)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 13)) then now() else null end),
      (p_cohort_id, 15, 'Day 15: Graduation, Engineering Demo Day & Letter of Recommendation', 'Present your completed capstone to engineering mentors, complete exit code review, and receive your verifiable credential.', 'Submit your portfolio demo link and final engineering reflection.', null, 'coding', 'text', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 14)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 14)) then now() else null end)
    on conflict (cohort_id, day_number) do nothing;

  elsif v_selected_track = 'motion_graphics' then
    insert into public.daily_challenges (
      cohort_id, day_number, title, description, instructions, starter_files_url,
      track_type, submission_type, deadline_hours, is_published, unlocked_at
    )
    values
      (p_cohort_id, 1, 'Day 01: Workspace Setup, Keyframe Curves & Velocity', 'Master temporal and spatial easing in the Graph Editor, understand value curves, and produce smooth secondary motion.', 'Submit an animation test exhibiting easing, anticipation, and follow-through.', 'https://drive.google.com/drive/folders/sample-motion-day-1', 'non_coding', 'drive_link', 24, true, now()),
      (p_cohort_id, 2, 'Day 02: Kinetic Typography & Expression-Driven Titles', 'Animate kinetic title systems with tracking animators, expression-based overshoot (inertia bounce), and voice cadence sync.', 'Submit a 15-second kinetic typography promo synced to a spoken word soundbite.', null, 'non_coding', 'drive_link', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 1)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 1)) then now() else null end),
      (p_cohort_id, 3, 'Day 03: Vector Shape Animations & Liquid Morphing', 'Create continuous vector transformations using shape path modifiers, trim paths, and seamless path interpolations.', 'Produce a 20-second continuous shape-morph sequence transitioning between 4 distinct icons.', null, 'non_coding', 'drive_link', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 2)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 2)) then now() else null end),
      (p_cohort_id, 4, 'Day 04: Brand Identity & Animated Logo Sting', 'Deconstruct a brand identity vector asset into a memorable 5-second animated bumper sting with branded color dynamics.', 'Deliver 16:9 and 9:16 aspect ratio animated logo stings with alpha transparency exports.', null, 'non_coding', 'drive_link', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 3)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 3)) then now() else null end),
      (p_cohort_id, 5, 'Day 05: Sprint 1 Milestone — Dynamic 15s Commercial Sting', 'Milestone deliverable: Combine typography, vector shape morphing, and logo animation into a polished 15-second commercial bumper.', 'Submit your Sprint 1 high-resolution export for mentor design critique and pacing review.', null, 'non_coding', 'drive_link', 48, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 4)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 4)) then now() else null end),
      (p_cohort_id, 6, 'Day 06: Cinema 4D / Blender Integration & 3D Camera Tracking', 'Solve real-world video footage tracks, extract 3D point clouds, and composite 3D geometric objects seamlessly into live video.', 'Submit a camera-tracked composite video with shadow catcher and realistic perspective.', null, 'non_coding', 'drive_link', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 5)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 5)) then now() else null end),
      (p_cohort_id, 7, 'Day 07: PBR Shading, Studio Lighting & Depth Passes', 'Set up three-point studio lighting rigs, apply realistic roughness/metallic PBR maps, and render out multi-channel EXR depth passes.', 'Submit high-resolution beauty pass and depth-of-field composite render.', null, 'non_coding', 'drive_link', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 6)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 6)) then now() else null end),
      (p_cohort_id, 8, 'Day 08: Particle Dynamics & Abstract Mograph Simulation', 'Utilize procedural emitters, turbulence fields, and particle collision dynamics to create abstract sci-fi/organic motion simulations.', 'Submit a 10-second looping abstract particle simulation cut.', null, 'non_coding', 'drive_link', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 7)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 7)) then now() else null end),
      (p_cohort_id, 9, 'Day 09: UI/UX Micro-Interactions & 3D Device Mockups', 'Animate mobile/desktop UI mockups floating in 3D isometric space with interactive clicks, gestures, and glass refraction.', 'Deliver a sleek SaaS software or mobile app product walkthrough video.', null, 'non_coding', 'drive_link', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 8)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 8)) then now() else null end),
      (p_cohort_id, 10, 'Day 10: Sprint 2 Milestone — Mid-Term Commercial Reel Review', 'Consolidated commercial motion sequence combining 3D product renders, dynamic camera moves, and kinetic graphic accents.', 'Submit your mid-term commercial reel segment for mentor scoring and cohort ranking.', null, 'non_coding', 'drive_link', 48, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 9)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 9)) then now() else null end),
      (p_cohort_id, 11, 'Day 11: Motion Capstone — 3D Styleframes & Storyboard Deck', 'Design 5 cohesive production styleframes, visual moodboards, and animatic timings for your final client commercial capstone.', 'Submit your styleframe presentation deck and rough animatic sequence.', null, 'non_coding', 'drive_link', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 10)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 10)) then now() else null end),
      (p_cohort_id, 12, 'Day 12: Motion Capstone — 3D Scene Animation & Camera Blocking', 'Animate core product hero shots, keyframe dynamic camera swoops, and lock scene transition cuts to audio stems.', 'Submit rough playblast / hardware preview of the complete 3D scene timing.', null, 'non_coding', 'drive_link', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 11)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 11)) then now() else null end),
      (p_cohort_id, 13, 'Day 13: Motion Capstone — Compositing, Grain & Color Finishing', 'Assemble multi-pass EXR renders in After Effects, add chromatic aberration, glow falls, 35mm film grain, and lens flares.', 'Submit near-final composite master cut for preliminary mentor feedback.', null, 'non_coding', 'drive_link', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 12)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 12)) then now() else null end),
      (p_cohort_id, 14, 'Day 14: Final Capstone Master Export & Breakdown Reel', 'Render the final 4K master export alongside a behind-the-scenes breakdown reel revealing wireframes, depth passes, and layers.', 'Submit your completed 4K final export link with breakdown commentary.', null, 'non_coding', 'drive_link', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 13)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 13)) then now() else null end),
      (p_cohort_id, 15, 'Day 15: Graduation, Exit Evaluation & Letter of Recommendation', 'Final mentor portfolio review, showreel cataloging, and release of your verified Internship Certificate.', 'Complete exit assessment and receive your digital verifiable certification.', null, 'non_coding', 'text', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 14)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 14)) then now() else null end)
    on conflict (cohort_id, day_number) do nothing;

  else
    insert into public.daily_challenges (
      cohort_id, day_number, title, description, instructions, starter_files_url,
      track_type, submission_type, deadline_hours, is_published, unlocked_at
    )
    values
      (p_cohort_id, 1, 'Day 01: Production Setup & First Kinetic Cut', 'Establish project directory structure, import raw footage/starter repo, and ship first edit.', 'Submit your Day 1 repository PR or Google Drive cut link before midnight.', 'https://drive.google.com/drive/folders/sample-day-1', 'non_coding', 'drive_link', 24, true, now()),
      (p_cohort_id, 2, 'Day 02: Pacing, Micro-Transitions & Retention', 'Learn fast-paced cuts, J/L audio cuts, and maintaining 70%+ audience watch retention.', 'Produce a 30-second timeline maintaining retention peaks at seconds 3, 7, and 15.', null, 'non_coding', 'drive_link', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 1)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 1)) then now() else null end),
      (p_cohort_id, 3, 'Day 03: Sound Design, SFX Stems & Audio Layering', 'Layer whooshes, risers, foley hits, and balance speech volume levels to -6dB True Peak.', 'Include at least 4 distinct audio stem layers and export your clean WAV/MP4 master.', null, 'non_coding', 'drive_link', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 2)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 2)) then now() else null end),
      (p_cohort_id, 4, 'Day 04: Kinetic Typography & Motion Graphics', 'Sync word-by-word highlighted captions and title lower-thirds to voice cadence.', 'Submit a 45-second commercial segment featuring dynamic kinetic typography.', null, 'non_coding', 'drive_link', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 3)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 3)) then now() else null end),
      (p_cohort_id, 5, 'Day 05: Sprint 1 Milestone — First Client Simulation', 'Integrate Days 1–4 techniques into a complete 60s vertical product ad or full code module.', 'Submit your Sprint 1 final export for weekend mentor live grading.', null, 'non_coding', 'drive_link', 48, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 4)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 4)) then now() else null end),
      (p_cohort_id, 6, 'Day 06: Cinematic Color Grading & Tone Curves', 'Color balance Log footage, create a moody contrast curve, and export Rec.709 clean grades.', 'Submit a side-by-side Before/After color comparison video.', null, 'non_coding', 'drive_link', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 5)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 5)) then now() else null end),
      (p_cohort_id, 7, 'Day 07: Speed Ramping, Optical Flow & Match Cuts', 'Execute smooth seamless speed-ramps between action sequences using bezier handles.', 'Deliver a 20-second dynamic sports or fitness montage with 3 speed ramps.', null, 'non_coding', 'drive_link', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 6)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 6)) then now() else null end),
      (p_cohort_id, 8, 'Day 08: Visual FX, Green Screen & Rotoscoping', 'Mask foreground subjects, layer background lighting effects, and clean edge bleed.', 'Submit your composite shot file and render proof.', null, 'non_coding', 'drive_link', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 7)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 7)) then now() else null end),
      (p_cohort_id, 9, 'Day 09: Music Video Rhythm & Beat Synchronicity', 'Cut to dynamic tempo shifts and transient drum peaks for maximum emotional punch.', 'Sync 8 fast-cut b-roll scenes to acoustic/electronic tempo drop.', null, 'non_coding', 'drive_link', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 8)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 8)) then now() else null end),
      (p_cohort_id, 10, 'Day 10: Sprint 2 Milestone — Mid-Term Portfolio Review', 'Consolidated commercial cut incorporating color, sound, typography, and speed ramps.', 'Submit for mid-term mentor feedback audit and cohort leaderboard score.', null, 'non_coding', 'drive_link', 48, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 9)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 9)) then now() else null end),
      (p_cohort_id, 11, 'Day 11: Production Capstone — Storyboard & Raw Assembly', 'Begin your final 15-day capstone client project. Assemble the A-roll timeline.', 'Submit rough narrative sequence cut.', null, 'non_coding', 'drive_link', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 10)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 10)) then now() else null end),
      (p_cohort_id, 12, 'Day 12: Production Capstone — Sound Design & Foley Polish', 'Add music transitions, SFX sweetening, and vocal clarity EQ pass.', 'Submit second cut with completed audio stems.', null, 'non_coding', 'drive_link', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 11)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 11)) then now() else null end),
      (p_cohort_id, 13, 'Day 13: Production Capstone — Motion & Color Mastering', 'Fine-tune color consistency across all takes, add typography overlays, and sharpen details.', 'Submit near-final client master for preliminary mentor critique.', null, 'non_coding', 'drive_link', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 12)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 12)) then now() else null end),
      (p_cohort_id, 14, 'Day 14: Final Capstone Master Export & Showcase', 'Deliver the client-ready 4K and vertical master exports with complete source project bundle.', 'Submit high-bitrate export link along with written production notes.', null, 'non_coding', 'drive_link', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 13)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 13)) then now() else null end),
      (p_cohort_id, 15, 'Day 15: Graduation, Exit Evaluation & Letter of Recommendation', 'Final mentor grading, portfolio verification, and release of your verified Internship Certificate.', 'Complete the exit survey and claim your verifiable digital certificate.', null, 'non_coding', 'text', 24, (v_cohort_start is not null and current_date >= (v_cohort_start::date + 14)), case when (v_cohort_start is not null and current_date >= (v_cohort_start::date + 14)) then now() else null end)
    on conflict (cohort_id, day_number) do nothing;
  end if;

  select count(*) into v_count
  from public.daily_challenges
  where cohort_id = p_cohort_id;

  return jsonb_build_object(
    'success', true,
    'count', v_count,
    'seeded', true,
    'track', v_selected_track
  );
end;
$$;

grant execute on function public.ensure_cohort_daily_challenges(uuid) to authenticated, anon, service_role;

-- ------------------------------------------------------------------------------
-- 2. Trigger: Automatically seed syllabus challenges when a new cohort is created
-- ------------------------------------------------------------------------------

create or replace function public.trigger_ensure_cohort_daily_challenges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_cohort_daily_challenges(new.id);
  return new;
exception when others then
  raise warning 'Auto-seeding daily challenges failed for cohort %: %', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists trg_ensure_cohort_daily_challenges on public.cohorts;
create trigger trg_ensure_cohort_daily_challenges
  after insert on public.cohorts
  for each row
  execute function public.trigger_ensure_cohort_daily_challenges();
