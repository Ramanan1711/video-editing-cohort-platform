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
  return (
    <>
      {/* ========================================================================= */}
      {/* SECTION 8: GAMIFICATION, STREAKS & LEVEL UP SYSTEM */}
      {/* ========================================================================= */}
      <section className="border-t border-white/10 bg-[#070b16] py-20 lg:py-28 relative overflow-hidden">
        {/* Ambient Lighting Orb */}
        <div className="gsap-parallax-slow absolute top-1/2 -left-40 size-96 rounded-full bg-[#B92B27]/10 blur-3xl pointer-events-none" />

        <div className="mx-auto max-w-7xl px-5 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="gsap-header-reveal space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#F2B705]/10 border border-[#F2B705]/20 px-3 py-1 text-xs font-black text-[#F2B705]">
                <Trophy size={14} />
                <span>The Psychology of Finishing</span>
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
                Gamified Daily Sprints That Make Quitting Impossible.
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                We engineered Iunoware Academy around positive momentum. Daily streaks, XP points, and cohort leaderboards keep your focus high until Day 15.
              </p>

              <div className="space-y-4 text-xs sm:text-sm text-slate-300">
                <div className="flex items-start gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-[#B92B27] via-[#D93830] to-[#F2B705] text-white font-bold shadow-md shadow-[#B92B27]/20">
                    🔥
                  </span>
                  <div>
                    <strong className="text-white">The 15-Day Flame Streak:</strong>
                    <p className="text-xs text-slate-400 mt-0.5">Submit every day to protect your unbroken streak. Earn the coveted 15/15 Finisher Badge.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-[#2675EB] text-white font-bold shadow-md shadow-[#2675EB]/20">
                    ⚡
                  </span>
                  <div>
                    <strong className="text-white">Early Bird XP Multiplier:</strong>
                    <p className="text-xs text-slate-400 mt-0.5">Submitting before 8:00 PM grants a 1.5x XP bonus, placing your work higher on the mentor review queue.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-[#38B44A] text-white font-bold shadow-md shadow-[#38B44A]/20">
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
              glareColor="rgba(185, 43, 39, 0.15)"
              className="rounded-3xl border border-white/10 bg-[#030712]/95 backdrop-blur-xl p-6 sm:p-8 space-y-6 shadow-2xl shadow-black/40"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#B92B27] via-[#D93830] to-[#F2B705] text-white font-black text-sm shadow-md shadow-[#B92B27]/20">
                    15
                  </div>
                  <div>
                    <p className="text-xs font-black text-white">Cohort Sprint Leaderboard</p>
                    <p className="text-[10px] text-slate-400">Live points rankings</p>
                  </div>
                </div>
                <span className="rounded-full bg-[#38B44A]/10 border border-[#38B44A]/20 px-2.5 py-0.5 text-[10px] font-black text-[#38B44A]">
                  Active Sprint Participant
                </span>
              </div>

              <div className="space-y-3">
                {[
                  { rank: 1, name: 'Sample Intern A', track: 'Commercial Cut', xp: '2,940 XP', streak: '12d 🔥' },
                  { rank: 2, name: 'Sample Intern B', track: 'Color Grading', xp: '2,890 XP', streak: '12d 🔥' },
                  { rank: 3, name: 'Your Candidate Profile', track: 'Current Candidate', xp: '2,850 XP', streak: '12d 🔥' },
                ].map((user) => (
                  <div
                    key={user.rank}
                    className={`flex items-center justify-between p-3.5 rounded-xl border text-xs transition ${
                      user.rank === 3
                        ? 'border-[#F2B705]/60 bg-gradient-to-r from-[#F2B705]/15 to-transparent text-white shadow-md shadow-[#F2B705]/10'
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
                      <p className="font-black text-[#F2B705]">{user.xp}</p>
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
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#F2B705]">
              Live Interactive Masterclasses
            </p>
            <h2 className="mt-2 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
              Live Critique Rooms &amp; Stage Refactorings
            </h2>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed">
              In addition to daily tasks, join live group critique sessions where mentors audit real student timelines and video projects on Zoom.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <TiltCard className="p-6 border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] rounded-2xl space-y-4 hover:border-[#2675EB]/40 transition">
              <span className="rounded-md bg-[#2675EB]/10 border border-[#2675EB]/20 px-2 py-0.5 text-[10px] font-black uppercase text-[#2675EB]">
                Every Saturday 6:00 PM
              </span>
              <h3 className="text-base font-black text-white">
                Live Timeline Teardowns &amp; Hot Seat
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Volunteers share their screens. Mentors pull apart the edit, pacing, audio ducking, and transition cuts in real-time.
              </p>
              <div className="text-[11px] font-bold text-slate-400 border-t border-white/10 pt-3">
                Full 4K recording uploaded within 2 hours.
              </div>
            </TiltCard>

            <TiltCard className="p-6 border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] rounded-2xl space-y-4 hover:border-[#B92B27]/40 transition">
              <span className="rounded-md bg-[#B92B27]/10 border border-[#B92B27]/20 px-2 py-0.5 text-[10px] font-black uppercase text-[#D93830]">
                Mid-Sprint Day 10
              </span>
              <h3 className="text-base font-black text-white">
                Color Grading &amp; Sound Masterclass
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Deep-dive into advanced topics: DaVinci Resolve node primaries, -14 LUFS broadcast mastering, and cinematic color space transforms.
              </p>
              <div className="text-[11px] font-bold text-slate-400 border-t border-white/10 pt-3">
                Interactive Q&amp;A directly with guest directors.
              </div>
            </TiltCard>

            <TiltCard className="p-6 border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] rounded-2xl space-y-4 hover:border-[#38B44A]/40 transition">
              <span className="rounded-md bg-[#38B44A]/10 border border-[#38B44A]/20 px-2 py-0.5 text-[10px] font-black uppercase text-[#38B44A]">
                Sprint Day 15
              </span>
              <h3 className="text-base font-black text-white">
                Capstone Demo Day &amp; Showreel Pitch
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Graduates present their crowning 15-day commercial reels to our partner network of agency creative leads and studio founders.
              </p>
              <div className="text-[11px] font-bold text-slate-400 border-t border-white/10 pt-3">
                Direct portfolio showcase opportunities.
              </div>
            </TiltCard>
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
              <span className="dot-label dot-label--emerald text-[#38B44A] font-bold mb-2">
                Featured Deliverables
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white mt-1">
                Selected Production Proof-of-Work
              </h2>
            </div>
            <p className="text-sm text-slate-400 max-w-md leading-relaxed">
              Inspected by senior video editors and creative directors. Real deliverables built by interns under 24-hour sprint briefs.
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
              kicker="01 / 04 · Kinetic Motion"
              title="Cinematic Pacing & Kinetic Title Sequence"
              description="Engineered for a commercial client with custom bezier easing curves, multi-track audio soundscapes, and viral retention pacing."
              cursorLabel="INSPECT CUT"
            />

            <FwCard
              figure={{
                imgSrc: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1280&q=80',
                alt: 'Professional audio mixer and studio monitors for sound design',
                tags: ['Sound Design', 'Adobe Audition', '-14 LUFS Audio'],
                aspectRatio: '16/10',
              }}
              kicker="02 / 04 · Audio Engineering"
              title="Dynamic Sound Design & Multi-Layer Atmospheric Mix"
              description="Full cinema-grade audio mix with high-impact sub-bass risers, whoosh impacts, dialogue ducking, and master loudness calibration."
              cursorLabel="LISTEN MIX"
            />

            <FwCard
              figure={{
                imgSrc: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1280&q=80',
                alt: 'DaVinci Resolve studio color grading interface and commercial video shot',
                tags: ['DaVinci Resolve', 'Color Primaries', 'Skin Tone Scopes'],
                aspectRatio: '16/10',
              }}
              kicker="03 / 04 · Color Grading"
              title="60s Commercial Capstone & Master Grade"
              description="Mastered to international broadcast delivery targets with skin-tone vector scopes, primary LUT grading, and 100% mentor rubric defense."
              cursorLabel="VIEW REEL"
            />

            <FwCard
              figure={{
                imgSrc: 'https://images.unsplash.com/photo-1536240478700-b869070f9279?auto=format&fit=crop&w=1280&q=80',
                alt: 'Broadcast television camera and video editing studio monitors',
                tags: ['Premiere Pro', 'Retention Edits', 'Multi-Cam Sync'],
                aspectRatio: '16/10',
              }}
              kicker="04 / 04 · Commercial Pacing"
              title="Multi-Cam Commercial Cut with Narrative Hooks"
              description="Fast-paced editorial cut with seamless J/L audio transitions, retention pattern interrupts, and full client handoff deliverables."
              cursorLabel="INSPECT EDIT"
            />
          </ul>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 12: VERIFIED CREDENTIAL & MENTOR RECOMMENDATION */}
      {/* ========================================================================= */}
      <section id="credentials" className="border-t border-white/10 bg-[#070b16] py-20 lg:py-28 text-white relative overflow-hidden">
        {/* Ambient Amber Glow */}
        <div className="gsap-parallax-slow absolute top-1/2 -right-40 size-96 rounded-full bg-[#F2B705]/10 blur-3xl pointer-events-none" />

        <div className="mx-auto max-w-7xl px-5 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="gsap-header-reveal space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#F2B705]/10 border border-[#F2B705]/20 px-3 py-1 text-xs font-black text-[#F2B705]">
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
                  <CheckCircle2 size={16} className="text-[#38B44A] shrink-0 mt-0.5" />
                  <span><strong>Cryptographic Verification:</strong> Each certificate includes a unique verification URL and QR code for recruiter validation.</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 size={16} className="text-[#38B44A] shrink-0 mt-0.5" />
                  <span><strong>Mentor Letter of Recommendation:</strong> Detailed assessment of your timeline speed, storytelling discipline, and technical execution.</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 size={16} className="text-[#38B44A] shrink-0 mt-0.5" />
                  <span><strong>LinkedIn 1-Click Credential:</strong> Display your verified internship certificate directly on your professional profile.</span>
                </div>
              </div>

              <div className="pt-2">
                <Button href="/register" withArrow className="bg-gradient-to-r from-[#B92B27] via-[#D93830] to-[#F2B705] hover:from-[#D93830] hover:to-[#D99B02] text-white border-none shadow-lg shadow-[#B92B27]/25">
                  Earn Your Credential
                </Button>
              </div>
            </div>

            {/* Realistic Certificate Mockup with 3D Depth Tilt */}
            <div className="relative">
              <div className="absolute -inset-2 rounded-3xl bg-gradient-to-tr from-[#B92B27] via-[#F2B705] to-[#2675EB] opacity-20 blur-2xl pointer-events-none" />
              <TiltCard
                maxTilt={8}
                glareColor="rgba(242, 183, 5, 0.2)"
                className="relative rounded-2xl border border-[#F2B705]/40 bg-gradient-to-b from-slate-900 via-[#070b16] to-[#030712] p-7 sm:p-9 shadow-2xl text-slate-100 space-y-6"
              >
                <div className="flex items-start justify-between border-b border-white/10 pb-5">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#F2B705]">
                      Iunoware Academy · Verified Credential
                    </span>
                    <h3 className="text-lg font-black text-white mt-1">
                      Certificate of Internship Completion
                    </h3>
                  </div>
                  <div className="flex size-11 items-center justify-center rounded-xl bg-[#F2B705]/10 border border-[#F2B705]/30 text-[#F2B705]">
                    <Award size={24} />
                  </div>
                </div>

                <div className="space-y-2 text-center py-4">
                  <p className="text-xs text-slate-400 uppercase tracking-widest">This acknowledges that</p>
                  <p className="text-2xl font-black text-white tracking-tight">Candidate Name</p>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                    has successfully satisfied all 15 production deliverables, passed mentor audits, and graduated with distinction in
                  </p>
                  <p className="text-sm font-black text-[#D93830]">Commercial Video Editing &amp; Kinetic Motion Track</p>
                </div>

                <div className="flex items-center justify-between border-t border-white/10 pt-5 text-xs text-slate-400">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-500">Credential ID</p>
                    <p className="font-mono text-xs text-slate-300">PCH-2026-VERIFIED</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <QrCode size={26} className="text-[#F2B705]" />
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-[#38B44A]">✓ Cryptographically Signed</p>
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
        <div className="gsap-parallax-slow absolute top-1/2 left-1/4 -translate-y-1/2 size-96 rounded-full bg-[#B92B27]/10 blur-3xl pointer-events-none" />

        <div className="mx-auto max-w-7xl px-5 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="gsap-header-reveal lg:col-span-1 space-y-4">
              <Quote size={36} className="text-[#F2B705]/40" />
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
                &quot;I finally finished work I am proud to send to clients.&quot;
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Verified stories from video editors who completed the 15-day sprint and landed paying client projects.
              </p>
            </div>

            <div className="gsap-cards-group lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TiltCard className="bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-xl border border-white/10 p-6 rounded-2xl text-white space-y-3 shadow-xl hover:border-[#B92B27]/40 transition">
                <div className="flex text-[#F2B705]">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={14} fill="currentColor" />
                  ))}
                </div>
                <p className="text-xs leading-relaxed text-slate-300">
                  &quot;The 15-day structure is genius. You don&apos;t have time to procrastinate. The WhatsApp support helped me unblock a tricky pacing cut in 10 minutes.&quot;
                </p>
                <div>
                  <p className="text-xs font-black text-white">Pooja S.</p>
                  <p className="text-[10px] text-[#2675EB]">Motion Design Track · Kinetic Subtitle Deliverable</p>
                </div>
              </TiltCard>

              <TiltCard className="bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-xl border border-white/10 p-6 rounded-2xl text-white space-y-3 shadow-xl hover:border-[#B92B27]/40 transition">
                <div className="flex text-[#F2B705]">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={14} fill="currentColor" />
                  ))}
                </div>
                <p className="text-xs leading-relaxed text-slate-300">
                  &quot;My cuts went from boring and amateur to having real commercial rhythm. The mentor critique room showed me mistakes I was making for 2 years.&quot;
                </p>
                <div>
                  <p className="text-xs font-black text-white">Rahul K.</p>
                  <p className="text-[10px] text-[#D93830]">Video Editing Track · 60s Commercial Cut</p>
                </div>
              </TiltCard>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

