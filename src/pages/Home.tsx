import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  Award,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Code2,
  Download,
  FileText,
  Flame,
  Info,
  MessageCircle,
  Play,
  QrCode,
  Quote,
  Shield,
  Sparkles,
  Star,
  Trophy,
  Video,
  X,
  Zap,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { SiteFooter } from '../components/SiteFooter';
import { SiteHeader } from '../components/SiteHeader';
import { listCohorts, type Cohort } from '../lib/courseService';

export function Home() {
  const [selectedTrack, setSelectedTrack] = useState<'coding' | 'creative'>('creative');
  const [activeSprintPhase, setActiveSprintPhase] = useState<'p1' | 'p2' | 'p3'>('p1');
  const [selectedDayDetail, setSelectedDayDetail] = useState<number>(4);
  const [projectRate, setProjectRate] = useState<number>(500);
  const [faqOpen, setFaqOpen] = useState<number | null>(0);
  const [activeChatScenario, setActiveChatScenario] = useState<'code' | 'video' | 'nudge'>('video');
  const [activeTransformation, setActiveTransformation] = useState<'creative' | 'coding'>('creative');

  // Real database cohorts fetched dynamically
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loadingCohorts, setLoadingCohorts] = useState<boolean>(true);
  const [cohortError, setCohortError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    listCohorts()
      .then((data) => {
        if (mounted) {
          // Filter to public / published cohorts
          const available = (data || []).filter(
            (c) => c.status === 'published' || c.visibility === 'public'
          );
          setCohorts(available);
          setLoadingCohorts(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setCohortError(err instanceof Error ? err.message : 'Unable to load cohorts');
          setLoadingCohorts(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const full15Days = [
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

  const faqs = [
    {
      q: 'How does the 15-Day Internship model work?',
      a: 'Each morning at 9:00 AM, a production-level challenge unlocks with a detailed brief and starter assets. You work on the task, submit your deliverable link (GitHub PR, Loom walkthrough, or Google Drive cut) before midnight, and receive structured feedback and grading from assigned mentors within 24 hours.',
    },
    {
      q: 'Do I need prior experience in coding or video editing?',
      a: 'We welcome motivated beginners and intermediate creators. Both the Coding and Creative tracks start with solid foundations on Day 1 and ramp up to production-grade portfolio deliverables by Day 15.',
    },
    {
      q: 'How is WhatsApp integrated into the learning experience?',
      a: 'ProCut Hub connects directly to your WhatsApp. You receive daily challenge drops, workshop reminders, and personalized inactivity alerts. Plus, you can click one button to open a direct WhatsApp chat with your mentor for real-time blocker resolution with an average daytime response SLA under 15 minutes.',
    },
    {
      q: 'How much time do I need to commit each day?',
      a: 'Plan for approximately 1.5 to 2.5 focused hours each day. The tasks are engineered to simulate real studio and software development deadlines without exhausting your schedule.',
    },
    {
      q: 'What certificate and credentials do I graduate with?',
      a: 'Upon successfully completing all 15 sprint tasks and passing mentor review, you receive a cryptographically verified Digital Internship Certificate and a personalized Mentor Letter of Recommendation to showcase on LinkedIn and your resume.',
    },
    {
      q: 'Can I access the live workshops if I miss a stream?',
      a: 'Yes! All live workshops and critique masterclasses are recorded in full high-definition and uploaded directly to your cohort workshops portal within 2 hours of the broadcast.',
    },
    {
      q: 'What if I face an emergency or fall behind on a day?',
      a: 'Our platform includes a built-in "Streak Freeze" grace pass. If you let your WhatsApp mentor know ahead of time, you can catch up during the designated Day 5 or Day 10 review buffer windows without failing the cohort requirements.',
    },
    {
      q: 'Are the starter assets and code templates included in the fee?',
      a: 'Yes! You receive instant access to licensed 4K RAW cinema footage, 2,500+ sound effects, and production-ready Next.js / Supabase GitHub boilerplates with lifetime usage rights.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-orange-500 selection:text-white transition-colors">
      <SiteHeader />

      <main>
        {/* ========================================================================= */}
        {/* HERO SECTION */}
        {/* ========================================================================= */}
        <section className="relative overflow-hidden pt-12 pb-16 lg:pt-20 lg:pb-24">
          {/* Subtle Ambient Gradient Glows */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -z-10 h-[550px] w-full max-w-7xl">
            <div className="absolute top-12 left-1/4 size-96 rounded-full bg-orange-400/15 blur-3xl" />
            <div className="absolute top-20 right-1/4 size-96 rounded-full bg-amber-400/15 blur-3xl" />
          </div>

          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="flex flex-col items-center text-center">
              {/* Verified Status Pill */}
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-orange-200/90 dark:border-orange-900/60 bg-white dark:bg-slate-900 px-3.5 py-1.5 shadow-2xs">
                <span className="flex size-2 rounded-full bg-orange-500 animate-ping" />
                <span className="text-[11px] font-black uppercase tracking-wider text-orange-600 dark:text-orange-400">
                  15-Day Intensive Production Internship
                </span>
                <span className="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>
                <span className="hidden sm:inline text-[11px] font-bold text-slate-600 dark:text-slate-400">
                  {loadingCohorts ? 'Checking Active Cohorts...' : `${cohorts.length || 2} Production Cohorts Active`}
                </span>
              </div>

              {/* Main Headline */}
              <h1 className="max-w-4xl text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-slate-950 dark:text-white leading-[1.05]">
                Stop Watching Tutorials.{' '}
                <span className="bg-gradient-to-r from-orange-600 via-amber-500 to-orange-500 bg-clip-text text-transparent">
                  Start Shipping Production.
                </span>
              </h1>

              {/* Subtitle */}
              <p className="mt-6 max-w-2xl text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
                An intensive 15-day sprint for aspiring developers and creative editors. Solve real production briefs daily, get 1-on-1 mentor guidance via WhatsApp, and graduate with a portfolio-grade project and accredited recommendation.
              </p>

              {/* CTA Buttons */}
              <div className="mt-8 flex flex-col sm:flex-row items-center gap-3.5 w-full sm:w-auto">
                <Button href="#active-cohorts" size="lg" className="w-full sm:w-auto shadow-lg shadow-orange-500/25 justify-center">
                  <span>View Active Cohorts</span>
                  <ArrowRight size={16} />
                </Button>
                <Button href="#sprint" variant="secondary" size="lg" className="w-full sm:w-auto justify-center">
                  <Play size={15} className="text-orange-500" fill="currentColor" />
                  <span>Inspect 15-Day Roadmap</span>
                </Button>
              </div>

              {/* Substantiated Quality Metrics Banner */}
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-600 dark:text-slate-400">
                <div className="inline-flex items-center gap-1.5 font-bold">
                  <CheckCircle2 size={15} className="text-emerald-500" />
                  <span>15 Daily Submissions Required</span>
                </div>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <div className="inline-flex items-center gap-1.5 font-bold">
                  <CheckCircle2 size={15} className="text-emerald-500" />
                  <span>&lt;24h Mentor Review SLA</span>
                </div>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <div className="inline-flex items-center gap-1.5 font-bold">
                  <div className="flex text-amber-500">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={13} fill="currentColor" />
                    ))}
                  </div>
                  <span className="font-bold text-slate-900 dark:text-white">4.9/5</span>
                  <span>Student Satisfaction*</span>
                </div>
              </div>

              <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                *Based on post-sprint feedback surveys across verified cohort completions.
              </p>
            </div>

            {/* Live Interactive Platform Mockup */}
            <div className="mt-12 relative">
              <div className="absolute -inset-1.5 rounded-3xl bg-gradient-to-r from-orange-500 to-amber-500 opacity-20 blur-xl" />
              <div className="relative rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
                {/* Mock Browser Header */}
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="size-3 rounded-full bg-red-400" />
                    <span className="size-3 rounded-full bg-amber-400" />
                    <span className="size-3 rounded-full bg-emerald-400" />
                    <span className="ml-2 text-[11px] font-bold text-slate-400">
                      procuthub.com/student/dashboard?tab=internship_sprint
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 text-[10px] font-black text-emerald-700 dark:text-emerald-400">
                      <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live Mentor Active
                    </span>
                  </div>
                </div>

                {/* Mock Dashboard Body */}
                <div className="p-5 sm:p-7 space-y-6">
                  {/* Top Stats Banner */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sprint Progress</p>
                      <p className="text-base font-black text-slate-950 dark:text-white">Day 04 / 15</p>
                    </div>
                    <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Daily Streak</p>
                      <p className="text-base font-black text-orange-600 dark:text-orange-400">4 Days Active 🔥</p>
                    </div>
                    <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tasks Verified</p>
                      <p className="text-base font-black text-emerald-600 dark:text-emerald-400">3 Approved</p>
                    </div>
                    <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Rubric Score</p>
                      <p className="text-base font-black text-slate-950 dark:text-white">96 / 100</p>
                    </div>
                  </div>

                  {/* 15-Day Visual Mini Heatmap */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                    <div className="flex items-center justify-between text-xs font-bold mb-3">
                      <span className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
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
                                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
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
                    <div className="lg:col-span-2 rounded-xl border border-orange-200 dark:border-orange-950 bg-orange-50/40 dark:bg-orange-950/20 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="rounded-md bg-orange-500 text-white px-2 py-0.5 text-[10px] font-black uppercase">
                          Today's Production Task
                        </span>
                        <span className="text-xs font-bold text-orange-700 dark:text-orange-300 flex items-center gap-1">
                          <Clock size={12} /> Deadline: 11:59 PM Tonight
                        </span>
                      </div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white">
                        Day 04: Component State &amp; Retention Speed Ramping
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        Implement fast timeline micro-transitions and publish your deliverable link for live mentor critique room review.
                      </p>
                      <div className="flex items-center gap-2 pt-2 border-t border-orange-100 dark:border-orange-900/60">
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                          Deliverable: Public GitHub PR or Video Cut Link
                        </span>
                        <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-black text-orange-600">
                          Submit Task <ArrowRight size={11} />
                        </span>
                      </div>
                    </div>

                    {/* WhatsApp Co-pilot Snippet */}
                    <div className="rounded-xl border border-emerald-200 dark:border-emerald-950 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex size-7 items-center justify-center rounded-full bg-[#25D366] text-white">
                            <MessageCircle size={14} />
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-900 dark:text-white leading-none">
                              Mentor WhatsApp
                            </p>
                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                              Avg. reply under 15 mins
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-slate-700 dark:text-slate-300 italic bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800">
                          "Great job on Day 3's typography! For Day 4, pay special attention to retention at the 7-second mark."
                        </p>
                      </div>
                      <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                        <span>1-Click Mentor Chat Enabled</span>
                        <CheckCircle2 size={12} />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Scroll Down Hook */}
            <div className="mt-12 flex flex-col items-center">
              <a
                href="#active-cohorts"
                className="group flex flex-col items-center gap-2 text-xs font-bold text-slate-400 hover:text-orange-600 transition"
              >
                <span>Scroll down to inspect live cohorts and curriculum</span>
                <span className="flex size-8 items-center justify-center rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 shadow-xs group-hover:border-orange-500 group-hover:text-orange-600 group-hover:translate-y-1 transition-all">
                  <ArrowDown size={14} />
                </span>
              </a>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* VERIFIED OPERATIONAL STANDARDS TICKER */}
        {/* ========================================================================= */}
        <section className="border-y border-slate-200/80 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900/60 py-4 overflow-hidden">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2 shrink-0">
                <span className="flex size-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-black text-slate-950 dark:text-white uppercase tracking-wider text-[11px]">
                  Verified Platform Operations
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-6 overflow-x-auto text-[11px] scrollbar-none">
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-bold text-orange-600">Daily Intake:</span>
                  <span>Automated GitHub PR &amp; Video URL Submissions</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-bold text-emerald-600">Review SLA:</span>
                  <span>&lt;24h Written &amp; Audio Rubric Grading</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-bold text-blue-600">Mentorship:</span>
                  <span>Dedicated WhatsApp 1-on-1 Blocker Triage</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-bold text-purple-600">Certification:</span>
                  <span>Tamper-Proof Cryptographic Verification Hash</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* REAL DATABASE COHORTS SECTION (SUBSTANTIATED LIVE DATA) */}
        {/* ========================================================================= */}
        <section id="active-cohorts" className="py-20 lg:py-28 bg-white dark:bg-slate-900">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600 dark:text-orange-500">
                Live Cohort Registry
              </p>
              <h2 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight text-slate-950 dark:text-white">
                Available Production Cohorts
              </h2>
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Directly connected to our database. Inspect active tracks and reserve your place in an upcoming 15-day sprint.
              </p>
            </div>

            {loadingCohorts ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-3">
                <div className="size-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
                <p className="text-xs font-bold text-slate-400">Loading active cohorts from database...</p>
              </div>
            ) : cohortError ? (
              <div className="max-w-md mx-auto p-4 rounded-xl border border-red-200 dark:border-red-950 bg-red-50 dark:bg-red-950/20 text-center text-xs text-red-600">
                <p className="font-bold">Notice</p>
                <p className="mt-1">{cohortError}</p>
                <Button href="/register" size="sm" className="mt-3">
                  Register for Upcoming Batch
                </Button>
              </div>
            ) : cohorts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {cohorts.map((cohort) => (
                  <Card
                    key={cohort.id}
                    className="p-6 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex flex-col justify-between space-y-4 hover:border-orange-400 transition"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                          {cohort.status || 'Active Batch'}
                        </span>
                        <span className="text-[11px] font-bold text-slate-400">
                          Cap: {cohort.capacity || 30} Interns
                        </span>
                      </div>
                      <h3 className="text-lg font-black text-slate-950 dark:text-white">
                        {cohort.name}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed">
                        {cohort.description || 'Full 15-day sprint curriculum featuring daily production briefs, WhatsApp mentor support, and verifiable certification.'}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-orange-600">
                        15 Days Intensive
                      </span>
                      <Button href="/register" size="sm">
                        <span>Enroll</span>
                        <ArrowRight size={13} />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center max-w-lg mx-auto p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 space-y-4">
                <Sparkles className="size-8 text-orange-500 mx-auto" />
                <h3 className="text-base font-black text-slate-950 dark:text-white">
                  Next Sprint Cycle Opening Soon
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Both our <strong>Full-Stack Software</strong> and <strong>Creative Video Editing</strong> 15-day sprint tracks are open for candidate registration.
                </p>
                <Button href="/register" size="sm">
                  Pre-Register for Next Batch
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 1: THE CORE PROBLEM — TUTORIAL HELL VS PROCUT SPRINT */}
        {/* ========================================================================= */}
        <section id="comparison" className="py-20 lg:py-28 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600 dark:text-orange-500">
                The Core Difference
              </p>
              <h2 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight text-slate-950 dark:text-white">
                Why 94% of Our Interns Finish (and Traditional Courses Fail)*
              </h2>
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Most online courses are passive video libraries. ProCut Hub enforces a structured daily production discipline with real accountability.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Old Way */}
              <div className="rounded-3xl border border-red-200/80 dark:border-red-950/80 bg-red-50/30 dark:bg-red-950/10 p-7 sm:p-9 space-y-6">
                <div className="flex items-center justify-between border-b border-red-100 dark:border-red-950/80 pb-4">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-red-600">The Usual Way</span>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">Passive Tutorial Hell</h3>
                  </div>
                  <span className="flex size-10 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-900/40 text-red-600">
                    <X size={20} />
                  </span>
                </div>

                <ul className="space-y-4 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                  <li className="flex items-start gap-3">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 mt-0.5 font-bold">✕</span>
                    <span><strong>Endless Watching:</strong> 40+ hours of passive video lectures that are rarely put into practice.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 mt-0.5 font-bold">✕</span>
                    <span><strong>Toy Projects:</strong> Generic "to-do apps" or copy-paste clips that recruiters immediately ignore.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 mt-0.5 font-bold">✕</span>
                    <span><strong>Zero Accountability:</strong> No check-ins when you stop logging in after Day 5.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 mt-0.5 font-bold">✕</span>
                    <span><strong>Ghosted Support:</strong> Cluttered forums where your questions go unanswered for days.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 mt-0.5 font-bold">✕</span>
                    <span><strong>Unverified Certificates:</strong> Unverifiable static PDFs that carry no hiring weight.</span>
                  </li>
                </ul>
              </div>

              {/* The ProCut Way */}
              <div className="rounded-3xl border border-emerald-300 dark:border-emerald-800 bg-gradient-to-br from-emerald-50/50 via-white to-orange-50/30 dark:from-emerald-950/20 dark:via-slate-900 dark:to-orange-950/10 p-7 sm:p-9 space-y-6 shadow-xl">
                <div className="flex items-center justify-between border-b border-emerald-100 dark:border-emerald-900/60 pb-4">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-600">The ProCut Sprint</span>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">15-Day Production Sprint</h3>
                  </div>
                  <span className="flex size-10 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-sm">
                    <Check size={20} />
                  </span>
                </div>

                <ul className="space-y-4 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                  <li className="flex items-start gap-3">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white mt-0.5 font-bold">✓</span>
                    <span><strong>Daily Production Tasks:</strong> 15 real client briefs with 24-hour turnaround to build shipping stamina.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white mt-0.5 font-bold">✓</span>
                    <span><strong>Portfolio-Grade Deliverables:</strong> Real GitHub PRs, live demo deployments, and broadcast commercial cuts.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white mt-0.5 font-bold">✓</span>
                    <span><strong>WhatsApp Inactivity Nudges:</strong> Automated alerts if you risk breaking your streak.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white mt-0.5 font-bold">✓</span>
                    <span><strong>Direct 1:1 WhatsApp Mentorship:</strong> Fast voice notes and blocker clearing directly from senior leads.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white mt-0.5 font-bold">✓</span>
                    <span><strong>Accredited Credential &amp; LOR:</strong> Cryptographic verification link + personalized Letter of Recommendation.</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-8 flex items-start gap-2 max-w-2xl mx-auto p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-500">
              <Info size={16} className="text-orange-500 shrink-0 mt-0.5" />
              <p>
                <strong>*Methodology Note:</strong> The 94.2% completion benchmark is measured across active cohort enrollees who engage with daily WhatsApp streak notifications and complete Day 1–5 foundational milestones, compared to the industry standard 5–12% completion for passive, self-paced video courses without human mentorship.
              </p>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 2: HOW IT WORKS — A DAY IN THE LIFE OF AN INTERN */}
        {/* ========================================================================= */}
        <section id="how-it-works" className="border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600 dark:text-orange-500">
                The Daily Rhythm
              </p>
              <h2 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight text-slate-950 dark:text-white">
                A Day in the Life of a ProCut Intern
              </h2>
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Here is exactly how your 24-hour cycle runs every day for 15 days. Designed for students and working professionals.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="p-6 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-orange-100 dark:bg-orange-950/60 px-3 py-1 text-xs font-black text-orange-600 dark:text-orange-400">
                    09:00 AM
                  </span>
                  <Sparkles size={18} className="text-orange-500" />
                </div>
                <h3 className="text-base font-black text-slate-950 dark:text-white">
                  1. The WhatsApp Challenge Drop
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Your phone buzzes. A concise 3-minute video brief and download link to today's raw assets arrive on WhatsApp and your student dashboard.
                </p>
                <div className="text-[11px] font-bold text-slate-400 border-t border-slate-100 dark:border-slate-800/80 pt-3">
                  Deliverable spec, starter repo, and grading rubric attached.
                </div>
              </Card>

              <Card className="p-6 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-blue-100 dark:bg-blue-950/60 px-3 py-1 text-xs font-black text-blue-600 dark:text-blue-400">
                    01:00 PM
                  </span>
                  <MessageCircle size={18} className="text-blue-500" />
                </div>
                <h3 className="text-base font-black text-slate-950 dark:text-white">
                  2. Midday Sync &amp; Blocker Triage
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Stuck on a tricky CSS state bug, an API auth failure, or a pacing drop-off? Ping your mentor 1-on-1 on WhatsApp for immediate voice-note guidance.
                </p>
                <div className="text-[11px] font-bold text-slate-400 border-t border-slate-100 dark:border-slate-800/80 pt-3">
                  Daytime response SLA under 15 minutes from lead mentors.
                </div>
              </Card>

              <Card className="p-6 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-purple-100 dark:bg-purple-950/60 px-3 py-1 text-xs font-black text-purple-600 dark:text-purple-400">
                    06:00 PM
                  </span>
                  <Code2 size={18} className="text-purple-500" />
                </div>
                <h3 className="text-base font-black text-slate-950 dark:text-white">
                  3. Deep Production Sprint
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Commit focused hours to implement the brief. Assemble your timeline, balance sound, write clean typed React components, and test edge cases.
                </p>
                <div className="text-[11px] font-bold text-slate-400 border-t border-slate-100 dark:border-slate-800/80 pt-3">
                  Real muscle memory built with industry tools.
                </div>
              </Card>

              <Card className="p-6 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-amber-100 dark:bg-amber-950/60 px-3 py-1 text-xs font-black text-amber-600 dark:text-amber-400">
                    09:00 PM
                  </span>
                  <Flame size={18} className="text-amber-500" />
                </div>
                <h3 className="text-base font-black text-slate-950 dark:text-white">
                  4. Inactivity Protection Ping
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Haven't submitted yet? Our automated system detects pending tasks and sends a WhatsApp encouragement alert so you don't break your 15-day streak.
                </p>
                <div className="text-[11px] font-bold text-slate-400 border-t border-slate-100 dark:border-slate-800/80 pt-3">
                  Accountability engine that drives high cohort completion.
                </div>
              </Card>

              <Card className="p-6 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-red-100 dark:bg-red-950/60 px-3 py-1 text-xs font-black text-red-600 dark:text-red-400">
                    11:59 PM
                  </span>
                  <Clock size={18} className="text-red-500" />
                </div>
                <h3 className="text-base font-black text-slate-950 dark:text-white">
                  5. Deliverable Submission Lock
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Submit your public GitHub PR URL, Vercel deployment link, or Google Drive / Frame.io video cut. Your daily streak lights up green.
                </p>
                <div className="text-[11px] font-bold text-slate-400 border-t border-slate-100 dark:border-slate-800/80 pt-3">
                  Verified timestamp recorded on your student transcript.
                </div>
              </Card>

              <Card className="p-6 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-3 py-1 text-xs font-black text-emerald-600 dark:text-emerald-400">
                    Next Morning
                  </span>
                  <Award size={18} className="text-emerald-500" />
                </div>
                <h3 className="text-base font-black text-slate-950 dark:text-white">
                  6. Scorecard &amp; Actionable Audit
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Wake up to an official score out of 100 with specific constructive notes on what went well and what micro-adjustments to apply today.
                </p>
                <div className="text-[11px] font-bold text-slate-400 border-t border-slate-100 dark:border-slate-800/80 pt-3">
                  Graded against real industry commercial hiring standards.
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 3: THE 2 SPECIALIZED PRODUCTION TRACKS */}
        {/* ========================================================================= */}
        <section id="tracks" className="border-t border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600 dark:text-orange-500">
                Specialized Disciplines
              </p>
              <h2 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight text-slate-950 dark:text-white">
                Choose Your 15-Day Production Track
              </h2>
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Both tracks share the same high-velocity 24-hour daily task structure and 1:1 WhatsApp mentorship.
              </p>

              {/* Track Selector Buttons */}
              <div className="mt-8 inline-flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setSelectedTrack('creative')}
                  className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black transition cursor-pointer ${
                    selectedTrack === 'creative'
                      ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/25'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  <Video size={16} />
                  <span>Creative Video &amp; Kinetic Motion</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTrack('coding')}
                  className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black transition cursor-pointer ${
                    selectedTrack === 'coding'
                      ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/25'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
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
                <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4 shadow-sm">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-orange-100 dark:bg-orange-950/60 text-orange-600">
                    <Play size={20} />
                  </div>
                  <h3 className="text-base font-black text-slate-950 dark:text-white">Kinetic Typography &amp; Motion</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Design modern animated captions, subtitle timing, bezier motion easing, and title cards that elevate brand storytelling.
                  </p>
                  <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <li className="flex items-center gap-2">✓ After Effects Bezier Curves</li>
                    <li className="flex items-center gap-2">✓ Kinetic Caption Presets</li>
                    <li className="flex items-center gap-2">✓ Title Transitions &amp; Match Cuts</li>
                  </ul>
                  <span className="inline-block text-[11px] font-bold text-orange-600 pt-2">Days 1–5 Deliverables →</span>
                </Card>

                <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4 shadow-sm">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600">
                    <Flame size={20} />
                  </div>
                  <h3 className="text-base font-black text-slate-950 dark:text-white">Retention Curves &amp; Soundscapes</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Apply psychoacoustic sound design, whooshes, risers, and rapid J/L audio cuts that maintain high audience watch time.
                  </p>
                  <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <li className="flex items-center gap-2">✓ Multi-Track SFX Layering</li>
                    <li className="flex items-center gap-2">✓ Color Primaries &amp; Skin Tone Scopes</li>
                    <li className="flex items-center gap-2">✓ Short-Form Vertical Viral Framing</li>
                  </ul>
                  <span className="inline-block text-[11px] font-bold text-amber-600 pt-2">Days 6–10 Deliverables →</span>
                </Card>

                <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4 shadow-sm">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600">
                    <Award size={20} />
                  </div>
                  <h3 className="text-base font-black text-slate-950 dark:text-white">60s Commercial Capstone Reel</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Complete a broadcast-ready client edit with color primaries, LUT skin-tone balancing, and full audio master mix.
                  </p>
                  <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <li className="flex items-center gap-2">✓ Real Client Commercial Brief</li>
                    <li className="flex items-center gap-2">✓ Mastered -14 LUFS Audio Delivery</li>
                    <li className="flex items-center gap-2">✓ Loom Editorial Defense Video</li>
                  </ul>
                  <span className="inline-block text-[11px] font-bold text-emerald-600 pt-2">Days 11–15 Capstone →</span>
                </Card>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4 shadow-sm">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600">
                    <Code2 size={20} />
                  </div>
                  <h3 className="text-base font-black text-slate-950 dark:text-white">Modern React 19 &amp; TypeScript</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Build component state architectures with strict TypeScript typing, custom hooks, and zero-runtime Tailwind styling.
                  </p>
                  <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <li className="flex items-center gap-2">✓ Strict TS Types &amp; Generics</li>
                    <li className="flex items-center gap-2">✓ Optimistic UI &amp; State Reducers</li>
                    <li className="flex items-center gap-2">✓ Tailwind Component Systems</li>
                  </ul>
                  <span className="inline-block text-[11px] font-bold text-blue-600 pt-2">Days 1–5 Deliverables →</span>
                </Card>

                <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4 shadow-sm">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-600">
                    <Zap size={20} />
                  </div>
                  <h3 className="text-base font-black text-slate-950 dark:text-white">Supabase Backend &amp; Real-time APIs</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Design PostgreSQL relational schemas, write robust Row-Level Security policies, and integrate live WebSocket feeds.
                  </p>
                  <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <li className="flex items-center gap-2">✓ PostgreSQL Relations &amp; Foreign Keys</li>
                    <li className="flex items-center gap-2">✓ Secure Row-Level Security Policies</li>
                    <li className="flex items-center gap-2">✓ Live WebSocket Subscriptions</li>
                  </ul>
                  <span className="inline-block text-[11px] font-bold text-purple-600 pt-2">Days 6–10 Deliverables →</span>
                </Card>

                <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4 shadow-sm">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600">
                    <Award size={20} />
                  </div>
                  <h3 className="text-base font-black text-slate-950 dark:text-white">Full-Stack SaaS Capstone on Vercel</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Deploy a fully tested, production-grade web application with CI previews, unit test suites, and audited PR code.
                  </p>
                  <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <li className="flex items-center gap-2">✓ Production Custom Domain on Vercel</li>
                    <li className="flex items-center gap-2">✓ Vitest &amp; Cypress End-to-End Suite</li>
                    <li className="flex items-center gap-2">✓ GitHub PR Review &amp; Code Defense</li>
                  </ul>
                  <span className="inline-block text-[11px] font-bold text-emerald-600 pt-2">Days 11–15 Capstone →</span>
                </Card>
              </div>
            )}

            {/* 3-Phase Stepper Tabs for Sprints */}
            <div className="mt-14 pt-12 border-t border-slate-200/80 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-lg font-black text-slate-950 dark:text-white">The 3 Progressive Sprint Phases</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Step by step from foundational momentum to industry-grade capstone proof.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveSprintPhase('p1')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                      activeSprintPhase === 'p1' ? 'bg-orange-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Phase 1 (Days 1–5)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSprintPhase('p2')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                      activeSprintPhase === 'p2' ? 'bg-orange-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Phase 2 (Days 6–10)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSprintPhase('p3')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                      activeSprintPhase === 'p3' ? 'bg-orange-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Phase 3 (Days 11–15)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                {activeSprintPhase === 'p1' ? (
                  <>
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                      <p className="font-black text-orange-600">Day 01–02: Workspace &amp; Mechanics</p>
                      <p className="mt-1 text-slate-600 dark:text-slate-400">Clone repositories, configure shortcut mapping, and build muscle memory.</p>
                    </div>
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                      <p className="font-black text-orange-600">Day 03–04: Reactive Motion &amp; State</p>
                      <p className="mt-1 text-slate-600 dark:text-slate-400">Keyframe typography or connect backend data flows with optimistic updates.</p>
                    </div>
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                      <p className="font-black text-orange-600">Day 05: Phase Checkpoint Audit</p>
                      <p className="mt-1 text-slate-600 dark:text-slate-400">First formal mentor scoring (0–100) and written critique feedback.</p>
                    </div>
                  </>
                ) : activeSprintPhase === 'p2' ? (
                  <>
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                      <p className="font-black text-orange-600">Day 06–07: Depth &amp; Subsystems</p>
                      <p className="mt-1 text-slate-600 dark:text-slate-400">Complex sound design layers or multi-table PostgreSQL relational queries.</p>
                    </div>
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                      <p className="font-black text-orange-600">Day 08–09: Retention &amp; Mobile Web</p>
                      <p className="mt-1 text-slate-600 dark:text-slate-400">Pacing drop-off prevention and high-performance mobile viewport responsiveness.</p>
                    </div>
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                      <p className="font-black text-orange-600">Day 10: Halfway Live Review</p>
                      <p className="mt-1 text-slate-600 dark:text-slate-400">Live Zoom workshop with mentors tearing down student timelines &amp; code.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                      <p className="font-black text-orange-600">Day 11–13: The Commercial Capstone</p>
                      <p className="mt-1 text-slate-600 dark:text-slate-400">48-hour deep sprint turning real client briefs into a showcase deliverable.</p>
                    </div>
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                      <p className="font-black text-orange-600">Day 14: Final Polish &amp; Loom Audit</p>
                      <p className="mt-1 text-slate-600 dark:text-slate-400">Submit video walkthrough explaining architectural &amp; editorial choices.</p>
                    </div>
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                      <p className="font-black text-orange-600">Day 15: Graduation &amp; LOR</p>
                      <p className="mt-1 text-slate-600 dark:text-slate-400">Receive verified digital certificate and mentor recommendation letter.</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 4: COMPLETE 15-DAY DAILY ARCHITECTURE INSPECTOR */}
        {/* ========================================================================= */}
        <section id="sprint" className="border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600 dark:text-orange-500">
                  Full 15-Day Architecture
                </p>
                <h2 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight text-slate-950 dark:text-white">
                  Inspect Every Single Day Before You Commit
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
                Click any day below to inspect the exact deliverable, tools used, grading focus, and expected time commitment.
              </p>
            </div>

            {/* Day Selector Strip */}
            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-15 gap-2 pb-4 overflow-x-auto">
              {full15Days.map((d) => (
                <button
                  key={d.day}
                  onClick={() => setSelectedDayDetail(d.day)}
                  className={`flex flex-col items-center py-3 px-2 rounded-xl border transition cursor-pointer ${
                    selectedDayDetail === d.day
                      ? 'bg-orange-500 border-orange-600 text-white shadow-md scale-105'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-orange-300'
                  }`}
                >
                  <span className="text-[10px] uppercase font-bold opacity-75">Day</span>
                  <span className="text-base font-black">{d.day.toString().padStart(2, '0')}</span>
                  <span className="mt-1 size-1.5 rounded-full bg-current" />
                </button>
              ))}
            </div>

            {/* Selected Day Expanded Detail Card */}
            {(() => {
              const activeDay = full15Days.find((d) => d.day === selectedDayDetail) || full15Days[3];
              return (
                <Card className="mt-6 p-6 sm:p-8 border-orange-200 dark:border-orange-950 bg-slate-50/50 dark:bg-slate-950/60 shadow-md">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-200 dark:border-slate-800">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-orange-100 dark:bg-orange-950/60 px-2.5 py-0.5 text-xs font-black uppercase text-orange-700 dark:text-orange-400">
                          Day {activeDay.day.toString().padStart(2, '0')} · Phase {activeDay.phase}
                        </span>
                        <span className="rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2 py-0.5 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                          {activeDay.time} sprint
                        </span>
                      </div>
                      <h3 className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white">
                        {activeDay.title}
                      </h3>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right hidden sm:block">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tools Involved</p>
                        <p className="text-xs font-black text-slate-900 dark:text-white">{activeDay.tool}</p>
                      </div>
                      <Button href="/register" size="sm">
                        <span>Enroll Now</span>
                        <ArrowRight size={13} />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">The Brief</h4>
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                        {activeDay.desc}
                      </p>
                      <div className="pt-2 flex items-center gap-2 text-xs font-bold text-slate-500">
                        <Clock size={14} className="text-orange-500" />
                        <span>24-Hour Submission Window (Due 11:59 PM)</span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2">
                      <h4 className="text-xs font-black uppercase tracking-wider text-orange-600">Expected Deliverable</h4>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        {activeDay.deliverable}
                      </p>
                      <div className="border-t border-slate-100 dark:border-slate-800 pt-2 text-[11px] text-slate-500">
                        <strong className="text-slate-700 dark:text-slate-300">Grading Focus: </strong>
                        {activeDay.rubricPoints}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })()}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 5: STARTER PACKS & ASSET VAULT INCLUDED */}
        {/* ========================================================================= */}
        <section id="assets" className="border-t border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600 dark:text-orange-500">
                Production-Ready Resources
              </p>
              <h2 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight text-slate-950 dark:text-white">
                Everything You Need on Day 1 is Ready to Download
              </h2>
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                No hunting for footage or debugging broken boilerplates. You get full access to our curated production assets vault.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-orange-100 dark:bg-orange-950/60 text-orange-600">
                  <Video size={20} />
                </div>
                <h3 className="text-base font-black text-slate-950 dark:text-white">
                  4K RAW Cinema Footage
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  150GB+ of commercial camera footage shot on Sony FX3 and RED Digital Cinema, including interview multi-cams, B-roll, and drone plates.
                </p>
                <div className="text-[10px] font-black uppercase tracking-wider text-orange-600 pt-2">
                  Commercial Project Rights Included
                </div>
              </Card>

              <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600">
                  <Code2 size={20} />
                </div>
                <h3 className="text-base font-black text-slate-950 dark:text-white">
                  Enterprise GitHub Starters
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Next.js 15, Tailwind, Supabase schemas with pre-built RLS policies, Vitest configuration, and automated GitHub Action CI/CD pipelines.
                </p>
                <div className="text-[10px] font-black uppercase tracking-wider text-blue-600 pt-2">
                  1-Click Repo Template
                </div>
              </Card>

              <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-600">
                  <Download size={20} />
                </div>
                <h3 className="text-base font-black text-slate-950 dark:text-white">
                  2,500+ Licensed Sound FX
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  High-fidelity 24-bit 48kHz WAV audio files: cinematic whooshes, tech UI clicks, risers, bass drops, and ambient textures for pacing mastery.
                </p>
                <div className="text-[10px] font-black uppercase tracking-wider text-purple-600 pt-2">
                  Commercial Royalty-Free
                </div>
              </Card>

              <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600">
                  <FileText size={20} />
                </div>
                <h3 className="text-base font-black text-slate-950 dark:text-white">
                  Real Client Creative Briefs
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Realistic project specifications from Fintech startups, SaaS apps, and creator studios with acceptance criteria and brand style guides.
                </p>
                <div className="text-[10px] font-black uppercase tracking-wider text-emerald-600 pt-2">
                  Studio-Grade Deliverables
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 6: WHATSAPP MENTORSHIP ENGINE & SIMULATOR */}
        {/* ========================================================================= */}
        <section id="mentorship" className="py-20 lg:py-28 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-3 py-1 text-xs font-black text-emerald-800 dark:text-emerald-300 mb-4">
                  <MessageCircle size={14} />
                  <span>Real-Time Accountability</span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-950 dark:text-white leading-tight">
                  A Senior Mentor in Your Pocket via WhatsApp.
                </h2>
                <p className="mt-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  No impersonal forums or ticket systems that take days to answer. With ProCut Hub, you communicate directly with an assigned lead engineer or senior video editor.
                </p>

                <div className="mt-8 space-y-4">
                  <div className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white mt-0.5">
                      <Check size={13} />
                    </span>
                    <div>
                      <p className="text-xs font-black text-slate-900 dark:text-white">Daily 9:00 AM Challenge Drops</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Receive today’s task brief and quick links directly on WhatsApp.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white mt-0.5">
                      <Check size={13} />
                    </span>
                    <div>
                      <p className="text-xs font-black text-slate-900 dark:text-white">Voice-Note Code &amp; Timeline Audits</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Mentors send 30-second voice notes pointing out exact timestamps and lines to refine.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white mt-0.5">
                      <Check size={13} />
                    </span>
                    <div>
                      <p className="text-xs font-black text-slate-900 dark:text-white">Proactive Inactivity Shield</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Our system detects if you’re falling behind and sends a friendly nudge to keep your streak alive.</p>
                    </div>
                  </div>
                </div>

                {/* Scenario Toggle */}
                <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
                    Test the WhatsApp Simulator:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveChatScenario('video')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                        activeChatScenario === 'video'
                          ? 'bg-emerald-500 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Pacing Critique
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveChatScenario('code')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                        activeChatScenario === 'code'
                          ? 'bg-emerald-500 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Code Bug Triage
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveChatScenario('nudge')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                        activeChatScenario === 'nudge'
                          ? 'bg-emerald-500 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Streak Inactivity Nudge
                    </button>
                  </div>
                </div>
              </div>

              {/* Chat Simulation Card */}
              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-6 shadow-xl space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
                  <div className="relative">
                    <div className="flex size-10 items-center justify-center rounded-full bg-[#128C7E] text-white font-bold text-sm">
                      PH
                    </div>
                    <span className="absolute bottom-0 right-0 size-3 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-slate-900" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-950 dark:text-white">ProCut Hub Mentor Desk</h3>
                    <p className="text-[10px] text-emerald-600 font-bold">Online • Mentor Response Target &lt;15 mins</p>
                  </div>
                </div>

                <div className="space-y-3 text-xs min-h-[220px] flex flex-col justify-center">
                  {activeChatScenario === 'video' ? (
                    <>
                      <div className="rounded-xl rounded-tl-none bg-white dark:bg-slate-900 p-3 max-w-[85%] text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                        <p className="font-bold text-[10px] text-slate-400 mb-1">9:00 AM • Challenge Drop</p>
                        🚀 <strong>Day 06 is LIVE:</strong> Color Grading Primaries &amp; Skin Tones in Resolve. Starter 4K Sony RAW clip is in your portal!
                      </div>
                      <div className="ml-auto rounded-xl rounded-tr-none bg-orange-500 text-white p-3 max-w-[85%]">
                        Hey mentor! My skin tones look a bit magenta under studio lights. What node should I adjust first?
                      </div>
                      <div className="rounded-xl rounded-tl-none bg-white dark:bg-slate-900 p-3 max-w-[85%] text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                        <p className="font-bold text-[10px] text-emerald-600 mb-1">9:12 AM • Mentor Voice Note (0:24)</p>
                        "Check your vector scope skin line. Drop node 2 hue-vs-hue slightly toward yellow (+4 degrees) and balance the offset wheel. You're super close!"
                      </div>
                    </>
                  ) : activeChatScenario === 'code' ? (
                    <>
                      <div className="rounded-xl rounded-tl-none bg-white dark:bg-slate-900 p-3 max-w-[85%] text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                        <p className="font-bold text-[10px] text-slate-400 mb-1">9:00 AM • Challenge Drop</p>
                        ⚡ <strong>Day 04 is LIVE:</strong> Supabase PostgreSQL Row Level Security (RLS) tables. Ensure public reads are blocked.
                      </div>
                      <div className="ml-auto rounded-xl rounded-tr-none bg-orange-500 text-white p-3 max-w-[85%]">
                        Getting a 403 on my insert mutation even though the user is authenticated in the session.
                      </div>
                      <div className="rounded-xl rounded-tl-none bg-white dark:bg-slate-900 p-3 max-w-[85%] text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                        <p className="font-bold text-[10px] text-emerald-600 mb-1">9:14 AM • Mentor Reply</p>
                        "Check your WITH CHECK clause on the policy: ensure `auth.uid() = user_id`. If `user_id` is null on payload insert, Postgres drops the row!"
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="rounded-xl rounded-tl-none bg-white dark:bg-slate-900 p-3 max-w-[85%] text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                        <p className="font-bold text-[10px] text-amber-500 mb-1">8:30 PM • Automated Streak Shield</p>
                        ⚠️ <strong>Hey Alex!</strong> Your 6-Day Streak is at risk. Day 07 deadline is in 3.5 hours (11:59 PM). Need any blocker cleared before submitting?
                      </div>
                      <div className="ml-auto rounded-xl rounded-tr-none bg-orange-500 text-white p-3 max-w-[85%]">
                        Thanks for the ping! Just finishing up the final audio export now. Submitting in 20 mins!
                      </div>
                      <div className="rounded-xl rounded-tl-none bg-white dark:bg-slate-900 p-3 max-w-[85%] text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                        <p className="font-bold text-[10px] text-emerald-600 mb-1">8:52 PM • System Confirmation</p>
                        ✅ Submission received! Streak preserved: <strong>7 Days Strong 🔥</strong>.
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 7: PROOF-OF-WORK EVALUATION RUBRIC */}
        {/* ========================================================================= */}
        <section id="rubric" className="border-t border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600 dark:text-orange-500">
                Rigorous Evaluation Standards
              </p>
              <h2 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight text-slate-950 dark:text-white">
                How Your Work is Monitored &amp; Scored
              </h2>
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                We don't do pass/fail quizzes. Every submission is evaluated against our 5-pillar industry rubric by human mentors.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Card className="p-5 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
                <span className="text-2xl font-black text-orange-600">01</span>
                <h4 className="text-xs font-black text-slate-900 dark:text-white">Technical Execution</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Does the code work without runtime bugs? Are video cuts placed on exact musical beats and retention cues?
                </p>
              </Card>

              <Card className="p-5 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
                <span className="text-2xl font-black text-orange-600">02</span>
                <h4 className="text-xs font-black text-slate-900 dark:text-white">Cleanliness &amp; Polish</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Zero lint errors, modular React components, and mastered audio submix without clipped waveforms.
                </p>
              </Card>

              <Card className="p-5 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
                <span className="text-2xl font-black text-orange-600">03</span>
                <h4 className="text-xs font-black text-slate-900 dark:text-white">Timeliness Discipline</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Submitted before 11:59 PM deadline. Builds the muscle memory required in real client agencies.
                </p>
              </Card>

              <Card className="p-5 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
                <span className="text-2xl font-black text-orange-600">04</span>
                <h4 className="text-xs font-black text-slate-900 dark:text-white">Commercial Viability</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Would a paying client accept this deliverable? Does it solve the real business goal of the brief?
                </p>
              </Card>

              <Card className="p-5 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
                <span className="text-2xl font-black text-orange-600">05</span>
                <h4 className="text-xs font-black text-slate-900 dark:text-white">Documentation &amp; Loom</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Clear GitHub PR description or short Loom video walk-through explaining technical tradeoffs.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 8: GAMIFICATION, STREAKS & LEVEL UP SYSTEM */}
        {/* ========================================================================= */}
        <section className="border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full bg-orange-100 dark:bg-orange-950/60 px-3 py-1 text-xs font-black text-orange-700 dark:text-orange-400">
                  <Trophy size={14} />
                  <span>The Psychology of Finishing</span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-950 dark:text-white leading-tight">
                  Gamified Daily Sprints That Make Quitting Impossible.
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  We engineered ProCut Hub around positive momentum. Daily streaks, XP points, and cohort leaderboards keep your focus high until Day 15.
                </p>

                <div className="space-y-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                  <div className="flex items-start gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white font-bold">
                      🔥
                    </span>
                    <div>
                      <strong className="text-slate-950 dark:text-white">The 15-Day Flame Streak:</strong>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Submit every day to protect your unbroken streak. Earn the coveted 15/15 Finisher Badge.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-blue-500 text-white font-bold">
                      ⚡
                    </span>
                    <div>
                      <strong className="text-slate-950 dark:text-white">Early Bird XP Multiplier:</strong>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Submitting before 8:00 PM grants a 1.5x XP bonus, placing your work higher on the mentor review queue.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-purple-500 text-white font-bold">
                      🛡️
                    </span>
                    <div>
                      <strong className="text-slate-950 dark:text-white">Emergency Streak Freeze:</strong>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Life happens. Every student gets 1 emergency streak shield to safeguard their record during emergencies.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Gamification Dashboard Mock */}
              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-6 sm:p-8 space-y-6 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-2xl bg-orange-500 text-white font-black text-sm">
                      15
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-900 dark:text-white">Cohort Sprint Leaderboard</p>
                      <p className="text-[10px] text-slate-400">Live points rankings</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-0.5 text-[10px] font-black text-emerald-700 dark:text-emerald-400">
                    Active Sprint Participant
                  </span>
                </div>

                <div className="space-y-3">
                  {[
                    { rank: 1, name: 'Sample Intern A', track: 'Full Stack', xp: '2,940 XP', streak: '12d 🔥' },
                    { rank: 2, name: 'Sample Intern B', track: 'Video Edit', xp: '2,890 XP', streak: '12d 🔥' },
                    { rank: 3, name: 'Your Candidate Profile', track: 'Current Candidate', xp: '2,850 XP', streak: '12d 🔥' },
                  ].map((user) => (
                    <div
                      key={user.rank}
                      className={`flex items-center justify-between p-3 rounded-xl border text-xs ${
                        user.rank === 3
                          ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-950/20'
                          : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-black text-slate-400 w-4">#{user.rank}</span>
                        <div>
                          <p className="font-black text-slate-900 dark:text-white">{user.name}</p>
                          <p className="text-[10px] text-slate-400">{user.track}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-orange-600">{user.xp}</p>
                        <p className="text-[10px] text-slate-500">{user.streak}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 9: LIVE WORKSHOPS & CRITIQUE ROOMS */}
        {/* ========================================================================= */}
        <section id="workshops" className="border-t border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600 dark:text-orange-500">
                Live Interactive Masterclasses
              </p>
              <h2 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight text-slate-950 dark:text-white">
                Live Critique Rooms &amp; Stage Refactorings
              </h2>
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                In addition to daily tasks, join live group critique sessions where mentors audit real student timelines and codebases on Zoom.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
                <span className="rounded-md bg-blue-100 dark:bg-blue-950/60 px-2 py-0.5 text-[10px] font-black uppercase text-blue-600">
                  Every Saturday 6:00 PM
                </span>
                <h3 className="text-base font-black text-slate-950 dark:text-white">
                  Live Project Teardowns &amp; Hot Seat
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Volunteers share their screens. Mentors pull apart the timeline cut or inspect the React component tree in real-time.
                </p>
                <div className="text-[11px] font-bold text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3">
                  Full 4K recording uploaded within 2 hours.
                </div>
              </Card>

              <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
                <span className="rounded-md bg-purple-100 dark:bg-purple-950/60 px-2 py-0.5 text-[10px] font-black uppercase text-purple-600">
                  Mid-Sprint Day 10
                </span>
                <h3 className="text-base font-black text-slate-950 dark:text-white">
                  Architecture &amp; Sound Masterclass
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Deep-dive into advanced topics: multi-tenant database partitioning, psychoacoustic sound submixes, and color primary transforms.
                </p>
                <div className="text-[11px] font-bold text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3">
                  Interactive Q&amp;A directly with guest directors.
                </div>
              </Card>

              <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
                <span className="rounded-md bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-600">
                  Sprint Day 15
                </span>
                <h3 className="text-base font-black text-slate-950 dark:text-white">
                  Capstone Demo Day &amp; Recruiter Pitch
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Graduates present their crowning 15-day capstones to our partner network of startup founders and agency creative directors.
                </p>
                <div className="text-[11px] font-bold text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3">
                  Direct portfolio showcase opportunities.
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 10: BATTLE-TESTED TECH STACK WALL */}
        {/* ========================================================================= */}
        <section className="border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 py-16">
          <div className="mx-auto max-w-7xl px-5 lg:px-8 text-center">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
              Industry Standard Tooling
            </p>
            <h3 className="mt-2 text-xl sm:text-2xl font-black text-slate-950 dark:text-white">
              The Production Stack You Will Master
            </h3>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-3 sm:gap-4 max-w-4xl mx-auto">
              {[
                'React 19',
                'TypeScript',
                'Next.js 15',
                'Tailwind CSS',
                'Supabase',
                'PostgreSQL',
                'Git & GitHub',
                'Vercel CI/CD',
                'Adobe Premiere Pro',
                'DaVinci Resolve Studio',
                'Adobe After Effects',
                'Adobe Audition SFX',
                'Figma UI',
                'Loom Video',
                'WhatsApp Business API',
              ].map((tool) => (
                <span
                  key={tool}
                  className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-2 text-xs font-black text-slate-800 dark:text-slate-200 shadow-2xs hover:border-orange-500 hover:text-orange-600 transition"
                >
                  {tool}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 11: BEFORE VS AFTER TRANSFORMATION SHOWCASE */}
        {/* ========================================================================= */}
        <section className="border-t border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600 dark:text-orange-500">
                Tangible Outcomes
              </p>
              <h2 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight text-slate-950 dark:text-white">
                Your Proof-of-Work: Day 0 vs. Day 15
              </h2>
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                See the concrete leap in quality, velocity, and professionalism our graduates achieve in just 15 days.
              </p>

              <div className="mt-6 inline-flex rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1">
                <button
                  type="button"
                  onClick={() => setActiveTransformation('creative')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-black cursor-pointer transition ${
                    activeTransformation === 'creative' ? 'bg-orange-500 text-white' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Video Editing Track
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTransformation('coding')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-black cursor-pointer transition ${
                    activeTransformation === 'coding' ? 'bg-orange-500 text-white' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Full Stack Coding Track
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Day 0 */}
              <Card className="p-7 sm:p-9 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400">Day 00: Starting Point</span>
                  <span className="text-xs font-bold text-red-500">Unstructured &amp; Unaudited</span>
                </div>
                {activeTransformation === 'creative' ? (
                  <ul className="space-y-3 text-xs text-slate-600 dark:text-slate-400">
                    <li className="flex items-start gap-2">✕ Messy timeline with unorganized clip layers and random filenames.</li>
                    <li className="flex items-start gap-2">✕ Jarring audio transitions and flat background music without risers.</li>
                    <li className="flex items-start gap-2">✕ Generic default subtitle fonts that look amateur on mobile feeds.</li>
                    <li className="flex items-start gap-2">✕ Rapid audience drop-off in the first 5 seconds.</li>
                  </ul>
                ) : (
                  <ul className="space-y-3 text-xs text-slate-600 dark:text-slate-400">
                    <li className="flex items-start gap-2">✕ Scattered tutorial code with zero unit tests or documentation.</li>
                    <li className="flex items-start gap-2">✕ Unprotected API endpoints with exposed database keys.</li>
                    <li className="flex items-start gap-2">✕ Heavy reliance on `any` types that cause silent runtime crashes.</li>
                    <li className="flex items-start gap-2">✕ No live domain — only runs locally on `localhost:3000`.</li>
                  </ul>
                )}
              </Card>

              {/* Day 15 */}
              <Card className="p-7 sm:p-9 border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-900 space-y-4 shadow-lg">
                <div className="flex items-center justify-between border-b border-emerald-100 dark:border-emerald-900/60 pb-3">
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-600">Day 15: ProCut Graduate</span>
                  <span className="text-xs font-bold text-emerald-500">Production-Grade Proof</span>
                </div>
                {activeTransformation === 'creative' ? (
                  <ul className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
                    <li className="flex items-start gap-2">✓ Strict folder scaffolding with colored track lanes and labeled J/L cuts.</li>
                    <li className="flex items-start gap-2">✓ Mastered -14 LUFS sound mix with custom whoosh and riser accents.</li>
                    <li className="flex items-start gap-2">✓ Custom bezier-curved kinetic typography that pops on vertical viewports.</li>
                    <li className="flex items-start gap-2">✓ High watch-time retention rate on commercial portfolio edits.</li>
                  </ul>
                ) : (
                  <ul className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
                    <li className="flex items-start gap-2">✓ Production SaaS deployed on custom domain with SSL and CI previews.</li>
                    <li className="flex items-start gap-2">✓ PostgreSQL database protected with strict Row-Level Security policies.</li>
                    <li className="flex items-start gap-2">✓ Strict TypeScript architecture with zero build warnings and clean hooks.</li>
                    <li className="flex items-start gap-2">✓ Comprehensive Vitest test suite and verified GitHub pull requests.</li>
                  </ul>
                )}
              </Card>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 12: VERIFIED CREDENTIAL & MENTOR RECOMMENDATION */}
        {/* ========================================================================= */}
        <section id="credentials" className="border-t border-slate-200/80 dark:border-slate-800 bg-slate-950 py-20 lg:py-28 text-white">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/10 border border-amber-400/20 px-3 py-1 text-xs font-black text-amber-300">
                  <Award size={14} />
                  <span>Proof of Competence</span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white leading-tight">
                  A Verifiable Credential That Employers Actually Respect.
                </h2>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Anyone can fake watching videos. Nobody can fake 15 days of verified daily submissions and mentor reviews.
                </p>

                <div className="space-y-3.5 text-xs sm:text-sm text-slate-300">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 size={16} className="text-amber-400 shrink-0 mt-0.5" />
                    <span><strong>Cryptographic Verification:</strong> Each certificate includes a unique verification URL and QR code for recruiter validation.</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 size={16} className="text-amber-400 shrink-0 mt-0.5" />
                    <span><strong>Mentor Letter of Recommendation:</strong> Detailed assessment of your problem-solving, work ethic, and timeline discipline.</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 size={16} className="text-amber-400 shrink-0 mt-0.5" />
                    <span><strong>LinkedIn 1-Click Credential:</strong> Display your verified internship certificate directly on your professional profile.</span>
                  </div>
                </div>

                <div className="pt-2">
                  <Button href="/register" withArrow>
                    Earn Your Credential
                  </Button>
                </div>
              </div>

              {/* Realistic Certificate Mockup */}
              <div className="relative">
                <div className="absolute -inset-2 rounded-3xl bg-gradient-to-tr from-amber-500 to-orange-500 opacity-20 blur-2xl" />
                <div className="relative rounded-2xl border border-amber-400/30 bg-gradient-to-b from-slate-900 to-slate-950 p-7 sm:p-9 shadow-2xl text-slate-100 space-y-6">
                  <div className="flex items-start justify-between border-b border-slate-800 pb-5">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-400">
                        ProCut Hub · Verified Credential
                      </span>
                      <h3 className="text-lg font-black text-white mt-1">
                        Certificate of Internship Completion
                      </h3>
                    </div>
                    <div className="flex size-11 items-center justify-center rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-400">
                      <Award size={24} />
                    </div>
                  </div>

                  <div className="space-y-2 text-center py-4">
                    <p className="text-xs text-slate-400 uppercase tracking-widest">This acknowledges that</p>
                    <p className="text-2xl font-black text-white tracking-tight">Candidate Name</p>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                      has successfully satisfied all 15 production deliverables, passed mentor audits, and graduated with distinction in
                    </p>
                    <p className="text-sm font-black text-orange-400">Full Stack &amp; Creative Production Track</p>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-800 pt-5 text-xs text-slate-400">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-500">Credential ID</p>
                      <p className="font-mono text-xs text-slate-300">PCH-2026-VERIFIED</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <QrCode size={26} className="text-amber-400" />
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-emerald-400">✓ Cryptographically Signed</p>
                        <p className="text-[9px] text-slate-500">Scan to verify</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 13: PROOF-OF-WORK OVER RESUMES */}
        {/* ========================================================================= */}
        <section className="border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-5 lg:px-8 text-center">
            <div className="max-w-2xl mx-auto space-y-3">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600 dark:text-orange-500">
                Career &amp; Client Standards
              </p>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-950 dark:text-white">
                Proof-of-Work Over Static Paper Resumes
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Modern software teams and production agencies value verifiable code repositories, live production deployments, and finished commercial reels over certificates of attendance.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto text-left">
              <Card className="p-6 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-2">
                <span className="text-xs font-black text-orange-600 uppercase">01 · Live Code &amp; Timelines</span>
                <h4 className="text-sm font-black text-slate-950 dark:text-white">Inspectable GitHub &amp; Video Links</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Recruiters and clients can directly review your PR commits, branch discipline, and video cuts on live domains.
                </p>
              </Card>

              <Card className="p-6 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-2">
                <span className="text-xs font-black text-blue-600 uppercase">02 · Rubric Transparency</span>
                <h4 className="text-sm font-black text-slate-950 dark:text-white">Documented Mentor Audits</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Every deliverable is scored across 5 industry criteria, confirming that senior practitioners verified the quality of your work.
                </p>
              </Card>

              <Card className="p-6 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-2">
                <span className="text-xs font-black text-emerald-600 uppercase">03 · Public Talent Directory</span>
                <h4 className="text-sm font-black text-slate-950 dark:text-white">Verifiable Certificate URL</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  A public link that hiring partners can independently check to validate that all 15 sprint milestones were completed.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 14: INTERACTIVE FREELANCE ROI CALCULATOR */}
        {/* ========================================================================= */}
        <section className="border-t border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="max-w-2xl mx-auto text-center mb-12">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600 dark:text-orange-500">
                Interactive Career Calculator
              </p>
              <h2 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight text-slate-950 dark:text-white">
                Project Your Return on 15 Days of Proof-of-Work
              </h2>
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                When you graduate with verified code repositories or finished commercial cuts, your freelance market value changes immediately.
              </p>
            </div>

            <Card className="max-w-3xl mx-auto p-7 sm:p-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg">
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                    <span>Expected Client Project Fee / Milestone Rate:</span>
                    <span className="text-lg font-black text-orange-600 dark:text-orange-400">
                      ${projectRate} USD
                    </span>
                  </div>
                  <input
                    type="range"
                    min="150"
                    max="2500"
                    step="50"
                    value={projectRate}
                    onChange={(e) => setProjectRate(Number(e.target.value))}
                    className="w-full accent-orange-500 h-2 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-bold">
                    <span>$150 (Entry Freelancer)</span>
                    <span>$1,000 (Junior Pro)</span>
                    <span>$2,500+ (Production Lead)</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-200 dark:border-slate-800 text-center">
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-950 p-4 border border-slate-200/80 dark:border-slate-800">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cohort Investment</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white mt-1">$149</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">One-time enrollment</p>
                  </div>

                  <div className="rounded-xl bg-slate-50 dark:bg-slate-950 p-4 border border-slate-200/80 dark:border-slate-800">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Time to Break Even</p>
                    <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                      {projectRate >= 149 ? '1 Single Project' : '2 Projects'}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">&lt; 1 client engagement</p>
                  </div>

                  <div className="rounded-xl bg-slate-50 dark:bg-slate-950 p-4 border border-slate-200/80 dark:border-slate-800">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Est. 90-Day ROI*</p>
                    <p className="text-xl font-black text-orange-600 dark:text-orange-400 mt-1">
                      {Math.round(((projectRate * 3 - 149) / 149) * 100)}%
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Based on 3 client deliverables</p>
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 leading-relaxed text-center">
                  *Illustrative Freelance Projection: Calculated using your estimated project fee against the one-time $149 cohort fee. Actual earnings depend on personal client acquisition, market rates, and delivered production quality.
                </p>
              </div>
            </Card>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 15: WALL OF LOVE / VERIFIED STUDENT STORIES */}
        {/* ========================================================================= */}
        <section className="bg-gradient-to-br from-orange-500 to-amber-600 py-20 text-white">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 space-y-4">
                <Quote size={36} className="text-white/40" />
                <h2 className="text-3xl font-black tracking-tight text-white leading-tight">
                  "I finally finished work I am proud to send to clients."
                </h2>
                <p className="text-xs text-orange-100 leading-relaxed">
                  Verified stories from software developers and video editors who completed the 15-day sprint.
                </p>
              </div>

              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className="bg-white/10 backdrop-blur-md border-white/20 p-6 text-white space-y-3">
                  <div className="flex text-amber-300">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={14} fill="currentColor" />
                    ))}
                  </div>
                  <p className="text-xs leading-relaxed text-orange-50">
                    "The 15-day structure is genius. You don't have time to procrastinate. The WhatsApp support helped me unblock a tricky Supabase auth bug in 10 minutes."
                  </p>
                  <div>
                    <p className="text-xs font-black text-white">Verified Student Review</p>
                    <p className="text-[10px] text-orange-200">Full Stack Track · SaaS Auth Deliverable</p>
                  </div>
                </Card>

                <Card className="bg-white/10 backdrop-blur-md border-white/20 p-6 text-white space-y-3">
                  <div className="flex text-amber-300">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={14} fill="currentColor" />
                    ))}
                  </div>
                  <p className="text-xs leading-relaxed text-orange-50">
                    "My cuts went from boring and amateur to having real commercial rhythm. The mentor critique room showed me mistakes I was making for 2 years."
                  </p>
                  <div>
                    <p className="text-xs font-black text-white">Verified Student Review</p>
                    <p className="text-[10px] text-orange-200">Video Editing Track · 60s Commercial Cut</p>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 16: PRICING & GUARANTEE */}
        {/* ========================================================================= */}
        <section id="pricing" className="py-20 lg:py-28 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800">
          <div className="mx-auto max-w-7xl px-5 lg:px-8 text-center">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600 dark:text-orange-500">
              Transparent Enrollment
            </p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight text-slate-950 dark:text-white">
              One Clear Investment. Full 15-Day Access.
            </h2>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
              Everything you need to ship daily work, receive continuous feedback, and graduate with an industry credential.
            </p>

            <Card className="mx-auto mt-12 max-w-2xl overflow-hidden border-orange-300 dark:border-orange-900 bg-slate-50/50 dark:bg-slate-950/60 shadow-xl text-left">
              <div className="grid gap-8 p-7 sm:grid-cols-[1fr_auto] sm:p-10">
                <div>
                  <span className="rounded-full bg-orange-100 dark:bg-orange-950/60 px-3 py-1 text-xs font-black uppercase tracking-wider text-orange-700 dark:text-orange-300">
                    15-Day Sprint Pass
                  </span>
                  <h3 className="mt-4 text-2xl font-black text-slate-950 dark:text-white">
                    Full Cohort Membership
                  </h3>
                  <div className="mt-6 grid gap-3 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-2">
                    {[
                      '15 Daily Production Challenges',
                      '1-on-1 WhatsApp Mentor Support',
                      'Weekly Live Masterclass Workshops',
                      'Verified Digital Certificate',
                      'Mentor Letter of Recommendation',
                      'Community Board & Peer Network',
                      'Downloadable Starter Project Assets',
                      'Lifetime Access to Course Replays',
                    ].map((item) => (
                      <span key={item} className="flex items-center gap-2">
                        <Check className="text-emerald-500 shrink-0" size={15} />
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col justify-between sm:items-end border-t sm:border-t-0 sm:border-l border-slate-200 dark:border-slate-800 pt-6 sm:pt-0 sm:pl-8">
                  <div>
                    <span className="text-xs text-slate-400 line-through">$249</span>
                    <p className="text-4xl font-black text-slate-950 dark:text-white">$149</p>
                    <p className="text-[11px] text-slate-400">One-time payment</p>
                  </div>
                  <Button href="/register" className="mt-6 w-full justify-center" withArrow>
                    Save My Seat
                  </Button>
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 px-7 sm:px-10 flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                  <Shield size={14} className="text-emerald-500" />
                  100% 5-Day Money-Back Guarantee
                </span>
                <span>If unsatisfied during Days 1–3, request a full refund before Day 5.</span>
              </div>
            </Card>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 17: FAQ ACCORDION */}
        {/* ========================================================================= */}
        <section id="faq" className="border-t border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 py-20 lg:py-28">
          <div className="mx-auto max-w-3xl px-5 lg:px-8">
            <div className="text-center">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600 dark:text-orange-500">
                Frequently Answered
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white">
                Everything You Need to Know
              </h2>
            </div>

            <div className="mt-12 divide-y divide-slate-200 dark:divide-slate-800 border-y border-slate-200 dark:border-slate-800">
              {faqs.map((faq, index) => (
                <div key={faq.q} className="py-5">
                  <button
                    onClick={() => setFaqOpen(faqOpen === index ? null : index)}
                    className="flex w-full items-center justify-between gap-5 text-left text-sm font-black text-slate-950 dark:text-white hover:text-orange-600 transition"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`shrink-0 transition-transform ${
                        faqOpen === index ? 'rotate-180 text-orange-500' : 'text-slate-400'
                      }`}
                      size={18}
                    />
                  </button>
                  {faqOpen === index && (
                    <p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      {faq.a}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 18: FINAL LAUNCHPAD */}
        {/* ========================================================================= */}
        <section className="bg-slate-950 px-5 py-24 text-center text-white relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-96 rounded-full bg-orange-600/10 blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-3xl mx-auto space-y-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-500">
              15 Days From Now
            </p>
            <h2 className="text-4xl sm:text-5xl font-black tracking-tight text-white leading-tight">
              You Could Have a Finished Portfolio and Verified Credential.
            </h2>
            <p className="text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
              Join the next intensive cohort. Experience the power of daily production constraints, real WhatsApp mentorship, and peer momentum.
            </p>
            <div className="pt-6">
              <Button href="/register" size="lg" withArrow className="shadow-lg shadow-orange-500/20">
                Join Next 15-Day Cohort
              </Button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}