import { useState } from 'react';
import { Award, CheckCircle2, QrCode, Quote, Star, Trophy } from 'lucide-react';
import { Button } from '../../ui/Button';
import { TiltCard } from '../TiltCard';
import { FwCard } from '../FwCard';
import { FreelanceEarningsCalculator } from '../FreelanceEarningsCalculator';

export interface TestimonialsSectionProps {
  publishedPrice: number;
  publishedCurrency: string;
}

export function TestimonialsSection({ publishedPrice, publishedCurrency }: TestimonialsSectionProps) {
  const [activeTransformation, setActiveTransformation] = useState<'creative' | 'coding'>('creative');

  return (
    <>
      {/* ========================================================================= */}
      {/* SECTION 8: GAMIFICATION, STREAKS & LEVEL UP SYSTEM */}
      {/* ========================================================================= */}
      <section className="border-t border-white/10 bg-[#070b16] py-20 lg:py-28 relative overflow-hidden">
        {/* Ambient Lighting Orb */}
        <div className="gsap-parallax-slow absolute top-1/2 -left-40 size-96 rounded-full bg-orange-500/10 blur-3xl pointer-events-none" />

        <div className="mx-auto max-w-7xl px-5 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="gsap-header-reveal space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-orange-500/10 border border-orange-500/20 px-3 py-1 text-xs font-black text-orange-400">
                <Trophy size={14} />
                <span>The Psychology of Finishing</span>
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
                Gamified Daily Sprints That Make Quitting Impossible.
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                We engineered ProCut Hub around positive momentum. Daily streaks, XP points, and cohort leaderboards keep your focus high until Day 15.
              </p>

              <div className="space-y-4 text-xs sm:text-sm text-slate-300">
                <div className="flex items-start gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white font-bold shadow-md shadow-orange-500/20">
                    🔥
                  </span>
                  <div>
                    <strong className="text-white">The 15-Day Flame Streak:</strong>
                    <p className="text-xs text-slate-400 mt-0.5">Submit every day to protect your unbroken streak. Earn the coveted 15/15 Finisher Badge.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-blue-500 text-white font-bold shadow-md shadow-blue-500/20">
                    ⚡
                  </span>
                  <div>
                    <strong className="text-white">Early Bird XP Multiplier:</strong>
                    <p className="text-xs text-slate-400 mt-0.5">Submitting before 8:00 PM grants a 1.5x XP bonus, placing your work higher on the mentor review queue.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-purple-500 text-white font-bold shadow-md shadow-purple-500/20">
                    🛡️
                  </span>
                  <div>
                    <strong className="text-white">Emergency Streak Freeze:</strong>
                    <p className="text-xs text-slate-400 mt-0.5">Life happens. Every student gets 1 emergency streak shield to safeguard their record during emergencies.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Gamification Dashboard Mock with 3D Depth Tilt */}
            <TiltCard
              maxTilt={6}
              glareColor="rgba(249, 115, 22, 0.15)"
              className="rounded-3xl border border-white/10 bg-[#030712]/95 backdrop-blur-xl p-6 sm:p-8 space-y-6 shadow-2xl shadow-orange-950/20"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white font-black text-sm shadow-md shadow-orange-500/20">
                    15
                  </div>
                  <div>
                    <p className="text-xs font-black text-white">Cohort Sprint Leaderboard</p>
                    <p className="text-[10px] text-slate-400">Live points rankings</p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-black text-emerald-400">
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
                    className={`flex items-center justify-between p-3.5 rounded-xl border text-xs transition ${
                      user.rank === 3
                        ? 'border-orange-500/60 bg-gradient-to-r from-orange-500/15 to-transparent text-white shadow-md shadow-orange-500/10'
                        : 'border-white/10 bg-white/[0.03] text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-black text-slate-400 w-4">#{user.rank}</span>
                      <div>
                        <p className="font-black text-white">{user.name}</p>
                        <p className="text-[10px] text-slate-400">{user.track}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-orange-400">{user.xp}</p>
                      <p className="text-[10px] text-slate-400">{user.streak}</p>
                    </div>
                  </div>
                ))}
              </div>
            </TiltCard>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 9: LIVE WORKSHOPS & CRITIQUE ROOMS */}
      {/* ========================================================================= */}
      <section id="workshops" className="border-t border-white/10 bg-[#030712] py-20 lg:py-28 relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-5 lg:px-8 relative z-10">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-400">
              Live Interactive Masterclasses
            </p>
            <h2 className="mt-2 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
              Live Critique Rooms &amp; Stage Refactorings
            </h2>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed">
              In addition to daily tasks, join live group critique sessions where mentors audit real student timelines and codebases on Zoom.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <TiltCard className="p-6 border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] rounded-2xl space-y-4 hover:border-blue-500/40 transition">
              <span className="rounded-md bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[10px] font-black uppercase text-blue-400">
                Every Saturday 6:00 PM
              </span>
              <h3 className="text-base font-black text-white">
                Live Project Teardowns &amp; Hot Seat
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Volunteers share their screens. Mentors pull apart the timeline cut or inspect the React component tree in real-time.
              </p>
              <div className="text-[11px] font-bold text-slate-400 border-t border-white/10 pt-3">
                Full 4K recording uploaded within 2 hours.
              </div>
            </TiltCard>

            <TiltCard className="p-6 border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] rounded-2xl space-y-4 hover:border-purple-500/40 transition">
              <span className="rounded-md bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 text-[10px] font-black uppercase text-purple-400">
                Mid-Sprint Day 10
              </span>
              <h3 className="text-base font-black text-white">
                Architecture &amp; Sound Masterclass
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Deep-dive into advanced topics: multi-tenant database partitioning, psychoacoustic sound submixes, and color primary transforms.
              </p>
              <div className="text-[11px] font-bold text-slate-400 border-t border-white/10 pt-3">
                Interactive Q&amp;A directly with guest directors.
              </div>
            </TiltCard>

            <TiltCard className="p-6 border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] rounded-2xl space-y-4 hover:border-emerald-500/40 transition">
              <span className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-400">
                Sprint Day 15
              </span>
              <h3 className="text-base font-black text-white">
                Capstone Demo Day &amp; Recruiter Pitch
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Graduates present their crowning 15-day capstones to our partner network of startup founders and agency creative directors.
              </p>
              <div className="text-[11px] font-bold text-slate-400 border-t border-white/10 pt-3">
                Direct portfolio showcase opportunities.
              </div>
            </TiltCard>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 10: BATTLE-TESTED TECH STACK WALL */}
      {/* ========================================================================= */}
      <section className="border-t border-white/10 bg-[#070b16] py-16 relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-5 lg:px-8 text-center relative z-10">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
            Industry Standard Tooling
          </p>
          <h3 className="mt-2 text-xl sm:text-2xl lg:text-3xl font-black text-white">
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
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-black text-slate-200 shadow-2xs hover:border-orange-500/60 hover:text-orange-400 hover:bg-orange-500/10 hover:shadow-lg hover:shadow-orange-500/10 transition cursor-default"
              >
                {tool}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION: SELECTED PRODUCTION DELIVERABLES (JUNCA .FW SHOWCASE) */}
      {/* ========================================================================= */}
      <section id="deliverables" className="border-t border-white/10 bg-[#030712] py-20 lg:py-28 relative overflow-hidden fw">
        <div className="mx-auto max-w-7xl px-5 lg:px-8 relative z-10">
          <div className="gsap-header-reveal flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
            <div>
              <span className="dot-label dot-label--emerald text-orange-400 font-bold mb-2">
                Featured Deliverables
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white mt-1">
                Selected Production Proof-of-Work
              </h2>
            </div>
            <p className="text-sm text-slate-400 max-w-md leading-relaxed">
              Inspected by senior engineers and creative directors. Real deliverables built by interns under 24-hour sprint briefs.
            </p>
          </div>

          <ul className="gsap-cards-group grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-14">
            <FwCard
              figure={{
                imgSrc: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=1280&q=80',
                alt: 'Cinematic video timeline with kinetic typography motion graphics',
                tags: ['Motion Design', 'After Effects', 'Kinetic Typography'],
                aspectRatio: '16/10',
              }}
              kicker="01 / 04 · Creative Video Track"
              title="Cinematic Pacing & Kinetic Title Sequence"
              description="Engineered for a commercial client with custom bezier easing curves, multi-track audio soundscapes, and viral retention pacing."
              cursorLabel="INSPECT CUT"
            />

            <FwCard
              figure={{
                imgSrc: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1280&q=80',
                alt: 'SaaS monitoring telemetry dashboard with real-time charts',
                tags: ['React 19', 'Supabase RLS', 'TypeScript'],
                aspectRatio: '16/10',
              }}
              kicker="02 / 04 · Full-Stack Coding Track"
              title="Real-Time Analytics & Telemetry Engine"
              description="Production web platform featuring optimistic UI state reducers, PostgreSQL Row-Level Security, and automated Vitest test coverage."
              cursorLabel="VIEW CODE"
            />

            <FwCard
              figure={{
                imgSrc: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1280&q=80',
                alt: 'DaVinci Resolve studio color grading interface and commercial video shot',
                tags: ['DaVinci Resolve', 'Color Primaries', '-14 LUFS Mix'],
                aspectRatio: '16/10',
              }}
              kicker="03 / 04 · Creative Video Track"
              title="60s Commercial Capstone & Master Audio Mix"
              description="Mastered to international broadcast loudness targets with skin-tone scopes, primary LUT grading, and 100% mentor rubric defense."
              cursorLabel="VIEW REEL"
            />

            <FwCard
              figure={{
                imgSrc: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1280&q=80',
                alt: 'Cloud server infrastructure and cryptographic verification system',
                tags: ['PostgreSQL', 'Webhooks', 'Vercel CI/CD'],
                aspectRatio: '16/10',
              }}
              kicker="04 / 04 · Full-Stack Coding Track"
              title="Cryptographic Certificate & Delivery Webhook Hub"
              description="Automated graduation pipeline verifying SHA-256 signatures, dispatching WhatsApp alerts, and provisioning recruiter links."
              cursorLabel="INSPECT API"
            />
          </ul>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 11: BEFORE VS AFTER TRANSFORMATION SHOWCASE */}
      {/* ========================================================================= */}
      <section className="border-t border-white/10 bg-[#030712] py-20 lg:py-28 relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-5 lg:px-8 relative z-10">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-400">
              Tangible Outcomes
            </p>
            <h2 className="mt-2 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
              Your Proof-of-Work: Day 0 vs. Day 15
            </h2>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed">
              See the concrete leap in quality, velocity, and professionalism our graduates achieve in just 15 days.
            </p>

            <div className="mt-6 inline-flex rounded-xl border border-white/10 bg-white/[0.04] p-1">
              <button
                type="button"
                onClick={() => setActiveTransformation('creative')}
                className={`px-4 py-1.5 rounded-lg text-xs font-black cursor-pointer transition ${
                  activeTransformation === 'creative'
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Video Editing Track
              </button>
              <button
                type="button"
                onClick={() => setActiveTransformation('coding')}
                className={`px-4 py-1.5 rounded-lg text-xs font-black cursor-pointer transition ${
                  activeTransformation === 'coding'
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Full Stack Coding Track
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Day 0 */}
            <TiltCard className="p-7 sm:p-9 border border-red-500/20 bg-gradient-to-b from-red-950/15 to-white/[0.02] rounded-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">Day 00: Starting Point</span>
                <span className="text-xs font-bold text-red-400">Unstructured &amp; Unaudited</span>
              </div>
              {activeTransformation === 'creative' ? (
                <ul className="space-y-3 text-xs text-slate-400">
                  <li className="flex items-start gap-2">✕ Messy timeline with unorganized clip layers and random filenames.</li>
                  <li className="flex items-start gap-2">✕ Jarring audio transitions and flat background music without risers.</li>
                  <li className="flex items-start gap-2">✕ Generic default subtitle fonts that look amateur on mobile feeds.</li>
                  <li className="flex items-start gap-2">✕ Rapid audience drop-off in the first 5 seconds.</li>
                </ul>
              ) : (
                <ul className="space-y-3 text-xs text-slate-400">
                  <li className="flex items-start gap-2">✕ Scattered tutorial code with zero unit tests or documentation.</li>
                  <li className="flex items-start gap-2">✕ Unprotected API endpoints with exposed database keys.</li>
                  <li className="flex items-start gap-2">✕ Heavy reliance on `any` types that cause silent runtime crashes.</li>
                  <li className="flex items-start gap-2">✕ No live domain — only runs locally on `localhost:3000`.</li>
                </ul>
              )}
            </TiltCard>

            {/* Day 15 */}
            <TiltCard
              glareColor="rgba(16, 185, 129, 0.2)"
              className="p-7 sm:p-9 border border-emerald-500/40 bg-gradient-to-b from-emerald-950/20 to-white/[0.02] rounded-2xl space-y-4 shadow-xl shadow-emerald-950/20"
            >
              <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-400">Day 15: ProCut Graduate</span>
                <span className="text-xs font-bold text-emerald-400">Production-Grade Proof</span>
              </div>
              {activeTransformation === 'creative' ? (
                <ul className="space-y-3 text-xs text-slate-300">
                  <li className="flex items-start gap-2">✓ Strict folder scaffolding with colored track lanes and labeled J/L cuts.</li>
                  <li className="flex items-start gap-2">✓ Mastered -14 LUFS sound mix with custom whoosh and riser accents.</li>
                  <li className="flex items-start gap-2">✓ Custom bezier-curved kinetic typography that pops on vertical viewports.</li>
                  <li className="flex items-start gap-2">✓ High watch-time retention rate on commercial portfolio edits.</li>
                </ul>
              ) : (
                <ul className="space-y-3 text-xs text-slate-300">
                  <li className="flex items-start gap-2">✓ Production SaaS deployed on custom domain with SSL and CI previews.</li>
                  <li className="flex items-start gap-2">✓ PostgreSQL database protected with strict Row-Level Security policies.</li>
                  <li className="flex items-start gap-2">✓ Strict TypeScript architecture with zero build warnings and clean hooks.</li>
                  <li className="flex items-start gap-2">✓ Comprehensive Vitest test suite and verified GitHub pull requests.</li>
                </ul>
              )}
            </TiltCard>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 12: VERIFIED CREDENTIAL & MENTOR RECOMMENDATION */}
      {/* ========================================================================= */}
      <section id="credentials" className="border-t border-white/10 bg-[#070b16] py-20 lg:py-28 text-white relative overflow-hidden">
        {/* Ambient Amber Glow */}
        <div className="gsap-parallax-slow absolute top-1/2 -right-40 size-96 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        <div className="mx-auto max-w-7xl px-5 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="gsap-header-reveal space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/10 border border-amber-400/20 px-3 py-1 text-xs font-black text-amber-300">
                <Award size={14} />
                <span>Proof of Competence</span>
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
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

            {/* Realistic Certificate Mockup with 3D Depth Tilt */}
            <div className="relative">
              <div className="absolute -inset-2 rounded-3xl bg-gradient-to-tr from-amber-500 to-orange-500 opacity-20 blur-2xl pointer-events-none" />
              <TiltCard
                maxTilt={8}
                glareColor="rgba(245, 158, 11, 0.2)"
                className="relative rounded-2xl border border-amber-400/30 bg-gradient-to-b from-slate-900 via-[#070b16] to-[#030712] p-7 sm:p-9 shadow-2xl text-slate-100 space-y-6"
              >
                <div className="flex items-start justify-between border-b border-white/10 pb-5">
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

                <div className="flex items-center justify-between border-t border-white/10 pt-5 text-xs text-slate-400">
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
              </TiltCard>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 13: PROOF-OF-WORK OVER RESUMES */}
      {/* ========================================================================= */}
      <section className="border-t border-white/10 bg-[#030712] py-20 lg:py-28 relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-5 lg:px-8 text-center relative z-10">
          <div className="gsap-header-reveal max-w-2xl mx-auto space-y-3">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-400">
              Career &amp; Client Standards
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
              Proof-of-Work Over Static Paper Resumes
            </h2>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed">
              Modern software teams and production agencies value verifiable code repositories, live production deployments, and finished commercial reels over certificates of attendance.
            </p>
          </div>

          <div className="gsap-cards-group mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto text-left">
            <TiltCard className="p-6 border border-white/10 bg-white/[0.03] rounded-2xl space-y-2 hover:border-orange-500/40 transition">
              <span className="text-xs font-black text-orange-400 uppercase">01 · Live Code &amp; Timelines</span>
              <h4 className="text-sm font-black text-white">Inspectable GitHub &amp; Video Links</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Recruiters and clients can directly review your PR commits, branch discipline, and video cuts on live domains.
              </p>
            </TiltCard>

            <TiltCard className="p-6 border border-white/10 bg-white/[0.03] rounded-2xl space-y-2 hover:border-blue-500/40 transition">
              <span className="text-xs font-black text-blue-400 uppercase">02 · Rubric Transparency</span>
              <h4 className="text-sm font-black text-white">Documented Mentor Audits</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Every deliverable is scored across 5 industry criteria, confirming that senior practitioners verified the quality of your work.
              </p>
            </TiltCard>

            <TiltCard className="p-6 border border-white/10 bg-white/[0.03] rounded-2xl space-y-2 hover:border-emerald-500/40 transition">
              <span className="text-xs font-black text-emerald-400 uppercase">03 · Public Talent Directory</span>
              <h4 className="text-sm font-black text-white">Verifiable Certificate URL</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                A public link that hiring partners can independently check to validate that all 15 sprint milestones were completed.
              </p>
            </TiltCard>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 14: INTERACTIVE FREELANCE ROI CALCULATOR */}
      {/* ========================================================================= */}
      <FreelanceEarningsCalculator
        publishedPrice={publishedPrice}
        publishedCurrency={publishedCurrency}
      />

      {/* ========================================================================= */}
      {/* SECTION 15: WALL OF LOVE / VERIFIED STUDENT STORIES */}
      {/* ========================================================================= */}
      <section className="bg-[#030712] border-t border-white/10 py-20 lg:py-28 text-white relative overflow-hidden">
        {/* Ambient Warm Glow */}
        <div className="gsap-parallax-slow absolute top-1/2 left-1/4 -translate-y-1/2 size-96 rounded-full bg-orange-500/10 blur-3xl pointer-events-none" />

        <div className="mx-auto max-w-7xl px-5 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="gsap-header-reveal lg:col-span-1 space-y-4">
              <Quote size={36} className="text-orange-500/40" />
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
                &quot;I finally finished work I am proud to send to clients.&quot;
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Verified stories from software developers and video editors who completed the 15-day sprint.
              </p>
            </div>

            <div className="gsap-cards-group lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TiltCard className="bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-xl border border-white/10 p-6 rounded-2xl text-white space-y-3 shadow-xl hover:border-orange-500/30 transition">
                <div className="flex text-amber-400">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={14} fill="currentColor" />
                  ))}
                </div>
                <p className="text-xs leading-relaxed text-slate-300">
                  &quot;The 15-day structure is genius. You don&apos;t have time to procrastinate. The WhatsApp support helped me unblock a tricky Supabase auth bug in 10 minutes.&quot;
                </p>
                <div>
                  <p className="text-xs font-black text-white">Verified Student Review</p>
                  <p className="text-[10px] text-orange-400">Full Stack Track · SaaS Auth Deliverable</p>
                </div>
              </TiltCard>

              <TiltCard className="bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-xl border border-white/10 p-6 rounded-2xl text-white space-y-3 shadow-xl hover:border-orange-500/30 transition">
                <div className="flex text-amber-400">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={14} fill="currentColor" />
                  ))}
                </div>
                <p className="text-xs leading-relaxed text-slate-300">
                  &quot;My cuts went from boring and amateur to having real commercial rhythm. The mentor critique room showed me mistakes I was making for 2 years.&quot;
                </p>
                <div>
                  <p className="text-xs font-black text-white">Verified Student Review</p>
                  <p className="text-[10px] text-orange-400">Video Editing Track · 60s Commercial Cut</p>
                </div>
              </TiltCard>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

