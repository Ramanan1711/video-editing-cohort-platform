import { useState } from 'react';
import { Check, MessageCircle } from 'lucide-react';
import { TiltCard } from '../TiltCard';
import { soundFx } from '../../../lib/soundFx';

export function MentorshipSection() {
  const [activeChatScenario, setActiveChatScenario] = useState<'code' | 'video' | 'nudge'>('video');

  return (
    <>
      {/* ========================================================================= */}
      {/* SECTION 6: WHATSAPP MENTORSHIP ENGINE & SIMULATOR */}
      {/* ========================================================================= */}
      <section id="mentorship" className="py-20 lg:py-28 bg-[#070b16] border-t border-white/10 relative overflow-hidden">
        {/* Ambient Lighting Orb */}
        <div className="absolute top-1/4 -right-40 size-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none gsap-parallax-slow" />

        <div className="mx-auto max-w-7xl px-5 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="gsap-header-reveal">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-black text-emerald-400 mb-4">
                <MessageCircle size={14} />
                <span>Real-Time Accountability</span>
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
                A Senior Mentor in Your Pocket via WhatsApp.
              </h2>
              <p className="mt-4 text-sm text-slate-400 leading-relaxed">
                No impersonal forums or ticket systems that take days to answer. With ProCut Hub, you communicate directly with an assigned lead engineer or senior video editor.
              </p>

              <div className="mt-8 space-y-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mt-0.5 shadow-xs shadow-emerald-500/20">
                    <Check size={13} />
                  </span>
                  <div>
                    <p className="text-xs font-black text-white">Daily 9:00 AM Challenge Drops</p>
                    <p className="text-xs text-slate-400">Receive today’s task brief and quick links directly on WhatsApp.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mt-0.5 shadow-xs shadow-emerald-500/20">
                    <Check size={13} />
                  </span>
                  <div>
                    <p className="text-xs font-black text-white">Voice-Note Code &amp; Timeline Audits</p>
                    <p className="text-xs text-slate-400">Mentors send 30-second voice notes pointing out exact timestamps and lines to refine.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mt-0.5 shadow-xs shadow-emerald-500/20">
                    <Check size={13} />
                  </span>
                  <div>
                    <p className="text-xs font-black text-white">Proactive Inactivity Shield</p>
                    <p className="text-xs text-slate-400">Our system detects if you’re falling behind and sends a friendly nudge to keep your streak alive.</p>
                  </div>
                </div>
              </div>

              {/* Scenario Toggle */}
              <div className="mt-8 pt-6 border-t border-white/10">
                <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
                  Test the WhatsApp Simulator:
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    data-cursor="TEST CHAT"
                    onClick={() => {
                      setActiveChatScenario('video');
                      soundFx.playBlip(440, 0.04, 'sine', 0.04);
                    }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                      activeChatScenario === 'video'
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 ring-1 ring-emerald-400'
                        : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    Pacing Critique
                  </button>
                  <button
                    type="button"
                    data-cursor="TEST CHAT"
                    onClick={() => {
                      setActiveChatScenario('code');
                      soundFx.playBlip(520, 0.04, 'sine', 0.04);
                    }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                      activeChatScenario === 'code'
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 ring-1 ring-emerald-400'
                        : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    Code Bug Triage
                  </button>
                  <button
                    type="button"
                    data-cursor="TEST CHAT"
                    onClick={() => {
                      setActiveChatScenario('nudge');
                      soundFx.playBlip(620, 0.04, 'sine', 0.04);
                    }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                      activeChatScenario === 'nudge'
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 ring-1 ring-emerald-400'
                        : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    Streak Inactivity Nudge
                  </button>
                </div>
              </div>
            </div>

            {/* Chat Simulation Card with 3D Depth Tilt */}
            <TiltCard
              maxTilt={6}
              glareColor="rgba(16, 185, 129, 0.15)"
              className="rounded-3xl border border-surface-subtle bg-surface-card/95 backdrop-blur-xl p-6 sm:p-7 shadow-2xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] shadow-emerald-950/20 space-y-4"
            >
              <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                <div className="relative">
                  <div className="flex size-10 items-center justify-center rounded-full bg-[#128C7E] text-white font-bold text-sm shadow-md shadow-emerald-950/40">
                    PH
                  </div>
                  <span className="absolute bottom-0 right-0 size-3 rounded-full bg-emerald-400 ring-2 ring-[#030712]" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-white">ProCut Hub Mentor Desk</h3>
                  <p className="text-[10px] text-emerald-400 font-bold">Online • Mentor Response Target &lt;15 mins</p>
                </div>
              </div>

              <div className="space-y-3 text-xs min-h-[220px] flex flex-col justify-center">
                {activeChatScenario === 'video' ? (
                  <>
                    <div className="rounded-xl rounded-tl-none bg-white/[0.06] p-3.5 max-w-[85%] text-slate-200 border border-white/10 shadow-sm backdrop-blur-sm">
                      <p className="font-bold text-[10px] text-slate-400 mb-1">9:00 AM • Challenge Drop</p>
                      🚀 <strong>Day 06 is LIVE:</strong> Color Grading Primaries &amp; Skin Tones in Resolve. Starter 4K Sony RAW clip is in your portal!
                    </div>
                    <div className="ml-auto rounded-xl rounded-tr-none bg-gradient-to-r from-orange-500 to-amber-600 text-white p-3.5 max-w-[85%] shadow-md shadow-orange-500/20">
                      Hey mentor! My skin tones look a bit magenta under studio lights. What node should I adjust first?
                    </div>
                    <div className="rounded-xl rounded-tl-none bg-white/[0.06] p-3.5 max-w-[85%] text-slate-200 border border-white/10 shadow-sm backdrop-blur-sm">
                      <p className="font-bold text-[10px] text-emerald-400 mb-1">9:12 AM • Mentor Voice Note (0:24)</p>
                      &quot;Check your vector scope skin line. Drop node 2 hue-vs-hue slightly toward yellow (+4 degrees) and balance the offset wheel. You&apos;re super close!&quot;
                    </div>
                  </>
                ) : activeChatScenario === 'code' ? (
                  <>
                    <div className="rounded-xl rounded-tl-none bg-white/[0.06] p-3.5 max-w-[85%] text-slate-200 border border-white/10 shadow-sm backdrop-blur-sm">
                      <p className="font-bold text-[10px] text-slate-400 mb-1">9:00 AM • Challenge Drop</p>
                      ⚡ <strong>Day 04 is LIVE:</strong> Supabase PostgreSQL Row Level Security (RLS) tables. Ensure public reads are blocked.
                    </div>
                    <div className="ml-auto rounded-xl rounded-tr-none bg-gradient-to-r from-orange-500 to-amber-600 text-white p-3.5 max-w-[85%] shadow-md shadow-orange-500/20">
                      Getting a 403 on my insert mutation even though the user is authenticated in the session.
                    </div>
                    <div className="rounded-xl rounded-tl-none bg-white/[0.06] p-3.5 max-w-[85%] text-slate-200 border border-white/10 shadow-sm backdrop-blur-sm">
                      <p className="font-bold text-[10px] text-emerald-400 mb-1">9:14 AM • Mentor Reply</p>
                      &quot;Check your WITH CHECK clause on the policy: ensure `auth.uid() = user_id`. If `user_id` is null on payload insert, Postgres drops the row!&quot;
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-xl rounded-tl-none bg-white/[0.06] p-3.5 max-w-[85%] text-slate-200 border border-white/10 shadow-sm backdrop-blur-sm">
                      <p className="font-bold text-[10px] text-amber-400 mb-1">8:30 PM • Automated Streak Shield</p>
                      ⚠️ <strong>Hey Alex!</strong> Your 6-Day Streak is at risk. Day 07 deadline is in 3.5 hours (11:59 PM). Need any blocker cleared before submitting?
                    </div>
                    <div className="ml-auto rounded-xl rounded-tr-none bg-gradient-to-r from-orange-500 to-amber-600 text-white p-3.5 max-w-[85%] shadow-md shadow-orange-500/20">
                      Thanks for the ping! Just finishing up the final audio export now. Submitting in 20 mins!
                    </div>
                    <div className="rounded-xl rounded-tl-none bg-white/[0.06] p-3.5 max-w-[85%] text-slate-200 border border-white/10 shadow-sm backdrop-blur-sm">
                      <p className="font-bold text-[10px] text-emerald-400 mb-1">8:52 PM • System Confirmation</p>
                      ✅ Submission received! Streak preserved: <strong>7 Days Strong 🔥</strong>.
                    </div>
                  </>
                )}
              </div>
            </TiltCard>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 7: PROOF-OF-WORK EVALUATION RUBRIC */}
      {/* ========================================================================= */}
      <section id="rubric" className="border-t border-white/10 bg-[#030712] py-20 lg:py-28 relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-5 lg:px-8 relative z-10">
          <div className="gsap-header-reveal text-center max-w-2xl mx-auto mb-16">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-400">
              Rigorous Evaluation Standards
            </p>
            <h2 className="mt-2 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
              How Your Work is Monitored &amp; Scored
            </h2>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed">
              We don&apos;t do pass/fail quizzes. Every submission is evaluated against our 5-pillar industry rubric by human mentors.
            </p>
          </div>

          <div className="gsap-cards-group grid grid-cols-1 md:grid-cols-5 gap-4">
            <TiltCard className="p-6 border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] rounded-2xl space-y-3 hover:border-orange-500/40 transition">
              <span className="text-3xl font-black bg-gradient-to-r from-orange-400 to-amber-500 bg-clip-text text-transparent">01</span>
              <h4 className="text-xs font-black text-white">Technical Execution</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Does the code work without runtime bugs? Are video cuts placed on exact musical beats and retention cues?
              </p>
            </TiltCard>

            <TiltCard className="p-6 border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] rounded-2xl space-y-3 hover:border-orange-500/40 transition">
              <span className="text-3xl font-black bg-gradient-to-r from-orange-400 to-amber-500 bg-clip-text text-transparent">02</span>
              <h4 className="text-xs font-black text-white">Cleanliness &amp; Polish</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Zero lint errors, modular React components, and mastered audio submix without clipped waveforms.
              </p>
            </TiltCard>

            <TiltCard className="p-6 border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] rounded-2xl space-y-3 hover:border-orange-500/40 transition">
              <span className="text-3xl font-black bg-gradient-to-r from-orange-400 to-amber-500 bg-clip-text text-transparent">03</span>
              <h4 className="text-xs font-black text-white">Timeliness Discipline</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Submitted before 11:59 PM deadline. Builds the muscle memory required in real client agencies.
              </p>
            </TiltCard>

            <TiltCard className="p-6 border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] rounded-2xl space-y-3 hover:border-orange-500/40 transition">
              <span className="text-3xl font-black bg-gradient-to-r from-orange-400 to-amber-500 bg-clip-text text-transparent">04</span>
              <h4 className="text-xs font-black text-white">Commercial Viability</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Would a paying client accept this deliverable? Does it solve the real business goal of the brief?
              </p>
            </TiltCard>

            <TiltCard className="p-6 border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] rounded-2xl space-y-3 hover:border-orange-500/40 transition">
              <span className="text-3xl font-black bg-gradient-to-r from-orange-400 to-amber-500 bg-clip-text text-transparent">05</span>
              <h4 className="text-xs font-black text-white">Documentation &amp; Loom</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Clear GitHub PR description or short Loom video walk-through explaining technical tradeoffs.
              </p>
            </TiltCard>
          </div>
        </div>
      </section>
    </>
  );
}

