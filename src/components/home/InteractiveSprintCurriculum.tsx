import { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Code2,
  Flame,
  MessageCircle,
  Trophy,
  Zap,
} from 'lucide-react';
import { TiltCard } from './TiltCard';
import { Button } from '../ui/Button';
import { soundFx } from '../../lib/soundFx';

export interface DayRoadmapItem {
  day: number;
  phase: number;
  track: string;
  title: string;
  deliverable: string;
  tool: string;
  time: string;
  desc: string;
  rubricPoints: string;
}

const full15Days: DayRoadmapItem[] = [
  {
    day: 1,
    phase: 1,
    track: 'both',
    title: 'Production Setup & First Kinetic Cut / Repo Init',
    deliverable: 'GitHub Repository with CI preview / Google Drive Kinetic Cut',
    tool: 'Premiere Pro / VS Code + Git',
    time: '2h',
    desc: 'Set up strict folder architecture, import 4K raw footage or initialize TypeScript boilerplate, and ship your first functional piece before midnight.',
    rubricPoints: 'Clean folder/file structure, strict linter / project setup, on-time submission.',
  },
  {
    day: 2,
    phase: 1,
    track: 'both',
    title: 'Pacing, J/L Cuts & Reactive State Management',
    deliverable: '30-second retention timeline / Interactive State Component',
    tool: 'DaVinci Resolve / React 19',
    time: '2.5h',
    desc: 'Learn the invisible mechanics of timing: audio lead-ins, micro-transitions, and component state pipelines that keep user attention locked.',
    rubricPoints: 'Seamless audio bridge across cuts, zero state desync, fluid interaction.',
  },
  {
    day: 3,
    phase: 1,
    track: 'both',
    title: 'Dynamic Typography & Kinetic Motion Systems',
    deliverable: 'Kinetic title sequence / Reusable Animated UI Elements',
    tool: 'After Effects / Tailwind CSS',
    time: '2h',
    desc: 'Craft animated typography with custom bezier easing curves and responsive design standards that stand out on any screen size.',
    rubricPoints: 'Bezier acceleration curves, responsive typography hierarchy, typography contrast.',
  },
  {
    day: 4,
    phase: 1,
    track: 'both',
    title: 'B-Roll Rhythm & Database Backend Integration',
    deliverable: 'Speed-ramped secondary edit / Supabase Auth & RLS Tables',
    tool: 'Premiere Pro / Supabase',
    time: '2.5h',
    desc: 'Seamlessly layer secondary footage with match-cuts, or architect relational database tables protected by strict Row-Level Security rules.',
    rubricPoints: 'Visual storytelling flow, secure DB schema policies, zero leaked credentials.',
  },
  {
    day: 5,
    phase: 1,
    track: 'both',
    title: 'Multi-Track Sound Design & Phase 1 Evaluation',
    deliverable: 'Submixed audio timeline / Working Full-Stack CRUD API',
    tool: 'Audition / REST APIs',
    time: '3h',
    desc: 'First major milestone checkpoint. Layer sound risers, whooshes, ambient textures, or ship tested API endpoints for mentor review.',
    rubricPoints: '-14 LUFS loudness mastering, error-handled HTTP status codes, unit tested.',
  },
  {
    day: 6,
    phase: 2,
    track: 'both',
    title: 'Color Grading Science & Server-Side Optimization',
    deliverable: 'Rec.709 balanced grade / Next.js Server Components',
    tool: 'DaVinci Resolve / Next.js',
    time: '2.5h',
    desc: 'Understand color primaries, skin-tone vector scopes, and server-side rendering to eliminate visual artifacts and network latencies.',
    rubricPoints: 'Accurate skin tones on vectorscope, zero layout shift, sub-second TTFB.',
  },
  {
    day: 7,
    phase: 2,
    track: 'both',
    title: 'Narrative Arc & Complex State Workflows',
    deliverable: '60s story cut / Multi-step Form & Telemetry Hook',
    tool: 'Premiere Pro / TypeScript',
    time: '2.5h',
    desc: 'Build emotional momentum using 3-act narrative pacing or create type-safe asynchronous state machines that handle edge cases cleanly.',
    rubricPoints: 'Hook-Hold-Payoff pacing, strict TS types without any, resilient state.',
  },
  {
    day: 8,
    phase: 2,
    track: 'both',
    title: 'Visual Effects & Third-Party API Integrations',
    deliverable: 'Composited motion cut / WhatsApp API Webhook Service',
    tool: 'After Effects / Node.js',
    time: '2.5h',
    desc: 'Execute clean rotoscoping and planar tracking, or build an automated WhatsApp dispatch and webhook listener service.',
    rubricPoints: 'Flawless edge matte refinement, verified webhook signature validation.',
  },
  {
    day: 9,
    phase: 2,
    track: 'both',
    title: 'High-Retention Short Form (Reels & Mobile Web)',
    deliverable: '9:16 viral retention edit / Mobile-first Responsive UI',
    tool: 'CapCut Pro / Mobile CSS',
    time: '2h',
    desc: 'Optimize for mobile consumption habits: vertical viewport framing, touch gestures, and 3-second hook retention techniques.',
    rubricPoints: '70%+ simulated watch time hook, thumb-zone ergonomics, 60fps animations.',
  },
  {
    day: 10,
    phase: 2,
    track: 'both',
    title: 'Halfway Live Review Room & Stress Testing',
    deliverable: 'Live Mentor Pitch / End-to-End Test Suite',
    tool: 'Zoom / Vitest + Cypress',
    time: '3h',
    desc: 'Join our halfway live masterclass workshop. Watch mentors tear down student projects in real time and run comprehensive code audits.',
    rubricPoints: 'Live feedback implementation, >85% code branch test coverage.',
  },
  {
    day: 11,
    phase: 3,
    track: 'both',
    title: 'Commercial Capstone: Client Brief Kickoff',
    deliverable: 'Approved project storyboard & Architecture Spec',
    tool: 'Figma / Architecture Doc',
    time: '2.5h',
    desc: 'Receive your real-world client brief. Plan technical architecture or cinematic shot list for your crowning 15-day sprint capstone.',
    rubricPoints: 'Comprehensive wireframes, modular system architecture diagram.',
  },
  {
    day: 12,
    phase: 3,
    track: 'both',
    title: 'Capstone Production: Deep Execution Day 1',
    deliverable: 'Rough cut submission / Frontend Core Implementation',
    tool: 'Full Suite',
    time: '4h',
    desc: 'Dedicated production sprint. Assemble full timeline or implement complete database connectivity with authenticated user routes.',
    rubricPoints: 'Core user flows functional, complete rough assembly of timeline.',
  },
  {
    day: 13,
    phase: 3,
    track: 'both',
    title: 'Capstone Production: Deep Execution Day 2',
    deliverable: 'Fine cut with sound / Production Deployment to Vercel',
    tool: 'Full Suite',
    time: '4h',
    desc: 'Fine-tune every cut and transition, or deploy your web application to a live domain with custom SSL and performance monitoring.',
    rubricPoints: 'Live production URL accessible, color mastered, audio submixed.',
  },
  {
    day: 14,
    phase: 3,
    track: 'both',
    title: 'The Polish & Peer Code / Timeline Audit',
    deliverable: 'Final deliverables package & Loom walk-through',
    tool: 'Loom / GitHub PR',
    time: '2.5h',
    desc: 'Submit your finished deliverable alongside a 3-minute video breakdown of technical decisions for final mentor audit.',
    rubricPoints: 'Clear articulated rationale, zero console errors, zero dropped frames.',
  },
  {
    day: 15,
    phase: 3,
    track: 'both',
    title: 'Graduation, Verified Credential & Exit Referral',
    deliverable: 'Digital Credential & LinkedIn Portfolio Release',
    tool: 'ProCut Portal',
    time: '1h',
    desc: 'Receive your cryptographically signed Certificate of Completion and a personal Mentor Letter of Recommendation for hiring partners.',
    rubricPoints: '15/15 days verified, credential published, talent directory listed.',
  },
];

export function InteractiveSprintCurriculum() {
  const [selectedDayDetail, setSelectedDayDetail] = useState<number>(4);
  const [roadmapFilter, setRoadmapFilter] = useState<'all' | 1 | 2 | 3>('all');

  return (
    <section id="sprint" className="border-t border-white/10 bg-[#030712] py-20 lg:py-28 relative overflow-hidden">
      {/* Subtle ambient background glow */}
      <div className="pointer-events-none absolute top-1/4 right-0 size-[500px] rounded-full bg-orange-500/5 blur-[140px] -z-10" />
      <div className="pointer-events-none absolute bottom-1/4 left-0 size-[500px] rounded-full bg-indigo-500/5 blur-[140px] -z-10" />

      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-400">
              Full 15-Day Connected Roadmap
            </p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight text-white">
              Inspect Every Single Day Before You Commit
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md leading-relaxed">
            Scroll and explore our 15-day production syllabus connected milestone by milestone. Click any node to inspect briefs, tools, deliverables, and mentor evaluation criteria.
          </p>
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
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/20'
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
              Phase 1 · Foundations (Days 1–5)
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
              Phase 2 · Depth &amp; APIs (Days 6–10)
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
              Phase 3 · Capstone &amp; LOR (Days 11–15)
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span className="size-2 rounded-full bg-orange-400 animate-ping" />
            <span>15 Production Milestones</span>
          </div>
        </div>

        {/* Split Screen Layout: Vertical Connected Roadmap + Sticky Live Inspector */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          {/* Left Column: Vertical Connected Transform Roadmap Track */}
          <div className="lg:col-span-7">
            <div className="roadmap-track pl-6 sm:pl-8 space-y-4">
              {/* Glowing Animated Laser Node traversing the spine */}
              <div className="roadmap-laser-node" />

              {full15Days
                .filter((d) => roadmapFilter === 'all' || d.phase === roadmapFilter)
                .map((d) => {
                  const isSelected = selectedDayDetail === d.day;
                  const isPhaseStart =
                    roadmapFilter === 'all' && (d.day === 1 || d.day === 6 || d.day === 11);

                  return (
                    <div key={d.day} className="relative group">
                      {/* Phase Milestone Marker */}
                      {isPhaseStart && (
                        <div className="pt-4 pb-2 -ml-6 sm:-ml-8 first:pt-0">
                          <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-[#060a16] px-3.5 py-1 text-[11px] font-black uppercase tracking-wider text-orange-300 font-mono shadow-md backdrop-blur-xl">
                            {d.day === 1 ? (
                              <Zap size={12} className="text-orange-400" />
                            ) : d.day === 6 ? (
                              <Flame size={12} className="text-amber-400" />
                            ) : (
                              <Trophy size={12} className="text-emerald-400" />
                            )}
                            <span>
                              {d.day === 1
                                ? 'Phase 01 · Foundations & Kinetic Pacing'
                                : d.day === 6
                                ? 'Phase 02 · Advanced Workflows & APIs'
                                : 'Phase 03 · Commercial Capstone & Exit Referral'}
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
                                ? 'bg-gradient-to-br from-orange-500 to-amber-500 text-white ring-4 ring-orange-500/30 shadow-lg shadow-orange-500/40 scale-110'
                                : 'bg-[#090d16] border border-white/20 text-slate-300 hover:border-orange-500/50 hover:text-white hover:scale-105'
                            }`}
                          >
                            {d.day.toString().padStart(2, '0')}
                          </button>
                        </div>

                        {/* Connected Horizontal Branch Line */}
                        <div
                          className={`absolute left-[15px] sm:left-[17px] top-[15px] sm:top-[17px] w-4 sm:w-6 h-0.5 pointer-events-none transition-colors duration-300 -z-0 ${
                            isSelected
                              ? 'bg-gradient-to-r from-orange-500 to-amber-500'
                              : 'bg-white/10 group-hover:bg-orange-500/30'
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
                              ? 'translate-x-1 sm:translate-x-2 border-orange-500/80 bg-gradient-to-r from-orange-500/15 via-[#0b1122] to-[#080d1a] shadow-xl shadow-orange-500/15'
                              : 'bg-[#090d16]/85 border-white/10 hover:border-orange-500/40 hover:bg-[#0c1222]/90 hover:translate-x-1'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-black uppercase font-mono tracking-wider ${
                                  isSelected
                                    ? 'bg-orange-500 text-white'
                                    : 'bg-white/10 text-orange-400'
                                }`}
                              >
                                Day {d.day.toString().padStart(2, '0')}
                              </span>
                              <span className="text-[11px] font-bold text-slate-400 font-mono">
                                Phase {d.phase}
                              </span>
                              <span className="text-white/20">•</span>
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
                                <Clock size={11} className="text-orange-400" />
                                <span>{d.time} sprint</span>
                              </span>
                            </div>

                            <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono text-slate-300">
                              <Code2 size={11} className="text-indigo-400" />
                              <span className="truncate max-w-[180px]">{d.tool}</span>
                            </div>
                          </div>

                          <h3
                            className={`text-base font-black tracking-tight leading-snug transition-colors ${
                              isSelected
                                ? 'text-white'
                                : 'text-slate-100 group-hover:text-orange-300'
                            }`}
                          >
                            {d.title}
                          </h3>

                          <p className="mt-1.5 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                            {d.desc}
                          </p>

                          <div className="mt-3.5 pt-3 border-t border-white/5 flex items-center justify-between gap-2 text-xs">
                            <span className="text-[11px] font-medium text-slate-300 truncate">
                              <strong className="text-orange-400 font-mono">Output: </strong>
                              {d.deliverable}
                            </span>
                            <span
                              className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-bold transition-transform ${
                                isSelected
                                  ? 'text-orange-400 translate-x-1'
                                  : 'text-slate-400 group-hover:text-orange-400 group-hover:translate-x-1'
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
            {(() => {
              const activeDay =
                full15Days.find((d) => d.day === selectedDayDetail) || full15Days[3];
              const prevDay = activeDay.day > 1 ? activeDay.day - 1 : null;
              const nextDay = activeDay.day < 15 ? activeDay.day + 1 : null;

              return (
                <div className="space-y-4">
                  {/* Stepper Navigation Controls */}
                  <div className="flex items-center justify-between bg-[#060913] border border-white/10 rounded-2xl px-4 py-2.5 backdrop-blur-xl">
                    <button
                      type="button"
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
                          ? 'bg-white/5 hover:bg-orange-500/20 text-slate-200 hover:text-orange-300 cursor-pointer'
                          : 'opacity-30 cursor-not-allowed text-slate-500'
                      }`}
                    >
                      <ChevronLeft size={14} />
                      <span>Day {(activeDay.day - 1).toString().padStart(2, '0')}</span>
                    </button>

                    <span className="text-xs font-black font-mono text-orange-400 tracking-wider">
                      DAY {activeDay.day.toString().padStart(2, '0')} / 15
                    </span>

                    <button
                      type="button"
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
                          ? 'bg-white/5 hover:bg-orange-500/20 text-slate-200 hover:text-orange-300 cursor-pointer'
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
                    glareColor="rgba(249, 115, 22, 0.25)"
                    className="p-6 sm:p-7 glass-obsidian border-orange-500/40 bg-[#090d16]/95 shadow-2xl rounded-3xl"
                  >
                    {/* Card Header */}
                    <div className="space-y-2 pb-5 border-b border-white/10">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-orange-500/20 border border-orange-500/40 px-2.5 py-0.5 text-xs font-black uppercase text-orange-400 font-mono">
                            Day {activeDay.day.toString().padStart(2, '0')} · Phase {activeDay.phase}
                          </span>
                          <span className="rounded-md bg-white/5 border border-white/10 px-2 py-0.5 text-[11px] font-bold text-slate-300 font-mono">
                            {activeDay.time} sprint
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
                        <span className="text-slate-500">Stack:</span>
                        <span className="text-white font-bold">{activeDay.tool}</span>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="mt-5 space-y-5">
                      {/* The Brief */}
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 font-mono mb-1.5">
                          The Brief &amp; Narrative
                        </h4>
                        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                          {activeDay.desc}
                        </p>
                        <div className="mt-2.5 flex items-center gap-2 text-xs font-bold text-slate-400">
                          <Clock size={13} className="text-orange-500" />
                          <span>24-Hour Submission Window (Due 11:59 PM)</span>
                        </div>
                      </div>

                      {/* Expected Deliverable */}
                      <div className="rounded-xl border border-white/10 bg-[#060911]/90 p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black uppercase tracking-wider text-orange-400 font-mono">
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
                          Mentor Grading Focus (0–100 Rubric)
                        </h4>
                        <p className="text-xs text-slate-300 leading-relaxed font-medium">
                          {activeDay.rubricPoints}
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
                          data-cursor="ENROLL IN SPRINT"
                          onMouseEnter={() => soundFx.playBlip(560, 0.03, 'sine', 0.03)}
                          onClick={() => soundFx.playSweep(300, 700, 0.12, 0.05)}
                          className="w-full bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white font-black border-none shadow-xl shadow-orange-500/25 justify-center py-3"
                        >
                          <span>Enroll In 15-Day Sprint</span>
                          <ArrowRight size={15} />
                        </Button>
                      </div>
                    </div>
                  </TiltCard>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </section>
  );
}
