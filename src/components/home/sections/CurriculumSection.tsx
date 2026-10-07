import { useState } from 'react';
import {
  Award,
  CheckCircle2,
  Clock,
  Code2,
  Download,
  FileText,
  Flame,
  MessageCircle,
  Play,
  Sparkles,
  Video,
  Zap,
} from 'lucide-react';
import { TiltCard } from '../TiltCard';
import { InteractiveSprintCurriculum } from '../InteractiveSprintCurriculum';
import { soundFx } from '../../../lib/soundFx';

export function CurriculumSection() {
  const [selectedTrack, setSelectedTrack] = useState<'coding' | 'creative'>('creative');
  const [activeSprintPhase, setActiveSprintPhase] = useState<'p1' | 'p2' | 'p3'>('p1');

  return (
    <>
      {/* ========================================================================= */}
      {/* SECTION 2: HOW IT WORKS — A DAY IN THE LIFE OF AN INTERN */}
      {/* ========================================================================= */}
      <section id="how-it-works" className="border-t border-white/10 bg-[#030712] py-20 lg:py-28 relative">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16 gsap-header-reveal">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-400">
              The Daily Rhythm
            </p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight text-white">
              A Day in the Life of a ProCut Hub Intern
            </h2>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed">
              Every single day follows an engineered 4-step sequence designed to build professional velocity without burning you out.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 gsap-cards-group">
            {/* Step 1 */}
            <TiltCard maxTilt={6} className="glass-obsidian p-6 border-white/10 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-orange-500 font-mono">01</span>
                <span className="flex size-9 items-center justify-center rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-400">
                  <Clock size={16} />
                </span>
              </div>
              <h3 className="text-base font-black text-white">
                9:00 AM · The Morning Brief Drop
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Receive the day&apos;s realistic production challenge directly via WhatsApp and the portal, complete with source assets, raw footage, and Figma specs.
              </p>
              <div className="text-[11px] font-bold text-orange-400 pt-2 border-t border-white/10 font-mono">
                Duration: 15–20 min brief review
              </div>
            </TiltCard>

            {/* Step 2 */}
            <TiltCard maxTilt={6} className="glass-obsidian p-6 border-white/10 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-blue-500 font-mono">02</span>
                <span className="flex size-9 items-center justify-center rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400">
                  <Play size={16} />
                </span>
              </div>
              <h3 className="text-base font-black text-white">
                Focused Build &amp; Debug
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Execute the assignment in your timeline or IDE. Stuck? Jump into your 1:1 WhatsApp channel with senior mentors to unblock technical barriers instantly.
              </p>
              <div className="text-[11px] font-bold text-blue-400 pt-2 border-t border-white/10 font-mono">
                Duration: 60–90 min build sprint
              </div>
            </TiltCard>

            {/* Step 3 */}
            <TiltCard maxTilt={6} className="glass-obsidian p-6 border-white/10 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-purple-500 font-mono">03</span>
                <span className="flex size-9 items-center justify-center rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400">
                  <MessageCircle size={16} />
                </span>
              </div>
              <h3 className="text-base font-black text-white">
                Submission &amp; 1:1 Review
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Upload your video export or submit a GitHub PR before the 11:59 PM deadline. Within 24 hours, receive detailed written and audio rubric feedback.
              </p>
              <div className="text-[11px] font-bold text-purple-400 pt-2 border-t border-white/10 font-mono">
                SLA: &lt;24h mentor feedback guarantee
              </div>
            </TiltCard>

            {/* Step 4 */}
            <TiltCard maxTilt={6} className="glass-obsidian p-6 border-white/10 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-emerald-500 font-mono">04</span>
                <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                  <Flame size={16} />
                </span>
              </div>
              <h3 className="text-base font-black text-white">
                Streak &amp; Level Up
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Earn XP points, advance your level on the cohort leaderboard, and protect your consecutive daily streak to unlock your end-of-cohort letter of recommendation.
              </p>
              <div className="text-[11px] font-bold text-emerald-400 pt-2 border-t border-white/10 font-mono">
                Result: Unstoppable shipping momentum
              </div>
            </TiltCard>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 3: THE 2 SPECIALIZED PRODUCTION TRACKS */}
      {/* ========================================================================= */}
      <section id="tracks" className="border-t border-white/10 bg-[#060911] py-20 lg:py-28 relative">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12 gsap-header-reveal">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-400">
              Specialized Disciplines
            </p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight text-white">
              Choose Your 15-Day Production Track
            </h2>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed">
              Both tracks share the same high-velocity 24-hour daily task structure and 1:1 WhatsApp mentorship.
            </p>

            {/* Track Selector Buttons */}
            <div className="mt-8 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-[#090d16] p-1.5 shadow-2xl">
              <button
                type="button"
                data-cursor="TRACK: CREATIVE"
                onClick={() => {
                  setSelectedTrack('creative');
                  soundFx.playSweep(260, 520, 0.08, 0.04);
                }}
                className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black transition cursor-pointer ${
                  selectedTrack === 'creative'
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Video size={16} />
                <span>Creative Video &amp; Kinetic Motion</span>
              </button>
              <button
                type="button"
                data-cursor="TRACK: CODING"
                onClick={() => {
                  setSelectedTrack('coding');
                  soundFx.playSweep(340, 680, 0.08, 0.04);
                }}
                className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black transition cursor-pointer ${
                  selectedTrack === 'coding'
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Code2 size={16} />
                <span>Coding &amp; Full Stack Software</span>
              </button>
            </div>
          </div>

          {/* Track Content Showcase */}
          {selectedTrack === 'creative' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <TiltCard maxTilt={5} data-cursor="INSPECT MODULE" className="glass-obsidian p-6 border-white/10 hover:border-orange-500/40 space-y-4 shadow-xl transition-all">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-orange-500/15 border border-orange-500/30 text-orange-400">
                  <Play size={20} />
                </div>
                <h3 className="text-base font-black text-white">Kinetic Typography &amp; Motion</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Design modern animated captions, subtitle timing, bezier motion easing, and title cards that elevate brand storytelling.
                </p>
                <ul className="text-xs text-slate-300 space-y-2 pt-2 border-t border-white/10">
                  <li className="flex items-center gap-2 text-slate-200">✓ After Effects Bezier Curves</li>
                  <li className="flex items-center gap-2 text-slate-200">✓ Dynamic Kinetic Subtitle Timing</li>
                  <li className="flex items-center gap-2 text-slate-200">✓ Custom Lower Thirds &amp; Overlays</li>
                </ul>
                <span className="inline-block text-[11px] font-bold text-orange-400 pt-2 font-mono">Days 1–5 Deliverables →</span>
              </TiltCard>

              <TiltCard maxTilt={5} data-cursor="INSPECT MODULE" className="glass-obsidian p-6 border-white/10 hover:border-amber-500/40 space-y-4 shadow-xl transition-all">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
                  <Sparkles size={20} />
                </div>
                <h3 className="text-base font-black text-white">DaVinci Resolve Color &amp; Audio</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Primary and secondary color correction, skin-tone isolation, LUT design, audio ducking, and multi-track whoosh sound design.
                </p>
                <ul className="text-xs text-slate-300 space-y-2 pt-2 border-t border-white/10">
                  <li className="flex items-center gap-2 text-slate-200">✓ Node-Based Color Primaries</li>
                  <li className="flex items-center gap-2 text-slate-200">✓ Sub-Mix Audio Mastering (-14 LUFS)</li>
                  <li className="flex items-center gap-2 text-slate-200">✓ Risers, Impacts &amp; Atmosphere</li>
                </ul>
                <span className="inline-block text-[11px] font-bold text-amber-400 pt-2 font-mono">Days 6–10 Deliverables →</span>
              </TiltCard>

              <TiltCard maxTilt={5} data-cursor="INSPECT MODULE" className="glass-obsidian p-6 border-white/10 hover:border-emerald-500/40 space-y-4 shadow-xl transition-all">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                  <CheckCircle2 size={20} />
                </div>
                <h3 className="text-base font-black text-white">Commercial Reel &amp; Final Cut</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Synthesize your work into a high-retention 60-second commercial cut for real portfolio defense with creative directors.
                </p>
                <ul className="text-xs text-slate-300 space-y-2 pt-2 border-t border-white/10">
                  <li className="flex items-center gap-2 text-slate-200">✓ Fast Narrative Retention Pacing</li>
                  <li className="flex items-center gap-2 text-slate-200">✓ Professional Client Handoff Specs</li>
                  <li className="flex items-center gap-2 text-slate-200">✓ Verified Portfolio Defense</li>
                </ul>
                <span className="inline-block text-[11px] font-bold text-emerald-400 pt-2 font-mono">Days 11–15 Capstone →</span>
              </TiltCard>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <TiltCard maxTilt={5} data-cursor="INSPECT MODULE" className="glass-obsidian p-6 border-white/10 hover:border-blue-500/40 space-y-4 shadow-xl transition-all">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-400">
                  <Code2 size={20} />
                </div>
                <h3 className="text-base font-black text-white">React 19 &amp; Modern TypeScript</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Build production-grade web interfaces with strict type safety, optimistic UI patterns, and modular Tailwind architectures.
                </p>
                <ul className="text-xs text-slate-300 space-y-2 pt-2 border-t border-white/10">
                  <li className="flex items-center gap-2 text-slate-200">✓ Strict TS Types &amp; Generics</li>
                  <li className="flex items-center gap-2 text-slate-200">✓ Optimistic UI &amp; State Reducers</li>
                  <li className="flex items-center gap-2 text-slate-200">✓ Tailwind Component Systems</li>
                </ul>
                <span className="inline-block text-[11px] font-bold text-blue-400 pt-2 font-mono">Days 1–5 Deliverables →</span>
              </TiltCard>

              <TiltCard maxTilt={5} data-cursor="INSPECT MODULE" className="glass-obsidian p-6 border-white/10 hover:border-purple-500/40 space-y-4 shadow-xl transition-all">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-400">
                  <Zap size={20} />
                </div>
                <h3 className="text-base font-black text-white">Supabase Backend &amp; Real-time APIs</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Design PostgreSQL relational schemas, write robust Row-Level Security policies, and integrate live WebSocket feeds.
                </p>
                <ul className="text-xs text-slate-300 space-y-2 pt-2 border-t border-white/10">
                  <li className="flex items-center gap-2 text-slate-200">✓ PostgreSQL Relations &amp; Foreign Keys</li>
                  <li className="flex items-center gap-2 text-slate-200">✓ Secure Row-Level Security Policies</li>
                  <li className="flex items-center gap-2 text-slate-200">✓ Live WebSocket Subscriptions</li>
                </ul>
                <span className="inline-block text-[11px] font-bold text-purple-400 pt-2 font-mono">Days 6–10 Deliverables →</span>
              </TiltCard>

              <TiltCard maxTilt={5} data-cursor="INSPECT MODULE" className="glass-obsidian p-6 border-white/10 hover:border-emerald-500/40 space-y-4 shadow-xl transition-all">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                  <Award size={20} />
                </div>
                <h3 className="text-base font-black text-white">Full-Stack SaaS Capstone on Vercel</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Deploy a fully tested, production-grade web application with CI previews, unit test suites, and audited PR code.
                </p>
                <ul className="text-xs text-slate-300 space-y-2 pt-2 border-t border-white/10">
                  <li className="flex items-center gap-2 text-slate-200">✓ Production Custom Domain on Vercel</li>
                  <li className="flex items-center gap-2 text-slate-200">✓ Vitest &amp; Cypress End-to-End Suite</li>
                  <li className="flex items-center gap-2 text-slate-200">✓ GitHub PR Review &amp; Code Defense</li>
                </ul>
                <span className="inline-block text-[11px] font-bold text-emerald-400 pt-2 font-mono">Days 11–15 Capstone →</span>
              </TiltCard>
            </div>
          )}

          {/* 3-Phase Stepper Tabs for Sprints */}
          <div className="mt-14 pt-12 border-t border-white/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-black text-white">The 3 Progressive Sprint Phases</h3>
                <p className="text-xs text-slate-400">Step by step from foundational momentum to industry-grade capstone proof.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-cursor="PHASE 01"
                  onClick={() => {
                    setActiveSprintPhase('p1');
                    soundFx.playBlip(320, 0.04, 'sine', 0.04);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                    activeSprintPhase === 'p1' ? 'bg-orange-500 text-white shadow-md shadow-orange-500/25' : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  Phase 1 (Days 1–5)
                </button>
                <button
                  type="button"
                  data-cursor="PHASE 02"
                  onClick={() => {
                    setActiveSprintPhase('p2');
                    soundFx.playBlip(420, 0.04, 'sine', 0.04);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                    activeSprintPhase === 'p2' ? 'bg-orange-500 text-white shadow-md shadow-orange-500/25' : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  Phase 2 (Days 6–10)
                </button>
                <button
                  type="button"
                  data-cursor="PHASE 03"
                  onClick={() => {
                    setActiveSprintPhase('p3');
                    soundFx.playBlip(560, 0.04, 'sine', 0.04);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                    activeSprintPhase === 'p3' ? 'bg-orange-500 text-white shadow-md shadow-orange-500/25' : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  Phase 3 (Days 11–15)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {activeSprintPhase === 'p1' ? (
                <>
                  <div className="p-4 rounded-xl border border-white/10 bg-[#090d16]/80 text-slate-300 shadow-md">
                    <p className="font-black text-orange-400 font-mono">Day 01–02: Workspace &amp; Mechanics</p>
                    <p className="mt-1 text-slate-400">Clone repositories, configure shortcut mapping, and build muscle memory.</p>
                  </div>
                  <div className="p-4 rounded-xl border border-white/10 bg-[#090d16]/80 text-slate-300 shadow-md">
                    <p className="font-black text-orange-400 font-mono">Day 03–04: Reactive Motion &amp; State</p>
                    <p className="mt-1 text-slate-400">Keyframe typography or connect backend data flows with optimistic updates.</p>
                  </div>
                  <div className="p-4 rounded-xl border border-white/10 bg-[#090d16]/80 text-slate-300 shadow-md">
                    <p className="font-black text-orange-400 font-mono">Day 05: Phase Checkpoint Audit</p>
                    <p className="mt-1 text-slate-400">First formal mentor scoring (0–100) and written critique feedback.</p>
                  </div>
                </>
              ) : activeSprintPhase === 'p2' ? (
                <>
                  <div className="p-4 rounded-xl border border-white/10 bg-[#090d16]/80 text-slate-300 shadow-md">
                    <p className="font-black text-orange-400 font-mono">Day 06–07: Depth &amp; Subsystems</p>
                    <p className="mt-1 text-slate-400">Complex sound design layers or multi-table PostgreSQL relational queries.</p>
                  </div>
                  <div className="p-4 rounded-xl border border-white/10 bg-[#090d16]/80 text-slate-300 shadow-md">
                    <p className="font-black text-orange-400 font-mono">Day 08–09: Retention &amp; Mobile Web</p>
                    <p className="mt-1 text-slate-400">Pacing drop-off prevention and high-performance mobile viewport responsiveness.</p>
                  </div>
                  <div className="p-4 rounded-xl border border-white/10 bg-[#090d16]/80 text-slate-300 shadow-md">
                    <p className="font-black text-orange-400 font-mono">Day 10: Halfway Live Review</p>
                    <p className="mt-1 text-slate-400">Live Zoom workshop with mentors tearing down student timelines &amp; code.</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-4 rounded-xl border border-white/10 bg-[#090d16]/80 text-slate-300 shadow-md">
                    <p className="font-black text-orange-400 font-mono">Day 11–13: The Commercial Capstone</p>
                    <p className="mt-1 text-slate-400">48-hour deep sprint turning real client briefs into a showcase deliverable.</p>
                  </div>
                  <div className="p-4 rounded-xl border border-white/10 bg-[#090d16]/80 text-slate-300 shadow-md">
                    <p className="font-black text-orange-400 font-mono">Day 14: Final Polish &amp; Loom Audit</p>
                    <p className="mt-1 text-slate-400">Submit video walkthrough explaining architectural &amp; editorial choices.</p>
                  </div>
                  <div className="p-4 rounded-xl border border-white/10 bg-[#090d16]/80 text-slate-300 shadow-md">
                    <p className="font-black text-orange-400 font-mono">Day 15: Graduation &amp; LOR</p>
                    <p className="mt-1 text-slate-400">Receive verified digital certificate and mentor recommendation letter.</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 4: COMPLETE 15-DAY DAILY ARCHITECTURE ROADMAP */}
      {/* ========================================================================= */}
      <InteractiveSprintCurriculum />

      {/* ========================================================================= */}
      {/* SECTION 5: STARTER PACKS & ASSET VAULT INCLUDED */}
      {/* ========================================================================= */}
      <section id="assets" className="border-t border-white/10 bg-[#070b16] py-20 lg:py-28 relative">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16 gsap-header-reveal">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-400">
              Production-Ready Resources
            </p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight text-white">
              Over ₹30,000 in Starter Assets &amp; Toolkits Included
            </h2>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed">
              No need to spend weeks hunting for media or boilerplate. You hit the ground running on Day 1 with industry-standard starter projects.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 gsap-cards-group">
            <TiltCard maxTilt={6} className="glass-obsidian p-6 border-white/10 space-y-4 shadow-xl">
              <div className="flex size-10 items-center justify-center rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-400">
                <Video size={18} />
              </div>
              <h3 className="text-base font-black text-white">4K Raw Commercial Footage</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Over 50 GB of multicam Sony FX3 &amp; RED RAW footage shots: interviews, tech B-roll, lifestyle, and dynamic transitions.
              </p>
              <div className="text-[11px] font-bold text-orange-400 pt-2 border-t border-white/10 font-mono">
                100% Commercial Usage Rights
              </div>
            </TiltCard>

            <TiltCard maxTilt={6} className="glass-obsidian p-6 border-white/10 space-y-4 shadow-xl">
              <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
                <Download size={18} />
              </div>
              <h3 className="text-base font-black text-white">Mastered Sound FX Vault</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Curated library of 300+ cinema-quality audio assets: deep sub-bass risers, whooshes, UI clicks, keyboard textures, and vinyl noise.
              </p>
              <div className="text-[11px] font-bold text-amber-400 pt-2 border-t border-white/10 font-mono">
                24-bit 48kHz WAV Masters
              </div>
            </TiltCard>

            <TiltCard maxTilt={6} className="glass-obsidian p-6 border-white/10 space-y-4 shadow-xl">
              <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400">
                <Code2 size={18} />
              </div>
              <h3 className="text-base font-black text-white">Full-Stack Starter Repos</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Pre-configured React 19 + Supabase starter templates with Tailwind CSS, TypeScript, Vitest test runners, and authentication pre-wired.
              </p>
              <div className="text-[11px] font-bold text-blue-400 pt-2 border-t border-white/10 font-mono">
                GitHub Template Repos
              </div>
            </TiltCard>

            <TiltCard maxTilt={6} className="glass-obsidian p-6 border-white/10 space-y-4 shadow-xl">
              <div className="flex size-10 items-center justify-center rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400">
                <FileText size={18} />
              </div>
              <h3 className="text-base font-black text-white">Agency Brief &amp; Rubric Vault</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Exact PDF briefs used by leading agencies: client deliverables, storyboard templates, Loom walk-through checklists, and contract templates.
              </p>
              <div className="text-[11px] font-bold text-purple-400 pt-2 border-t border-white/10 font-mono">
                Editable Notion / PDF Packs
              </div>
            </TiltCard>
          </div>
        </div>
      </section>
    </>
  );
}

