import { useState, useMemo } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Code2,
  Film,
  Flame,
  MessageCircle,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react';
import { TiltCard } from './TiltCard';
import { Button } from '../ui/Button';
import { soundFx } from '../../lib/soundFx';

export type SprintTrack = 'video' | 'coding' | 'motion';

export interface DayRoadmapItem {
  day: number;
  phase: 1 | 2 | 3;
  track: SprintTrack;
  title: string;
  deliverable: string;
  tool: string;
  time: string;
  desc: string;
  rubricPoints: string;
}

export interface TrackMetadata {
  id: SprintTrack;
  tabLabel: string;
  name: string;
  badge: string;
  description: string;
  color: {
    primary: string;
    border: string;
    borderHover: string;
    bgBadge: string;
    textBadge: string;
    gradient: string;
    glow: string;
  };
  softwareStack: Array<{ name: string; role: string }>;
  phases: Record<
    1 | 2 | 3,
    {
      title: string;
      tagline: string;
      days: string;
      objective: string;
      milestone: string;
    }
  >;
}

const TRACK_DEFINITIONS: Record<SprintTrack, TrackMetadata> = {
  video: {
    id: 'video',
    tabLabel: '🎬 Video Editing Track',
    name: 'Video Editing & Post-Production',
    badge: 'ProCut Visual Track',
    description: 'Master Hollywood pacing, multi-track audio stems, color grading science, and commercial client assemblies.',
    color: {
      primary: 'text-orange-400',
      border: 'border-orange-500/40',
      borderHover: 'hover:border-orange-500/60',
      bgBadge: 'bg-orange-500/20',
      textBadge: 'text-orange-400',
      gradient: 'from-orange-500 to-amber-500',
      glow: 'rgba(249, 115, 22, 0.25)',
    },
    softwareStack: [
      { name: 'Premiere Pro', role: 'Rough Cuts & Story Assembly' },
      { name: 'DaVinci Resolve', role: 'Color Grading & Scopes' },
      { name: 'Adobe Audition', role: 'SFX Stems & -14 LUFS Mix' },
      { name: 'After Effects', role: 'Kinetic Titles & Visual FX' },
    ],
    phases: {
      1: {
        title: 'Phase 1: Drills & Foundations',
        tagline: 'Assembly Cuts, J/L Audio Bridges & Kinetic Captions',
        days: 'Days 1–5',
        objective: 'Establish project architecture, build high-retention timeline cuts, balance multi-stem sound layers to -14 LUFS, and animate word-by-word captions.',
        milestone: 'Sprint 1 Milestone: 60s Vertical Product Commercial Cut',
      },
      2: {
        title: 'Phase 2: Production & Color Science',
        tagline: 'Log Curves, Speed Ramps & Rotoscoping',
        days: 'Days 6–10',
        objective: 'Deliver Rec.709 color balances on vectorscopes, bezier speed ramping with optical flow, green screen despill, and transient beat drops.',
        milestone: 'Sprint 2 Milestone: Mid-Term Commercial Portfolio Review',
      },
      3: {
        title: 'Phase 3: Client Simulation & Capstone',
        tagline: '4K Master, Audio Polish & Exit Referral',
        days: 'Days 11–15',
        objective: 'Execute a client commercial brief from A-roll assembly to foley sweetening, multi-layer mastering, and high-bitrate ProRes/MP4 exports.',
        milestone: 'Capstone Master: 4K Client Master + Verifiable Digital Certificate & LOR',
      },
    },
  },
  coding: {
    id: 'coding',
    tabLabel: '💻 Full-Stack Software Track',
    name: 'Full-Stack Software Engineering',
    badge: 'Production Engineering Track',
    description: 'Build enterprise-grade web applications with strict TypeScript, PostgreSQL RLS, Zod APIs, and automated CI/CD pipelines.',
    color: {
      primary: 'text-cyan-400',
      border: 'border-cyan-500/40',
      borderHover: 'hover:border-cyan-500/60',
      bgBadge: 'bg-cyan-500/20',
      textBadge: 'text-cyan-300',
      gradient: 'from-cyan-500 via-sky-500 to-blue-600',
      glow: 'rgba(6, 182, 212, 0.25)',
    },
    softwareStack: [
      { name: 'VS Code + Git', role: 'Strict Monorepo & Branch PRs' },
      { name: 'React 19', role: 'Optimistic State & Client Architecture' },
      { name: 'Supabase + RLS', role: 'Row-Level Security & Postgres Schema' },
      { name: 'TypeScript + Zod', role: 'Type-Safe Contracts & Input Validation' },
      { name: 'Node.js / Webhooks', role: 'Idempotent Queues & WebSockets' },
    ],
    phases: {
      1: {
        title: 'Phase 1: Drills & Architecture',
        tagline: 'Git Flow, Relational Schemas & Zod APIs',
        days: 'Days 1–5',
        objective: 'Enforce strict Git branching, author normalized PostgreSQL schemas protected by Row-Level Security, build Zod-validated APIs, and connect optimistic UI states.',
        milestone: 'Sprint 1 Milestone: Authenticated Full-Stack CRUD API with Passing Tests',
      },
      2: {
        title: 'Phase 2: Production Systems & Real-Time',
        tagline: 'WebSockets, RBAC Route Guards & Webhooks',
        days: 'Days 6–10',
        objective: 'Integrate live real-time sync with reconnection backoff, implement hierarchical role guards, process idempotent payment webhooks, and rate limit public endpoints.',
        milestone: 'Sprint 2 Milestone: Consolidated Real-Time Application with Live Review',
      },
      3: {
        title: 'Phase 3: Client Simulation & Deployment',
        tagline: 'System RFC, Automated CI/CD & Production Release',
        days: 'Days 11–15',
        objective: 'Architect enterprise system design documents, build core transactional business logic, execute automated test suites (unit + integration), and ship to custom cloud domains.',
        milestone: 'Capstone Deliverable: Production Deployed SaaS + Verified Certificate & LOR',
      },
    },
  },
  motion: {
    id: 'motion',
    tabLabel: '✨ Motion & 3D Design Track',
    name: 'Motion Graphics & 3D Animation',
    badge: 'Cinema 3D & Mograph Track',
    description: 'Create fluid kinetic typography, liquid vector morphs, 3D camera tracking, and physically based material simulations.',
    color: {
      primary: 'text-fuchsia-400',
      border: 'border-fuchsia-500/40',
      borderHover: 'hover:border-fuchsia-500/60',
      bgBadge: 'bg-fuchsia-500/20',
      textBadge: 'text-fuchsia-300',
      gradient: 'from-fuchsia-500 via-purple-500 to-pink-500',
      glow: 'rgba(217, 70, 239, 0.25)',
    },
    softwareStack: [
      { name: 'Blender 4', role: '3D Geometry, PBR Materials & Cycles' },
      { name: 'Cinema 4D', role: 'Camera Blocking & Spatial Layout' },
      { name: 'After Effects', role: 'Graph Editor Easing & Multi-Pass EXR' },
      { name: 'Octane / Redshift', role: 'Physically Based Shading & Glow' },
      { name: 'Illustrator', role: 'Vector Paths & Liquid Shape Morphs' },
    ],
    phases: {
      1: {
        title: 'Phase 1: Drills & Motion Principles',
        tagline: 'Graph Easing, Kinetic Titles & Vector Morphs',
        days: 'Days 1–5',
        objective: 'Master graph editor bezier velocity handles, inertia bounce expressions, continuous liquid vector shape morphs, and animated corporate logo stings.',
        milestone: 'Sprint 1 Milestone: 15s Commercial Bumper Sting with Alpha Channel',
      },
      2: {
        title: 'Phase 2: Production & 3D Spatial Systems',
        tagline: 'Camera Tracking, PBR Shading & Particles',
        days: 'Days 6–10',
        objective: 'Extract 3D point cloud camera tracks from live footage, light scenes with studio HDRI rigs, author physically based roughness shaders, and simulate particle dynamics.',
        milestone: 'Sprint 2 Milestone: Mid-Term 3D Motion Reel Sequence',
      },
      3: {
        title: 'Phase 3: Client Simulation & Showreel',
        tagline: 'Styleframe Decks, Multi-Pass EXR & 4K Reel',
        days: 'Days 11–15',
        objective: 'Design 5 client pitch styleframes, animate 3D scene camera choreography, composite multi-pass EXR layers in After Effects, and master the final 4K showreel.',
        milestone: 'Capstone Deliverable: 4K Commercial Motion Reel + Verified Certificate & LOR',
      },
    },
  },
};

const TRACK_CURRICULUM_DAYS: Record<SprintTrack, DayRoadmapItem[]> = {
  video: [
    {
      day: 1,
      phase: 1,
      track: 'video',
      title: 'Day 01: Production Setup & First Kinetic Cut',
      deliverable: 'Google Drive cut link with clean directory structure',
      tool: 'Premiere Pro',
      time: '2h',
      desc: 'Establish project directory structure, import raw 4K footage, set project scratch disks, and ship your first kinetic cut before midnight.',
      rubricPoints: 'Strict directory architecture, zero dropped frames, rough assembly timing.',
    },
    {
      day: 2,
      phase: 1,
      track: 'video',
      title: 'Day 02: Pacing, Micro-Transitions & Retention',
      deliverable: '30-second high-retention timeline with J/L audio bridges',
      tool: 'Premiere Pro',
      time: '2.5h',
      desc: 'Learn fast-paced cuts, audio lead-ins (J/L cuts), and maintaining 70%+ audience watch retention past the crucial 3-second hook.',
      rubricPoints: 'Retention hook within 3s, seamless J/L audio overlap, zero visual stutter.',
    },
    {
      day: 3,
      phase: 1,
      track: 'video',
      title: 'Day 03: Sound Design, SFX Stems & Audio Layering',
      deliverable: 'Submixed audio timeline with 4+ distinct stems',
      tool: 'Adobe Audition',
      time: '2h',
      desc: 'Layer whooshes, risers, foley hits, and balance speech volume levels to -6dB True Peak and -14 LUFS integrated loudness.',
      rubricPoints: '-14 LUFS loudness mastering, dialogue clarity over music, textured foley layers.',
    },
    {
      day: 4,
      phase: 1,
      track: 'video',
      title: 'Day 04: Kinetic Typography & Motion Graphics',
      deliverable: '45-second commercial segment with kinetic captions',
      tool: 'After Effects',
      time: '2.5h',
      desc: 'Sync word-by-word highlighted captions, animated lower thirds, and title motion accents to speaker cadence and vocal emphasis.',
      rubricPoints: 'Accurate speech cadence sync, typography contrast ratio, bezier easing curves.',
    },
    {
      day: 5,
      phase: 1,
      track: 'video',
      title: 'Day 05: Sprint 1 Milestone — First Client Simulation',
      deliverable: 'Complete 60-second vertical product ad export',
      tool: 'Premiere Pro',
      time: '3h',
      desc: 'Integrate Days 1–4 techniques into a complete 60s vertical product ad ready for weekend mentor live grading and review.',
      rubricPoints: 'Pacing curve retention, clean audio submix, dynamic typography integration.',
    },
    {
      day: 6,
      phase: 2,
      track: 'video',
      title: 'Day 06: Cinematic Color Grading & Tone Curves',
      deliverable: 'Before/After Log-to-Rec.709 color balance grade',
      tool: 'DaVinci Resolve',
      time: '2.5h',
      desc: 'Color balance Log footage, create a moody contrast curve, align skin tones on vectorscopes, and export clean Rec.709 deliverables.',
      rubricPoints: 'Accurate vectorscope skin-tone line alignment, clean contrast tone curve, zero clip banding.',
    },
    {
      day: 7,
      phase: 2,
      track: 'video',
      title: 'Day 07: Speed Ramping, Optical Flow & Match Cuts',
      deliverable: '20-second dynamic sports/action montage with 3 speed ramps',
      tool: 'DaVinci Resolve / Premiere',
      time: '2.5h',
      desc: 'Execute smooth seamless speed-ramps between action sequences using bezier handles and optical flow motion vector interpolation.',
      rubricPoints: 'Smooth velocity bezier transition, zero optical flow warping artifacts, match-cut alignment.',
    },
    {
      day: 8,
      phase: 2,
      track: 'video',
      title: 'Day 08: Visual FX, Green Screen & Rotoscoping',
      deliverable: 'Clean composite shot file with edge matte refinement',
      tool: 'After Effects',
      time: '2.5h',
      desc: 'Mask foreground subjects, layer background lighting effects, despill green screen edges, and clean edge bleed.',
      rubricPoints: 'Hair/edge detail preservation, zero color spill, light wrap consistency.',
    },
    {
      day: 9,
      phase: 2,
      track: 'video',
      title: 'Day 09: Music Video Rhythm & Beat Synchronicity',
      deliverable: '8-cut b-roll sequence synchronized to transient audio drop',
      tool: 'Premiere Pro',
      time: '2h',
      desc: 'Cut to dynamic tempo shifts and transient drum peaks for maximum emotional punch, matching cuts to rhythmic transients.',
      rubricPoints: 'Accurate transient waveform alignment, emotional visual momentum, rhythm variety.',
    },
    {
      day: 10,
      phase: 2,
      track: 'video',
      title: 'Day 10: Sprint 2 Milestone — Mid-Term Portfolio Review',
      deliverable: 'Consolidated commercial cut incorporating all Sprint 2 tools',
      tool: 'Full Editing Suite',
      time: '3h',
      desc: 'Consolidated commercial cut incorporating color, sound, typography, and speed ramps submitted for mid-term mentor feedback audit.',
      rubricPoints: 'Comprehensive technical polish, cohesive narrative rhythm, portfolio quality.',
    },
    {
      day: 11,
      phase: 3,
      track: 'video',
      title: 'Day 11: Production Capstone — Storyboard & Raw Assembly',
      deliverable: 'Rough narrative A-roll timeline and storyboard breakdown',
      tool: 'Premiere Pro',
      time: '2.5h',
      desc: 'Begin your final 15-day capstone client project. Assemble the A-roll timeline and establish foundational narrative progression.',
      rubricPoints: 'Structural narrative clarity, foundational scene coverage, pacing baseline.',
    },
    {
      day: 12,
      phase: 3,
      track: 'video',
      title: 'Day 12: Production Capstone — Sound Design & Foley Polish',
      deliverable: 'Second cut with full atmospheric sound stems and mix',
      tool: 'Adobe Audition',
      time: '4h',
      desc: 'Add music transitions, SFX sweetening, vocal clarity EQ pass, and spatial stereo panning across client footage.',
      rubricPoints: 'Dialogue intelligibility, spatial panning accuracy, dynamic impact sound design.',
    },
    {
      day: 13,
      phase: 3,
      track: 'video',
      title: 'Day 13: Production Capstone — Motion & Color Mastering',
      deliverable: 'Near-final client master with color and titles mastered',
      tool: 'DaVinci Resolve',
      time: '4h',
      desc: 'Fine-tune color consistency across all takes, add typography overlays, sharpen details, and eliminate visual artifacts.',
      rubricPoints: 'Cross-scene color consistency, title layout typography, zero clipping.',
    },
    {
      day: 14,
      phase: 3,
      track: 'video',
      title: 'Day 14: Final Capstone Master Export & Showcase',
      deliverable: 'ProRes 4K and Web MP4 deliverables bundle with production notes',
      tool: 'Media Encoder',
      time: '2.5h',
      desc: 'Deliver the client-ready 4K and vertical master exports with complete source project bundle and production notes.',
      rubricPoints: 'Bitrate encoding standard compliance, comprehensive documentation, clean render.',
    },
    {
      day: 15,
      phase: 3,
      track: 'video',
      title: 'Day 15: Graduation, Exit Evaluation & Letter of Recommendation',
      deliverable: 'Verified Internship Certificate & LinkedIn Portfolio',
      tool: 'ProCut Portal',
      time: '1h',
      desc: 'Final mentor grading, portfolio verification, and release of your verified Internship Certificate and personal Letter of Recommendation.',
      rubricPoints: '15/15 days accepted submissions, mentor portfolio signoff, exit interview.',
    },
  ],
  coding: [
    {
      day: 1,
      phase: 1,
      track: 'coding',
      title: 'Day 01: Git Workflow, Dev Environment & Initial Commit',
      deliverable: 'GitHub Repository with strict TypeScript/ESLint CI preview',
      tool: 'VS Code + Git',
      time: '2h',
      desc: 'Set up development workspace, initialize strict TypeScript configuration, configure ESLint/Prettier, and open your initial feature branch PR.',
      rubricPoints: 'Clean branch hygiene, zero TypeScript errors in strict mode, passing CI hooks.',
    },
    {
      day: 2,
      phase: 1,
      track: 'coding',
      title: 'Day 02: Relational Modeling & Row-Level Security (RLS)',
      deliverable: 'PostgreSQL DDL schema migration with RLS policies',
      tool: 'PostgreSQL / Supabase',
      time: '2.5h',
      desc: 'Design 3NF relational schema in PostgreSQL, create migration scripts, and enforce strict Row-Level Security policies with zero data leak vectors.',
      rubricPoints: 'Proper foreign keys & composite indexing, multi-tenant RLS isolation assertions.',
    },
    {
      day: 3,
      phase: 1,
      track: 'coding',
      title: 'Day 03: Strongly Typed REST Endpoints & Zod Validation',
      deliverable: 'REST API endpoints with Zod payload schemas & test suite',
      tool: 'TypeScript / Zod',
      time: '2h',
      desc: 'Author production REST/RPC handler functions, integrate Zod request body validation, and return RFC 7807 compliant error payloads.',
      rubricPoints: 'Strict input sanitization, 100% typed schemas, RFC 7807 error status codes.',
    },
    {
      day: 4,
      phase: 1,
      track: 'coding',
      title: 'Day 04: Frontend State Architecture & Optimistic Mutations',
      deliverable: 'Interactive React state components with optimistic rollback',
      tool: 'React 19 / TanStack Query',
      time: '2.5h',
      desc: 'Implement TanStack Query or SWR hooks with optimistic UI rollback, background cache revalidation, and zero layout shift.',
      rubricPoints: 'Optimistic UI latency < 50ms, graceful rollback on error, zero unnecessary re-renders.',
    },
    {
      day: 5,
      phase: 1,
      track: 'coding',
      title: 'Day 05: Sprint 1 Milestone — Authenticated CRUD Feature',
      deliverable: 'Complete end-to-end full-stack CRUD feature with >85% test coverage',
      tool: 'React + Supabase',
      time: '3h',
      desc: 'Consolidate Days 1–4 into an end-to-end user feature with secure authentication tokens, RLS enforcement, and optimistic feedback.',
      rubricPoints: 'End-to-end user journey verified, automated test suite passing, secure session tokens.',
    },
    {
      day: 6,
      phase: 2,
      track: 'coding',
      title: 'Day 06: WebSocket Real-Time Sync & Live Subscriptions',
      deliverable: 'Multi-tab collaborative live feed with auto-reconnection',
      tool: 'WebSockets / Supabase Realtime',
      time: '2.5h',
      desc: 'Subscribe to PostgreSQL CDC replication streams or Supabase Realtime channels with reconnection backoff and heartbeat verification.',
      rubricPoints: 'Real-time broadcast latency < 100ms, backoff reconnection retry, optimistic deduplication.',
    },
    {
      day: 7,
      phase: 2,
      track: 'coding',
      title: 'Day 07: Role-Based Access Control (RBAC) & Route Guards',
      deliverable: 'RBAC route guards and server-side RPC permission checks',
      tool: 'TypeScript / Next.js',
      time: '2.5h',
      desc: 'Implement hierarchical roles (student, mentor, admin) with route-level protection, JWT claims verification, and security middleware.',
      rubricPoints: 'Unauthorized actions return 403 Forbidden, server-authoritative permission checks.',
    },
    {
      day: 8,
      phase: 2,
      track: 'coding',
      title: 'Day 08: Payment Webhook Processing & Idempotency',
      deliverable: 'Cryptographically verified Razorpay/Stripe webhook endpoint',
      tool: 'Node.js / Crypto HMAC',
      time: '2.5h',
      desc: 'Construct resilient webhook handler verifying cryptographic signatures, enforcing atomic idempotency keys, and handling retries gracefully.',
      rubricPoints: 'HMAC signature verification, duplicate webhook replay rejection, idempotent DB transactions.',
    },
    {
      day: 9,
      phase: 2,
      track: 'coding',
      title: 'Day 09: Background Job Queues & Rate Limiting',
      deliverable: 'Token-bucket rate limiter and asynchronous task runner',
      tool: 'Redis / Edge Functions',
      time: '2h',
      desc: 'Design asynchronous task queues for notification dispatch and attach token-bucket rate limiters across public API endpoints.',
      rubricPoints: 'Accurate HTTP 429 rate limit enforcement, exponential backoff on queue worker retries.',
    },
    {
      day: 10,
      phase: 2,
      track: 'coding',
      title: 'Day 10: Sprint 2 Milestone — Mid-Term Integration Review',
      deliverable: 'Consolidated full-stack service with live deployment audit',
      tool: 'Full Stack Architecture',
      time: '3h',
      desc: 'Consolidated full-stack service incorporating real-time feeds, webhooks, rate limiting, and RBAC security submitted for mid-term review.',
      rubricPoints: 'Architectural modularity, zero open security vulnerabilities, automated CI test pass.',
    },
    {
      day: 11,
      phase: 3,
      track: 'coding',
      title: 'Day 11: Production Capstone — System Architecture & Data Model',
      deliverable: 'Technical Design RFC document, ERD diagrams & schema DDL',
      tool: 'Architecture RFC / DDL',
      time: '2.5h',
      desc: 'Kick off the 5-day software engineering capstone client brief. Author architecture diagram, schema DDL, and API contracts.',
      rubricPoints: 'System scalability analysis, database normalization, strongly defined API contracts.',
    },
    {
      day: 12,
      phase: 3,
      track: 'coding',
      title: 'Day 12: Production Capstone — Core Business Logic & State Engine',
      deliverable: 'Core domain services implementation with unit test coverage >80%',
      tool: 'TypeScript / Database',
      time: '4h',
      desc: 'Implement primary workflow algorithms, transactional invariants, and complex optimistic state transitions.',
      rubricPoints: 'Data consistency under concurrency, comprehensive edge-case test suite.',
    },
    {
      day: 13,
      phase: 3,
      track: 'coding',
      title: 'Day 13: Production Capstone — Automated Testing & Security Audit',
      deliverable: 'E2E test suite (Vitest + Playwright) and 0-CVE security audit report',
      tool: 'Vitest / Playwright',
      time: '4h',
      desc: 'Achieve comprehensive unit, integration, and E2E coverage. Run automated static security scans and fix vulnerabilities.',
      rubricPoints: '>85% code branch test coverage, zero high/critical vulnerabilities in dependencies.',
    },
    {
      day: 14,
      phase: 3,
      track: 'coding',
      title: 'Day 14: Production Capstone — CI/CD Pipeline & Production Deployment',
      deliverable: 'Live Vercel/Cloudflare deployment URL with health check monitor',
      tool: 'GitHub Actions / Vercel',
      time: '2.5h',
      desc: 'Configure automated build & deployment workflows, edge caching, observability alerts, and ship to production domain.',
      rubricPoints: '100% passing automated CI/CD pipeline, SSL/HTTPS valid, sub-second TTFB.',
    },
    {
      day: 15,
      phase: 3,
      track: 'coding',
      title: 'Day 15: Graduation, Engineering Demo Day & Letter of Recommendation',
      deliverable: 'Live Product Demo, Verified Certificate & Mentor Recommendation',
      tool: 'ProCut Portal',
      time: '1h',
      desc: 'Present your completed capstone to engineering mentors, complete exit code review, and receive your verifiable credential.',
      rubricPoints: 'Passing engineering code review, verified certificate issuance, hiring portfolio release.',
    },
  ],
  motion: [
    {
      day: 1,
      phase: 1,
      track: 'motion',
      title: 'Day 01: Workspace Setup, Keyframe Curves & Velocity',
      deliverable: 'Animation test exhibiting easing, squash, stretch, and overshoot',
      tool: 'After Effects',
      time: '2h',
      desc: 'Master temporal and spatial easing in the Graph Editor, understand value curves, and produce smooth secondary motion.',
      rubricPoints: 'Graph editor bezier curve control, anticipation & follow-through, zero abrupt velocity snaps.',
    },
    {
      day: 2,
      phase: 1,
      track: 'motion',
      title: 'Day 02: Kinetic Typography & Expression-Driven Titles',
      deliverable: '15-second kinetic typography promo synced to spoken audio',
      tool: 'After Effects',
      time: '2.5h',
      desc: 'Animate kinetic title systems with tracking animators, expression-based overshoot (inertia bounce), and voice cadence sync.',
      rubricPoints: 'Word-by-word transient synchronization, expressive typography hierarchy, inertia bounce.',
    },
    {
      day: 3,
      phase: 1,
      track: 'motion',
      title: 'Day 03: Vector Shape Animations & Liquid Morphing',
      deliverable: '20-second continuous vector morph sequence between 4 icons',
      tool: 'After Effects / Illustrator',
      time: '2h',
      desc: 'Create continuous vector transformations using shape path modifiers, trim paths, and seamless path interpolations.',
      rubricPoints: 'Seamless path vertex interpolation, zero vector distortion, fluid liquid elasticity.',
    },
    {
      day: 4,
      phase: 1,
      track: 'motion',
      title: 'Day 04: Brand Identity & Animated Logo Sting',
      deliverable: '16:9 & 9:16 animated brand logo stings with alpha channels',
      tool: 'After Effects',
      time: '2.5h',
      desc: 'Deconstruct a brand identity vector asset into a memorable 5-second animated bumper sting with branded color dynamics.',
      rubricPoints: 'Strong brand personality, seamless alpha transparency export, sound design sync.',
    },
    {
      day: 5,
      phase: 1,
      track: 'motion',
      title: 'Day 05: Sprint 1 Milestone — Dynamic 15s Commercial Sting',
      deliverable: 'Polished 15-second commercial bumper with motion audio',
      tool: 'After Effects',
      time: '3h',
      desc: 'Milestone deliverable: Combine typography, vector shape morphing, and logo animation into a polished 15-second commercial bumper.',
      rubricPoints: 'Commercial pacing, coherent design language, high-resolution render quality.',
    },
    {
      day: 6,
      phase: 2,
      track: 'motion',
      title: 'Day 06: Cinema 4D / Blender Integration & 3D Camera Tracking',
      deliverable: 'Camera-tracked composite video with shadow catcher in 3D space',
      tool: 'Blender / Cinema 4D',
      time: '2.5h',
      desc: 'Solve real-world video footage tracks, extract 3D point clouds, and composite 3D geometric objects seamlessly into live video.',
      rubricPoints: 'Sub-pixel camera solve error (< 0.5px), accurate shadow catcher integration, perspective match.',
    },
    {
      day: 7,
      phase: 2,
      track: 'motion',
      title: 'Day 07: PBR Shading, Studio Lighting & Depth Passes',
      deliverable: 'High-res beauty pass and multi-channel EXR depth render',
      tool: 'Blender / Cinema 4D',
      time: '2.5h',
      desc: 'Set up three-point studio lighting rigs, apply realistic roughness/metallic PBR maps, and render out multi-channel EXR depth passes.',
      rubricPoints: 'Accurate Fresnel reflection, realistic specular highlights, clean depth pass separation.',
    },
    {
      day: 8,
      phase: 2,
      track: 'motion',
      title: 'Day 08: Particle Dynamics & Abstract Mograph Simulation',
      deliverable: '10-second looping abstract particle simulation visualizer',
      tool: 'Blender Particles / C4D',
      time: '2.5h',
      desc: 'Utilize procedural emitters, turbulence fields, and particle collision dynamics to create abstract sci-fi/organic motion simulations.',
      rubricPoints: 'Natural force-field physics, seamless loop point timing, particle density balance.',
    },
    {
      day: 9,
      phase: 2,
      track: 'motion',
      title: 'Day 09: UI/UX Micro-Interactions & 3D Device Mockups',
      deliverable: 'Sleek SaaS software or app product walkthrough in 3D isometric space',
      tool: 'Cinema 4D / After Effects',
      time: '2h',
      desc: 'Animate mobile/desktop UI mockups floating in 3D isometric space with interactive clicks, gestures, and glass refraction.',
      rubricPoints: 'Realistic glass dispersion, smooth UI transition timing, commercial polish.',
    },
    {
      day: 10,
      phase: 2,
      track: 'motion',
      title: 'Day 10: Sprint 2 Milestone — Mid-Term Commercial Reel Review',
      deliverable: 'Consolidated 3D motion reel segment submitted for mentor grading',
      tool: 'Full 3D Motion Suite',
      time: '3h',
      desc: 'Consolidated commercial motion sequence combining 3D product renders, dynamic camera moves, and kinetic graphic accents.',
      rubricPoints: 'Multi-element technical integration, cinematic camera framing, rhythm & audio synergy.',
    },
    {
      day: 11,
      phase: 3,
      track: 'motion',
      title: 'Day 11: Motion Capstone — 3D Styleframes & Storyboard Deck',
      deliverable: '5 cohesive production styleframes and animatic sequence',
      tool: 'Illustrator / Blender',
      time: '2.5h',
      desc: 'Design 5 cohesive production styleframes, visual moodboards, and animatic timings for your final client commercial capstone.',
      rubricPoints: 'Visual storytelling coherence, strong lighting & color keys, precise animatic pacing.',
    },
    {
      day: 12,
      phase: 3,
      track: 'motion',
      title: 'Day 12: Motion Capstone — 3D Scene Animation & Camera Blocking',
      deliverable: 'Low-res viewport animatic playblast confirming cut timings',
      tool: 'Blender / Cinema 4D',
      time: '4h',
      desc: 'Animate core product hero shots, keyframe dynamic camera swoops, and lock scene transition cuts to audio stems.',
      rubricPoints: 'Choreographed camera moves, focal subject retention, smooth cut transitions.',
    },
    {
      day: 13,
      phase: 3,
      track: 'motion',
      title: 'Day 13: Motion Capstone — Compositing, Grain & Color Finishing',
      deliverable: 'Multi-pass composite timeline proof showing individual EXR layers',
      tool: 'After Effects / DaVinci',
      time: '4h',
      desc: 'Assemble multi-pass EXR renders in After Effects, add chromatic aberration, glow falls, 35mm film grain, and lens flares.',
      rubricPoints: 'Multi-pass EXR depth integration, atmospheric volumetric light, filmic color grading.',
    },
    {
      day: 14,
      phase: 3,
      track: 'motion',
      title: 'Day 14: Final Capstone Master Export & Breakdown Reel',
      deliverable: '4K commercial master export alongside behind-the-scenes breakdown reel',
      tool: 'Media Encoder',
      time: '2.5h',
      desc: 'Render the final 4K master export alongside a behind-the-scenes breakdown reel revealing wireframes, depth passes, and layers.',
      rubricPoints: 'Flawless 4K encoding, clear behind-the-scenes wireframe breakdown, industry deliverable standard.',
    },
    {
      day: 15,
      phase: 3,
      track: 'motion',
      title: 'Day 15: Graduation, Exit Evaluation & Letter of Recommendation',
      deliverable: 'Verified Internship Certificate, Portfolio Showreel & Referral',
      tool: 'ProCut Portal',
      time: '1h',
      desc: 'Final mentor portfolio review, showreel cataloging, and release of your verified Internship Certificate and personal Letter of Recommendation.',
      rubricPoints: '15/15 days verified submissions, completed showreel portfolio, mentor evaluation signoff.',
    },
  ],
};

export interface InteractiveSprintCurriculumProps {
  defaultTrack?: SprintTrack;
  defaultDay?: number;
}

export function InteractiveSprintCurriculum({
  defaultTrack = 'video',
  defaultDay = 4,
}: InteractiveSprintCurriculumProps) {
  const [selectedTrack, setSelectedTrack] = useState<SprintTrack>(defaultTrack);
  const [selectedDayDetail, setSelectedDayDetail] = useState<number>(defaultDay);
  const [roadmapFilter, setRoadmapFilter] = useState<'all' | 1 | 2 | 3>('all');

  const currentTrackMeta = TRACK_DEFINITIONS[selectedTrack];
  const currentDays = TRACK_CURRICULUM_DAYS[selectedTrack];

  const filteredDays = useMemo(() => {
    return currentDays.filter((d) => roadmapFilter === 'all' || d.phase === roadmapFilter);
  }, [currentDays, roadmapFilter]);

  const activeDay = useMemo(() => {
    return currentDays.find((d) => d.day === selectedDayDetail) || currentDays[0];
  }, [currentDays, selectedDayDetail]);

  const prevDay = activeDay.day > 1 ? activeDay.day - 1 : null;
  const nextDay = activeDay.day < 15 ? activeDay.day + 1 : null;

  const handleTrackChange = (newTrack: SprintTrack) => {
    setSelectedTrack(newTrack);
    soundFx.playBlip(newTrack === 'video' ? 380 : newTrack === 'coding' ? 440 : 500, 0.03, 'sine', 0.03);
  };

  return (
    <section id="sprint" className="border-t border-white/10 bg-[#030712] py-20 lg:py-28 relative overflow-hidden">
      {/* Subtle ambient background glow */}
      <div
        className={`pointer-events-none absolute top-1/4 right-0 size-[500px] rounded-full blur-[140px] -z-10 transition-colors duration-700 ${
          selectedTrack === 'video'
            ? 'bg-orange-500/10'
            : selectedTrack === 'coding'
            ? 'bg-cyan-500/10'
            : 'bg-fuchsia-500/10'
        }`}
      />
      <div
        className={`pointer-events-none absolute bottom-1/4 left-0 size-[500px] rounded-full blur-[140px] -z-10 transition-colors duration-700 ${
          selectedTrack === 'video'
            ? 'bg-amber-500/10'
            : selectedTrack === 'coding'
            ? 'bg-blue-600/10'
            : 'bg-purple-600/10'
        }`}
      />

      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-[#080d1a] mb-3">
              <span className={`text-[11px] font-black uppercase tracking-[0.18em] font-mono ${currentTrackMeta.color.primary}`}>
                {currentTrackMeta.badge}
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
              Separate 15-Day Sprint Tracks
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
              {currentTrackMeta.description}
            </p>
          </div>

          <p className="text-xs sm:text-sm text-slate-400 max-w-md leading-relaxed">
            Inspect every single day before you commit. Click any milestone to inspect briefs, tools, deliverables, and mentor evaluation criteria.
          </p>
        </div>

        {/* ========================================================================= */}
        {/* TRACK SWITCHER TABS */}
        {/* ========================================================================= */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3 text-xs font-mono uppercase tracking-wider text-slate-400">
            <Sparkles size={14} className={currentTrackMeta.color.primary} />
            <span>Select Sprint Specialization:</span>
          </div>

          <div
            role="tablist"
            aria-label="Sprint Track Selection"
            className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-2 rounded-2xl bg-[#070b16] border border-white/10 shadow-2xl backdrop-blur-xl"
          >
            {(['video', 'coding', 'motion'] as SprintTrack[]).map((trackKey) => {
              const meta = TRACK_DEFINITIONS[trackKey];
              const isSelected = selectedTrack === trackKey;

              return (
                <button
                  key={trackKey}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  data-cursor={`SWITCH TO ${meta.name.toUpperCase()}`}
                  onClick={() => handleTrackChange(trackKey)}
                  className={`group relative flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl text-xs sm:text-sm font-black transition-all duration-300 cursor-pointer ${
                    isSelected
                      ? `bg-gradient-to-r ${meta.color.gradient} text-white shadow-lg shadow-black/40 scale-[1.01]`
                      : 'bg-white/[0.03] text-slate-300 hover:text-white hover:bg-white/[0.07] border border-transparent hover:border-white/10'
                  }`}
                >
                  <span className="truncate">{meta.tabLabel}</span>
                  {isSelected && (
                    <span className="size-2 rounded-full bg-white animate-pulse shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* DYNAMIC SOFTWARE ICONS STRIP */}
        {/* ========================================================================= */}
        <div className="mb-8 p-4 sm:p-5 rounded-2xl bg-[#070b16]/90 border border-white/10 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className={`size-8 rounded-lg ${currentTrackMeta.color.bgBadge} ${currentTrackMeta.color.textBadge} flex items-center justify-center shrink-0`}>
              {selectedTrack === 'video' ? (
                <Film size={18} />
              ) : selectedTrack === 'coding' ? (
                <Code2 size={18} />
              ) : (
                <Sparkles size={18} />
              )}
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-400 font-mono">
                {currentTrackMeta.name} Software Stack
              </p>
              <p className="text-[11px] text-slate-300">
                Industry-standard tooling mastered hands-on across all 15 sprint deliverables
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {currentTrackMeta.softwareStack.map((tool) => (
              <div
                key={tool.name}
                title={tool.role}
                className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0b1020] border border-white/10 hover:border-white/25 transition text-xs font-mono text-slate-200 shadow-sm"
              >
                <span className="size-1.5 rounded-full bg-emerald-400" />
                <span className="font-bold text-white">{tool.name}</span>
                <span className="hidden sm:inline text-[10px] text-slate-400">• {tool.role.split('&')[0].trim()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* PHASE OBJECTIVES BANNER (Phase 1, Phase 2, Phase 3) */}
        {/* ========================================================================= */}
        <div className="mb-10 grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {([1, 2, 3] as const).map((phaseNum) => {
            const phaseInfo = currentTrackMeta.phases[phaseNum];
            const isPhaseActive = roadmapFilter === phaseNum;

            return (
              <div
                key={phaseNum}
                onClick={() => {
                  setRoadmapFilter((prev) => (prev === phaseNum ? 'all' : phaseNum));
                  soundFx.playBlip(360 + phaseNum * 40, 0.02, 'sine', 0.02);
                }}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  isPhaseActive
                    ? `${currentTrackMeta.color.border} bg-[#0b1122] shadow-lg shadow-black/40`
                    : 'bg-[#060a14]/80 border-white/10 hover:border-white/20 hover:bg-[#080d1c]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-black uppercase font-mono tracking-wider px-2 py-0.5 rounded bg-white/5 text-slate-300">
                    {phaseInfo.days}
                  </span>
                  <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
                    {phaseNum === 1 ? (
                      <Zap size={12} className={currentTrackMeta.color.primary} />
                    ) : phaseNum === 2 ? (
                      <Flame size={12} className="text-amber-400" />
                    ) : (
                      <Trophy size={12} className="text-emerald-400" />
                    )}
                    <span>Phase 0{phaseNum}</span>
                  </div>
                </div>

                <h4 className="text-sm font-black text-white">{phaseInfo.title}</h4>
                <p className={`text-xs font-medium mt-0.5 ${currentTrackMeta.color.primary}`}>
                  {phaseInfo.tagline}
                </p>
                <p className="mt-2 text-[11px] text-slate-400 leading-relaxed line-clamp-2">
                  {phaseInfo.objective}
                </p>

                <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span className="truncate max-w-[200px] text-slate-300">
                    🎯 {phaseInfo.milestone.split(':')[0]}
                  </span>
                  <span className="font-bold underline text-slate-300">
                    {isPhaseActive ? 'Showing' : 'Filter'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Phase Filters & Quick Jump Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8 pb-4 border-b border-white/10">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onMouseEnter={() => soundFx.playBlip(380, 0.02, 'sine', 0.02)}
              onClick={() => {
                setRoadmapFilter('all');
                soundFx.playBlip(380, 0.03, 'sine', 0.03);
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                roadmapFilter === 'all'
                  ? `bg-gradient-to-r ${currentTrackMeta.color.gradient} text-white shadow-md`
                  : 'bg-[#090d16] border border-white/10 text-slate-400 hover:text-white hover:border-white/25'
              }`}
            >
              All 15 Days
            </button>
            <button
              type="button"
              onMouseEnter={() => soundFx.playBlip(420, 0.02, 'sine', 0.02)}
              onClick={() => {
                setRoadmapFilter(1);
                soundFx.playBlip(420, 0.03, 'sine', 0.03);
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                roadmapFilter === 1
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                  : 'bg-[#090d16] border border-white/10 text-slate-400 hover:text-white hover:border-white/25'
              }`}
            >
              Phase 1 · Drills (Days 1–5)
            </button>
            <button
              type="button"
              onMouseEnter={() => soundFx.playBlip(460, 0.02, 'sine', 0.02)}
              onClick={() => {
                setRoadmapFilter(2);
                soundFx.playBlip(460, 0.03, 'sine', 0.03);
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                roadmapFilter === 2
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                  : 'bg-[#090d16] border border-white/10 text-slate-400 hover:text-white hover:border-white/25'
              }`}
            >
              Phase 2 · Production (Days 6–10)
            </button>
            <button
              type="button"
              onMouseEnter={() => soundFx.playBlip(500, 0.02, 'sine', 0.02)}
              onClick={() => {
                setRoadmapFilter(3);
                soundFx.playBlip(500, 0.03, 'sine', 0.03);
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                roadmapFilter === 3
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                  : 'bg-[#090d16] border border-white/10 text-slate-400 hover:text-white hover:border-white/25'
              }`}
            >
              Phase 3 · Client Capstone (Days 11–15)
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
            <span>15 Milestones in {currentTrackMeta.name}</span>
          </div>
        </div>

        {/* Split Screen Layout: Vertical Connected Roadmap + Sticky Live Inspector */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          {/* Left Column: Vertical Connected Transform Roadmap Track */}
          <div className="lg:col-span-7">
            <div className="roadmap-track pl-6 sm:pl-8 space-y-4">
              {/* Glowing Animated Laser Node traversing the spine */}
              <div className="roadmap-laser-node" />

              {filteredDays.map((d) => {
                const isSelected = activeDay.day === d.day;
                const isPhaseStart =
                  roadmapFilter === 'all' && (d.day === 1 || d.day === 6 || d.day === 11);

                return (
                  <div key={`${selectedTrack}-${d.day}`} className="relative group">
                    {/* Phase Milestone Marker */}
                    {isPhaseStart && (
                      <div className="pt-4 pb-2 -ml-6 sm:-ml-8 first:pt-0">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#060a16] px-3.5 py-1 text-[11px] font-black uppercase tracking-wider text-slate-200 font-mono shadow-md backdrop-blur-xl">
                          {d.day === 1 ? (
                            <Zap size={12} className={currentTrackMeta.color.primary} />
                          ) : d.day === 6 ? (
                            <Flame size={12} className="text-amber-400" />
                          ) : (
                            <Trophy size={12} className="text-emerald-400" />
                          )}
                          <span>
                            {currentTrackMeta.phases[d.phase].title}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start gap-3 sm:gap-5">
                      {/* Connected Spine Node Button */}
                      <div className="relative z-10 shrink-0">
                        <button
                          type="button"
                          onMouseEnter={() => soundFx.playBlip(300 + d.day * 18, 0.03, 'sine', 0.03)}
                          onClick={() => {
                            setSelectedDayDetail(d.day);
                            soundFx.playBlip(320 + d.day * 22, 0.035, 'sine', 0.035);
                          }}
                          data-cursor={`DAY ${d.day.toString().padStart(2, '0')}`}
                          className={`size-8 sm:size-9 rounded-full flex items-center justify-center font-mono font-black text-xs transition-all duration-300 cursor-pointer ${
                            isSelected
                              ? `bg-gradient-to-br ${currentTrackMeta.color.gradient} text-white ring-4 ring-white/20 shadow-lg scale-110`
                              : 'bg-[#090d16] border border-white/20 text-slate-300 hover:border-white/50 hover:text-white hover:scale-105'
                          }`}
                        >
                          {d.day.toString().padStart(2, '0')}
                        </button>
                      </div>

                      {/* Connected Horizontal Branch Line */}
                      <div
                        className={`absolute left-[15px] sm:left-[17px] top-[15px] sm:top-[17px] w-4 sm:w-6 h-0.5 pointer-events-none transition-colors duration-300 -z-0 ${
                          isSelected
                            ? `bg-gradient-to-r ${currentTrackMeta.color.gradient}`
                            : 'bg-white/10 group-hover:bg-white/30'
                        }`}
                      />

                      {/* Connected Roadmap Card with Smooth Transform */}
                      <div
                        onMouseEnter={() => soundFx.playBlip(300 + d.day * 18, 0.03, 'sine', 0.03)}
                        onClick={() => {
                          setSelectedDayDetail(d.day);
                          soundFx.playBlip(320 + d.day * 22, 0.035, 'sine', 0.035);
                        }}
                        data-cursor={`INSPECT DAY ${d.day.toString().padStart(2, '0')}`}
                        style={{ willChange: 'transform' }}
                        className={`w-full text-left p-4 sm:p-5 rounded-2xl border transition-all duration-300 cursor-pointer roadmap-card-transform ${
                          isSelected
                            ? `${currentTrackMeta.color.border} bg-gradient-to-r from-white/[0.08] via-[#0b1122] to-[#080d1a] shadow-xl translate-x-1 sm:translate-x-2`
                            : 'bg-[#090d16]/85 border-white/10 hover:border-white/25 hover:bg-[#0c1222]/90 hover:translate-x-1'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-black uppercase font-mono tracking-wider ${
                                isSelected
                                  ? `bg-gradient-to-r ${currentTrackMeta.color.gradient} text-white`
                                  : 'bg-white/10 text-slate-200'
                              }`}
                            >
                              Day {d.day.toString().padStart(2, '0')}
                            </span>
                            <span className="text-[11px] font-bold text-slate-400 font-mono">
                              Phase {d.phase}
                            </span>
                            <span className="text-white/20">•</span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
                              <Clock size={11} className={currentTrackMeta.color.primary} />
                              <span>{d.time} sprint</span>
                            </span>
                          </div>

                          <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono text-slate-300">
                            <Code2 size={11} className={currentTrackMeta.color.primary} />
                            <span className="truncate max-w-[180px]">{d.tool}</span>
                          </div>
                        </div>

                        <h3
                          className={`text-base font-black tracking-tight leading-snug transition-colors ${
                            isSelected
                              ? 'text-white'
                              : 'text-slate-100 group-hover:text-white'
                          }`}
                        >
                          {d.title}
                        </h3>

                        <p className="mt-1.5 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                          {d.desc}
                        </p>

                        <div className="mt-3.5 pt-3 border-t border-white/5 flex items-center justify-between gap-2 text-xs">
                          <span className="text-[11px] font-medium text-slate-300 truncate">
                            <strong className={`${currentTrackMeta.color.primary} font-mono`}>Output: </strong>
                            {d.deliverable}
                          </span>
                          <span
                            className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-bold transition-transform ${
                              isSelected
                                ? `${currentTrackMeta.color.primary} translate-x-1`
                                : 'text-slate-400 group-hover:text-white group-hover:translate-x-1'
                            }`}
                          >
                            <span>Inspect</span>
                            <ArrowRight size={12} />
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Sticky Selected Day Deep-Dive Inspector */}
          <div className="lg:col-span-5 sticky top-24 self-start">
            <div className="space-y-4">
              {/* Stepper Navigation Controls */}
              <div className="flex items-center justify-between bg-[#060913] border border-white/10 rounded-2xl px-4 py-2.5 backdrop-blur-xl shadow-lg">
                <button
                  type="button"
                  aria-label="Previous day brief"
                  data-testid="inspector-prev-day"
                  disabled={!prevDay}
                  onMouseEnter={() => {
                    if (prevDay) soundFx.playBlip(360, 0.02, 'sine', 0.02);
                  }}
                  onClick={() => {
                    if (prevDay) {
                      setSelectedDayDetail(prevDay);
                      soundFx.playBlip(320 + prevDay * 22, 0.035, 'sine', 0.035);
                    }
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    prevDay
                      ? 'bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white cursor-pointer'
                      : 'opacity-30 cursor-not-allowed text-slate-500'
                  }`}
                >
                  <ChevronLeft size={14} />
                  <span>Day {(activeDay.day - 1).toString().padStart(2, '0')}</span>
                </button>

                <span data-testid="inspector-day-indicator" className={`text-xs font-black font-mono tracking-wider ${currentTrackMeta.color.primary}`}>{`DAY ${activeDay.day.toString().padStart(2, '0')} / 15`}</span>

                <button
                  type="button"
                  aria-label="Next day brief"
                  data-testid="inspector-next-day"
                  disabled={!nextDay}
                  onMouseEnter={() => {
                    if (nextDay) soundFx.playBlip(480, 0.02, 'sine', 0.02);
                  }}
                  onClick={() => {
                    if (nextDay) {
                      setSelectedDayDetail(nextDay);
                      soundFx.playBlip(320 + nextDay * 22, 0.035, 'sine', 0.035);
                    }
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    nextDay
                      ? 'bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white cursor-pointer'
                      : 'opacity-30 cursor-not-allowed text-slate-500'
                  }`}
                >
                  <span>Day {(activeDay.day + 1).toString().padStart(2, '0')}</span>
                  <ChevronRight size={14} />
                </button>
              </div>

              {/* Detailed 3D Tilt Card */}
              <TiltCard
                maxTilt={4}
                scale={1.01}
                perspective={1200}
                glareOpacity={0.18}
                glareColor={currentTrackMeta.color.glow}
                className={`p-6 sm:p-7 glass-obsidian ${currentTrackMeta.color.border} bg-[#090d16]/95 shadow-2xl rounded-3xl`}
              >
                {/* Card Header */}
                <div className="space-y-2 pb-5 border-b border-white/10">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-md ${currentTrackMeta.color.bgBadge} border ${currentTrackMeta.color.border} px-2.5 py-0.5 text-xs font-black uppercase font-mono ${currentTrackMeta.color.textBadge}`}>
                        Day {activeDay.day.toString().padStart(2, '0')} · Phase {activeDay.phase}
                      </span>
                      <span className="rounded-md bg-white/5 border border-white/10 px-2 py-0.5 text-[11px] font-bold text-slate-300 font-mono flex items-center gap-1">
                        <Clock size={11} className={currentTrackMeta.color.primary} />
                        <span>{activeDay.time} sprint</span>
                      </span>
                    </div>
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 font-mono">
                      <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Active Brief
                    </span>
                  </div>

                  <h3 className="text-xl sm:text-2xl font-black text-white leading-tight">
                    {activeDay.title}
                  </h3>

                  <div className="flex items-center gap-2 text-xs text-slate-400 font-mono pt-1">
                    <span className="text-slate-500">Software Stack:</span>
                    <span className="text-white font-bold">{activeDay.tool}</span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="mt-5 space-y-5">
                  {/* The Brief & Narrative */}
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 font-mono mb-1.5">
                      The Brief &amp; Narrative
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      {activeDay.desc}
                    </p>
                    <div className="mt-2.5 flex items-center gap-2 text-xs font-bold text-slate-400">
                      <Clock size={13} className={currentTrackMeta.color.primary} />
                      <span>24-Hour Submission Window (Due 11:59 PM)</span>
                    </div>
                  </div>

                  {/* Expected Deliverable */}
                  <div className="rounded-xl border border-white/10 bg-[#060911]/90 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className={`text-xs font-black uppercase tracking-wider font-mono ${currentTrackMeta.color.primary}`}>
                        Expected Deliverable
                      </h4>
                      <CheckCircle2 size={14} className="text-emerald-400" />
                    </div>
                    <p className="text-xs font-bold text-white leading-relaxed">
                      {activeDay.deliverable}
                    </p>
                  </div>

                  {/* Mentor Grading Rubric */}
                  <div className="rounded-xl border border-white/10 bg-[#060911]/60 p-4 space-y-1.5">
                    <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 font-mono">
                      Mentor Grading Rubric (0–100 Criteria)
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed font-medium">
                      {activeDay.rubricPoints}
                    </p>
                  </div>

                  {/* Phase Objective Context */}
                  <div className="rounded-xl border border-white/10 bg-[#060911]/40 p-3.5 space-y-1">
                    <p className="text-[10px] font-black uppercase font-mono tracking-wider text-slate-400">
                      Sprint Milestone Objective
                    </p>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {currentTrackMeta.phases[activeDay.phase].objective}
                    </p>
                  </div>

                  {/* WhatsApp Mentor SLA Callout */}
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 flex items-center gap-3">
                    <div className="flex size-7 items-center justify-center rounded-full bg-[#25D366] text-white shrink-0">
                      <MessageCircle size={14} />
                    </div>
                    <div className="text-xs">
                      <p className="font-bold text-white leading-none">1-on-1 Mentor Support</p>
                      <p className="text-[11px] text-emerald-400 mt-0.5">Instant WhatsApp blocker help with &lt;15m response SLA</p>
                    </div>
                  </div>

                  {/* CTA Button */}
                  <div className="pt-2">
                    <Button
                      href="/register"
                      size="md"
                      data-cursor={`ENROLL IN ${currentTrackMeta.name.toUpperCase()}`}
                      onMouseEnter={() => soundFx.playBlip(560, 0.03, 'sine', 0.03)}
                      onClick={() => soundFx.playSweep(300, 700, 0.12, 0.05)}
                      className={`w-full bg-gradient-to-r ${currentTrackMeta.color.gradient} text-white font-black border-none shadow-xl justify-center py-3`}
                    >
                      <span>Enroll In 15-Day {currentTrackMeta.name.split('&')[0].trim()} Sprint</span>
                      <ArrowRight size={15} />
                    </Button>
                  </div>
                </div>
              </TiltCard>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
