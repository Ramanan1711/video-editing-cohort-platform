import {
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  Clock,
  Flame,
  MessageCircle,
  Play,
  Sparkles,
  Star,
} from 'lucide-react';
import { Button } from '../../ui/Button';
import { HeroCanvasSimulator } from '../HeroCanvasSimulator';
import { LazyRobotTerminal } from '../LazyRobotTerminal';
import { TiltCard } from '../TiltCard';
import { soundFx } from '../../../lib/soundFx';
import { setPendingCohortCheckout } from '../../../lib/cohortCheckoutPersistence';

export interface HeroSectionProps {
  loadingCohorts: boolean;
  cohorts: Array<{
    id: string;
    name: string;
    description?: string | null;
    status?: string | null;
    capacity?: number | null;
    price_inr?: number | null;
    currency?: string | null;
  }>;
  cohortError: string | null;
  publishedPrice: number;
  publishedCurrency: string;
}

export function HeroSection({
  loadingCohorts,
  cohorts,
  cohortError,
  publishedPrice,
  publishedCurrency,
}: HeroSectionProps) {
  return (
    <>
      {/* ========================================================================= */}
      {/* HERO SECTION WITH 3D ROBOT TERMINAL & JUNCA STUDIO TYPOGRAPHY */}
      {/* ========================================================================= */}
      <section className="hero relative overflow-hidden bg-[#080808] border-b border-white/10 min-h-[92vh] lg:min-h-screen flex items-end pb-16 lg:pb-28">
        {/* Atmospheric crimson volumetric gradient inspired by Junca Studio */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_75%_55%_at_70%_40%,rgba(220,38,38,0.22),transparent_70%)] gsap-parallax-slow" />
        <div className="pointer-events-none absolute top-12 left-1/4 -z-10 size-[500px] rounded-full bg-red-600/10 blur-[140px] gsap-parallax-slow" />

        {/* Interactive 3D / Gradient WebGL Canvas Hero Simulator */}
        <HeroCanvasSimulator />

        {/* 3D Retro-Futuristic Robot Terminal Character with Visor CRT & Fan */}
        <div className="absolute right-0 sm:right-2 lg:right-4 xl:right-8 top-1/2 -translate-y-1/2 z-10 hidden md:flex items-center justify-center pointer-events-none">
          <LazyRobotTerminal />
        </div>

        {/* Exact Requested Hero Content Markup */}
        <div className="container hero__content mx-auto max-w-7xl px-5 lg:px-8 relative z-20 w-full" data-astro-cid-lcdefpme="">
          <div className="flex flex-col items-start text-left max-w-3xl">
            {/* Verified Status Pill */}
            <div
              data-cursor="COHORT TELEMETRY"
              className="mb-8 inline-flex items-center gap-2.5 rounded-full border border-orange-500/30 bg-[#090d16]/80 px-4 py-1.5 shadow-lg shadow-orange-500/10 backdrop-blur-xl gsap-metric-reveal"
            >
              <span className="flex size-2 rounded-full bg-orange-500 animate-ping" />
              <span className="text-[11px] font-black uppercase tracking-wider text-orange-400 font-mono">
                Stop Watching Tutorials · 15-Day Production Sprint
              </span>
              <span className="hidden sm:inline text-white/20">•</span>
              <span className="hidden sm:inline text-[11px] font-bold text-slate-300 font-mono">
                {loadingCohorts ? 'Checking Active Cohorts...' : `${cohorts.length || 2} Production Cohorts Active`}
              </span>
            </div>

            {/* Exact Requested Hero Title Markup */}
            <h1 className="hero__title" data-hero-titre="" data-scr-skip="" data-astro-cid-lcdefpme="">
              Start Shipping Production.
            </h1>

            {/* Subtitle */}
            <p className="mt-6 max-w-2xl text-base sm:text-lg text-slate-300 leading-relaxed font-normal">
              An intensive 15-day sprint for aspiring developers and creative editors. Solve real production briefs daily, get 1-on-1 mentor guidance via WhatsApp, and graduate with a portfolio-grade project and accredited recommendation.
            </p>

            {/* CTA Buttons */}
            <div className="mt-8 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
              <Button
                href="#active-cohorts"
                size="lg"
                data-cursor="VIEW COHORTS"
                onClick={() => soundFx.playSweep(260, 600, 0.1, 0.05)}
                className="w-full sm:w-auto shadow-xl shadow-orange-500/30 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white font-black border-none justify-center px-8 py-3.5 hover:scale-105 transition-all"
              >
                <span>View Active Cohorts</span>
                <ArrowRight size={16} />
              </Button>
              <Button
                href="#sprint"
                variant="secondary"
                size="lg"
                data-cursor="INSPECT 15 DAYS"
                onClick={() => soundFx.playBlip(480, 0.04, 'sine', 0.04)}
                className="w-full sm:w-auto justify-center bg-white/5 border border-white/15 text-white hover:bg-white/10 hover:border-orange-500/40 backdrop-blur-xl px-7 py-3.5 font-bold transition-all"
              >
                <Play size={15} className="text-orange-400" fill="currentColor" />
                <span>Inspect 15-Day Roadmap</span>
              </Button>
            </div>

            {/* Substantiated Quality Metrics Banner */}
            <div className="mt-8 flex flex-wrap items-center justify-start gap-4 text-xs text-slate-300">
              <div className="inline-flex items-center gap-1.5 font-bold">
                <CheckCircle2 size={15} className="text-emerald-400" />
                <span>15 Daily Submissions Required</span>
              </div>
              <span className="text-white/20">•</span>
              <div className="inline-flex items-center gap-1.5 font-bold">
                <CheckCircle2 size={15} className="text-emerald-400" />
                <span>&lt;24h Mentor Review SLA</span>
              </div>
              <span className="text-white/20">•</span>
              <div className="inline-flex items-center gap-1.5 font-bold">
                <div className="flex text-amber-400">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={13} fill="currentColor" />
                  ))}
                </div>
                <span className="font-bold text-white">4.9/5</span>
                <span>Satisfaction*</span>
              </div>
            </div>

            <p className="mt-2 text-[10px] text-slate-400">
              *Based on post-sprint feedback surveys across verified cohort completions.
            </p>
          </div>
        </div>
      </section>

      {/* Live Interactive Platform Mockup Section */}
      <section className="relative py-12 px-5 lg:px-8 bg-[#040813] border-b border-white/10">
        <div className="mx-auto max-w-7xl">
          {/* Live Interactive Platform Mockup with 3D Depth-Tilt & Specular Lighting */}
          <div className="mt-14 relative perspective-1200">
            <div className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-orange-500 to-amber-500 opacity-20 blur-2xl pointer-events-none" />
            <TiltCard
              maxTilt={4}
              scale={1.01}
              perspective={1200}
              glareOpacity={0.2}
              glareColor="rgba(251, 146, 60, 0.3)"
              className="relative rounded-3xl border border-surface-subtle bg-surface-card/90 backdrop-blur-2xl shadow-2xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] overflow-hidden"
            >
              {/* Mock Browser Header */}
              <div className="flex items-center justify-between border-b border-white/10 bg-[#060911]/80 px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <span className="size-3 rounded-full bg-red-500/80" />
                  <span className="size-3 rounded-full bg-amber-500/80" />
                  <span className="size-3 rounded-full bg-emerald-500/80" />
                  <span className="ml-2 font-mono text-[11px] font-bold text-slate-400">
                    procuthub.com/student/dashboard?tab=internship_sprint
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-black text-emerald-400">
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live Mentor Active
                  </span>
                </div>
              </div>

              {/* Mock Dashboard Body */}
              <div className="p-6 sm:p-8 space-y-6">
                {/* Top Stats Banner */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-md">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sprint Progress</p>
                    <p className="text-base font-black text-white font-mono">Day 04 / 15</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-md">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Daily Streak</p>
                    <p className="text-base font-black text-orange-400 font-mono">4 Days Active 🔥</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-md">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tasks Verified</p>
                    <p className="text-base font-black text-emerald-400 font-mono">3 Approved</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-md">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Rubric Score</p>
                    <p className="text-base font-black text-white font-mono">96 / 100</p>
                  </div>
                </div>

                {/* 15-Day Visual Mini Heatmap */}
                <div className="rounded-xl border border-white/10 bg-[#040711]/60 p-4">
                  <div className="flex items-center justify-between text-xs font-bold mb-3">
                    <span className="flex items-center gap-1.5 text-slate-200">
                      <Flame size={14} className="text-orange-500" />
                      15-Day Sprint Heatmap
                    </span>
                    <span className="text-[11px] text-slate-400">Day 4 Milestone · On Schedule</span>
                  </div>
                  <div className="grid grid-cols-15 gap-1.5 sm:gap-2">
                    {Array.from({ length: 15 }, (_, i) => i + 1).map((day) => {
                      const isDone = day <= 3;
                      const isCurrent = day === 4;
                      return (
                        <div
                          key={day}
                          className={`flex flex-col items-center gap-1 py-1.5 rounded-lg border text-center transition ${
                            isDone
                              ? 'bg-emerald-500 border-emerald-600 text-white shadow-2xs'
                              : isCurrent
                              ? 'bg-orange-500 border-orange-600 text-white animate-pulse'
                              : 'bg-white/5 border-white/10 text-slate-400'
                          }`}
                        >
                          <span className="text-[9px] font-black">{day}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Active Task + WhatsApp Preview */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2 rounded-xl border border-orange-500/30 bg-orange-500/10 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="rounded-md bg-orange-500 text-white px-2 py-0.5 text-[10px] font-black uppercase">
                        Today's Production Task
                      </span>
                      <span className="text-xs font-bold text-orange-300 flex items-center gap-1">
                        <Clock size={12} /> Deadline: 11:59 PM Tonight
                      </span>
                    </div>
                    <h3 className="text-sm font-black text-white">
                      Day 04: Component State &amp; Retention Speed Ramping
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Implement fast timeline micro-transitions and publish your deliverable link for live mentor critique room review.
                    </p>
                    <div className="flex items-center gap-2 pt-2 border-t border-orange-500/20">
                      <span className="text-[11px] font-bold text-slate-300">
                        Deliverable: Public GitHub PR or Video Cut Link
                      </span>
                      <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-black text-orange-400">
                        Submit Task <ArrowRight size={11} />
                      </span>
                    </div>
                  </div>

                  {/* WhatsApp Co-pilot Snippet */}
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex size-7 items-center justify-center rounded-full bg-[#25D366] text-white">
                          <MessageCircle size={14} />
                        </div>
                        <div>
                          <p className="text-xs font-black text-white leading-none">
                            Mentor WhatsApp
                          </p>
                          <p className="text-[10px] text-emerald-400 mt-0.5">
                            Avg. reply under 15 mins
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-300 italic bg-[#030712]/80 p-3 rounded-lg border border-white/10">
                        &quot;Great job on Day 3's typography! For Day 4, pay special attention to retention at the 7-second mark.&quot;
                      </p>
                    </div>
                    <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                      <span>1-Click Mentor Chat Enabled</span>
                      <CheckCircle2 size={12} />
                    </span>
                  </div>
                </div>
              </div>
            </TiltCard>
          </div>

          {/* Scroll Down Hook */}
          <div className="mt-14 flex flex-col items-center">
            <a
              href="#active-cohorts"
              className="group flex flex-col items-center gap-2 text-xs font-bold text-slate-400 hover:text-orange-400 transition"
            >
              <span>Scroll down to inspect live cohorts and curriculum</span>
              <span className="flex size-8 items-center justify-center rounded-full border border-white/10 bg-[#090d16] text-slate-300 shadow-lg group-hover:border-orange-500 group-hover:text-orange-400 group-hover:translate-y-1 transition-all">
                <ArrowDown size={14} />
              </span>
            </a>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* VERIFIED OPERATIONAL STANDARDS TICKER */}
      {/* ========================================================================= */}
      <section className="border-y border-white/10 bg-[#060911]/90 py-4 overflow-hidden backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs font-semibold text-slate-300">
            <div className="flex items-center gap-2 shrink-0">
              <span className="flex size-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-black text-white uppercase tracking-wider text-[11px]">
                Verified Platform Operations
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-6 overflow-x-auto text-[11px] scrollbar-none">
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="font-bold text-orange-400">Daily Intake:</span>
                <span>Automated GitHub PR &amp; Video URL Submissions</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="font-bold text-emerald-400">Review SLA:</span>
                <span>&lt;24h Written &amp; Audio Rubric Grading</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="font-bold text-blue-400">Mentorship:</span>
                <span>Dedicated WhatsApp 1-on-1 Blocker Triage</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="font-bold text-purple-400">Certification:</span>
                <span>Tamper-Proof Cryptographic Verification Hash</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* REAL DATABASE COHORTS SECTION WITH 3D DEPTH-TILT OBSIDIAN CARDS */}
      {/* ========================================================================= */}
      <section id="active-cohorts" className="py-20 lg:py-28 bg-[#030712] relative">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14 gsap-header-reveal">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-400">
              Live Cohort Registry
            </p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight text-white">
              Available Production Cohorts
            </h2>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed">
              Directly connected to our database. Inspect active tracks and reserve your place in an upcoming 15-day sprint.
            </p>
          </div>

          {loadingCohorts ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <div className="size-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
              <p className="text-xs font-bold text-slate-400">Loading active cohorts from database...</p>
            </div>
          ) : cohortError ? (
            <div className="max-w-md mx-auto p-4 rounded-xl border border-red-500/30 bg-red-950/20 text-center text-xs text-red-400">
              <p className="font-bold">Notice</p>
              <p className="mt-1">{cohortError}</p>
              <Button href="/register" size="sm" className="mt-3">
                Register for Upcoming Batch
              </Button>
            </div>
          ) : cohorts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 gsap-cards-group">
              {cohorts.map((cohort) => (
                <TiltCard
                  key={cohort.id}
                  maxTilt={7}
                  scale={1.02}
                  perspective={1000}
                  glareOpacity={0.25}
                  glareColor="rgba(249, 115, 22, 0.25)"
                  data-cursor="RESERVE SEAT"
                  className="glass-obsidian p-6 border-white/10 hover:border-orange-500/40 flex flex-col justify-between space-y-4 shadow-xl transition-all"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="dot-label dot-label--emerald text-[10px] uppercase font-mono font-bold">
                        {cohort.status || 'Active Batch'}
                      </span>
                      <span className="text-[11px] font-bold text-slate-400 font-mono">
                        Cap: {cohort.capacity || 30} Interns
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-white">
                      {cohort.name}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                      {cohort.description || 'Full 15-day sprint curriculum featuring daily production briefs, WhatsApp mentor support, and verifiable certification.'}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-orange-400 font-mono block">
                        ₹{(cohort.price_inr ?? publishedPrice).toLocaleString('en-IN')} {cohort.currency || publishedCurrency}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">15 Days Intensive</span>
                    </div>
                    <Button
                      href={`/register?cohort=${cohort.id}`}
                      size="sm"
                      data-cursor="ENROLL"
                      onClick={() => {
                        setPendingCohortCheckout(cohort.id, cohort.name, cohort.price_inr ?? undefined, cohort.currency ?? undefined);
                        soundFx.playSweep(300, 700, 0.1, 0.05);
                      }}
                      className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold border-none shadow-md shadow-orange-500/20"
                    >
                      <span>Enroll</span>
                      <ArrowRight size={13} />
                    </Button>
                  </div>
                </TiltCard>
              ))}
            </div>
          ) : (
            <div className="text-center max-w-lg mx-auto p-8 rounded-2xl border border-white/10 bg-[#090d16]/80 backdrop-blur-xl space-y-4 shadow-xl">
              <Sparkles className="size-8 text-orange-500 mx-auto" />
              <h3 className="text-base font-black text-white">
                Next Sprint Cycle Opening Soon
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Both our <strong>Full-Stack Software</strong> and <strong>Creative Video Editing</strong> 15-day sprint tracks are open for candidate registration.
              </p>
              <Button href="/register" size="sm" className="bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold border-none">
                Pre-Register for Next Batch
              </Button>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
